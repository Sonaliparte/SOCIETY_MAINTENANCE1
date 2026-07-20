import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { downloadReceipt } from '../services/dataService';
import { CheckCircle2, Download, Home, Loader2, ArrowRight } from 'lucide-react';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = searchParams.get('session_id');
  const billIdsParam = searchParams.get('bill_ids');

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null); // stores payment id being downloaded

  useEffect(() => {
    const fetchPayments = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('payments')
          .select(`
            *,
            bill:bills(billing_month),
            flat:flats(wing, flat_number, society:societies(name))
          `)
          .eq('transaction_id', sessionId)
          .eq('status', 'success');

        if (error) throw error;
        setPayments(data || []);
      } catch (err) {
        console.error('Error fetching success payments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, [sessionId]);

  const handleDownloadReceipt = async (payment) => {
    setDownloading(payment.id);
    try {
      const blob = await downloadReceipt({ receiptUrl: payment.receipt_url });
      const fileURL = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `Receipt_${payment.bill?.billing_month || 'Maintenance'}_Flat_${payment.flat?.wing}-${payment.flat?.flat_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Receipt download failed:', err);
      alert('Failed to download receipt PDF.');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    for (const payment of payments) {
      await handleDownloadReceipt(payment);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
          <span className="text-slate-500 font-medium text-sm">Settling invoice logs...</span>
        </div>
      </div>
    );
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const flatInfo = payments[0]?.flat;
  const societyName = flatInfo?.society?.name || "Society Manager";
  const monthsPaid = payments.map(p => p.bill?.billing_month).filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-premium p-8 text-center space-y-6">
        
        {/* Animated Green Circle */}
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 border border-emerald-100">
          <CheckCircle2 className="h-12 w-12 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Payment Successful!</h1>
          <p className="text-sm text-slate-400">Your maintenance fees have been settled successfully.</p>
        </div>

        {/* Transaction Summary Card */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/50 text-left space-y-3.5">
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Society</span>
            <span className="text-xs font-bold text-slate-700">{societyName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Flat Unit</span>
            <span className="text-xs font-semibold text-slate-700">Flat {flatInfo ? `${flatInfo.wing} - ${flatInfo.flat_number}` : 'Unassigned'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Months Paid</span>
            <span className="text-xs font-semibold text-slate-700">{monthsPaid || 'Advance Payment'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payment Mode</span>
            <span className="text-xs font-mono font-semibold text-slate-700 capitalize">{payments[0]?.payment_mode || 'Online'}</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-200/60 pt-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Paid</span>
            <span className="text-base font-extrabold text-sky-600">₹ {totalPaid.toFixed(2)}</span>
          </div>
        </div>

        {/* Receipt Lists */}
        {payments.length > 0 && (
          <div className="space-y-2.5 text-left">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Generated Receipts</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {payments.map(pay => (
                <div key={pay.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                  <div className="text-xs font-semibold text-slate-700">{pay.bill?.billing_month || 'Maintenance'}</div>
                  <button
                    type="button"
                    onClick={() => handleDownloadReceipt(pay)}
                    disabled={downloading === pay.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-100/50 text-[10px] font-bold text-sky-600 transition-colors"
                  >
                    {downloading === pay.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    <span>Download PDF</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto Email Note */}
        <p className="text-[11px] text-slate-400/80 bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-100/50">
          Receipts have been emailed to your registered address automatically.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {payments.length > 1 && (
            <button
              onClick={handleDownloadAll}
              className="flex-1 rounded-xl border border-sky-100 hover:border-sky-200 bg-sky-50/50 hover:bg-sky-50 text-sky-600 font-semibold text-xs py-3.5 flex items-center justify-center gap-1.5 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Download All</span>
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3.5 flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-[0.98]"
          >
            <Home className="h-4 w-4" />
            <span>Go to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
