// =============================================================================
// mockPaymentService.js
// Isolated mock payment gateway — swap this file for Razorpay SDK later.
// All configurable constants live here.
// =============================================================================

// ---------------------------------------------------------------------------
// ⚙️  CONFIGURATION — Edit these to change billing behaviour
// ---------------------------------------------------------------------------
export const CONFIG = {
  /** Day of the month the bill is due (1–28) */
  DUE_DAY_OF_MONTH: 10,

  /** 'percent' calculates PENALTY_VALUE% of the bill amount.
   *  'flat'    adds a fixed ₹PENALTY_VALUE regardless of amount. */
  PENALTY_TYPE: 'percent',

  /** Penalty amount: if PENALTY_TYPE='percent', this is the %. If 'flat', ₹ flat fee. */
  PENALTY_VALUE: 10,

  /** Duration (ms) of the mock payment scanning animation */
  MOCK_PROCESS_DURATION_MS: 4000,
};

// ---------------------------------------------------------------------------
// 💡 Utility helpers
// ---------------------------------------------------------------------------

/** Returns true if today is past the bill due date */
export function isOverdue(dueDateStr) {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  due.setHours(23, 59, 59, 999); // end of due day
  return new Date() > due;
}

/** Calculates penalty amount based on config */
export function calculatePenalty(baseAmount, dueDateStr) {
  if (!isOverdue(dueDateStr)) return 0;
  if (CONFIG.PENALTY_TYPE === 'percent') {
    return Math.round(baseAmount * (CONFIG.PENALTY_VALUE / 100));
  }
  return CONFIG.PENALTY_VALUE;
}

/** Generates a unique receipt/transaction ID */
export function generateReceiptId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${datePart}-${randPart}`;
}

// ---------------------------------------------------------------------------
// 📄 Receipt generation
// ---------------------------------------------------------------------------

/**
 * Generates a structured receipt object.
 * @param {Object} params
 * @param {string} params.payerName
 * @param {string} params.payerEmail
 * @param {string} params.unitLabel  — e.g. "A - 101"
 * @param {string[]} params.months   — e.g. ["July 2026"]
 * @param {number} params.baseAmount
 * @param {number} params.penalty
 * @param {string} params.paymentMethod
 * @returns {Object} receipt
 */
export function generateReceipt({
  payerName,
  payerEmail,
  unitLabel,
  months,
  baseAmount,
  penalty,
  paidAmount,
  paymentMethod = 'UPI / GPay',
}) {
  const transactionId = generateReceiptId();
  const paymentDate = new Date().toISOString();
  const totalAmount = paidAmount !== undefined ? paidAmount : baseAmount + penalty;

  return {
    transactionId,
    paymentDate,
    payerName,
    payerEmail,
    unitLabel,
    months,
    baseAmount,
    penalty,
    totalAmount,
    paymentMethod,
    isLatePaid: penalty > 0,
  };
}

// ---------------------------------------------------------------------------
// 💳 Mock payment processor
// ---------------------------------------------------------------------------

/**
 * Simulates an async payment processing flow.
 * Call this when the user confirms payment.
 *
 * @param {number} amount  — total amount to charge
 * @param {string[]} months — months being paid
 * @param {function} onProgress — optional callback({ stage: 'scanning'|'confirming'|'success' })
 * @returns {Promise<{ success: boolean, transactionId: string }>}
 */
export function mockProcessPayment(amount, months, onProgress) {
  return new Promise((resolve) => {
    const duration = CONFIG.MOCK_PROCESS_DURATION_MS;

    // Stage 1: scanning (0 → 60% of duration)
    if (onProgress) onProgress({ stage: 'scanning', percent: 0 });

    const scanEnd = duration * 0.6;
    const confirmEnd = duration;

    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / duration, 1);

      if (elapsed < scanEnd) {
        if (onProgress) onProgress({ stage: 'scanning', percent: Math.round((elapsed / scanEnd) * 60) });
        requestAnimationFrame(tick);
      } else if (elapsed < confirmEnd) {
        if (onProgress) onProgress({ stage: 'confirming', percent: 60 + Math.round(((elapsed - scanEnd) / (confirmEnd - scanEnd)) * 40) });
        requestAnimationFrame(tick);
      } else {
        if (onProgress) onProgress({ stage: 'success', percent: 100 });
        const transactionId = generateReceiptId();
        resolve({ success: true, transactionId });
      }
    };

    requestAnimationFrame(tick);
  });
}

// ---------------------------------------------------------------------------
// 🗄️  Local persistence — Receipts Ledger
// ---------------------------------------------------------------------------

const RECEIPTS_KEY = 'sgs_receipts_ledger';
const HISTORY_KEY = 'sgs_payment_history';

/** Saves a receipt to localStorage */
export function storeReceiptLocally(receipt) {
  const existing = getStoredReceipts();
  // Deduplicate by transactionId
  const updated = [receipt, ...existing.filter(r => r.transactionId !== receipt.transactionId)];
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(updated));
}

/** Returns all locally stored receipts (newest first) */
export function getStoredReceipts() {
  try {
    return JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Saves a payment history record to localStorage */
export function storePaymentRecord(record) {
  const existing = getLocalPaymentHistory();
  const updated = [record, ...existing.filter(r => r.transactionId !== record.transactionId)];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

/** Returns all locally stored payment history records (newest first) */
export function getLocalPaymentHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}
