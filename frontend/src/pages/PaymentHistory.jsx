import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Filter,
  InboxIcon,
  CreditCard,
} from 'lucide-react';

import { getLocalPaymentHistory } from '../services/mockPaymentService';
import { getPaymentHistory as getSupabaseHistory } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n) {
  return '₹ ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 text-slate-300 ml-1 inline" />;
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-sky-500 ml-1 inline" />
    : <ChevronDown className="h-3 w-3 text-sky-500 ml-1 inline" />;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'late-paid') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
        <AlertCircle className="h-3 w-3" /> Late Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
      <CheckCircle2 className="h-3 w-3" /> Paid
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PaymentHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | paid | late-paid

  // Sort
  const [sortField, setSortField] = useState('paymentDate');
  const [sortDir, setSortDir] = useState('desc');

  // ── Load: merge localStorage + Supabase ─────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Local mock payments
        const local = getLocalPaymentHistory();

        // Supabase historical payments
        let supabaseRecords = [];
        try {
          const raw = await getSupabaseHistory();
          supabaseRecords = raw.map((p) => ({
            transactionId: p.transactionId,
            paymentDate: p.paymentDate,
            months: p.Bill ? [p.Bill.billingMonth] : [],
            baseAmount: p.amount,
            penalty: 0,
            totalAmount: p.amount,
            status: 'paid',
            paymentMethod: p.paymentMode || 'Online',
            unitLabel: p.Flat ? `${p.Flat.wing} - ${p.Flat.flatNumber}` : 'N/A',
            _source: 'supabase',
          }));
        } catch {
          // silently ignore if no connection
        }

        // Merge & deduplicate
        const seen = new Set();
        const merged = [...local, ...supabaseRecords].filter((r) => {
          if (seen.has(r.transactionId)) return false;
          seen.add(r.transactionId);
          return true;
        });

        setRecords(merged);
      } catch (err) {
        console.error('PaymentHistory load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Available years ────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set(records.map((r) => new Date(r.paymentDate).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [records]);

  // ── Filtered + sorted ──────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let out = records;

    if (filterYear) {
      out = out.filter((r) => new Date(r.paymentDate).getFullYear() === Number(filterYear));
    }

    if (filterStatus !== 'all') {
      out = out.filter((r) => (r.status || 'paid') === filterStatus);
    }

    out = [...out].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'paymentDate') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return out;
  }, [records, filterYear, filterStatus, sortField, sortDir]);

  // ── Sort handler ────────────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // ── Totals ──────────────────────────────────────────────────────────────
  const totalPaid = displayed.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const latePaidCount = displayed.filter((r) => (r.status || 'paid') === 'late-paid').length;

  // ─────────────────────────────────────────────────────────────────────────
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
          <h1 className="text-xl font-bold text-slate-800">Payment History</h1>
          <p className="text-xs text-slate-400 mt-0.5">Full transaction log for all maintenance payments</p>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Total Paid',
            value: fmtCurrency(totalPaid),
            sub: `${displayed.length} transaction${displayed.length !== 1 ? 's' : ''}`,
            color: 'emerald',
          },
          {
            label: 'On Time',
            value: displayed.filter((r) => (r.status || 'paid') === 'paid').length,
            sub: 'payments',
            color: 'sky',
          },
          {
            label: 'Late Paid',
            value: latePaidCount,
            sub: latePaidCount === 0 ? 'Great record!' : 'with penalty',
            color: latePaidCount > 0 ? 'amber' : 'emerald',
          },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center"
          >
            <div className={`text-xl font-black text-${color}-600`}>{value}</div>
            <div className="text-xs font-bold text-slate-700 mt-0.5">{label}</div>
            <div className="text-[10px] text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Filter</span>
        </div>

        {/* Year filter */}
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 bg-white min-w-[120px]"
        >
          <option value="">All Years</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Status filter */}
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-semibold">
          {[
            { value: 'all', label: 'All' },
            { value: 'paid', label: 'Paid' },
            { value: 'late-paid', label: 'Late Paid' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-3 py-2 transition-colors ${
                filterStatus === value
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(filterYear || filterStatus !== 'all') && (
          <button
            onClick={() => { setFilterYear(''); setFilterStatus('all'); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline ml-auto"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-7 w-7 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center">
              <InboxIcon className="h-7 w-7 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">No payment records found</p>
              <p className="text-xs text-slate-400 mt-1">
                {records.length === 0 ? 'Make your first payment to see history here.' : 'Try adjusting the filters.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 px-5 py-3 bg-slate-50/80 border-b border-slate-100">
              {[
                { label: 'Date', field: 'paymentDate' },
                { label: 'Month(s)', field: null },
                { label: 'Base', field: 'baseAmount' },
                { label: 'Penalty', field: 'penalty' },
                { label: 'Total', field: 'totalAmount' },
                { label: 'Status', field: 'status' },
                { label: 'Method', field: null },
              ].map(({ label, field }) => (
                <button
                  key={label}
                  onClick={() => field && handleSort(field)}
                  className={`text-[10px] font-extrabold uppercase tracking-wider text-left transition-colors ${
                    field ? 'text-slate-500 hover:text-sky-600 cursor-pointer' : 'text-slate-400 cursor-default'
                  }`}
                >
                  {label}
                  {field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
                </button>
              ))}
            </div>

            <div className="divide-y divide-slate-50">
              {displayed.map((r) => {
                const status = r.status || 'paid';
                return (
                  <div
                    key={r.transactionId}
                    className="px-5 py-4 hover:bg-slate-50/30 transition-colors"
                  >
                    {/* Mobile view */}
                    <div className="md:hidden space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-bold text-slate-800">{fmtDate(r.paymentDate)}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{r.transactionId}</div>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="text-slate-500">
                          Months: <span className="text-slate-700 font-semibold">
                            {Array.isArray(r.months) ? r.months.join(', ') : r.months}
                          </span>
                        </span>
                        <span className="text-slate-500">
                          Base: <span className="text-slate-700 font-semibold">{fmtCurrency(r.baseAmount)}</span>
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
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <CreditCard className="h-3 w-3" />
                        <span>{r.paymentMethod || 'Mock Gateway'}</span>
                      </div>
                    </div>

                    {/* Desktop grid row */}
                    <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 items-center text-sm">
                      {/* Date */}
                      <div>
                        <div className="font-semibold text-slate-700 text-xs">{fmtDate(r.paymentDate)}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[140px]">
                          {r.transactionId}
                        </div>
                      </div>

                      {/* Months */}
                      <div className="text-xs text-slate-600 max-w-[130px]">
                        {Array.isArray(r.months)
                          ? r.months.join(', ')
                          : r.months || '—'}
                      </div>

                      {/* Base */}
                      <div className="text-right text-xs text-slate-600">{fmtCurrency(r.baseAmount)}</div>

                      {/* Penalty */}
                      <div className={`text-right text-xs font-semibold ${r.penalty > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {r.penalty > 0 ? `+ ${fmtCurrency(r.penalty)}` : '—'}
                      </div>

                      {/* Total */}
                      <div className="text-right text-xs font-bold text-slate-800">{fmtCurrency(r.totalAmount)}</div>

                      {/* Status */}
                      <div className="text-right">
                        <StatusBadge status={status} />
                      </div>

                      {/* Method */}
                      <div className="text-right text-[10px] text-slate-400 flex items-center justify-end gap-1">
                        <CreditCard className="h-3 w-3" />
                        <span>{r.paymentMethod || 'Mock Gateway'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50/40 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
              <span className="text-xs text-slate-400">
                {displayed.length} record{displayed.length !== 1 ? 's' : ''} · sorted by{' '}
                <span className="font-semibold text-slate-600">{sortField === 'paymentDate' ? 'date' : sortField}</span>{' '}
                ({sortDir})
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Total: {fmtCurrency(totalPaid)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;
