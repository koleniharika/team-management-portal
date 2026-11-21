import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Badge, Card, Empty, ErrorNote, Loading, PageHead, Stat } from '../components/ui';
import { daysBetween, fmtDate } from '../lib/util';

export default function ReportCard() {
  const { userId } = useParams();

  const { data, loading, error } = useAsync(
    () => Promise.all([
      api.get('employees', userId),
      api.list('tasks', { assignedTo: userId, status: 'all' }),
    ]).then(([employee, tasks]) => ({ employee, tasks })),
    [userId],
  );

  if (loading) return <Loading />;
  if (error || !data?.employee) return <ErrorNote error={error || 'Employee not found.'} />;

  const { employee, tasks } = data;
  const done = tasks.filter((t) => t.status === 'done');
  const late = done.filter((t) => t.deadline && t.completedAt && daysBetween(t.deadline, t.completedAt) > 0);
  const onTime = done.length - late.length;
  const active = tasks.filter((t) => t.status !== 'done');
  const rate = done.length ? Math.round((onTime / done.length) * 100) : 0;

  return (
    <>
      <PageHead eyebrow={`${employee.subRole || employee.role} · joined ${fmtDate(employee.joinDate)}`} title={employee.name}>
        <Link to="/team" className="btn btn-ghost">← Team</Link>
      </PageHead>

      <div className="grid grid-stats">
        <Stat label="Completed" value={done.length} tone="lime" />
        <Stat label="On time" value={onTime} tone="lime" />
        <Stat label="Late" value={late.length} tone="orange" />
        <Stat label="Active now" value={active.length} tone="lilac" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 24 }}>
        <Card feature accent="lime">
          <p className="eyebrow">On-time rate</p>
          <p className="display display-xl" style={{ margin: '8px 0' }}>{rate}%</p>
          <p className="muted" style={{ margin: 0 }}>{onTime} of {done.length} delivered by the deadline</p>
        </Card>
      </div>

      <section className="section">
        <h2 className="display display-md" style={{ marginBottom: 16 }}>Completed work</h2>
        {done.length === 0 ? <Empty>Nothing completed yet.</Empty> : (
          <div className="table-wrap">
            <table className="table-stack">
              <thead><tr><th>Task</th><th>Deadline</th><th>Completed</th><th className="num">Result</th></tr></thead>
              <tbody>
                {done.map((t) => {
                  const overshoot = t.deadline && t.completedAt ? daysBetween(t.deadline, t.completedAt) : 0;
                  return (
                    <tr key={t.id}>
                      <td data-label="Task"><Link to={`/tasks/${t.id}`} className="link-plain"><strong>{t.title}</strong></Link></td>
                      <td data-label="Deadline">{fmtDate(t.deadline)}</td>
                      <td data-label="Completed">{fmtDate(t.completedAt)}</td>
                      <td className="num" data-label="Result">
                        {overshoot > 0
                          ? <Badge tone="orange">{overshoot}d late</Badge>
                          : <Badge tone="lime">on time</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
