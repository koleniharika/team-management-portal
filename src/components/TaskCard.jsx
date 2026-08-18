import { Link } from 'react-router-dom';
import { Badge, Button, Card } from './ui';
import { PRIORITY_TONE, fmtDate, isOverdue } from '../lib/util';

const STATUS_TONE = { submitted: 'purple', 'in-progress': 'green', rejected: 'orange', done: 'green' };

export default function TaskCard({ task, brandName, assigneeName, onDelete, children }) {
  const late = isOverdue(task);

  return (
    <Card hover className={`reveal ${late ? 'card-overdue' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row" style={{ gap: 8 }}>
        <Badge tone={PRIORITY_TONE[task.priority]} solid>{task.priority}</Badge>
        {brandName && <Badge>{brandName}</Badge>}
        {task.status !== 'pending' && <Badge tone={STATUS_TONE[task.status]}>{task.status}</Badge>}
        {late && <Badge tone="orange" solid>overdue</Badge>}
      </div>

      <Link to={`/tasks/${task.$id}`} className="link-plain">
        <h3 className="display display-md">{task.title}</h3>
      </Link>

      {task.description && (
        <p className="muted" style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {task.description}
        </p>
      )}

      <dl className="dl" style={{ marginTop: 'auto' }}>
        {assigneeName && (<><dt>Assigned to</dt><dd>{assigneeName}</dd></>)}
        <dt>Deadline</dt>
        <dd style={late ? { color: 'var(--orange)', fontWeight: 700 } : undefined}>{fmtDate(task.deadline)}</dd>
      </dl>

      {task.submissionLink && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <a href={task.submissionLink} target="_blank" rel="noreferrer">Submission ↗</a>
        </p>
      )}
      {task.remarks && <p className="muted" style={{ margin: 0, fontSize: 13 }}><strong>Remarks:</strong> {task.remarks}</p>}

      {(children || onDelete) && (
        <div className="row" style={{ gap: 8 }}>
          {children}
          {onDelete && (
            <Button size="sm" variant="danger" onClick={() => onDelete(task)} aria-label={`Delete ${task.title}`}>
              Delete
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
