import { Link } from 'react-router-dom';
import { Badge, Button, Card } from './ui';
import { PRIORITY_TONE, fmtDate, isOverdue } from '../lib/util';

const STATUS_TONE = {
  pending: 'yellow',
  'in-progress': 'blue',
  submitted: 'lilac',
  approved: 'lime',
  done: 'lime',
  rejected: 'pink',
};

export default function TaskCard({ task, brandName, assigneeName, onDelete, children }) {
  const late = isOverdue(task);
  // calm list card: the only colour block is the priority rule down the left edge
  const rule = late ? 'orange' : PRIORITY_TONE[task.priority] || 'lilac';

  return (
    <Card
      hover
      className={`reveal card-rule ${late ? 'card-overdue' : ''}`}
      style={{ '--rule': `var(--${rule})`, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div className="row" style={{ gap: 8 }}>
        <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
        <Badge tone={STATUS_TONE[task.status]}>{task.status}</Badge>
        {brandName && <Badge>{brandName}</Badge>}
        {late && <Badge tone="orange">overdue</Badge>}
      </div>

      <Link to={`/tasks/${task.id}`} className="link-plain">
        <h3 className="card-title">{task.title}</h3>
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
