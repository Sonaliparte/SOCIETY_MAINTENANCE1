import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Search,
  Filter,
  Mail,
  Eye,
  ChevronLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  IndianRupee,
  User,
  Hash,
  Download,
  InboxIcon,
} from 'lucide-react';

import { getStoredReceipts } from '../services/mockPaymentService';
import { sendReceiptEmail } from '../services/emailService';
import { getPaymentHistory } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n) {
  return '₹ ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Receipt Detail Modal ────────────────────────────────────────────────────

function ReceiptModal({ receipt, onClose, onResend }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      await onResend(receipt);
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
            Payment Receipt
          </div>
          <div className="text-xl font-black">{fmtCurrency(receipt.totalAmount)}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {fmtDate(receipt.paymentDate)} · {fmtTime(receipt.paymentDate)}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Transaction ID */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            {[
              { icon: Hash, label: 'Transaction ID', value: receipt.transactionId },
              { icon: User, label: 'Resident', value: receipt.payerName },
              { icon: Receipt, label: 'Unit / Flat', value: receipt.unitLabel },
              { icon: Calendar, label: 'Month(s) Paid', value: Array.isArray(receipt.months) ? receipt.months.join(', ') : receipt.months },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-400 shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
                </div>
                <span className="text-slate-800 font-semibold text-right text-xs">{value}</span>
              </div>
            ))}
          </div>

          {/* Amount breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Base Maintenance</span>
              <span>{fmtCurrency(receipt.baseAmount)}</span>
            </div>
            {receipt.penalty > 0 && (
              <div className="flex justify-between text-rose-600 font-semibold">
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Late Penalty
                </span>
                <span>+ {fmtCurrency(receipt.penalty)}</span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-900">
              <span>Total Paid</span>
              <span className="text-emerald-600">{fmtCurrency(receipt.totalAmount)}</span>
            </div>
          </div>

          <div className="flex justify-between text-xs text-slate-500">
            <span>Payment Method</span>
            <span className="font-semibold">{receipt.paymentMethod || 'Mock Gateway'}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleResend}
              disabled={sending || sent}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                sent
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm'
              } disabled:opacity-60`}
            >
              {sent ? (
                <><CheckCircle2 className="h-4 w-4" /> Sent!</>
              ) : (
                <><Mail className="h-4 w-4" /> {sending ? 'Sending…' : 'Re-send Email'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const ReceiptsLedger = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [resendToast, setResendToast] = useState('');

  // ── Load: merge localStorage + Supabase history ───────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const localReceipts = getStoredReceipts();
        let supabaseReceipts = [];
        try {
          const supabaseHistory = await getPaymentHistory();
          supabaseReceipts = supabaseHistory.map((p) => ({
            transactionId: p.transactionId,
            paymentDate: p.paymentDate,
            payerName: user?.name || 'Resident',
            payerEmail: user?.email || '',
            unitLabel: p.Flat ? `${p.Flat.wing} - ${p.Flat.flatNumber}` : 'N/A',
            months: p.Bill ? [p.Bill.billingMonth] : [],
            baseAmount: p.amount,
            penalty: 0,
            totalAmount: p.amount,
            paymentMethod: p.paymentMode || 'Online',
            isLatePaid: false,
            _source: 'supabase',
          }));
        } catch {
          // Supabase may not have records; silently skip
        }

        // Merge & deduplicate by transactionId
        const seen = new Set();
        const merged = [...localReceipts, ...supabaseReceipts].filter((r) => {
          if (seen.has(r.transactionId)) return false;
          seen.add(r.transactionId);
          return true;
        });

        // Sort newest first
        merged.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
        setReceipts(merged);
      } catch (err) {
        console.error('ReceiptsLedger load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = receipts;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      out = out.filter(
        (r) =>
          r.transactionId?.toLowerCase().includes(q) ||
          r.payerName?.toLowerCase().includes(q) ||
          r.unitLabel?.toLowerCase().includes(q) ||
          (Array.isArray(r.months) ? r.months.join(' ') : r.months || '')
            .toLowerCase()
            .includes(q)
      );
    }

    if (filterMonth) {
      out = out.filter((r) => {
        const date = new Date(r.paymentDate);
        const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return ym === filterMonth;
      });
    }

    return out;
  }, [receipts, searchQuery, filterMonth]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleResend = async (receipt) => {
    await sendReceiptEmail(receipt);
    setResendToast(`Receipt re-sent to ${receipt.payerEmail || 'email (mock)'}`);
    setTimeout(() => setResendToast(''), 4000);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/maintenance')}
          className="p-2 rounded-xl bg-white border border-slate-100 hover:bg-slate-50 text-slate-500 shadow-sm transition-colors"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Receipts Ledger</h1>
          <p className="text-xs text-slate-400 mt-0.5">All your maintenance payment receipts</p>
        </div>
      </div>

      {/* Re-send toast */}
      {resendToast && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3 animate-slide-in">
          <Mail className="h-4 w-4 shrink-0" />
          {resendToast}
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by TXN ID, name, or unit…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 placeholder:text-slate-300"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 text-slate-600 min-w-[160px]"
          />
        </div>
        {(searchQuery || filterMonth) && (
          <button
            onClick={() => { setSearchQuery(''); setFilterMonth(''); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Receipts table / list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-7 w-7 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center">
              <InboxIcon className="h-7 w-7 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">No receipts found</p>
              <p className="text-xs text-slate-400 mt-1">
                {receipts.length === 0 ? 'Pay a bill to generate your first receipt.' : 'Try adjusting your filters.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <span>Transaction</span>
              <span className="text-right">Month(s)</span>
              <span className="text-right">Base</span>
              <span className="text-right">Penalty</span>
              <span className="text-right">Total</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map((r) => (
                <div
                  key={r.transactionId}
                  className="px-5 py-4 hover:bg-slate-50/40 transition-colors"
                >
                  {/* Mobile: card layout */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-700 truncate">
                          {r.transactionId}
                        </span>
                        {r.isLatePaid && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            <AlertCircle className="h-3 w-3" /> Late
                          </span>
                        )}
                        {!r.isLatePaid && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> Paid
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(r.paymentDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {r.unitLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Receipt className="h-3 w-3" />
                          {Array.isArray(r.months) ? r.months.join(', ') : r.months}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs pt-0.5">
                        <span className="text-slate-500">
                          Base: <span className="font-semibold text-slate-700">{fmtCurrency(r.baseAmount)}</span>
                        </span>
                        {r.penalty > 0 && (
                          <span className="text-rose-500">
                            Penalty: <span className="font-semibold">+ {fmtCurrency(r.penalty)}</span>
                          </span>
                        )}
                        <span className="text-slate-900 font-bold">
                          Total: {fmtCurrency(r.totalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setSelectedReceipt(r)}
                        title="View receipt"
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-sky-600 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleResend(r)}
                        title="Re-send email"
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50/40 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                Showing {filtered.length} of {receipts.length} receipts
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                <IndianRupee className="h-3 w-3" />
                Total paid: {fmtCurrency(filtered.reduce((s, r) => s + r.totalAmount, 0))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Receipt detail modal */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onResend={handleResend}
        />
      )}
    </div>
  );
};

export default ReceiptsLedger;
