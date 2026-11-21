import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Badge, Button, Card, Empty, ErrorNote, Input, Loading, PageHead, Stat } from '../components/ui';
import { STATUS_TONE, byId, fmtDate } from '../lib/util';

const STATUSES = ['pending', 'in-progress', 'submitted', 'approved', 'done'];

export default function BrandDetail() {
  const { id } = useParams();

  const { data, loading, error, setData, mutate } = useAsync(
    () => Promise.all([
      api.get('brands', id),
      api.list('tasks', { brandId: id, status: 'all' }),
      api.list('employees'),
      api.list('deliverables', { brandId: id }),
    ]).then(([brand, tasks, employees, deliverables]) => ({ brand, tasks, employees, deliverables })),
    [id],
  );

  if (loading) return <Loading />;
  if (!data?.brand) return <ErrorNote error={error || 'Brand not found.'} />;

  const { brand, tasks, employees, deliverables } = data;
  const empById = byId(employees);
  const count = (status) => tasks.filter((t) => t.status === status).length;
  // anything outside the usual five (e.g. rejected) still gets a row, so the numbers add up
  const statuses = [...STATUSES, ...new Set(tasks.map((t) => t.status).filter((s) => !STATUSES.includes(s)))];

  const people = Object.values(tasks.reduce((acc, t) => {
    const row = acc[t.assignedTo] || (acc[t.assignedTo] = { id: t.assignedTo, total: 0, done: 0 });
    row.total += 1;
    if (t.status === 'done') row.done += 1;
    return acc;
  }, {})).sort((a, b) => b.done - a.done || b.total - a.total);

  const newestFirst = [...tasks].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return (
    <>
      <PageHead eyebrow={[brand.contactName, brand.contactInfo].filter(Boolean).join(' · ') || 'Brand report'} title={brand.name}>
        <Link to="/brands" className="btn btn-ghost">← Brands</Link>
      </PageHead>

      <ErrorNote error={error} />

      <div className="grid grid-stats">
        <Stat label="Tasks done" value={count('done')} tone="lime" />
        <Stat label="Total tasks" value={tasks.length} tone="lilac" />
        <Stat label="Still open" value={tasks.length - count('done')} tone="yellow" />
        <Stat label="People involved" value={people.length} tone="blue" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 24 }}>
        <Card>
          <h2 className="eyebrow" style={{ marginBottom: 16 }}>Status breakdown</h2>
          <dl className="dl">
            {statuses.map((s) => (
              <div key={s} style={{ display: 'contents' }}>
                <dt><Badge tone={STATUS_TONE[s]}>{s}</Badge></dt>
                <dd>{count(s)}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="eyebrow" style={{ marginBottom: 16 }}>Who did the work</h2>
          {people.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nobody yet.</p> : (
            <dl className="dl">
              {people.map((p) => (
                <div key={p.id} style={{ display: 'contents' }}>
                  <dt>
                    {empById[p.id]
                      ? <Link to={`/team/${p.id}`} className="link-plain"><strong>{empById[p.id].name}</strong></Link>
                      : <span className="muted">Former member</span>}
                  </dt>
                  <dd>{p.done} done <span className="muted">· {p.total} total</span></dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <Deliverables brandId={id} items={deliverables} setData={setData} mutate={mutate} />

      <section className="section">
        <h2 className="display display-md" style={{ marginBottom: 16 }}>All tasks</h2>
        {tasks.length === 0 ? <Empty>No tasks for {brand.name} yet.</Empty> : (
          <div className="table-wrap">
            <table className="table-stack">
              <thead><tr><th>Task</th><th>Assigned to</th><th>Status</th><th className="num">Deadline</th></tr></thead>
              <tbody>
                {newestFirst.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Task"><Link to={`/tasks/${t.id}`} className="link-plain"><strong>{t.title}</strong></Link></td>
                    <td data-label="Assigned to">{empById[t.assignedTo]?.name || '—'}</td>
                    <td data-label="Status"><Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge></td>
                    <td className="num" data-label="Deadline">{fmtDate(t.deadline)}</td>
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

/** Handwritten-style checklist: click the circle to cross a line off in red, click again to undo. */
function Deliverables({ brandId, items, setData, mutate }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const done = items.filter((d) => d.done).length;

  const setItems = (change) => (d) => ({ ...d, deliverables: change(d.deliverables) });

  const add = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText(''); // stay open: lists usually get typed in one go
    const temp = { id: `tmp-${Date.now()}`, text: value, done: 0, temp: true };
    const row = await mutate(setItems((list) => [...list, temp]), () => api.create('deliverables', { brandId, text: value }));
    if (row) setData(setItems((list) => list.map((d) => (d.id === temp.id ? row : d))));
  };

  const toggle = (item) => mutate(
    setItems((list) => list.map((d) => (d.id === item.id ? { ...d, done: d.done ? 0 : 1 } : d))),
    () => api.update('deliverables', item.id, { done: !item.done }),
  );

  const remove = (item) => mutate(
    setItems((list) => list.filter((d) => d.id !== item.id)),
    () => api.remove('deliverables', item.id),
  );

  return (
    <section className="section">
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="display display-md">Deliverables</h2>
          {items.length > 0 && <p className="muted" style={{ margin: '6px 0 0' }}>{done} of {items.length} done</p>}
        </div>
        {!adding && <Button onClick={() => setAdding(true)}>+ Add deliverable</Button>}
      </div>

      <Card>
        {items.length === 0 && !adding && <p className="muted" style={{ margin: 0 }}>Nothing on the list yet.</p>}
        {items.length > 0 && (
          <ul className="deliv-list">
            {items.map((d) => (
              <li key={d.id} className={`deliv ${d.done ? 'is-done' : ''}`}>
                <button type="button" className="deliv-check" onClick={() => toggle(d)} disabled={d.temp}
                  aria-pressed={!!d.done} aria-label={`${d.done ? 'Un-mark' : 'Mark'} "${d.text}" done`}>
                  {d.done ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 4 20 20M20 4 4 20" />
                    </svg>
                  ) : null}
                </button>
                <span className="deliv-text">{d.text}</span>
                <button type="button" className="icon-btn" onClick={() => remove(d)} disabled={d.temp}
                  aria-label={`Delete "${d.text}"`}>✕</button>
              </li>
            ))}
          </ul>
        )}
        {adding && (
          <form onSubmit={add} className="row" style={{ gap: 8, flexWrap: 'nowrap', marginTop: items.length ? 16 : 0 }}>
            <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="3 reels for the launch week…"
              aria-label="New deliverable" onKeyDown={(e) => { if (e.key === 'Escape') setAdding(false); }} />
            <Button disabled={!text.trim()}>Add</Button>
            <Button type="button" variant="ghost" onClick={() => { setAdding(false); setText(''); }}>Done</Button>
          </form>
        )}
      </Card>
    </section>
  );
}
