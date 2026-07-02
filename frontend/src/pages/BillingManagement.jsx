import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocieties, getBills, generateBills } from '../services/dataService';
import { Calendar, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';

const BillingManagement = () => {
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const [billingMonth, setBillingMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  useEffect(() => {
    const fetchSocieties = async () => {
      try {
        const data = await getSocieties();
        setSocieties(data);
        setSelectedSocietyId(data[0]?.id || user?.societyId || '');
      } catch (err) {
        console.error('Error fetching societies:', err);
      }
    };
    fetchSocieties();
  }, [user?.societyId]);

  const fetchBills = async () => {
    if (!selectedSocietyId) return;
    setLoading(true);
    try {
      const data = await getBills({ societyId: selectedSocietyId, status: statusFilter || undefined });
      setBills(data);
    } catch (err) {
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [selectedSocietyId, statusFilter]);

  const handleGenerateBills = async (e) => {
    e.preventDefault();
    if (!billingMonth || !dueDate) {
      alert('Billing month and due date are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await generateBills(selectedSocietyId, billingMonth, dueDate);
      alert(`Bills generated! Created ${res.generated} invoices. (Skipped ${res.skipped} duplicates)`);
      setShowGenerateModal(false);
      setBillingMonth('');
      setDueDate('');
      fetchBills();
    } catch (err) {
      alert(err.message || 'Failed to generate bills.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Billing & Invoicing</h1>
          <p className="text-slate-500 text-sm">Issue monthly maintenance bills and check current payment status.</p>
        </div>
        <button onClick={() => setShowGenerateModal(true)} className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm px-4 py-2.5 shadow flex items-center gap-1.5 self-start sm:self-auto">
          <Calendar className="h-4.5 w-4.5" />
          Generate Monthly Bills
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {societies.length > 0 && (
          <select value={selectedSocietyId} onChange={(e) => setSelectedSocietyId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {societies.map((soc) => <option key={soc.id} value={soc.id}>{soc.name}</option>)}
          </select>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">All Invoices</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <button onClick={fetchBills} className="w-fit inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">
          <RefreshCw className="h-4 w-4" />
          Reload
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 border-3 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 bg-white shadow-premium overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                <th className="p-4">Billing Month</th>
                <th className="p-4">Flat / Resident</th>
                <th className="p-4">Base Amount</th>
                <th className="p-4">Late Penalty</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
              {bills.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">No invoices found.</td></tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-slate-800">{bill.billingMonth}</td>
                    <td className="p-4">
                      {bill.Flat ? (
                        <>
                          <div className="font-semibold">Flat {bill.Flat.wing} - {bill.Flat.flatNumber}</div>
                          <div className="text-xs text-slate-400">{bill.Flat.owner?.name || 'Vacant'}</div>
                        </>
                      ) : 'N/A'}
                    </td>
                    <td className="p-4 font-semibold">₹ {bill.amount}</td>
                    <td className="p-4 font-bold text-red-600">{bill.penalty > 0 ? `₹ ${bill.penalty}` : '—'}</td>
                    <td className="p-4 text-xs">{new Date(bill.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                        bill.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        bill.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {bill.status === 'paid' && <CheckCircle className="h-3 w-3" />}
                        {bill.status === 'overdue' && <AlertTriangle className="h-3 w-3" />}
                        {bill.status === 'pending' && <Clock className="h-3 w-3" />}
                        <span className="capitalize">{bill.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Trigger Billing Cycle</h3>
            <form onSubmit={handleGenerateBills} className="space-y-4">
              <input type="month" required value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm" />
              <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm" />
              <div className="p-3 border border-amber-100 bg-amber-50/50 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <p className="text-[11px] text-amber-700">Creates invoices for all units. Duplicates are skipped automatically.</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowGenerateModal(false)} className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-sky-600 text-white font-semibold text-xs py-2 px-4">{submitting ? 'Generating...' : 'Start Billing Run'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingManagement;
