import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocieties, getExpenses, createExpense } from '../services/dataService';
import { Plus, TrendingDown, FileText } from 'lucide-react';

const ExpenseTracker = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const [category, setCategory] = useState('utility');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

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

  const fetchExpenses = async () => {
    if (!selectedSocietyId) return;
    setLoading(true);
    try {
      const data = await getExpenses(selectedSocietyId);
      setExpenses(data);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedSocietyId]);

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createExpense({
        societyId: selectedSocietyId,
        category,
        description,
        amount: parseFloat(amount),
        expenseDate,
        proofFile,
      });
      alert('Expense logged successfully!');
      setShowAddModal(false);
      setCategory('utility');
      setDescription('');
      setAmount('');
      setExpenseDate('');
      setProofFile(null);
      fetchExpenses();
    } catch (err) {
      alert(err.message || 'Failed to register expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Expense Ledger</h1>
          <p className="text-slate-500 text-sm">Log building expenditures with optional proof uploads to Supabase Storage.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm px-4 py-2.5 shadow flex items-center gap-1.5 self-start sm:self-auto">
          <Plus className="h-4.5 w-4.5" />
          Log Society Expense
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        {societies.length > 0 && (
          <select value={selectedSocietyId} onChange={(e) => setSelectedSocietyId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            {societies.map((soc) => <option key={soc.id} value={soc.id}>{soc.name}</option>)}
          </select>
        )}
        <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-premium flex items-center gap-3.5 sm:col-span-2 max-w-sm ml-auto w-full">
          <div className="p-2 rounded bg-rose-50 text-rose-600"><TrendingDown className="h-5 w-5" /></div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Cumulative Expenditures</span>
            <span className="block text-lg font-extrabold text-slate-800">₹ {totalSpent.toLocaleString('en-IN')}</span>
          </div>
        </div>
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
                <th className="p-4">Expense Details</th>
                <th className="p-4">Category</th>
                <th className="p-4">Amount Spent</th>
                <th className="p-4">Paid Date</th>
                <th className="p-4 text-right">Invoice Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
              {expenses.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-400">No expenses logged yet.</td></tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-semibold text-slate-800">{exp.description}</td>
                    <td className="p-4 capitalize">{exp.category}</td>
                    <td className="p-4 font-bold text-rose-600">₹ {exp.amount}</td>
                    <td className="p-4 text-xs">{new Date(exp.expenseDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                    <td className="p-4 text-right">
                      {exp.proofUrl ? (
                        <a href={exp.proofUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-600 hover:underline inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          View Bill
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No receipt file</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Log Society Expense</h3>
            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm">
                <option value="utility">Utility</option>
                <option value="security">Security</option>
                <option value="maintenance">Maintenance</option>
                <option value="repairs">Repairs</option>
                <option value="gardening">Gardening</option>
                <option value="other">Other</option>
              </select>
              <input type="text" required placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" required placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm" />
                <input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm" />
              </div>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500" />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-slate-200 py-2 px-4 text-xs font-semibold text-slate-500">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-sky-600 text-white font-semibold text-xs py-2 px-4">{submitting ? 'Saving...' : 'Log Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;
