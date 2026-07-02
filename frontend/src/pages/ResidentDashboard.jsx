import React, { useState, useEffect } from 'react';
import {
  getMyFlats,
  getBills,
  getPaymentHistory,
  getNotices,
  getComplaints,
  createPaymentOrder,
  downloadReceipt,
} from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  ArrowRight,
  Download,
  CheckCircle2,
  Megaphone,
  Wrench,
} from 'lucide-react';

const ResidentDashboard = () => {
  const { user } = useAuth();
  const [flat, setFlat] = useState(null);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notices, setNotices] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingBillId, setPayingBillId] = useState(null);

  useEffect(() => {
    const fetchResidentData = async () => {
      setLoading(true);
      try {
        const [flatData, pendingBills, overdueBills, paymentsData, noticesData, complaintsData] = await Promise.all([
          getMyFlats(),
          getBills({ status: 'pending' }),
          getBills({ status: 'overdue' }),
          getPaymentHistory(),
          getNotices(user?.societyId),
          getComplaints(),
        ]);

        if (flatData.length > 0) setFlat(flatData[0]);
        setBills([...overdueBills, ...pendingBills]);
        setPayments(paymentsData);
        setNotices((noticesData || []).slice(0, 3));
        setComplaints(complaintsData.slice(0, 4));
      } catch (err) {
        console.error('Error fetching resident dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchResidentData();
  }, [user]);

  const handlePayNow = async (bill) => {
    setPayingBillId(bill.id);
    try {
      const response = await createPaymentOrder(bill.id, 'card');
      window.location.href = response.url;
    } catch (err) {
      console.error('Checkout creation error:', err);
      alert(err.message || 'Failed to launch payment checkout.');
    } finally {
      setPayingBillId(null);
    }
  };

  const handleDownloadReceipt = async (payment) => {
    try {
      const blob = await downloadReceipt(payment);
      const fileURL = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `Receipt_${payment.transactionId.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Receipt download failed:', err);
      alert('Failed to download receipt PDF.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 border-4 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  const outstandingDues = bills.reduce((acc, curr) => acc + curr.amount + curr.penalty, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600">Unit Ownership</span>
          <h1 className="text-2xl font-bold font-sans text-slate-800 tracking-tight mt-0.5">
            Flat {flat ? `${flat.wing} - ${flat.flatNumber}` : 'Unassigned'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{flat?.Society?.name || 'No society linked'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-8 bg-white/60 backdrop-blur border border-sky-100/50 rounded-xl p-4 md:w-auto">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Unit Area</span>
            <span className="block text-sm font-semibold text-slate-700 mt-0.5">{flat?.areaSqFt || '—'} Sq. Ft.</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Base Rate</span>
            <span className="block text-sm font-semibold text-slate-700 mt-0.5">₹ {flat?.maintenanceAmount || '—'} / Mo</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-100 bg-white p-6 shadow-premium flex flex-col justify-between min-h-[300px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-sans text-slate-800">Pending Maintenance</h3>
                <p className="text-xs text-slate-400">Current and overdue society maintenance charges</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                outstandingDues > 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {outstandingDues > 0 ? `₹ ${outstandingDues} Pending` : 'All Paid'}
              </span>
            </div>

            {bills.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                <span className="font-semibold text-slate-800 text-sm">Great Job! No Pending Dues.</span>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                {bills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-slate-100 rounded-xl hover:border-slate-200 transition-all bg-slate-50/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-2 rounded-lg ${bill.status === 'overdue' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">Bill for {bill.billingMonth}</div>
                        <div className="text-xs text-slate-400">Due Date: {new Date(bill.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
                        {bill.penalty > 0 && (
                          <div className="text-[10px] text-red-500 font-bold mt-0.5">+ Late penalty fee of ₹ {bill.penalty} added</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 mt-3 sm:mt-0">
                      <span className="text-lg font-extrabold font-sans text-slate-800">₹ {bill.amount + bill.penalty}</span>
                      <button
                        onClick={() => handlePayNow(bill)}
                        disabled={payingBillId === bill.id}
                        className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-4 py-2 shadow flex items-center gap-1.5"
                      >
                        {payingBillId === bill.id ? (
                          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>Pay Now <ArrowRight className="h-3 w-3" /></>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-premium flex flex-col justify-between min-h-[300px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-sans text-slate-800">Announcements</h3>
                <p className="text-xs text-slate-400">Recent broadcasts from the society office</p>
              </div>
              <Megaphone className="h-5 w-5 text-sky-500 shrink-0" />
            </div>

            {notices.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No active announcements at the moment.</div>
            ) : (
              <div className="space-y-4">
                {notices.map((notice) => (
                  <div key={notice.id} className="space-y-1.5 border-l-2 border-sky-500 pl-3">
                    <span className="block text-[10px] font-bold text-slate-400">{new Date(notice.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                    <span className="block text-xs font-bold text-slate-800 truncate leading-tight">{notice.title}</span>
                    <span className="block text-xs text-slate-500 line-clamp-2 leading-relaxed">{notice.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <a href="/notices" className="block text-center text-xs font-semibold text-sky-600 hover:underline mt-4 pt-3 border-t border-slate-100">
            Open Notice Board
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-100 bg-white p-6 shadow-premium space-y-4">
          <div>
            <h3 className="text-base font-bold font-sans text-slate-800">Payments & Receipts History</h3>
            <p className="text-xs text-slate-400">Chronological history of settled maintenance charges</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase">
                  <th className="pb-3">Month</th>
                  <th className="pb-3">Reference ID</th>
                  <th className="pb-3">Paid Date</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-400">No payment history logged yet.</td>
                  </tr>
                ) : (
                  payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 font-semibold text-slate-800">{pay.Bill ? pay.Bill.billingMonth : 'Advance'}</td>
                      <td className="py-3 font-mono text-xs">{pay.transactionId.substring(0, 15)}...</td>
                      <td className="py-3 text-xs text-slate-400">{new Date(pay.paymentDate).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 font-bold text-slate-800">₹ {pay.amount}</td>
                      <td className="py-3 text-right">
                        {pay.receiptUrl && (
                          <button
                            onClick={() => handleDownloadReceipt(pay)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded transition-colors"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-premium flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-sans text-slate-800">Helpdesk Tickets</h3>
                <p className="text-xs text-slate-400">Status of filed maintenance requests</p>
              </div>
              <Wrench className="h-5 w-5 text-slate-400" />
            </div>

            {complaints.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No tickets submitted yet.</div>
            ) : (
              <div className="space-y-3">
                {complaints.map((comp) => (
                  <div key={comp.id} className="flex items-start justify-between p-2.5 border border-slate-100 rounded-lg bg-slate-50/20">
                    <div>
                      <span className="block text-xs font-semibold text-slate-800 leading-tight">{comp.title}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5 capitalize">{comp.category}</span>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      comp.status === 'pending' ? 'bg-red-50 text-red-700 border border-red-100' :
                      comp.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      {comp.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <a href="/complaints" className="block text-center text-xs font-semibold text-sky-600 hover:underline mt-4 pt-3 border-t border-slate-100">
            File New Complaint
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResidentDashboard;
