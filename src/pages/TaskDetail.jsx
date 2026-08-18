import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { confirmDeleteTask, db, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, Empty, ErrorNote, Field, Loading, Modal, TextArea } from '../components/ui';
import { PRIORITY_TONE, canDeleteTask, fmtDate, isOverdue, toDateTime, today } from '../lib/util';

export default function TaskDetail() {
  const { id } = useParams();
  const { employee, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error: loadError, reload } = useAsync(
    () => db.get('tasks', id).then(async (task) => ({
      task,
      brand: task.brandId ? await db.get('brands', task.brandId).catch(() => null) : null,
      people: await db.list('employees'),
      comments: await db.list('comments', [Query.equal('taskId', id), Query.orderAsc('$createdAt')]),
    })),
    [id],
  );

  if (loading) return <Loading />;
  if (loadError || !data) return <ErrorNote error={loadError || 'Task not found.'} />;

  const { task, brand, people, comments } = data;
  const assignee = people.find((p) => p.userId === task.assignedTo);
  const creator = people.find((p) => p.userId === task.createdBy);
  const canComment = isAdmin || task.assignedTo === employee.userId;

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try { await fn(); await reload(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const postComment = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    act(async () => {
      await db.create('comments', {
        taskId: id,
        authorId: employee.userId,
        authorName: employee.name,
        message: message.trim(),
      });
      setMessage('');
    });
  };

  // deleting takes the task's comments with it, then drops us back to the list
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      if (await confirmDeleteTask(task)) navigate(isAdmin ? '/admin' : '/me', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // completedAt holds the local calendar day it was closed, same encoding as deadline,
  // so the on-time comparison never straddles a timezone. The real instant is $updatedAt.
  const approve = () => act(() => db.update('tasks', id, { status: 'done', completedAt: toDateTime(today()) }));

  const reject = (remark) => act(async () => {
    await db.update('tasks', id, { status: 'pending', remarks: remark });
    await db.create('comments', {
      taskId: id, authorId: employee.userId, authorName: employee.name,
      message: `Sent back for changes: ${remark}`,
    });
    setRejecting(false);
  });

  return (
    <div className="stack">
      <div className="row-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
        {canDeleteTask(task, employee) && (
          <Button variant="danger" size="sm" onClick={remove} disabled={busy}>Delete task</Button>
        )}
      </div>

      <Card feature className={isOverdue(task) ? 'card-overdue' : ''}>
        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <Badge tone={PRIORITY_TONE[task.priority]} solid>{task.priority}</Badge>
          <Badge tone={task.status === 'done' ? 'green' : task.status === 'submitted' ? 'purple' : undefined}>{task.status}</Badge>
          {brand && <Badge>{brand.name}</Badge>}
          {isOverdue(task) && <Badge tone="orange" solid>overdue</Badge>}
        </div>

        <h1 className="display display-lg" style={{ marginBottom: 16 }}>{task.title}</h1>
        {task.description && <p style={{ whiteSpace: 'pre-wrap', maxWidth: '70ch' }}>{task.description}</p>}

        <hr className="hr" />
        <dl className="dl" style={{ gridTemplateColumns: 'auto 1fr', maxWidth: 520 }}>
          <dt>Assigned to</dt><dd>{assignee?.name || '—'}</dd>
          <dt>Created by</dt><dd>{creator?.name || '—'}</dd>
          <dt>Deadline</dt><dd>{fmtDate(task.deadline)}</dd>
          {task.completedAt && (<><dt>Completed</dt><dd>{fmtDate(task.completedAt)}</dd></>)}
          {task.submissionLink && (
            <><dt>Submission</dt><dd><a href={task.submissionLink} target="_blank" rel="noreferrer">Open link ↗</a></dd></>
          )}
          {task.remarks && (<><dt>Remarks</dt><dd>{task.remarks}</dd></>)}
        </dl>

        {isAdmin && task.status === 'submitted' && (
          <div className="row" style={{ marginTop: 24 }}>
            <Button variant="green" onClick={approve} disabled={busy}>Approve &amp; close</Button>
            <Button variant="ghost" onClick={() => setRejecting(true)} disabled={busy}>Send back</Button>
          </div>
        )}
        {isAdmin && task.status !== 'done' && task.status !== 'submitted' && (
          <div className="row" style={{ marginTop: 24 }}>
            <Button variant="ghost" onClick={approve} disabled={busy}>Mark done</Button>
          </div>
        )}
        <ErrorNote error={error} />
      </Card>

      <section>
        <h2 className="display display-md" style={{ marginBottom: 16 }}>Activity</h2>
        <div className="thread">
          {comments.length === 0 && <Empty>No comments yet.</Empty>}
          {comments.map((c) => (
            <div key={c.$id} className="bubble">
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 14 }}>{c.authorName}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{new Date(c.$createdAt).toLocaleString()}</span>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.message}</p>
            </div>
          ))}
        </div>

        {canComment ? (
          <form onSubmit={postComment} style={{ marginTop: 20 }}>
            <Field label="Add a comment">
              <TextArea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Feedback, blockers, status…" />
            </Field>
            <Button disabled={busy || !message.trim()}>Post comment</Button>
          </form>
        ) : (
          <p className="muted" style={{ marginTop: 20 }}>Only the assignee and admins can comment here.</p>
        )}
      </section>

      <RejectModal open={rejecting} onClose={() => setRejecting(false)} onReject={reject} busy={busy} />
      {!canComment && <Link to="/me" className="muted">Back to my work</Link>}
    </div>
  );
}

function RejectModal({ open, onClose, onReject, busy }) {
  const [remark, setRemark] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Send back" subtitle="Task returns to pending with your note.">
      <form onSubmit={(e) => { e.preventDefault(); onReject(remark.trim()); setRemark(''); }}>
        <Field label="What needs changing?">
          <TextArea required value={remark} onChange={(e) => setRemark(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="orange" disabled={busy || !remark.trim()}>Send back</Button>
        </div>
      </form>
    </Modal>
  );
}
