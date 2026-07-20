-- New tables and RLS policies for Security Management and Maintenance Payment Flow
-- File: supabase/migrations/002_security_and_payments.sql

-- ---------------------------------------------------------------------------
-- Notices Alterations
-- ---------------------------------------------------------------------------
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

-- ---------------------------------------------------------------------------
-- Flats Policy Addition (allow security to select)
-- ---------------------------------------------------------------------------
CREATE POLICY "Security read society flats"
  ON public.flats FOR SELECT
  USING (
    public.get_user_role() = 'security'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Security read society profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_user_role() = 'security'
    AND society_id = public.get_user_society_id()
  );

-- ---------------------------------------------------------------------------
-- 1. Visitors Log Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('Guest', 'Delivery', 'Cab', 'Service')),
  vehicle_number TEXT,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time TIMESTAMPTZ,
  photo_url TEXT,
  logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'inside' CHECK (status IN ('inside', 'exited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own flat visitors"
  ON public.visitors FOR SELECT
  USING (public.user_owns_flat(flat_id));

CREATE POLICY "Security read society visitors"
  ON public.visitors FOR SELECT
  USING (
    public.get_user_role() = 'security'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Admins read society visitors"
  ON public.visitors FOR SELECT
  USING (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Security manage society visitors"
  ON public.visitors FOR ALL
  USING (
    public.get_user_role() = 'security'
    AND society_id = public.get_user_society_id()
  )
  WITH CHECK (
    public.get_user_role() = 'security'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Admins manage society visitors"
  ON public.visitors FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

-- ---------------------------------------------------------------------------
-- 2. Pre-Approved Visitors Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approved_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  photo_url TEXT,
  relation TEXT NOT NULL CHECK (relation IN ('family', 'friend', 'maid', 'driver')),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approved_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own flat approved_visitors"
  ON public.approved_visitors FOR ALL
  USING (EXISTS (SELECT 1 FROM public.flats f WHERE f.id = approved_visitors.flat_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flats f WHERE f.id = approved_visitors.flat_id AND f.owner_id = auth.uid()));

CREATE POLICY "Security read society approved_visitors"
  ON public.approved_visitors FOR SELECT
  USING (
    public.get_user_role() = 'security'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = approved_visitors.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  );

CREATE POLICY "Admins manage society approved_visitors"
  ON public.approved_visitors FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = approved_visitors.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Daily Help Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_help (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL, -- Maid, Driver, Cook, Watchman, etc.
  working_days TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_help ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own flat daily_help"
  ON public.daily_help FOR ALL
  USING (EXISTS (SELECT 1 FROM public.flats f WHERE f.id = daily_help.flat_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.flats f WHERE f.id = daily_help.flat_id AND f.owner_id = auth.uid()));

CREATE POLICY "Security read society daily_help"
  ON public.daily_help FOR SELECT
  USING (
    public.get_user_role() = 'security'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = daily_help.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  );

CREATE POLICY "Admins manage society daily_help"
  ON public.daily_help FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = daily_help.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Daily Help Attendance Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.help_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  help_id UUID NOT NULL REFERENCES public.daily_help(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  out_time TIMESTAMPTZ,
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.help_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own help_attendance"
  ON public.help_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_help dh
      JOIN public.flats f ON f.id = dh.flat_id
      WHERE dh.id = help_attendance.help_id
      AND f.owner_id = auth.uid()
    )
  );

CREATE POLICY "Security manage society help_attendance"
  ON public.help_attendance FOR ALL
  USING (
    public.get_user_role() = 'security'
    AND EXISTS (
      SELECT 1 FROM public.daily_help dh
      JOIN public.flats f ON f.id = dh.flat_id
      WHERE dh.id = help_attendance.help_id
      AND f.society_id = public.get_user_society_id()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'security'
    AND EXISTS (
      SELECT 1 FROM public.daily_help dh
      JOIN public.flats f ON f.id = dh.flat_id
      WHERE dh.id = help_attendance.help_id
      AND f.society_id = public.get_user_society_id()
    )
  );

CREATE POLICY "Admins manage society help_attendance"
  ON public.help_attendance FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.daily_help dh
      JOIN public.flats f ON f.id = dh.flat_id
      WHERE dh.id = help_attendance.help_id
      AND f.society_id = public.get_user_society_id()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.daily_help dh
      JOIN public.flats f ON f.id = dh.flat_id
      WHERE dh.id = help_attendance.help_id
      AND f.society_id = public.get_user_society_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Delivery Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  courier_name TEXT NOT NULL CHECK (courier_name IN ('Amazon', 'Swiggy', 'Zomato', 'Dunzo', 'Other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collected')),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own flat deliveries"
  ON public.deliveries FOR ALL
  USING (public.user_owns_flat(flat_id))
  WITH CHECK (public.user_owns_flat(flat_id));

CREATE POLICY "Security manage society deliveries"
  ON public.deliveries FOR ALL
  USING (
    public.get_user_role() = 'security'
    AND society_id = public.get_user_society_id()
  )
  WITH CHECK (
    public.get_user_role() = 'security'
    AND society_id = public.get_user_society_id()
  );

CREATE POLICY "Admins manage society deliveries"
  ON public.deliveries FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND society_id = public.get_user_society_id()
  );

-- ---------------------------------------------------------------------------
-- 6. Gate Passes Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  otp_code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own flat gate_passes"
  ON public.gate_passes FOR ALL
  USING (public.user_owns_flat(flat_id))
  WITH CHECK (public.user_owns_flat(flat_id));

CREATE POLICY "Security manage society gate_passes"
  ON public.gate_passes FOR ALL
  USING (
    public.get_user_role() = 'security'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = gate_passes.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'security'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = gate_passes.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  );

CREATE POLICY "Admins manage society gate_passes"
  ON public.gate_passes FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = gate_passes.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = gate_passes.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 7. SOS Alerts Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own flat sos_alerts"
  ON public.sos_alerts FOR ALL
  USING (public.user_owns_flat(flat_id))
  WITH CHECK (public.user_owns_flat(flat_id));

CREATE POLICY "Security manage society sos_alerts"
  ON public.sos_alerts FOR ALL
  USING (
    public.get_user_role() = 'security'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = sos_alerts.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'security'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = sos_alerts.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  );

CREATE POLICY "Admins manage society sos_alerts"
  ON public.sos_alerts FOR ALL
  USING (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = sos_alerts.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  )
  WITH CHECK (
    public.get_user_role() = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM public.flats f
      WHERE f.id = sos_alerts.flat_id
      AND f.society_id = public.get_user_society_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Storage Buckets & Policies for Photos
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('visitor-photos', 'visitor-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone read visitor photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'visitor-photos');

CREATE POLICY "Authenticated users upload visitor photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'visitor-photos');
