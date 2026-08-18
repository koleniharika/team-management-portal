import { useMemo, useState } from 'react';
import { confirmDeleteTask, db, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHead, Select } from '../components/ui';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';
import { byId } from '../lib/util';

const NO_FILTERS = { q: '', role: '', subRole: '', brandId: '', priority: '', status: '' };

export default function AdminDashboard() {
  const [nearestFirst, setNearestFirst] = useState(true);
  const [formFor, setFormFor] = useState(null); // null = closed, '' = anyone, userId = preset
  const [filters, setFilters] = useState(NO_FILTERS);
  const [error, setError] = useState(null);

  const { data, loading, error: loadError, reload } = useAsync(
    () => Promise.all([
      db.list('tasks', [Query.notEqual('status', 'done'), Query.limit(500)]),
      db.list('employees', [Query.orderAsc('name')]),
      db.list('brands', [Query.orderAsc('name')]),
      db.list('roles', [Query.orderAsc('name')]),
    ]).then(([tasks, employees, brands, roles]) => ({ tasks, employees, brands, roles })),
    [],
  );

  const { tasks = [], employees = [], brands = [], roles = [] } = data || {};
  const brandsById = useMemo(() => byId(brands), [brands]);
  const empByUserId = useMemo(() => byId(employees, 'userId'), [employees]);

  const sorted = useMemo(() => {
    const dir = nearestFirst ? 1 : -1;
    return [...tasks].sort((a, b) => dir * String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
  }, [tasks, nearestFirst]);

  const workload = useMemo(() => {
    const counts = {};
    for (const t of tasks) counts[t.assignedTo] = (counts[t.assignedTo] || 0) + 1;
    return counts;
  }, [tasks]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const q = filters.q.trim().toLowerCase();
  const dirty = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  // every filter is AND-ed; tasks match the people filters through their assignee
  const shownTasks = sorted.filter((t) => {
    const emp = empByUserId[t.assignedTo];
    return (!q || (emp?.name || '').toLowerCase().includes(q))
      && (!filters.role || emp?.role === filters.role)
      && (!filters.subRole || emp?.subRole === filters.subRole)
      && (!filters.brandId || t.brandId === filters.brandId)
      && (!filters.priority || t.priority === filters.priority)
      && (!filters.status || t.status === filters.status);
  });

  const shownEmployees = employees.filter((e) =>
    (!q || e.name.toLowerCase().includes(q))
    && (!filters.role || e.role === filters.role)
    && (!filters.subRole || e.subRole === filters.subRole));

  const removeTask = async (task) => {
    setError(null);
    try {
      if (await confirmDeleteTask(task)) reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHead eyebrow={`${tasks.length} open ${tasks.length === 1 ? 'task' : 'tasks'}`} title="Command desk">
        <Button variant="ghost" onClick={() => setNearestFirst((v) => !v)}>
          Deadline {nearestFirst ? '↑ nearest' : '↓ farthest'}
        </Button>
        <Button onClick={() => setFormFor('')}>+ Create task</Button>
      </PageHead>

      <div className="filter-bar">
        <Field label="Search name">
          <Input value={filters.q} onChange={set('q')} placeholder="Employee name…" />
        </Field>
        <Field label="Role">
          <Select value={filters.role} onChange={set('role')}>
            <option value="">All roles</option>
            <option value="admin">admin</option>
            <option value="employee">employee</option>
          </Select>
        </Field>
        <Field label="Sub role">
          <Select value={filters.subRole} onChange={set('subRole')}>
            <option value="">All sub roles</option>
            {roles.map((r) => <option key={r.$id} value={r.name}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Brand">
          <Select value={filters.brandId} onChange={set('brandId')}>
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.$id} value={b.$id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={filters.priority} onChange={set('priority')}>
            <option value="">Any priority</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={set('status')}>
            <option value="">Any status</option>
            <option value="pending">pending</option>
            <option value="in-progress">in-progress</option>
            <option value="submitted">submitted</option>
            <option value="rejected">rejected</option>
          </Select>
        </Field>
        {dirty && (
          <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)} style={{ alignSelf: 'end' }}>
            Clear filters
          </Button>
        )}
      </div>

      <ErrorNote error={loadError || error} />
      {loading ? <Loading /> : (
        <div className="grid grid-split">
          <section>
            <h2 className="eyebrow" style={{ marginBottom: 16 }}>
              Open work{dirty ? ` · ${shownTasks.length} of ${tasks.length}` : ''}
            </h2>
            {shownTasks.length === 0 ? (
              <Empty>{dirty ? 'No tasks match these filters.' : 'Nothing open. Suspiciously quiet.'}</Empty>
            ) : (
              <div className="grid grid-cards">
                {shownTasks.map((t) => (
                  <TaskCard
                    key={t.$id}
                    task={t}
                    brandName={brandsById[t.brandId]?.name}
                    assigneeName={empByUserId[t.assignedTo]?.name || 'Unassigned'}
                    onDelete={removeTask}
                  />
                ))}
              </div>
            )}
          </section>

          <Card feature as="section" className="panel-sticky">
            <h2 className="display display-md" style={{ marginBottom: 4 }}>The team</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Number = active tasks. Balance before you assign.</p>
            <div className="stack" style={{ gap: 12, marginTop: 20 }}>
              {shownEmployees.map((e) => (
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
              {shownEmployees.length === 0 && (
                <Empty>{employees.length ? 'Nobody matches these filters.' : 'No employees yet.'}</Empty>
              )}
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
