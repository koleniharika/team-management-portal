import { useMemo, useState } from 'react';
import { db, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import { Button, Empty, ErrorNote, Field, Input, Loading, Modal, PageHead, Stat, TextArea } from '../components/ui';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';
import { byId, isOverdue } from '../lib/util';

export default function EmployeeDashboard() {
  const { employee } = useAuth();
  const [creating, setCreating] = useState(false);
  const [submitFor, setSubmitFor] = useState(null);

  const { data, loading, error, reload } = useAsync(
    () => Promise.all([
      db.list('tasks', [Query.equal('assignedTo', employee.userId), Query.orderAsc('deadline')]),
      db.list('brands', [Query.orderAsc('name')]),
    ]).then(([tasks, brands]) => ({ tasks, brands })),
    [employee.userId],
  );

  const { tasks = [], brands = [] } = data || {};
  const brandsById = useMemo(() => byId(brands), [brands]);
  const open = tasks.filter((t) => t.status !== 'done');
  const late = open.filter(isOverdue).length;

  return (
    <>
      <PageHead eyebrow={`Hi ${employee.name.split(' ')[0]}`} title="Your desk">
        <Button onClick={() => setCreating(true)}>+ Create task</Button>
      </PageHead>

      <div className="grid grid-stats" style={{ marginBottom: 32 }}>
        <Stat label="Open tasks" value={open.length} tone="purple" />
        <Stat label="Overdue" value={late} tone="orange" />
        <Stat label="Completed" value={tasks.length - open.length} tone="green" />
      </div>

      <ErrorNote error={error} />
      {loading ? <Loading /> : open.length === 0 ? (
        <Empty>Inbox zero. Nothing assigned to you right now.</Empty>
      ) : (
        <div className="grid grid-cards">
          {open.map((t) => (
            <TaskCard key={t.$id} task={t} brandName={brandsById[t.brandId]?.name}>
              {t.status === 'submitted'
                ? <span className="muted" style={{ fontSize: 13 }}>Waiting on review</span>
                : <Button size="sm" onClick={() => setSubmitFor(t)}>Submit work</Button>}
            </TaskCard>
          ))}
        </div>
      )}

      <TaskForm
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={reload}
        brands={brands}
        lockedTo={employee.userId}
      />
      <SubmitModal task={submitFor} onClose={() => setSubmitFor(null)} onDone={reload} />
    </>
  );
}

function SubmitModal({ task, onClose, onDone }) {
  const [form, setForm] = useState({ submissionLink: '', remarks: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await db.update('tasks', task.$id, {
        status: 'submitted',
        submissionLink: form.submissionLink.trim(),
        remarks: form.remarks.trim(),
      });
      setForm({ submissionLink: '', remarks: '' });
      onClose();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!task} onClose={onClose} title="Submit work" subtitle={task?.title}>
      <form onSubmit={submit}>
        <Field label="Submission link">
          <Input type="url" required placeholder="https://drive.google.com/…"
            value={form.submissionLink} onChange={(e) => setForm({ ...form, submissionLink: e.target.value })} />
        </Field>
        <Field label="Remarks">
          <TextArea placeholder="Anything the reviewer should know"
            value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
        </Field>
        <ErrorNote error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="green" disabled={busy}>{busy ? 'Sending…' : 'Submit for review'}</Button>
        </div>
      </form>
    </Modal>
  );
}
