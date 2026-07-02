import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocieties, getFinancialReport, getComplaints, createNotice } from '../services/dataService';
import {
  IndianRupee,
  TrendingDown,
  Wallet,
  BellRing,
  AlertTriangle,
  CheckCircle,
  Plus,
  Receipt,
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [societies, setSocieties] = useState([]);
  const [selectedSocietyId, setSelectedSocietyId] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remindingId, setRemindingId] = useState(null);

  useEffect(() => {
    const fetchSocieties = async () => {
      try {
        const data = await getSocieties();
        setSocieties(data);
        if (data.length > 0) {
          setSelectedSocietyId(data[0].id);
        } else if (user?.societyId) {
          setSelectedSocietyId(user.societyId);
        }
      } catch (err) {
        console.error('Error fetching societies:', err);
      }
    };
    fetchSocieties();
  }, [user?.societyId]);

  useEffect(() => {
    if (!selectedSocietyId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [reportData, complaintsData] = await Promise.all([
          getFinancialReport(selectedSocietyId),
          getComplaints(),
        ]);
        setReport(reportData);
        setComplaints(complaintsData.slice(0, 5));
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedSocietyId]);

  const handleSendReminder = async (defaulter) => {
    setRemindingId(defaulter.flatId);
    try {
      const mockMsg = `Dear ${defaulter.ownerName}, you have outstanding maintenance dues of Rs. ${Number(defaulter.outstandingBalance).toFixed(2)} for Flat ${defaulter.wing}-${defaulter.flatNumber}. Please settle them at the earliest.`;

      await createNotice({
        societyId: selectedSocietyId,
        title: `Reminder: Maintenance Overdue - Flat ${defaulter.flatNumber}`,
        content: mockMsg,
      });

      alert(`Reminder notice posted for ${defaulter.ownerName}!`);
    } catch (err) {
      console.error('Error sending reminder:', err);
      alert('Failed to dispatch reminder.');
    } finally {
      setRemindingId(null);
    }
  };

  if (loading && societies.length === 0 && !user?.societyId) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  const summary = report?.summary || { totalCollected: 0, totalSpent: 0, balance: 0, outstandingAmount: 0, flatCount: 0 };
  const breakdown = report?.expenseBreakdown || { utility: 0, security: 0, maintenance: 0, repairs: 0, gardening: 0, other: 0 };
  const defaulters = report?.defaulters || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Society Operations</h1>
          <p className="text-slate-500 text-sm">Review monthly balance ledger, expenses, and unpaid logs.</p>
        </div>

        {societies.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Society:</span>
            <select
              value={selectedSocietyId}
              onChange={(e) => setSelectedSocietyId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {societies.map((soc) => (
                <option key={soc.id} value={soc.id}>{soc.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 border-3 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-premium flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <IndianRupee className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Collected Fees</span>
                <span className="block text-xl font-bold font-sans text-slate-800 mt-0.5">₹ {Number(summary.totalCollected).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-premium flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <TrendingDown className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses</span>
                <span className="block text-xl font-bold font-sans text-slate-800 mt-0.5">₹ {Number(summary.totalSpent).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-premium flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Society Balance</span>
                <span className="block text-xl font-bold font-sans text-slate-800 mt-0.5">₹ {Number(summary.balance).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-premium flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Dues</span>
                <span className="block text-xl font-bold font-sans text-slate-800 mt-0.5">₹ {Number(summary.outstandingAmount).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border border-slate-100 bg-white p-6 shadow-premium space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-sans text-slate-800">Defaulters List</h3>
                  <p className="text-xs text-slate-400">Residents with overdue maintenance payments</p>
                </div>
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {defaulters.length} Overdue Flats
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase">
                      <th className="pb-3">Flat / Owner</th>
                      <th className="pb-3">Base Maintenance</th>
                      <th className="pb-3">Pending Months</th>
                      <th className="pb-3">Total Arrears</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                    {defaulters.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-6 text-center text-slate-400 font-medium">
                          <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                          Zero outstanding dues! Society is fully paid.
                        </td>
                      </tr>
                    ) : (
                      defaulters.map((def) => (
                        <tr key={def.flatId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5">
                            <div className="font-semibold text-slate-800">{def.wing} - {def.flatNumber}</div>
                            <div className="text-xs text-slate-400">{def.ownerName}</div>
                          </td>
                          <td className="py-3.5">₹ {def.maintenanceAmount}</td>
                          <td className="py-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {(def.pendingMonths || []).map((m) => (
                                <span key={m.billingMonth} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  {m.billingMonth}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 font-bold text-red-600">₹ {def.outstandingBalance}</td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => handleSendReminder(def)}
                              disabled={remindingId === def.flatId}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md px-2 py-1 transition-all"
                            >
                              <BellRing className="h-3 w-3" />
                              {remindingId === def.flatId ? 'Sending...' : 'Remind'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-premium space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold font-sans text-slate-800">Expense Breakdown</h3>
                <p className="text-xs text-slate-400">Allocation of society funds by categories</p>
              </div>

              {summary.totalSpent === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No expenses logged this month yet.</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(breakdown).map(([category, amount]) => {
                    const numAmount = Number(amount);
                    const percentage = summary.totalSpent > 0 ? (numAmount / summary.totalSpent) * 100 : 0;
                    if (numAmount === 0) return null;
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="capitalize text-slate-600">{category}</span>
                          <span className="text-slate-800">₹ {numAmount.toLocaleString('en-IN')} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${percentage}%` }}
                            className={`h-full rounded-full ${
                              category === 'utility' ? 'bg-sky-500' :
                              category === 'security' ? 'bg-amber-500' :
                              category === 'maintenance' ? 'bg-indigo-500' :
                              category === 'repairs' ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 border-t border-slate-100 pt-4 flex gap-2">
                <a href="/billing" className="flex-1 py-2 text-center text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center justify-center gap-1">
                  <Receipt className="h-3.5 w-3.5" />
                  Issue Bills
                </a>
                <a href="/expenses" className="flex-1 py-2 text-center text-xs font-semibold rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add Cost
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-premium space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-sans text-slate-800">Latest Helpdesk Requests</h3>
                <p className="text-xs text-slate-400">Recent complaints lodged by residents</p>
              </div>
              <a href="/complaints" className="text-xs font-semibold text-sky-600 hover:underline">View All</a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase">
                    <th className="pb-3">Ticket</th>
                    <th className="pb-3">Flat</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                  {complaints.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-4 text-center text-slate-400">No active complaints found.</td>
                    </tr>
                  ) : (
                    complaints.map((comp) => (
                      <tr key={comp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3">
                          <span className="font-semibold text-slate-800">{comp.title}</span>
                          <span className="block text-xs text-slate-400 truncate max-w-[200px]">{comp.description}</span>
                        </td>
                        <td className="py-3">{comp.Flat ? `${comp.Flat.wing}-${comp.Flat.flatNumber}` : 'N/A'}</td>
                        <td className="py-3 capitalize">{comp.category}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            comp.status === 'pending' ? 'bg-red-50 text-red-700 border border-red-200' :
                            comp.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {comp.status === 'in_progress' ? 'In Progress' : comp.status}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-slate-400">
                          {new Date(comp.createdAt).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
