import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHead, Select } from '../components/ui';
import { byId, fmtDate, money, toDateTime, today } from '../lib/util';

const firstOfMonth = () => today().slice(0, 8) + '01';

export default function Invoices() {
  const [form, setForm] = useState({ brandId: '', periodFrom: firstOfMonth(), periodTo: today() });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error: loadError, reload } = useAsync(
    () => Promise.all([
      db.list('brands', [Query.orderAsc('name')]),
      db.list('invoices', [Query.orderDesc('$createdAt')]),
      db.list('tasks', [Query.equal('status', 'done'), Query.limit(1000)]),
    ]).then(([brands, invoices, tasks]) => ({ brands, invoices, tasks })),
    [],
  );

  const { brands = [], invoices = [], tasks = [] } = data || {};
  const brandsById = useMemo(() => byId(brands), [brands]);
  const brand = brandsById[form.brandId];

  // completed tasks for the brand whose completedAt falls inside the period
  const billable = useMemo(() => tasks.filter((t) => {
    if (t.brandId !== form.brandId || !t.completedAt) return false;
    const day = String(t.completedAt).slice(0, 10);
    return day >= form.periodFrom && day <= form.periodTo;
  }), [tasks, form]);

  const amount = billable.length * Number(brand?.ratePerProject || 0);

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await db.create('invoices', {
        brandId: form.brandId,
        periodFrom: toDateTime(form.periodFrom),
        periodTo: toDateTime(form.periodTo),
        amount,
        status: 'draft',
        taskIds: billable.map((t) => t.$id),
      });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (inv, status) => { await db.update('invoices', inv.$id, { status }); reload(); };

  return (
    <>
      <PageHead eyebrow={`${invoices.length} issued`} title="Invoicing" />

      <ErrorNote error={loadError || error} />
      {loading ? <Loading /> : (
        <>
          <Card feature as="form" onSubmit={generate} className="reveal">
            <h2 className="display display-md" style={{ marginBottom: 20 }}>Generate an invoice</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="Brand">
                <Select required value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
                  <option value="">— pick a brand —</option>
                  {brands.map((b) => <option key={b.$id} value={b.$id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="From">
                <Input type="date" required value={form.periodFrom} onChange={(e) => setForm({ ...form, periodFrom: e.target.value })} />
              </Field>
              <Field label="To">
                <Input type="date" required value={form.periodTo} onChange={(e) => setForm({ ...form, periodTo: e.target.value })} />
              </Field>
            </div>

            {brand && (
              <div className="row-between" style={{ marginTop: 12, marginBottom: 20 }}>
                <p className="muted" style={{ margin: 0 }}>
                  {billable.length} completed {billable.length === 1 ? 'task' : 'tasks'} × {money(brand.ratePerProject)}
                </p>
                <p className="display display-md" style={{ margin: 0 }}>{money(amount)}</p>
              </div>
            )}

            <Button disabled={busy || !form.brandId || billable.length === 0}>
              {busy ? 'Generating…' : 'Generate draft invoice'}
            </Button>
            {brand && billable.length === 0 && (
              <p className="muted" style={{ fontSize: 13 }}>No completed tasks for this brand in that window.</p>
            )}
          </Card>

          <section className="section">
            <h2 className="display display-md" style={{ marginBottom: 16 }}>Invoices</h2>
            {invoices.length === 0 ? <Empty>Nothing invoiced yet.</Empty> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Brand</th><th>Period</th><th className="num">Tasks</th><th className="num">Amount</th><th>Status</th><th className="num"></th></tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.$id}>
                        <td><strong>{brandsById[inv.brandId]?.name || 'Unknown brand'}</strong></td>
                        <td className="muted">{fmtDate(inv.periodFrom)} → {fmtDate(inv.periodTo)}</td>
                        <td className="num">{inv.taskIds?.length || 0}</td>
                        <td className="num">{money(inv.amount)}</td>
                        <td>
                          <Select value={inv.status} onChange={(e) => setStatus(inv, e.target.value)}
                            aria-label="Invoice status" style={{ width: 'auto', padding: '8px 14px' }}>
                            <option value="draft">draft</option>
                            <option value="sent">sent</option>
                            <option value="paid">paid</option>
                          </Select>
                        </td>
                        <td className="num">
                          <Link className="btn btn-ghost btn-sm" to={`/invoices/${inv.$id}`}>Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
