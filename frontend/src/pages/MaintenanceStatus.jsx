import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Clock,
  Receipt,
  History,
  X,
  Loader2,
  Zap,
  CalendarDays,
  IndianRupee,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { getBills, getMyFlats, verifyPayment } from '../services/dataService';
import {
  CONFIG,
  calculatePenalty,
  isOverdue,
  generateReceipt,
  mockProcessPayment,
  storeReceiptLocally,
  storePaymentRecord,
} from '../services/mockPaymentService';
import { sendReceiptEmail } from '../services/emailService';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n) {
  return '₹ ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function monthLabel(isoYYYYMM) {
  // "2026-07" → "July 2026"
  const [y, m] = isoYYYYMM.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// ─── Scanning / payment modal ────────────────────────────────────────────────

function PaymentModal({ amount, months, onSuccess, onClose, payerName, payerEmail, unitLabel, baseAmount, penalty }) {
  const [stage, setStage] = useState('idle'); // idle | scanning | confirming | success
  const [percent, setPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Custom amount (defaults to total due)
  const [customAmountStr, setCustomAmountStr] = useState(amount.toString());

  const startPayment = useCallback(async () => {
    const paidAmount = Number(customAmountStr);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setStage('scanning');
    setErrorMsg('');
    try {
      const result = await mockProcessPayment(paidAmount, months, ({ stage: s, percent: p }) => {
        setStage(s);
        setPercent(p);
      });

      if (result.success) {
        // Generate receipt
        const receipt = generateReceipt({
          payerName,
          payerEmail,
          unitLabel,
          months,
          baseAmount,
          penalty,
          paidAmount: paidAmount, // Save actual amount paid
          paymentMethod: 'UPI / GPay',
        });

        // Persist
        storeReceiptLocally(receipt);
        storePaymentRecord({
          ...receipt,
          status: penalty > 0 && paidAmount >= amount ? 'late-paid' : 'paid',
        });

        // Mock email
        sendReceiptEmail(receipt).catch(console.error);

        setStage('success');
        setTimeout(() => onSuccess(receipt), 600);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMsg(err.message || 'Payment failed. Please try again.');
      setStage('idle');
    }
  }, [amount, customAmountStr, months, payerName, payerEmail, unitLabel, baseAmount, penalty, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-in">
        {/* Close (only when idle or error) */}
        {(stage === 'idle') && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Header stripe */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">
            UPI / GPay Payment
          </div>
          <div className="text-2xl font-black">
            {stage === 'idle' ? (
              <div className="flex items-center gap-1 border-b border-slate-600 pb-1 mt-1">
                <span className="text-xl">₹</span>
                <input 
                  type="number" 
                  value={customAmountStr}
                  onChange={(e) => setCustomAmountStr(e.target.value)}
                  className="bg-transparent border-none outline-none w-full text-2xl font-black text-white p-0 m-0 focus:ring-0 appearance-none"
                />
              </div>
            ) : (
              fmtCurrency(Number(customAmountStr) || 0)
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            {months.length === 1 ? months[0] : `${months.length} months`} · {unitLabel}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Breakdown */}
          {stage === 'idle' && (
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Base Maintenance</span>
                <span>{fmtCurrency(baseAmount)}</span>
              </div>
              {penalty > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Late Penalty
                  </span>
                  <span>+ {fmtCurrency(penalty)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-base">
                <span>Total Due</span>
                <span className="text-emerald-600">{fmtCurrency(amount)}</span>
              </div>
            </div>
          )}

          {/* Scanner animation */}
          {(stage === 'scanning' || stage === 'confirming') && (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* GPay QR visual */}
              <div className="relative h-32 w-32 bg-white rounded-xl shadow-sm border border-slate-200 p-2">
                <div className="absolute inset-2 grid grid-cols-5 grid-rows-5 gap-1 opacity-20">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="bg-slate-800 rounded-[2px]" />
                  ))}
                </div>
                {/* Scanning line overlay */}
                <div
                  className="absolute left-0 right-0 h-1 bg-emerald-500 shadow-[0_0_12px_3px_rgba(16,185,129,0.5)] rounded-full transition-all duration-300 z-10"
                  style={{ top: `${(percent / 100) * 94}%` }}
                />
                <div className="absolute inset-0 border-2 border-dashed border-emerald-500 rounded-xl animate-pulse-ring" />
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">
                  {stage === 'scanning' ? 'Scanning payment...' : 'Confirming transaction...'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Do not close this window</div>
              </div>
            </div>
          )}

          {/* Success flash */}
          {stage === 'success' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="h-16 w-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-800">Payment Successful!</div>
                <div className="text-xs text-slate-400 mt-0.5">Redirecting…</div>
              </div>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl p-3 font-medium">
              {errorMsg}
            </div>
          )}

          {/* CTA */}
          {stage === 'idle' && (
            <button
              onClick={startPayment}
              className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 active:scale-[0.98] transition-all"
            >
              <Zap className="h-4 w-4" />
              <span>Confirm & Pay {fmtCurrency(Number(customAmountStr) || 0)}</span>
            </button>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>256-bit secure · Mock Gateway</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Advance month grid ──────────────────────────────────────────────────────

function AdvanceMonthGrid({ flat, onPayAdvance }) {
  const [selected, setSelected] = useState([]);

  const today = new Date();
  const options = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + 1 + i, 1);
    return {
      value: d.toISOString().substring(0, 7),
      label: d.toLocaleDateString('en-IN', { month: 'long' }),
    };
  });

  const toggle = (v) =>
    setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const totalAmount = Number(flat?.maintenance_amount || 0) * selected.length;

  return (
    <div className="border-t border-slate-100 pt-5 space-y-4">
      <div>
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
          Pay Advance Maintenance
        </h4>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Select months below to make a single combined advance payment
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all select-none cursor-pointer ${
                isSelected
                  ? 'border-sky-500 bg-sky-50/40 text-sky-700 shadow-sm'
                  : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{opt.label}</span>
              <div
                className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'bg-sky-500 border-sky-500' : 'border-slate-300 bg-white'
                }`}
              >
                {isSelected && (
                  <svg viewBox="0 0 10 10" className="h-2 w-2 text-white fill-current">
                    <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between bg-sky-50/40 border border-sky-100 rounded-2xl p-4 gap-3">
          <div>
            <span className="text-[10px] font-extrabold text-sky-600 uppercase tracking-wider">
              Advance Summary
            </span>
            <span className="block text-sm font-extrabold text-slate-800 mt-0.5">
              {selected.length} month{selected.length !== 1 ? 's' : ''} · {fmtCurrency(totalAmount)}
            </span>
          </div>
          <button
            onClick={() => onPayAdvance(selected, totalAmount)}
            className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-3 shadow transition-all active:scale-[0.98]"
          >
            Pay Advance
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const MaintenanceStatus = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [flat, setFlat] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Payment modal state
  const [modal, setModal] = useState(null); // null | { amount, months, baseAmount, penalty, billIds }

  // Success toast
  const [successReceipt, setSuccessReceipt] = useState(null);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [flatsData, pendingBills, overdueBills] = await Promise.all([
          getMyFlats(),
          getBills({ status: 'pending' }),
          getBills({ status: 'overdue' }),
        ]);

        const activeFlat = flatsData[0] || null;
        setFlat(activeFlat);

        const allBills = [...overdueBills, ...pendingBills];
        
        // --- DEMO OVERRIDE: Mock a pending bill if none exist ---
        if (allBills.length === 0) {
          allBills.push({
            id: 'mock-bill-demo',
            billingMonth: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
            amount: 2500,
            penalty: 250,
            dueDate: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
            status: 'pending'
          });
        }
        // --------------------------------------------------------
        
        setBills(allBills);
      } catch (err) {
        console.error('MaintenanceStatus load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, refreshKey]);

  // ── Derived values ────────────────────────────────────────────────────────
  const currentBill = bills[0] || null;
  const billOverdue = currentBill ? isOverdue(currentBill.dueDate) : false;
  const penaltyAmount = currentBill ? calculatePenalty(currentBill.amount, currentBill.dueDate) : 0;
  const totalPayable = currentBill ? currentBill.amount + penaltyAmount : 0;
  const outstandingDues = bills.reduce((s, b) => s + b.amount + b.penalty, 0);
  const allSettled = !loading && outstandingDues === 0 && bills.length === 0;

  // Unit label helper
  const unitLabel = flat
    ? `${flat.wing} - ${flat.flat_number || flat.flatNumber}`
    : 'Unassigned';

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCurrentBillModal = () => {
    if (!currentBill) return;
    setModal({
      amount: totalPayable,
      months: [currentBill.billingMonth],
      baseAmount: currentBill.amount,
      penalty: penaltyAmount,
      billIds: [currentBill.id],
      isAdvance: false,
    });
  };

  const openAdvanceModal = (selectedMonths, totalAmount) => {
    const baseAmt = Number(flat?.maintenance_amount || 0) * selectedMonths.length;
    setModal({
      amount: totalAmount,
      months: selectedMonths.map(monthLabel),
      baseAmount: baseAmt,
      penalty: 0,
      billIds: [],
      isAdvance: true,
      advanceMonths: selectedMonths,
    });
  };

  const handlePaymentSuccess = async (receipt) => {
    setModal(null);
    setSuccessReceipt(receipt);

    // Attempt to verify with Supabase (best-effort)
    if (modal?.billIds?.length > 0) {
      try {
        await verifyPayment(receipt.transactionId, modal.billIds, 'mock');
      } catch (e) {
        console.warn('Supabase verify failed (localStorage still saved):', e.message);
      }
    }

    // Refresh bills
    setRefreshKey((k) => k + 1);
  };

  // ── Render: loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Success Toast */}
      {successReceipt && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm animate-slide-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-800">Payment Successful!</p>
            <p className="text-xs text-emerald-600 mt-0.5 truncate">
              TXN: {successReceipt.transactionId} · Receipt emailed (mock)
            </p>
          </div>
          <button
            onClick={() => setSuccessReceipt(null)}
            className="text-emerald-400 hover:text-emerald-600 p-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Main Maintenance Card ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Card header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Maintenance Status</h2>
            <p className="text-xs text-slate-400 mt-0.5">Track and recharge maintenance bills instantly</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
              allSettled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {allSettled ? 'All Settled' : `₹ ${outstandingDues.toLocaleString('en-IN')} Pending`}
          </span>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* ── All Settled State ── */}
          {allSettled ? (
            <div className="py-10 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-100/60 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
              <div className="h-16 w-16 rounded-full bg-white border-2 border-emerald-200 shadow-sm flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">All society maintenance bills paid!</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Thank you for helping keep operations running smoothly.
                </p>
              </div>
            </div>
          ) : (
            /* ── Pending Bill State ── */
            <div className="bg-gradient-to-br from-red-50/50 to-rose-50/30 border border-red-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider">
                    Maintenance Due
                  </span>
                  <h4 className="text-lg font-black text-slate-800 leading-tight">
                    Bill for {currentBill?.billingMonth}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    Due: {fmtDate(currentBill?.dueDate)}
                    {billOverdue && (
                      <span className="ml-1 inline-flex items-center gap-1 text-red-500 font-semibold">
                        · <AlertCircle className="h-3.5 w-3.5" /> Overdue
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-black text-slate-900">
                    {fmtCurrency(totalPayable)}
                  </div>
                  {billOverdue && penaltyAmount > 0 && (
                    <div className="text-[10px] text-red-500 font-bold mt-0.5">incl. late fee</div>
                  )}
                </div>
              </div>

              {/* Penalty breakdown (only shown if overdue) */}
              {billOverdue && penaltyAmount > 0 && (
                <div className="bg-white/70 border border-red-100 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Maintenance</span>
                    <span>{fmtCurrency(currentBill.amount)}</span>
                  </div>
                  <div className="flex justify-between text-red-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Late Penalty
                      <span className="text-[10px] opacity-70">
                        ({CONFIG.PENALTY_TYPE === 'percent' ? `${CONFIG.PENALTY_VALUE}%` : `₹${CONFIG.PENALTY_VALUE} flat`})
                      </span>
                    </span>
                    <span>+ {fmtCurrency(penaltyAmount)}</span>
                  </div>
                  <div className="border-t border-red-100 pt-1.5 flex justify-between font-bold text-slate-800">
                    <span>Total Payable</span>
                    <span className="text-emerald-700">{fmtCurrency(totalPayable)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={openCurrentBillModal}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 active:scale-[0.98] transition-all"
              >
                <span>Pay Now</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Bill Info (date + unit) when pending ── */}
          {!allSettled && flat && (
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { icon: CalendarDays, label: 'Due Day', value: `${CONFIG.DUE_DAY_OF_MONTH}th of month` },
                { icon: IndianRupee, label: 'Base Rate', value: `₹ ${flat.maintenance_amount || '—'}/mo` },
                { icon: ShieldCheck, label: 'Penalty', value: CONFIG.PENALTY_TYPE === 'percent' ? `${CONFIG.PENALTY_VALUE}% if late` : `₹${CONFIG.PENALTY_VALUE} flat` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 space-y-1">
                  <Icon className="h-4 w-4 text-slate-400 mx-auto" />
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{label}</div>
                  <div className="text-xs font-semibold text-slate-700">{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Advance Month Grid ── */}
          {flat && (
            <AdvanceMonthGrid flat={flat} onPayAdvance={openAdvanceModal} />
          )}
        </div>
      </div>

      {/* ── Quick Links Row ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/receipts')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-sky-200 hover:shadow-md transition-all group"
        >
          <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:bg-sky-100 transition-colors">
            <Receipt className="h-4.5 w-4.5" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-slate-800">Receipts Ledger</div>
            <div className="text-[10px] text-slate-400 mt-0.5">View & re-send receipts</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 ml-auto group-hover:text-sky-400 transition-colors" />
        </button>

        <button
          onClick={() => navigate('/payment-history')}
          className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
            <History className="h-4.5 w-4.5" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-slate-800">Payment History</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Full transaction log</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 ml-auto group-hover:text-emerald-400 transition-colors" />
        </button>
      </div>

      {/* ── Payment Modal ── */}
      {modal && (
        <PaymentModal
          amount={modal.amount}
          months={modal.months}
          baseAmount={modal.baseAmount}
          penalty={modal.penalty}
          payerName={user?.name || 'Resident'}
          payerEmail={user?.email || ''}
          unitLabel={unitLabel}
          onSuccess={handlePaymentSuccess}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default MaintenanceStatus;
