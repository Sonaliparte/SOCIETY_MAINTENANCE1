-- Society Maintenance Manager — Supabase schema
-- Run in Supabase SQL Editor or via: supabase db push

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  total_flats INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'resident'
    CHECK (role IN ('super_admin', 'resident', 'security')),
  society_id UUID REFERENCES public.societies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.flats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  wing TEXT NOT NULL,
  flat_number TEXT NOT NULL,
  flat_type TEXT NOT NULL DEFAULT '2BHK',
  area_sqft NUMERIC(10, 2) NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  maintenance_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (society_id, wing, flat_number)
);

CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  penalty NUMERIC(10, 2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flat_id, billing_month)
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_mode TEXT NOT NULL DEFAULT 'card',
  transaction_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  expense_date DATE NOT NULL,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  posted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER for RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_society_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT society_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_owns_flat(flat_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flats
    WHERE id = flat_uuid AND owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Auth trigger — auto-create profile on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'resident')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_email();

-- ---------------------------------------------------------------------------
-- Business logic RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_profile_by_email(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only admins can look up profiles';
  END IF;

  SELECT id, name, phone, role, email INTO v_profile
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'phone', v_profile.phone,
    'role', v_profile.role,
    'email', v_profile.email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_monthly_bills(
  p_society_id UUID,
  p_billing_month TEXT,
  p_due_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_society UUID;
  v_generated INTEGER := 0;
  v_skipped INTEGER := 0;
  v_flat RECORD;
BEGIN
  SELECT role, society_id INTO v_role, v_society
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'super_admin' OR v_society IS DISTINCT FROM p_society_id THEN
    RAISE EXCEPTION 'Only society admins can generate bills';
  END IF;

  FOR v_flat IN
    SELECT id, maintenance_amount FROM public.flats WHERE society_id = p_society_id
  LOOP
    BEGIN
      INSERT INTO public.bills (flat_id, billing_month, amount, due_date, status)
      VALUES (v_flat.id, p_billing_month, v_flat.maintenance_amount, p_due_date, 'pending');
      v_generated := v_generated + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN json_build_object('generated', v_generated, 'skipped', v_skipped);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_financial_report(p_society_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_society UUID;
  v_total_collected NUMERIC := 0;
  v_total_spent NUMERIC := 0;
  v_outstanding NUMERIC := 0;
  v_flat_count INTEGER := 0;
  v_breakdown JSON;
  v_defaulters JSON;
BEGIN
  SELECT role, society_id INTO v_role, v_society
  FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'resident' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_role = 'super_admin' AND v_society IS DISTINCT FROM p_society_id THEN
    RAISE EXCEPTION 'Access denied for this society';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO v_total_collected
  FROM public.payments p
  JOIN public.flats f ON f.id = p.flat_id
  WHERE f.society_id = p_society_id AND p.status = 'success';

  SELECT COALESCE(SUM(e.amount), 0) INTO v_total_spent
  FROM public.expenses e WHERE e.society_id = p_society_id;

  SELECT COALESCE(SUM(b.amount + b.penalty), 0) INTO v_outstanding
  FROM public.bills b
  JOIN public.flats f ON f.id = b.flat_id
  WHERE f.society_id = p_society_id AND b.status IN ('pending', 'overdue');

  SELECT COUNT(*) INTO v_flat_count FROM public.flats WHERE society_id = p_society_id;

  SELECT json_build_object(
    'utility', COALESCE(SUM(CASE WHEN category = 'utility' THEN amount ELSE 0 END), 0),
    'security', COALESCE(SUM(CASE WHEN category = 'security' THEN amount ELSE 0 END), 0),
    'maintenance', COALESCE(SUM(CASE WHEN category = 'maintenance' THEN amount ELSE 0 END), 0),
    'repairs', COALESCE(SUM(CASE WHEN category = 'repairs' THEN amount ELSE 0 END), 0),
    'gardening', COALESCE(SUM(CASE WHEN category = 'gardening' THEN amount ELSE 0 END), 0),
    'other', COALESCE(SUM(CASE WHEN category = 'other' THEN amount ELSE 0 END), 0)
  ) INTO v_breakdown
  FROM public.expenses WHERE society_id = p_society_id;

  SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) INTO v_defaulters
  FROM (
    SELECT
      f.id AS "flatId",
      f.wing,
      f.flat_number AS "flatNumber",
      f.maintenance_amount AS "maintenanceAmount",
      p.name AS "ownerName",
      au.email AS "ownerEmail",
      COALESCE(SUM(b.amount + b.penalty), 0) AS "outstandingBalance",
      COALESCE(json_agg(json_build_object('billingMonth', b.billing_month)) FILTER (WHERE b.id IS NOT NULL), '[]'::json) AS "pendingMonths"
    FROM public.flats f
    LEFT JOIN public.profiles p ON p.id = f.owner_id
    LEFT JOIN auth.users au ON au.id = p.id
    JOIN public.bills b ON b.flat_id = f.id AND b.status IN ('pending', 'overdue')
    WHERE f.society_id = p_society_id
    GROUP BY f.id, f.wing, f.flat_number, f.maintenance_amount, p.name, au.email
  ) d;

  RETURN json_build_object(
    'summary', json_build_object(
      'totalCollected', v_total_collected,
      'totalSpent', v_total_spent,
      'balance', v_total_collected - v_total_spent,
      'outstandingAmount', v_outstanding,
      'flatCount', v_flat_count
    ),
    'expenseBreakdown', v_breakdown,
    'defaulters', v_defaulters
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins read society profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins update society profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Admins link residents to society"
  ON public.profiles FOR UPDATE
  USING (
    public.get_user_role() = 'super_admin'
    AND role = 'resident'
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

-- societies
CREATE POLICY "Admins manage own society"
  ON public.societies FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND id = public.get_user_society_id()
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND id = public.get_user_society_id()
  );

CREATE POLICY "Admins create society on signup"
  ON public.societies FOR INSERT
  WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "Members read own society"
  ON public.societies FOR SELECT
  USING (id = public.get_user_society_id());

-- flats
CREATE POLICY "Admins manage society flats"
  ON public.flats FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Residents read own flats"
  ON public.flats FOR SELECT
  USING (owner_id = auth.uid());

-- bills
CREATE POLICY "Admins manage society bills"
  ON public.bills FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = bills.flat_id AND f.society_id = public.get_user_society_id()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = bills.flat_id AND f.society_id = public.get_user_society_id()
    )
  );

CREATE POLICY "Residents read own bills"
  ON public.bills FOR SELECT
  USING (public.user_owns_flat(flat_id));

-- payments
CREATE POLICY "Admins read society payments"
  ON public.payments FOR SELECT
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = payments.flat_id AND f.society_id = public.get_user_society_id()
    )
  );

