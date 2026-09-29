import { useMemo, useState } from 'react';
import { api, confirmDeleteTask } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Button, Empty, ErrorNote, Field, Input, Loading, PageHead, Select } from '../components/ui';
import TaskCard from '../components/TaskCard';
import { byId } from '../lib/util';

const REVIEW_STATUSES = ['submitted', 'approved', 'done'];
const NO_FILTERS = { q: '', title: '', brandId: '', status: '', priority: '', dateField: 'deadline', from: '', to: '' };

export default function CompletedTasks() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [error, setError] = useState(null);

  const { data, loading, error: loadError, reload } = useAsync(
    () => Promise.all([
      api.list('tasks', { status: REVIEW_STATUSES.join(',') }),
      api.list('employees'),
      api.list('brands'),
    ]).then(([tasks, employees, brands]) => ({ tasks, employees, brands })),
    [],
  );

  const { tasks = [], employees = [], brands = [] } = data || {};
  const brandsById = useMemo(() => byId(brands), [brands]);
  const empById = useMemo(() => byId(employees), [employees]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const q = filters.q.trim().toLowerCase();
  const title = filters.title.trim().toLowerCase();
  const dirty = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  // all filters AND together; the date range reads whichever column is selected
  const shown = useMemo(() => tasks.filter((t) => {
    const emp = empById[t.assignedTo];
    const day = String(t[filters.dateField] || '').slice(0, 10);
    return (!q || (emp?.name || '').toLowerCase().includes(q))
      && (!title || (t.title || '').toLowerCase().includes(title))
      && (!filters.brandId || t.brandId === filters.brandId)
      && (!filters.status || t.status === filters.status)
      && (!filters.priority || t.priority === filters.priority)
      && (!filters.from || (day && day >= filters.from))
      && (!filters.to || (day && day <= filters.to));
  }).sort((a, b) => String(b.completedAt || b.deadline || '').localeCompare(String(a.completedAt || a.deadline || ''))),
  [tasks, empById, q, title, filters]);

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
      <PageHead
        eyebrow={`${tasks.length} submitted, approved or done`}
        title="Review desk"
      >
        {dirty && <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>}
      </PageHead>

      <div className="filter-bar">
        <Field label="Employee">
          <Input value={filters.q} onChange={set('q')} placeholder="Name…" />
        </Field>
        <Field label="Task title">
          <Input value={filters.title} onChange={set('title')} placeholder="Search titles…" />
        </Field>
        <Field label="Brand">
          <Select value={filters.brandId} onChange={set('brandId')}>
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={set('status')}>
            <option value="">Any status</option>
            {REVIEW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <Field label="Date range on">
          <Select value={filters.dateField} onChange={set('dateField')}>
            <option value="deadline">deadline</option>
            <option value="completedAt">completed</option>
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" value={filters.from} onChange={set('from')} />
        </Field>
        <Field label="To">
          <Input type="date" value={filters.to} onChange={set('to')} />
        </Field>
      </div>

      <ErrorNote error={loadError || error} />
      {loading ? <Loading /> : shown.length === 0 ? (
        <Empty>{dirty ? 'No submissions match these filters.' : 'Nothing submitted yet.'}</Empty>
      ) : (
        <>
          <p className="eyebrow" style={{ marginBottom: 16 }}>
            Showing {shown.length} of {tasks.length}
          </p>
          <div className="grid grid-cards">
            {shown.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                brandName={brandsById[t.brandId]?.name}
                assigneeName={empById[t.assignedTo]?.name || 'Unassigned'}
                onDelete={removeTask}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
