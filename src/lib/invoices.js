// Local-only invoicing: nothing here talks to Appwrite. Invoices live in localStorage
// and leave the browser only as a PDF the user downloads.
const KEY = 'erp.invoices.v1';

/** '' for anything that isn't a usable number — blank must stay blank, never become 0. */
export const num = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  const n = Number(s);
  return Number.isFinite(n) ? n : '';
};

export const blankLine = () => ({
  id: `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  description: '', qty: '', rate: '', amount: '',
});

export const blankInvoice = () => ({
  id: '',
  sender: '', number: '', date: '',
  clientName: '', clientDetails: '', pan: '',
  taxPercent: '', notes: '',
  lines: [blankLine()],
});

/**
 * A line's amount: what was typed, else qty x rate when both are numbers, else blank.
 * Totals stay blank until at least one line resolves to a number, so an empty form
 * prints an empty bill rather than a wall of zeroes.
 */
export const lineAmount = (line) => {
  const typed = num(line?.amount);
  if (typed !== '') return typed;
  const q = num(line?.qty);
  const r = num(line?.rate);
  return q !== '' && r !== '' ? q * r : '';
};

export function computeTotals(lines = [], taxPercent = '') {
  const amounts = lines.map(lineAmount);
  const numeric = amounts.filter((a) => a !== '');
  if (!numeric.length) return { amounts, subtotal: '', tax: '', total: '' };

  const subtotal = numeric.reduce((s, a) => s + a, 0);
  const pct = num(taxPercent);
  const tax = pct === '' ? '' : Math.round(subtotal * pct) / 100;
  const total = subtotal + (tax === '' ? 0 : tax);
  return { amounts, subtotal, tax, total };
}

/** Indian digit grouping without a currency symbol — callers add ₹ or "INR". */
export const amountText = (n) => (n === '' || n === null || n === undefined ? '' : Number(n).toLocaleString('en-IN'));

// ---- localStorage list (newest first) ----
export function loadInvoices() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return []; // corrupt or blocked storage: behave like an empty shelf
  }
}

function write(rows) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* private mode / quota: the invoice still downloads, it just isn't remembered */
  }
  return rows;
}

/** Upsert by id; a blank id means "new". Returns the updated list. */
export function saveInvoice(invoice) {
  const id = invoice.id || `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const row = { ...invoice, id, savedAt: new Date().toISOString() };
  const rest = loadInvoices().filter((r) => r.id !== id);
  return { list: write([row, ...rest]), row };
}

export const deleteInvoice = (id) => write(loadInvoices().filter((r) => r.id !== id));
