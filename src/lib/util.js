// Dates are plain 'YYYY-MM-DD' strings parsed as local time — avoids the UTC
// off-by-one that Date.parse/toISOString gives users east/west of GMT.
// (Ported from salaryModule.html.)
export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDate = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = () => iso(new Date());

/**
 * 'YYYY-MM-DD' -> ISO-8601 for Appwrite's datetime columns, pinned to UTC midnight.
 * Deliberately no timezone conversion: `new Date(s).toISOString()` would shift the day
 * for anyone east/west of GMT, so the date you picked is the date that comes back from
 * `.slice(0, 10)` — which is how every reader here parses these columns.
 */
export const toDateTime = (s) => (s ? `${String(s).slice(0, 10)}T00:00:00.000Z` : null);
export const thisMonth = () => today().slice(0, 7); // 'YYYY-MM'

export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5); // round absorbs DST
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return iso(d); };

export const fmtDate = (s) =>
  s ? parseDate(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtMonth = (m) =>
  parseDate(`${m}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/**
 * Next payday: the month after `lastPaid`, on the employee's fixed payday-of-month
 * (`anchor`), clamped to short months. Anchoring on `anchor` rather than on lastPaid
 * means a short February or a late payment moves one due date, not the whole future
 * schedule — 31st → 28 Feb → back to 31 Mar.
 */
export const nextPayday = (lastPaid, anchor) => {
  const d = parseDate(lastPaid);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(Math.min(anchor, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return iso(d);
};

/** overdue / due / upcoming for a salary cycle. */
export function payStatus(lastPaid, anchor) {
  const due = nextPayday(lastPaid, anchor);
  const left = daysBetween(today(), due);
  if (left < 0) return { key: 'overdue', tone: 'orange', label: `${-left}d overdue`, note: `Overdue by ${-left} day${-left > 1 ? 's' : ''}`, due, left };
  if (left === 0) return { key: 'due', tone: 'purple', label: 'due today', note: 'Payment due today', due, left };
  return { key: 'upcoming', tone: 'green', label: `in ${left}d`, note: `${left} day${left > 1 ? 's' : ''} remaining`, due, left };
}

export const netPay = (p) => Number(p?.base || 0) + Number(p?.bonus || 0) - Number(p?.deductions || 0);

export const isOverdue = (task) =>
  !!task.deadline && task.status !== 'done' && daysBetween(today(), task.deadline) < 0;

export const PRIORITY_TONE = { high: 'orange', medium: 'purple', low: 'green' };

export const byId = (rows, key = '$id') => Object.fromEntries(rows.map((r) => [r[key], r]));

export const initials = (name = '?') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
