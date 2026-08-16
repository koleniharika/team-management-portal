import { useMemo } from 'react';
import { db, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { Card, Empty, ErrorNote, Loading, PageHead, Stat } from '../components/ui';
import { daysBetween, isOverdue, money } from '../lib/util';

export default function Analytics() {
  const { data, loading, error } = useAsync(
    () => Promise.all([
      db.list('tasks', [Query.limit(1000)]),
      db.list('brands', [Query.orderAsc('name')]),
      db.list('invoices', [Query.limit(500)]),
    ]).then(([tasks, brands, invoices]) => ({ tasks, brands, invoices })),
    [],
  );

  const { tasks = [], brands = [], invoices = [] } = data || {};

  const done = tasks.filter((t) => t.status === 'done');
  const pending = tasks.filter((t) => t.status !== 'done');
  const onTime = done.filter((t) => !t.deadline || !t.completedAt || daysBetween(t.deadline, t.completedAt) <= 0).length;
  const rate = done.length ? Math.round((onTime / done.length) * 100) : 0;

  const perBrand = useMemo(() => brands.map((b) => {
    const mine = tasks.filter((t) => t.brandId === b.$id);
    const completed = mine.filter((t) => t.status === 'done').length;
    return {
      brand: b,
      total: mine.length,
      completed,
      revenue: completed * Number(b.ratePerProject || 0),
      invoiced: invoices.filter((i) => i.brandId === b.$id).reduce((s, i) => s + Number(i.amount || 0), 0),
    };
  }).sort((a, b) => b.revenue - a.revenue), [brands, tasks, invoices]);

  const maxTasks = Math.max(1, ...perBrand.map((r) => r.total));
  const totalRevenue = perBrand.reduce((s, r) => s + r.revenue, 0);
  const collected = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0);

  if (loading) return <Loading />;

  return (
    <>
      <PageHead eyebrow="All time" title="Analytics" />
      <ErrorNote error={error} />

      <div className="grid grid-stats">
        <Stat label="Open tasks" value={pending.length} tone="purple" />
        <Stat label="Completed" value={done.length} tone="green" />
        <Stat label="Overdue now" value={pending.filter(isOverdue).length} tone="orange" />
        <Stat label="On-time rate" value={`${rate}%`} tone="green" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 24 }}>
        <Card feature accent="ink">
          <p className="eyebrow">Revenue earned</p>
          <p className="display display-xl" style={{ margin: '8px 0' }}>{money(totalRevenue)}</p>
          <p className="muted" style={{ margin: 0 }}>completed tasks × brand rate</p>
        </Card>
        <Card feature accent="green">
          <p className="eyebrow">Collected</p>
          <p className="display display-xl" style={{ margin: '8px 0' }}>{money(collected)}</p>
          <p className="muted" style={{ margin: 0 }}>{invoices.filter((i) => i.status === 'paid').length} invoices paid</p>
        </Card>
      </div>

      <section className="section">
        <h2 className="display display-md" style={{ marginBottom: 16 }}>Per brand</h2>
        {perBrand.length === 0 ? <Empty>No brands yet.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Brand</th><th>Tasks</th><th className="num">Completed</th><th className="num">Revenue</th><th className="num">Invoiced</th></tr>
              </thead>
              <tbody>
                {perBrand.map((r) => (
                  <tr key={r.brand.$id}>
                    <td><strong>{r.brand.name}</strong></td>
                    <td style={{ minWidth: 180 }}>
                      <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--tint-ink)' }}>
                          <div style={{ width: `${(r.total / maxTasks) * 100}%`, height: '100%', borderRadius: 999, background: 'var(--purple)' }} />
                        </div>
                        <span className="mono-nums muted">{r.total}</span>
                      </div>
                    </td>
                    <td className="num">{r.completed}</td>
                    <td className="num">{money(r.revenue)}</td>
                    <td className="num muted">{money(r.invoiced)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
