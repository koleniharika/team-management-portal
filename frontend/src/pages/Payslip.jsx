import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Badge, Button, Card, ErrorNote, Loading } from '../components/ui';
import { fmtDate, fmtMonth, money, netPay } from '../lib/util';

export default function Payslip() {
  const { userId, month } = useParams();

  const { data, loading, error } = useAsync(
    () => Promise.all([
      api.get('employees', userId),
      api.list('payments', { employeeId: userId, month }),
    ]).then(([employee, pay]) => ({ employee, pay: pay[0] })),
    [userId, month],
  );

  if (loading) return <Loading />;
  if (error || !data?.employee) return <ErrorNote error={error || 'Employee not found.'} />;

  const { employee, pay } = data;
  if (!pay) return (
    <>
      <ErrorNote error={`No payment record for ${fmtMonth(month)}.`} />
      <Link to="/salary" className="btn btn-ghost" style={{ marginTop: 16 }}>← Payroll</Link>
    </>
  );

  const lines = [
    ['Base salary', pay.base],
    ['Bonus', pay.bonus],
    ['Deductions', -Math.abs(pay.deductions || 0)],
  ];

  return (
    <>
      <div className="row-between no-print" style={{ marginBottom: 24 }}>
        <Link to="/salary" className="btn btn-ghost">← Payroll</Link>
        <Button onClick={() => window.print()}>Print payslip</Button>
      </div>

      <Card feature style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow">Payslip</p>
            <h1 className="display display-lg">{fmtMonth(month)}</h1>
          </div>
          <span className="logo">studio<em style={{ color: 'var(--lime)', fontStyle: 'normal' }}>.</em>erp</span>
        </div>

        <hr className="hr" />

        <dl className="dl" style={{ maxWidth: 420 }}>
          <dt>Employee</dt><dd>{employee.name}</dd>
          <dt>Role</dt><dd>{employee.subRole || employee.role}</dd>
          <dt>Email</dt><dd>{employee.email}</dd>
          <dt>Joined</dt><dd>{fmtDate(employee.joinDate)}</dd>
        </dl>

        <hr className="hr" />

        <table>
          <tbody>
            {lines.map(([label, amount]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="num">{amount < 0 ? `−${money(Math.abs(amount))}` : money(amount)}</td>
              </tr>
            ))}
            <tr>
              <td><strong>Net pay</strong></td>
              <td className="num"><strong className="display display-md">{money(netPay(pay))}</strong></td>
            </tr>
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 24 }}>
          <Badge tone={pay.status === 'paid' ? 'lime' : 'orange'} solid>{pay.status}</Badge>
          {pay.paidOn && <span className="muted">Paid on {fmtDate(pay.paidOn)}</span>}
        </div>

        <p className="muted" style={{ fontSize: 12, marginTop: 32 }}>
          Computer-generated payslip · no signature required.
        </p>
      </Card>
    </>
  );
}
