import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Societies
// ---------------------------------------------------------------------------
export async function getSocieties() {
  const { data, error } = await supabase
    .from('societies')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createSociety({ name, address }) {
  const { data, error } = await supabase
    .from('societies')
    .insert({ name, address, total_flats: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function linkProfileToSociety(societyId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ society_id: societyId })
    .eq('id', user.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Flats
// ---------------------------------------------------------------------------
export async function getFlats(societyId) {
  const { data, error } = await supabase
    .from('flats')
    .select(`
      *,
      owner:profiles!flats_owner_id_fkey(id, name, phone, email)
    `)
    .eq('society_id', societyId)
    .order('wing')
    .order('flat_number');
  if (error) throw error;

  return data.map((flat) => ({
    id: flat.id,
    wing: flat.wing,
    flatNumber: flat.flat_number,
    flatType: flat.flat_type,
    areaSqFt: flat.area_sqft,
    maintenanceAmount: flat.maintenance_amount,
    ownerId: flat.owner_id,
    owner: flat.owner
      ? { id: flat.owner.id, name: flat.owner.name, email: flat.owner.email, phone: flat.owner.phone }
      : null,
  }));
}

export async function getMyFlats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('flats')
    .select(`
      *,
      society:societies(id, name, address)
    `)
    .eq('owner_id', user.id);
  if (error) throw error;

  return data.map((flat) => ({
    ...flat,
    wing: flat.wing,
    flatNumber: flat.flat_number,
    areaSqFt: flat.area_sqft,
    maintenanceAmount: flat.maintenance_amount,
    Society: flat.society
      ? { id: flat.society.id, name: flat.society.name, address: flat.society.address }
      : null,
  }));
}

export async function createFlat({
  societyId,
  wing,
  flatNumber,
  flatType,
  areaSqFt,
  maintenanceAmount,
  ownerId,
}) {
  const amount = maintenanceAmount ?? Math.round(areaSqFt * 3.5);

  const { data, error } = await supabase
    .from('flats')
    .insert({
      society_id: societyId,
      wing,
      flat_number: flatNumber,
      flat_type: flatType,
      area_sqft: areaSqFt,
      maintenance_amount: amount,
      owner_id: ownerId || null,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('societies')
    .update({ total_flats: await countFlats(societyId) })
    .eq('id', societyId);

  return data;
}

async function countFlats(societyId) {
  const { count, error } = await supabase
    .from('flats')
    .select('*', { count: 'exact', head: true })
    .eq('society_id', societyId);
  if (error) throw error;
  return count ?? 0;
}

export async function lookupProfileByEmail(email) {
  const { data, error } = await supabase.rpc('lookup_profile_by_email', {
    p_email: email,
  });
  if (error) throw error;
  return data;
}

export async function assignFlatOwner(flatId, ownerId) {
  const { data: flat, error: flatError } = await supabase
    .from('flats')
    .select('society_id')
    .eq('id', flatId)
    .single();
  if (flatError) throw flatError;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ society_id: flat.society_id })
    .eq('id', ownerId);
  if (profileError) throw profileError;

  const { data, error } = await supabase
    .from('flats')
    .update({ owner_id: ownerId })
    .eq('id', flatId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function assignOwnerByEmail(flatId, email) {
  const profile = await lookupProfileByEmail(email);
  if (!profile) {
    throw new Error('No registered user found with that email. Ask the resident to sign up first.');
  }
  if (profile.role !== 'resident') {
    throw new Error('Only resident accounts can be assigned as flat owners.');
  }
  return assignFlatOwner(flatId, profile.id);
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------
export async function getBills({ societyId, status, flatId } = {}) {
  if (societyId) {
    const { data: societyFlats, error: flatError } = await supabase
      .from('flats')
      .select('id')
      .eq('society_id', societyId);
    if (flatError) throw flatError;

    const flatIds = (societyFlats || []).map((f) => f.id);
    if (flatIds.length === 0) return [];

    let query = supabase
      .from('bills')
      .select(`
        *,
        flat:flats(
          id, wing, flat_number, maintenance_amount, society_id,
          owner:profiles!flats_owner_id_fkey(id, name)
        )
      `)
      .in('flat_id', flatIds)
      .order('due_date', { ascending: false });

    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data.map(mapBill);
  }

  let query = supabase
    .from('bills')
    .select(`
      *,
      flat:flats(
        id, wing, flat_number, maintenance_amount,
        owner:profiles!flats_owner_id_fkey(id, name)
      )
    `)
    .order('due_date', { ascending: false });

  if (status) query = query.eq('status', status);
  if (flatId) query = query.eq('flat_id', flatId);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapBill);
}

function mapBill(bill) {
  return {
    id: bill.id,
    flatId: bill.flat_id,
    billingMonth: bill.billing_month,
    amount: Number(bill.amount),
    penalty: Number(bill.penalty),
    dueDate: bill.due_date,
    status: bill.status,
    createdAt: bill.created_at,
    Flat: bill.flat
      ? {
          id: bill.flat.id,
          wing: bill.flat.wing,
          flatNumber: bill.flat.flat_number,
          maintenanceAmount: bill.flat.maintenance_amount,
          owner: bill.flat.owner ? { name: bill.flat.owner.name } : null,
        }
      : null,
  };
}

export async function generateBills(societyId, billingMonth, dueDate) {
  const { data, error } = await supabase.rpc('generate_monthly_bills', {
    p_society_id: societyId,
    p_billing_month: billingMonth,
    p_due_date: dueDate,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export async function getPaymentHistory() {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      bill:bills(billing_month),
      flat:flats(wing, flat_number)
    `)
    .eq('status', 'success')
    .order('payment_date', { ascending: false });
  if (error) throw error;

  return data.map((pay) => ({
    id: pay.id,
    amount: Number(pay.amount),
    paymentDate: pay.payment_date,
    paymentMode: pay.payment_mode,
    transactionId: pay.transaction_id,
    status: pay.status,
    receiptUrl: pay.receipt_url,
    Bill: pay.bill ? { billingMonth: pay.bill.billing_month } : null,
  }));
}

export async function createPaymentOrder(billId, paymentMode = 'card') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ billId, paymentMode }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Payment order failed');
  return result;
}

export async function verifyPayment(sessionId, billId, paymentMode = 'card') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ sessionId, billId, paymentMode }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Payment verification failed');
  return result;
}

export async function downloadReceipt(payment) {
  if (!payment.receiptUrl) throw new Error('No receipt available');

  const { data, error } = await supabase.storage
    .from('receipts')
    .download(payment.receiptUrl.replace(/^receipts\//, ''));
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export async function getExpenses(societyId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('society_id', societyId)
    .order('expense_date', { ascending: false });
  if (error) throw error;

  return data.map((e) => ({
    id: e.id,
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    expenseDate: e.expense_date,
    proofUrl: e.proof_url,
  }));
}

export async function createExpense({ societyId, category, description, amount, expenseDate, proofFile }) {
  let proofUrl = null;

  if (proofFile) {
    const ext = proofFile.name.split('.').pop();
    const path = `${societyId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('expense-proofs')
      .upload(path, proofFile);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('expense-proofs').getPublicUrl(path);
    proofUrl = urlData.publicUrl;
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      society_id: societyId,
      category,
      description,
      amount,
      expense_date: expenseDate,
      proof_url: proofUrl,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFinancialReport(societyId) {
  const { data, error } = await supabase.rpc('get_financial_report', {
    p_society_id: societyId,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------
export async function getNotices(societyId) {
  let query = supabase
    .from('notices')
    .select(`
      *,
      poster:profiles!notices_posted_by_fkey(id, name)
    `)
    .order('created_at', { ascending: false });

  if (societyId) query = query.eq('society_id', societyId);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    createdAt: n.created_at,
    poster: n.poster ? { name: n.poster.name } : null,
  }));
}

export async function createNotice({ societyId, title, content }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notices')
    .insert({
      society_id: societyId,
      title,
      content,
      posted_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------
export async function getComplaints(status) {
  let query = supabase
    .from('complaints')
    .select(`
      *,
      flat:flats(
        id, wing, flat_number,
        owner:profiles!flats_owner_id_fkey(id, name)
      )
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    status: c.status,
    createdAt: c.created_at,
    Flat: c.flat
      ? {
          wing: c.flat.wing,
          flatNumber: c.flat.flat_number,
          owner: c.flat.owner ? { name: c.flat.owner.name } : null,
        }
      : null,
  }));
}

export async function createComplaint({ flatId, category, title, description }) {
  const { data, error } = await supabase
    .from('complaints')
    .insert({ flat_id: flatId, category, title, description })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateComplaintStatus(id, status) {
  const { data, error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
