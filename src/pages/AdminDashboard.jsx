import { useMemo, useState } from 'react';
import { db, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHead } from '../components/ui';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';
import { byId } from '../lib/util';

export default function AdminDashboard() {
  const [nearestFirst, setNearestFirst] = useState(true);
  const [formFor, setFormFor] = useState(null); // null = closed, '' = anyone, userId = preset

  const { data, loading, error, reload } = useAsync(
    () => Promise.all([
      db.list('tasks', [Query.notEqual('status', 'done'), Query.limit(500)]),
      db.list('employees', [Query.orderAsc('name')]),
      db.list('brands', [Query.orderAsc('name')]),
    ]).then(([tasks, employees, brands]) => ({ tasks, employees, brands })),
    [],
  );

  const { tasks = [], employees = [], brands = [] } = data || {};
  const brandsById = useMemo(() => byId(brands), [brands]);
  const namesByUserId = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.userId, e.name])),
    [employees],
  );

  const sorted = useMemo(() => {
    const dir = nearestFirst ? 1 : -1;
    return [...tasks].sort((a, b) => dir * String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
  }, [tasks, nearestFirst]);

  const workload = useMemo(() => {
    const counts = {};
    for (const t of tasks) counts[t.assignedTo] = (counts[t.assignedTo] || 0) + 1;
    return counts;
  }, [tasks]);

  return (
    <>
      <PageHead eyebrow={`${tasks.length} open ${tasks.length === 1 ? 'task' : 'tasks'}`} title="Command desk">
        <Button variant="ghost" onClick={() => setNearestFirst((v) => !v)}>
          Deadline {nearestFirst ? '↑ nearest' : '↓ farthest'}
        </Button>
        <Button onClick={() => setFormFor('')}>+ Create task</Button>
      </PageHead>

      <ErrorNote error={error} />
      {loading ? <Loading /> : (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2.2fr) minmax(300px, 1fr)', alignItems: 'start' }}>
          <section>
            <h2 className="eyebrow" style={{ marginBottom: 16 }}>Open work</h2>
            {sorted.length === 0 ? <Empty>Nothing open. Suspiciously quiet.</Empty> : (
              <div className="grid grid-cards">
                {sorted.map((t) => (
                  <TaskCard
                    key={t.$id}
                    task={t}
                    brandName={brandsById[t.brandId]?.name}
                    assigneeName={namesByUserId[t.assignedTo] || 'Unassigned'}
                  />
                ))}
              </div>
            )}
          </section>

          <Card feature as="section" style={{ position: 'sticky', top: 88 }}>
            <h2 className="display display-md" style={{ marginBottom: 4 }}>The team</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Number = active tasks. Balance before you assign.</p>
            <div className="stack" style={{ gap: 12, marginTop: 20 }}>
              {employees.map((e) => (
                <div key={e.$id} className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.name}
                    </strong>
                    <span className="muted" style={{ fontSize: 12 }}>{e.subRole || e.role}</span>
                  </div>
                  <Badge tone={workload[e.userId] ? 'purple' : undefined} title={`${workload[e.userId] || 0} active tasks`}>
                    {workload[e.userId] || 0}
                  </Badge>
                  <Badge tone={e.status === 'available' ? 'green' : 'orange'}>{e.status}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => setFormFor(e.userId)}>Assign</Button>
                </div>
              ))}
              {employees.length === 0 && <Empty>No employees yet.</Empty>}
            </div>
          </Card>
        </div>
      )}

      <TaskForm
        key={formFor ?? 'closed'}
        open={formFor !== null}
        onClose={() => setFormFor(null)}
        onCreated={reload}
        employees={employees}
        brands={brands}
        presetAssignee={formFor || ''}
      />
    </>
  );
}
