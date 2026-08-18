import { Link, useParams } from 'react-router-dom';
import { db, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { Badge, Card, Empty, ErrorNote, Loading, PageHead, Stat } from '../components/ui';
import { daysBetween, fmtDate, fmtMonth, money, netPay } from '../lib/util';

export default function ReportCard() {
  const { userId } = useParams();

  const { data, loading, error } = useAsync(
    () => Promise.all([
      db.list('employees', [Query.equal('userId', userId), Query.limit(1)]),
      db.list('tasks', [Query.equal('assignedTo', userId), Query.limit(500)]),
      db.list('payments', [Query.equal('employeeId', userId), Query.limit(500)]),
    ]).then(([emp, tasks, payments]) => ({ employee: emp[0], tasks, payments })),
    [userId],
  );

  if (loading) return <Loading />;
  if (error || !data?.employee) return <ErrorNote error={error || 'Employee not found.'} />;

  const { employee, tasks, payments } = data;
  const done = tasks.filter((t) => t.status === 'done');
  const late = done.filter((t) => t.deadline && t.completedAt && daysBetween(t.deadline, t.completedAt) > 0);
  const onTime = done.length - late.length;
  const active = tasks.filter((t) => t.status !== 'done');
  const paid = payments.filter((p) => p.status === 'paid');
  const earnings = paid.reduce((s, p) => s + netPay(p), 0);
  const rate = done.length ? Math.round((onTime / done.length) * 100) : 0;

  return (
    <>
      <PageHead eyebrow={`${employee.subRole || employee.role} · joined ${fmtDate(employee.joinDate)}`} title={employee.name}>
        <Link to="/team" className="btn btn-ghost">← Team</Link>
      </PageHead>

      <div className="grid grid-stats">
        <Stat label="Completed" value={done.length} tone="green" />
        <Stat label="On time" value={onTime} tone="green" />
        <Stat label="Late" value={late.length} tone="orange" />
        <Stat label="Active now" value={active.length} tone="purple" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 24 }}>
        <Card feature accent="green">
          <p className="eyebrow">On-time rate</p>
          <p className="display display-xl" style={{ margin: '8px 0' }}>{rate}%</p>
          <p className="muted" style={{ margin: 0 }}>{onTime} of {done.length} delivered by the deadline</p>
        </Card>
        <Card feature accent="ink">
          <p className="eyebrow">Total earnings</p>
          <p className="display display-xl" style={{ margin: '8px 0' }}>{money(earnings)}</p>
          <p className="muted" style={{ margin: 0 }}>{paid.length} paid {paid.length === 1 ? 'month' : 'months'}</p>
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
                    <tr key={t.$id}>
                      <td data-label="Task"><Link to={`/tasks/${t.$id}`} className="link-plain"><strong>{t.title}</strong></Link></td>
                      <td data-label="Deadline">{fmtDate(t.deadline)}</td>
                      <td data-label="Completed">{fmtDate(t.completedAt)}</td>
                      <td className="num" data-label="Result">
                        {overshoot > 0
                          ? <Badge tone="orange">{overshoot}d late</Badge>
                          : <Badge tone="green">on time</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="display display-md" style={{ marginBottom: 16 }}>Payments</h2>
        {payments.length === 0 ? <Empty>No payment records.</Empty> : (
          <div className="table-wrap">
            <table className="table-stack">
              <thead><tr><th>Month</th><th>Status</th><th className="num">Net</th><th className="num">Payslip</th></tr></thead>
              <tbody>
                {[...payments].sort((a, b) => String(b.month).localeCompare(String(a.month))).map((p) => (
                  <tr key={p.$id}>
                    <td data-label="Month">{fmtMonth(p.month)}</td>
                    <td data-label="Status"><Badge tone={p.status === 'paid' ? 'green' : 'orange'}>{p.status}</Badge></td>
                    <td className="num" data-label="Net">{money(netPay(p))}</td>
                    <td className="num" data-label="Payslip">
                      <Link className="btn btn-ghost btn-sm" to={`/salary/${userId}/${p.month}`}>View</Link>
                    </td>
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
