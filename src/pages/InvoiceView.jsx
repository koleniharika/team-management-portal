import { Link, useParams } from 'react-router-dom';
import { db } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { Badge, Button, Card, ErrorNote, Loading } from '../components/ui';
import { fmtDate, money } from '../lib/util';

export default function InvoiceView() {
  const { id } = useParams();

  const { data, loading, error } = useAsync(
    () => db.get('invoices', id).then(async (invoice) => ({
      invoice,
      brand: invoice.brandId ? await db.get('brands', invoice.brandId).catch(() => null) : null,
      tasks: await Promise.all(
        (invoice.taskIds || []).map((tid) => db.get('tasks', tid).catch(() => null)),
      ).then((rows) => rows.filter(Boolean)),
    })),
    [id],
  );

  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote error={error || 'Invoice not found.'} />;

  const { invoice, brand, tasks } = data;
  const rate = Number(brand?.ratePerProject || 0);

  return (
    <>
      <div className="row-between no-print" style={{ marginBottom: 24 }}>
        <Link to="/invoices" className="btn btn-ghost">← Invoices</Link>
        <Button onClick={() => window.print()}>Print invoice</Button>
      </div>

      <Card feature style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow">Invoice · {invoice.$id.slice(-8).toUpperCase()}</p>
            <h1 className="display display-lg">{brand?.name || 'Unknown brand'}</h1>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {brand?.contactName}{brand?.contactInfo ? ` · ${brand.contactInfo}` : ''}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="logo">studio<em style={{ color: 'var(--lime)', fontStyle: 'normal' }}>.</em>erp</span>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              {fmtDate(invoice.periodFrom)} → {fmtDate(invoice.periodTo)}
            </p>
            <Badge tone={invoice.status === 'paid' ? 'lime' : invoice.status === 'sent' ? 'lilac' : undefined}
              style={{ marginTop: 8 }}>{invoice.status}</Badge>
          </div>
        </div>

        <hr className="hr" />

        <table>
          <thead>
            <tr><th>Deliverable</th><th>Completed</th><th className="num">Rate</th></tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.$id}>
                <td>{t.title}</td>
                <td className="muted">{fmtDate(t.completedAt)}</td>
                <td className="num">{money(rate)}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={3} className="muted">Line items unavailable — tasks may have been deleted.</td></tr>
            )}
            <tr>
              <td><strong>Total</strong></td>
              <td />
              <td className="num"><strong className="display display-md">{money(invoice.amount)}</strong></td>
            </tr>
          </tbody>
        </table>

        <p className="muted" style={{ fontSize: 12, marginTop: 32 }}>
          Payable within 15 days of receipt. Thank you for the work.
        </p>
      </Card>
    </>
  );
}
