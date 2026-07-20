import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getBills, createPaymentOrder, verifyPayment } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, CreditCard, Building2, Smartphone, Landmark, ArrowRight, ChevronLeft, Loader2 } from 'lucide-react';

const PaymentCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const billIdsParam = searchParams.get('bill_ids');
  const billIds = billIdsParam ? billIdsParam.split(',') : [];

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [paymentMode, setPaymentMode] = useState('upi'); // upi, card, netbanking
  
  // UPI states
  const [upiApp, setUpiApp] = useState('gpay'); // gpay, phonepe, paytm, other
  const [upiId, setUpiId] = useState('');

  // Card states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Netbanking states
  const [selectedBank, setSelectedBank] = useState('');

  useEffect(() => {
    const fetchBillsDetails = async () => {
      if (billIds.length === 0) {
        setError('No bills selected for checkout.');
        setLoading(false);
        return;
      }
      try {
        const fetchedBills = await getBills();
        const filtered = fetchedBills.filter(b => billIds.includes(b.id));
        setBills(filtered);
      } catch (err) {
        console.error('Error fetching checkout bills:', err);
        setError('Failed to load bill details.');
      } finally {
        setLoading(false);
      }
    };
    fetchBillsDetails();
  }, [billIdsParam]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
          <span className="text-slate-500 font-medium text-sm">Preparing secure gateway...</span>
        </div>
      </div>
    );
  }

  if (error || bills.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-100 p-6 shadow-premium text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Checkout Error</h2>
          <p className="text-slate-500 text-sm">{error || "Unable to retrieve payment information."}</p>
          <button onClick={() => navigate('/')} className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const baseAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const penaltyAmount = bills.reduce((sum, b) => sum + b.penalty, 0);
  const totalAmount = baseAmount + penaltyAmount;
  const flatInfo = bills[0]?.Flat;

  const handleConfirmAndPay = async (e) => {
    e.preventDefault();
    setPaying(true);
    setError('');

    try {
      // 1. Initialize order
      const order = await createPaymentOrder(billIds, paymentMode);
      
      // 2. Simulate network delay for verification
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. Verify payment using transaction ID
      const txId = order.sessionId || `mock_session_${Date.now()}`;
      await verifyPayment(txId, billIds, paymentMode);
      
      // 4. Navigate to success page
      navigate(`/payment/success?session_id=${txId}&bill_ids=${billIdsParam}`);
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment processing failed. Please try again.');
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="rounded-lg p-2 bg-white border border-slate-100 hover:bg-slate-50 text-slate-600 shadow-sm transition-colors">
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Pay Maintenance Dues</h1>
            <p className="text-slate-500 text-xs">Secure billing portal</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-premium overflow-hidden">
          {/* Banner Details */}
          <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-sky-400 font-extrabold uppercase tracking-widest">Selected Unit</span>
              <h2 className="text-lg font-bold">Flat {flatInfo ? `${flatInfo.wing} - ${flatInfo.flatNumber}` : 'Unassigned'}</h2>
              <p className="text-slate-400 text-xs">Dues for {bills.map(b => b.billingMonth).join(', ')}</p>
            </div>
            <div className="text-right">
              <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Total Amount</span>
              <span className="text-2xl font-extrabold text-white">₹ {totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Bill Summary Breakdown */}
            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100 space-y-2 text-sm">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-1">Fee Breakdown</h3>
              <div className="flex justify-between text-slate-600">
                <span>Base Maintenance</span>
                <span>₹ {baseAmount.toFixed(2)}</span>
              </div>
              {penaltyAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Overdue Penalty</span>
                  <span>+ ₹ {penaltyAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-200/80 my-2 pt-2 flex justify-between font-extrabold text-slate-800 text-base">
                <span>Total Payable</span>
                <span className="text-sky-600">₹ {totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            {/* Payment Tabs - Jio Style */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Select Payment Method</h3>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMode('upi')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${
                    paymentMode === 'upi'
                      ? 'border-sky-500 bg-sky-50/30 text-sky-600 shadow-sm'
                      : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50/50'
                  }`}
                >
                  <Smartphone className="h-5 w-5" />
                  <span>UPI Apps</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('card')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${
                    paymentMode === 'card'
                      ? 'border-sky-500 bg-sky-50/30 text-sky-600 shadow-sm'
                      : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50/50'
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('netbanking')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${
                    paymentMode === 'netbanking'
                      ? 'border-sky-500 bg-sky-50/30 text-sky-600 shadow-sm'
                      : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50/50'
                  }`}
                >
                  <Landmark className="h-5 w-5" />
                  <span>Net Banking</span>
                </button>
              </div>

              {/* Payment Details Form */}
              <form onSubmit={handleConfirmAndPay} className="mt-6 pt-4 border-t border-slate-100 space-y-4">
                
                {/* UPI Sub-option */}
                {paymentMode === 'upi' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                      {['gpay', 'phonepe', 'paytm', 'other'].map(app => (
                        <button
                          key={app}
                          type="button"
                          onClick={() => setUpiApp(app)}
                          className={`py-2 px-1 rounded-lg border text-[10px] font-bold uppercase transition-all ${
                            upiApp === app
                              ? 'border-sky-500 bg-sky-50/10 text-sky-600'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {app === 'gpay' ? 'GPay' : app === 'phonepe' ? 'PhonePe' : app === 'paytm' ? 'Paytm' : 'BHIM / UPI'}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Enter UPI ID</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. mobileNumber@ybl or username@okaxis"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-500"
                      />
                    </div>
                  </div>
                )}

                {/* Card Sub-option */}
                {paymentMode === 'card' && (
                  <div className="space-y-4.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Cardholder Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Name on card"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Card Number</label>
                      <input
                        type="text"
                        required
                        placeholder="XXXX XXXX XXXX XXXX"
                        value={cardNumber}
                        maxLength={19}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                          setCardNumber(val);
                        }}
                        className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</label>
                        <input
                          type="text"
                          required
                          placeholder="MM/YY"
                          value={cardExpiry}
                          maxLength={5}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').replace(/(\d{2})(\d{1,2})/, '$1/$2');
                            setCardExpiry(val);
                          }}
                          className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">CVV</label>
                        <input
                          type="password"
                          required
                          placeholder="•••"
                          maxLength={3}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                          className="w-full rounded-lg border border-slate-200 py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Netbanking Sub-option */}
                {paymentMode === 'netbanking' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { code: 'sbi', name: 'SBI' },
                        { code: 'hdfc', name: 'HDFC' },
                        { code: 'icici', name: 'ICICI' },
                        { code: 'axis', name: 'Axis' },
                        { code: 'kotak', name: 'Kotak' },
                        { code: 'pnb', name: 'PNB' }
                      ].map(bank => (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => setSelectedBank(bank.code)}
                          className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-all ${
                            selectedBank === bank.code
                              ? 'border-sky-500 bg-sky-50/10 text-sky-600'
                              : 'border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {bank.name}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Or Select Other Bank</label>
                      <select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-500"
                      >
                        <option value="">Choose Bank</option>
                        <option value="bob">Bank of Baroda</option>
                        <option value="canara">Canara Bank</option>
                        <option value="idbi">IDBI Bank</option>
                        <option value="yes">Yes Bank</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between gap-4 text-slate-400 text-[10px] uppercase font-extrabold border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Razorpay Secure Standard</span>
                  </div>
                  <span>Indian UPI & Card Support</span>
                </div>

                <button
                  type="submit"
                  disabled={paying}
                  className="w-full mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/10 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {paying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing transaction...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Pay ₹ {totalAmount.toFixed(2)}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCheckout;
