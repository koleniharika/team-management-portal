import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Empty, Field, Input, PageHead, TextArea } from '../components/ui';
import { downloadInvoicePdf } from '../lib/invoicePdf';
import {
  amountText, blankInvoice, blankLine, computeTotals, deleteInvoice, loadInvoices, saveInvoice, upiUri,
} from '../lib/invoices';
import { fmtDate } from '../lib/util';

// Local only: no API, no network. Every field is optional by design.
const show = (n) => (n === '' ? '—' : `₹${amountText(n)}`);

export default function Invoices() {
  const [invoice, setInvoice] = useState(blankInvoice);
  const [saved, setSaved] = useState(loadInvoices);
  const [note, setNote] = useState(null);

  const qrInput = useRef(null);
  const [qrPreview, setQrPreview] = useState('');

  const set = (k) => (e) => setInvoice({ ...invoice, [k]: e.target.value });
  const totals = useMemo(() => computeTotals(invoice.lines, invoice.taxPercent), [invoice]);
  const payLink = upiUri(invoice, totals.total);

  // qrcode is imported on demand — the other pages never need it
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing a stale QR is the point
    if (!payLink) { setQrPreview(''); return undefined; }
    let alive = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(payLink, { margin: 1, width: 320 }))
      .then((url) => { if (alive) setQrPreview(url); })
      .catch(() => { if (alive) setQrPreview(''); });
    return () => { alive = false; };
  }, [payLink]);

  /** An uploaded QR is stored inline — keep it small so localStorage survives. */
  const pickQr = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 400_000) { setNote('That QR image is too big — use one under 400 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setInvoice({ ...invoice, qrDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const setLine = (id, key) => (e) => setInvoice({
    ...invoice,
    lines: invoice.lines.map((l) => (l.id === id ? { ...l, [key]: e.target.value } : l)),
  });
  const addLine = () => setInvoice({ ...invoice, lines: [...invoice.lines, blankLine()] });
  const removeLine = (id) => setInvoice({
    ...invoice,
    lines: invoice.lines.length > 1 ? invoice.lines.filter((l) => l.id !== id) : [blankLine()],
  });

  const save = () => {
    const { list, row } = saveInvoice(invoice);
    setSaved(list);
    setInvoice(row);
    setNote('Saved to this browser.');
  };

  const startNew = () => { setInvoice(blankInvoice()); setNote(null); };

  const download = (row) => downloadInvoicePdf(row).catch((err) => setNote(`PDF failed: ${err.message}`));

  const remove = (row) => {
    if (!window.confirm('Delete this saved invoice? This only removes it from this browser.')) return;
    setSaved(deleteInvoice(row.id));
    if (row.id === invoice.id) startNew();
  };

  return (
    <>
      <PageHead eyebrow="Saved in this browser only" title="Invoicing">
        {invoice.id && <Button variant="ghost" onClick={startNew}>+ New invoice</Button>}
        <Button variant="ghost" onClick={save}>Save</Button>
        <Button onClick={() => download(invoice)}>Download PDF</Button>
      </PageHead>

      <Card feature as="section" className="reveal">
        <div className="row-between" style={{ marginBottom: 20 }}>
          <h2 className="display display-md">{invoice.id ? 'Editing invoice' : 'New invoice'}</h2>
          {note && <span className="badge badge-lime">{note}</span>}
        </div>

        <div className="invoice-grid">
          <Field label="Your brand name"><Input value={invoice.sender} onChange={set('sender')} placeholder="Studio name" /></Field>
          <Field label="Invoice number"><Input value={invoice.number} onChange={set('number')} placeholder="INV-014" /></Field>
          <Field label="Invoice date"><Input type="date" value={invoice.date} onChange={set('date')} /></Field>
          <Field label="Bill to"><Input value={invoice.clientName} onChange={set('clientName')} placeholder="Client / brand name" /></Field>
          <Field label="PAN number"><Input value={invoice.pan} onChange={set('pan')} placeholder="ABCDE1234F" /></Field>
          <Field label="Tax %" hint="optional"><Input value={invoice.taxPercent} onChange={set('taxPercent')} placeholder="18" inputMode="decimal" /></Field>
          <Field label="UPI ID" hint="optional"><Input value={invoice.upiId} onChange={set('upiId')} placeholder="you@bank" /></Field>
        </div>

        <Field label="Client address / details">
          <TextArea value={invoice.clientDetails} onChange={set('clientDetails')} rows={3}
            placeholder={'Street, city\nGSTIN / email / phone'} style={{ minHeight: 80 }} />
        </Field>

        <hr className="hr" />

        <div className="row-between" style={{ marginBottom: 12 }}>
          <h3 className="card-title">Line items</h3>
          <Button size="sm" variant="ghost" onClick={addLine}>+ Add line</Button>
        </div>

        <div className="stack" style={{ gap: 10 }}>
          {invoice.lines.map((line, i) => (
            <div className="line-row" key={line.id}>
              <Input aria-label={`Description ${i + 1}`} value={line.description} onChange={setLine(line.id, 'description')} placeholder="Description / product" />
              <Input aria-label={`Quantity ${i + 1}`} value={line.qty} onChange={setLine(line.id, 'qty')} placeholder="Qty" inputMode="decimal" />
              <Input aria-label={`Rate ${i + 1}`} value={line.rate} onChange={setLine(line.id, 'rate')} placeholder="Rate" inputMode="decimal" />
              <Input aria-label={`Amount ${i + 1}`} value={line.amount} onChange={setLine(line.id, 'amount')}
                placeholder={totals.amounts[i] === '' ? 'Amount' : `${amountText(totals.amounts[i])} (auto)`} inputMode="decimal" />
              <Button size="sm" variant="danger" onClick={() => removeLine(line.id)} aria-label={`Remove line ${i + 1}`}>✕</Button>
            </div>
          ))}
        </div>

        <div className="invoice-pay">
          <div className="invoice-qr">
            <div className="row-between" style={{ marginBottom: 10 }}>
              <h3 className="card-title">Payment QR</h3>
              <div className="row" style={{ gap: 8 }}>
                <Button type="button" size="sm" variant="ghost" onClick={() => qrInput.current?.click()}>
                  Upload QR
                </Button>
                {invoice.qrDataUrl && (
                  <Button type="button" size="sm" variant="danger" onClick={() => setInvoice({ ...invoice, qrDataUrl: '' })}>
                    Remove
                  </Button>
                )}
                <input ref={qrInput} type="file" accept="image/*" hidden onChange={pickQr} />
              </div>
            </div>
            {invoice.upiId && <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>{invoice.upiId}</p>}
            {invoice.qrDataUrl || qrPreview ? (
              <img className="qr-img" src={invoice.qrDataUrl || qrPreview} alt="UPI payment QR" />
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Add a UPI ID to generate one, or upload your own. Both optional.
              </p>
            )}
          </div>

          <dl className="dl">
            <dt>Subtotal</dt><dd>{show(totals.subtotal)}</dd>
            <dt>Tax{invoice.taxPercent ? ` (${invoice.taxPercent}%)` : ''}</dt><dd>{show(totals.tax)}</dd>
            <dt><strong>Total</strong></dt><dd><strong>{show(totals.total)}</strong></dd>
          </dl>
        </div>

        <Field label="Notes / payment details">
          <TextArea value={invoice.notes} onChange={set('notes')} rows={3}
            placeholder={'Bank name, A/C no., IFSC, UPI\nPayable within 15 days'} style={{ minHeight: 80 }} />
        </Field>

        <div className="row" style={{ marginTop: 8 }}>
          <Button onClick={() => download(invoice)}>Download PDF</Button>
          <Button variant="ghost" onClick={save}>{invoice.id ? 'Update saved copy' : 'Save invoice'}</Button>
        </div>
      </Card>

      <section className="section">
        <h2 className="display display-md" style={{ marginBottom: 16 }}>Saved invoices</h2>
        {saved.length === 0 ? (
          <Empty>Nothing saved yet. Fill the form and hit save — it stays in this browser.</Empty>
        ) : (
          <div className="grid grid-cards">
            {saved.map((row) => {
              const t = computeTotals(row.lines || [], row.taxPercent);
              return (
                <Card key={row.id} hover className="reveal card-rule"
                  style={{ '--rule': row.id === invoice.id ? 'var(--lime)' : 'var(--lilac)' }}>
                  <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                    {row.number && <span className="badge badge-lilac">{row.number}</span>}
                    {row.date && <span className="badge">{fmtDate(row.date)}</span>}
                    {row.id === invoice.id && <span className="badge badge-lime">editing</span>}
                  </div>
                  <h3 className="card-title">{row.clientName || row.sender || 'Untitled invoice'}</h3>
                  {row.sender && row.clientName && (
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>from {row.sender}</p>
                  )}
                  <p className="display display-md" style={{ margin: '14px 0 0' }}>{show(t.total)}</p>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                    {(row.lines || []).filter((l) => l.description || l.amount).length} line items
                    {row.savedAt ? ` · saved ${new Date(row.savedAt).toLocaleDateString()}` : ''}
                  </p>
                  <div className="row" style={{ gap: 8, marginTop: 18 }}>
                    <Button size="sm" variant="ghost" onClick={() => { setInvoice(row); setNote(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      Open
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => download(row)}>PDF</Button>
                    <Button size="sm" variant="danger" onClick={() => remove(row)}>Delete</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