CREATE POLICY "Residents read own payments"
  ON public.payments FOR SELECT
  USING (public.user_owns_flat(flat_id));

CREATE POLICY "Residents insert own payments"
  ON public.payments FOR INSERT
  WITH CHECK (public.user_owns_flat(flat_id));

CREATE POLICY "Admins update society payments"
  ON public.payments FOR UPDATE
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = payments.flat_id AND f.society_id = public.get_user_society_id()
    )
  );

-- expenses
CREATE POLICY "Admins manage society expenses"
  ON public.expenses FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

-- notices
CREATE POLICY "Admins manage society notices"
  ON public.notices FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Members read society notices"
  ON public.notices FOR SELECT
  USING (society_id = public.get_user_society_id());

-- complaints
CREATE POLICY "Residents manage own complaints"
  ON public.complaints FOR ALL
  USING (public.user_owns_flat(flat_id))
  WITH CHECK (public.user_owns_flat(flat_id));

CREATE POLICY "Admins manage society complaints"
  ON public.complaints FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = complaints.flat_id AND f.society_id = public.get_user_society_id()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = complaints.flat_id AND f.society_id = public.get_user_society_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-proofs', 'expense-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users read receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "Service role uploads receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Anyone read expense proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'expense-proofs');

CREATE POLICY "Admins upload expense proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expense-proofs'
    AND public.get_user_role() = 'super_admin'
  );
