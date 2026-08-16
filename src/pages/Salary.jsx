import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, Modal, PageHead, Select, Stat } from '../components/ui';
import { fmtDate, fmtMonth, money, netPay, parseDate, payStatus, thisMonth, toDateTime, today } from '../lib/util';

/** Layout + cycle maths ported from salaryModule.html, wired to the payments table. */
export default function Salary() {
  const [month, setMonth] = useState(thisMonth());
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const { data, loading, error: loadError, reload } = useAsync(
    () => Promise.all([
      db.list('employees', [Query.orderAsc('name')]),
      db.list('payments', [Query.limit(1000)]),
    ]).then(([employees, payments]) => ({ employees, payments })),
    [],
  );

  const { employees = [], payments = [] } = data || {};

  const rows = useMemo(() => employees.map((e) => {
    const mine = payments.filter((p) => p.employeeId === e.userId);
    const pay = mine.find((p) => p.month === month) || null;
    const paidRows = mine.filter((p) => p.status === 'paid' && p.paidOn);
    const lastPaid = paidRows.map((p) => String(p.paidOn).slice(0, 10)).sort().pop() || String(e.joinDate || today()).slice(0, 10);
    const anchor = parseDate(e.joinDate || today()).getDate();
    return {
      e,
      pay,
      lastPaid,
      status: payStatus(lastPaid, anchor),
      totalPaid: paidRows.reduce((s, p) => s + netPay(p), 0),
      // last month's numbers seed a new row so admins rarely retype them
      previous: mine.filter((p) => p.month < month).sort((a, b) => a.month.localeCompare(b.month)).pop(),
    };
  }).sort((a, b) => a.status.left - b.status.left), [employees, payments, month]);

  const shown = rows.filter(({ e, status }) =>
    (filter === 'all' || status.key === filter) &&
    (!q || `${e.name} ${e.subRole || ''}`.toLowerCase().includes(q.toLowerCase())));

  const paidThisMonth = payments
    .filter((p) => p.month === month && p.status === 'paid')
    .reduce((s, p) => s + netPay(p), 0);

  const markPaid = async ({ e, pay, previous }) => {
    setError(null);
    try {
      if (pay) await db.update('payments', pay.$id, { status: 'paid', paidOn: toDateTime(today()) });
      else await db.create('payments', {
        employeeId: e.userId, month,
        base: Number(previous?.base || 0), bonus: 0, deductions: 0,
        status: 'paid', paidOn: toDateTime(today()),
      });
      reload();
    } catch (err) { setError(err.message); }
  };

  const history = payments
    .filter((p) => p.status === 'paid')
    .sort((a, b) => String(b.paidOn).localeCompare(String(a.paidOn)));
  const nameOf = (userId) => employees.find((x) => x.userId === userId)?.name || userId;

  return (
    <>
      <PageHead eyebrow={fmtMonth(month)} title="Payroll">
        <Input type="month" value={month} onChange={(ev) => setMonth(ev.target.value)}
          aria-label="Payroll month" style={{ width: 'auto' }} />
      </PageHead>

      <ErrorNote error={loadError || error} />
      {loading ? <Loading /> : (
        <>
          <div className="grid grid-stats">
            <Stat label="Employees" value={employees.length} tone="ink" />
            <Stat label="Due today" value={rows.filter((r) => r.status.key === 'due').length} tone="purple" />
            <Stat label="Overdue" value={rows.filter((r) => r.status.key === 'overdue').length} tone="orange" />
            <Stat label="Paid this month" value={money(paidThisMonth)} tone="green" />
          </div>

          <div className="row" style={{ margin: '28px 0 20px' }}>
            <Input placeholder="Search name or role…" value={q} onChange={(e) => setQ(e.target.value)}
              aria-label="Search employees" style={{ flex: 1, minWidth: 220 }} />
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by cycle"
              style={{ width: 'auto' }}>
              <option value="all">All employees</option>
              <option value="overdue">Overdue</option>
              <option value="due">Due today</option>
              <option value="upcoming">Upcoming</option>
            </Select>
          </div>

          {shown.length === 0 ? <Empty>No employees match this view.</Empty> : (
            <div className="grid grid-cards">
              {shown.map((row) => {
                const { e, pay, lastPaid, status, totalPaid } = row;
                const isPaid = pay?.status === 'paid';
                return (
                  <Card key={e.$id} hover className={`reveal ${status.key === 'overdue' ? 'card-overdue' : ''}`}>
                    <div className="row-between" style={{ marginBottom: 16 }}>
                      <div>
                        <h2 className="display display-md">{e.name}</h2>
                        <span className="muted" style={{ fontSize: 13 }}>{e.subRole || e.role}</span>
                      </div>
                      <Badge tone={status.tone} solid={status.key !== 'upcoming'}>{status.label}</Badge>
                    </div>

                    <dl className="dl">
                      <dt>Joined</dt><dd>{fmtDate(e.joinDate)}</dd>
                      <dt>Base</dt><dd>{money(pay?.base)}</dd>
                      <dt>Bonus</dt><dd style={{ color: 'var(--green)' }}>{money(pay?.bonus)}</dd>
                      <dt>Deductions</dt><dd style={{ color: 'var(--orange)' }}>−{money(pay?.deductions)}</dd>
                      <dt><strong>Net for {month}</strong></dt><dd><strong>{money(netPay(pay))}</strong></dd>
                      <dt>Last payment</dt><dd>{fmtDate(lastPaid)}</dd>
                      <dt>Next due</dt><dd>{fmtDate(status.due)}</dd>
                      <dt>Total paid</dt><dd>{money(totalPaid)}</dd>
                    </dl>

                    <div className="row" style={{ marginTop: 20 }}>
                      {isPaid
                        ? <Badge tone="green" solid>paid {fmtDate(pay.paidOn)}</Badge>
                        : <Button size="sm" variant="green" onClick={() => markPaid(row)}>Mark as paid</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>Amounts</Button>
                      <Link className="btn btn-ghost btn-sm" to={`/salary/${e.userId}/${month}`}>Payslip</Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <section className="section">
            <h2 className="display display-md" style={{ marginBottom: 16 }}>Payment history</h2>
            {history.length === 0 ? <Empty>No payments recorded yet.</Empty> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Paid on</th><th>Employee</th><th>Month</th><th className="num">Net</th></tr></thead>
                  <tbody>
                    {history.map((p) => (
                      <tr key={p.$id}>
                        <td>{fmtDate(p.paidOn)}</td>
                        <td>{nameOf(p.employeeId)}</td>
                        <td className="muted">{fmtMonth(p.month)}</td>
                        <td className="num">{money(netPay(p))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <AmountsModal key={editing?.e.$id} row={editing} month={month} onClose={() => setEditing(null)} onDone={reload} />
    </>
  );
}

function AmountsModal({ row, month, onClose, onDone }) {
  const pay = row?.pay;
  const [form, setForm] = useState(() => ({
    base: pay?.base ?? row?.previous?.base ?? '',
    bonus: pay?.bonus ?? 0,
    deductions: pay?.deductions ?? 0,
    status: pay?.status ?? 'unpaid',
  }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      employeeId: row.e.userId,
      month,
      base: Number(form.base) || 0,
      bonus: Number(form.bonus) || 0,
      deductions: Number(form.deductions) || 0,
      status: form.status,
      // null, not '' — an empty string is not valid for a datetime column
      paidOn: form.status === 'paid' ? (pay?.paidOn || toDateTime(today())) : null,
    };
    try {
      if (pay) await db.update('payments', pay.$id, payload);
      else await db.create('payments', payload);
      onClose();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!row} onClose={onClose} title="Salary amounts" subtitle={`${row?.e.name} · ${fmtMonth(month)}`}>
      <form onSubmit={submit}>
        <Field label="Base (₹)"><Input type="number" min="0" required value={form.base} onChange={set('base')} /></Field>
        <div className="two-col">
          <Field label="Bonus (₹)"><Input type="number" min="0" value={form.bonus} onChange={set('bonus')} /></Field>
          <Field label="Deductions (₹)"><Input type="number" min="0" value={form.deductions} onChange={set('deductions')} /></Field>
        </div>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            <option value="unpaid">unpaid</option>
            <option value="paid">paid</option>
          </Select>
        </Field>
        <p className="display display-md" style={{ margin: '4px 0 18px' }}>
          Net {money(netPay({ base: form.base, bonus: form.bonus, deductions: form.deductions }))}
        </p>
        <ErrorNote error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}
