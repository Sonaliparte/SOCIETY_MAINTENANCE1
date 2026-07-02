import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyPayment } from '../services/dataService';
import { ShieldCheck, CreditCard, Building2, CheckCircle, ArrowRight } from 'lucide-react';

const MockCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const billId = searchParams.get('bill_id');
  const amount = searchParams.get('amount');

  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId || !billId) {
      setError('Invalid checkout session query parameters.');
    }
  }, [sessionId, billId]);

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await verifyPayment(sessionId, billId, 'card');
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Payment authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  if (error && !sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 text-center">
        <div className="max-w-sm rounded-xl bg-slate-800 p-6 border border-slate-700 text-red-400">
          <span className="text-lg font-bold block mb-2">Checkout Error</span>
          <p className="text-sm text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="z-10 w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-sky-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <span className="font-sans font-bold text-sm tracking-wide">Society Maintenance</span>
          </div>
          <span className="text-xs bg-sky-500 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Test Mode</span>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 mx-auto">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Payment Successful!</h2>
            <p className="text-slate-400 text-sm">Receipt generated and uploaded to Supabase Storage.</p>
            <button onClick={() => navigate('/')} className="w-full mt-4 rounded-lg bg-sky-600 hover:bg-sky-500 py-3 text-white text-sm font-semibold">
              Return to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleProcessPayment} className="p-6 space-y-5">
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="text-center p-4 border border-slate-800 bg-slate-950/40 rounded-xl">
              <span className="block text-xs font-semibold text-slate-500 uppercase">Amount Due</span>
              <span className="block text-3xl font-extrabold text-white mt-1">₹ {parseFloat(amount || 0).toFixed(2)}</span>
            </div>
            <input type="text" required placeholder="Cardholder Name" value={cardName} onChange={(e) => setCardName(e.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3.5 text-sm text-white" />
            <div className="relative">
              <CreditCard className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input type="text" disabled value="4242 •••• •••• 4242" className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 text-sm text-slate-400" />
            </div>
            <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[10px] uppercase font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Secure Payment Gateway</span>
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 py-3 font-semibold text-sm text-white flex items-center justify-center gap-1.5">
              {loading ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Pay ₹ {parseFloat(amount || 0).toFixed(2)} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default MockCheckout;
