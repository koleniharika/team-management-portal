import { amountText, computeTotals, lineAmount, upiUri } from './invoices.js';

// ponytail: "INR" instead of ₹ — jsPDF's built-in fonts are WinAnsi and can't encode
// U+20B9. Embedding a Unicode TTF is the upgrade path if the symbol matters.
const money = (n) => (n === '' ? '' : `INR ${amountText(n)}`);
const clean = (v) => String(v ?? '').trim();

/** QR as a PNG data URL; qrcode is imported here so it never lands in the main bundle. */
async function qrDataUrl(text) {
  try {
    const { default: QRCode } = await import('qrcode');
    return await QRCode.toDataURL(text, { margin: 1, width: 320 });
  } catch {
    return '';
  }
}

const prettyDate = (d) => {
  if (!clean(d)) return '';
  const [y, m, day] = clean(d).slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return clean(d);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Builds the bill and hands it to the browser. Blank fields simply don't print.
 * jsPDF is imported on click — it is ~450kB that no other page needs.
 */
export async function downloadInvoicePdf(invoice) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const page = doc.internal.pageSize;
  const M = 48;                    // margin
  const right = page.getWidth() - M;
  let y = 64;

  // ---- sender, big at the top ----
  if (clean(invoice.sender)) {
    doc.setFont('helvetica', 'bold').setFontSize(24).setTextColor(7, 5, 21);
    doc.text(clean(invoice.sender), M, y);
    y += 12;
  }

  // ---- meta: date, number, PAN (right column, only what exists) ----
  const meta = [
    ['Invoice no.', clean(invoice.number)],
    ['Date', prettyDate(invoice.date)],
    ['PAN', clean(invoice.pan)],
  ].filter(([, v]) => v);

  let metaY = clean(invoice.sender) ? 52 : 64;
  doc.setFontSize(10);
  for (const [label, value] of meta) {
    doc.setFont('helvetica', 'normal').setTextColor(120, 120, 120);
    doc.text(label, right - 150, metaY);
    doc.setFont('helvetica', 'bold').setTextColor(7, 5, 21);
    doc.text(value, right, metaY, { align: 'right' });
    metaY += 15;
  }

  y = Math.max(y + 18, metaY + 10);
  doc.setDrawColor(220, 220, 220).line(M, y, right, y);
  y += 28;

  // ---- bill to ----
  const clientLines = clean(invoice.clientDetails).split('\n').map(clean).filter(Boolean);
  if (clean(invoice.clientName) || clientLines.length) {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(120, 120, 120);
    doc.text('BILL TO', M, y);
    y += 16;
    if (clean(invoice.clientName)) {
      doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(7, 5, 21);
      doc.text(clean(invoice.clientName), M, y);
      y += 16;
    }
    if (clientLines.length) {
      doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90, 90, 90);
      for (const line of clientLines) {
        doc.text(doc.splitTextToSize(line, 300), M, y);
        y += 14;
      }
    }
    y += 14;
  }

  // ---- line items (skipped entirely when nothing was filled in) ----
  const rows = (invoice.lines || [])
    .filter((l) => clean(l.description) || clean(l.qty) || clean(l.rate) || clean(l.amount))
    .map((l) => [clean(l.description), clean(l.qty), clean(l.rate) ? money(Number(l.rate)) : '', money(lineAmount(l))]);

  if (rows.length) {
    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qty', 'Rate', 'Amount']],
      body: rows,
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 8, textColor: [7, 5, 21], lineColor: [230, 230, 230], lineWidth: 0.5 },
      headStyles: { fillColor: [7, 5, 21], textColor: [248, 248, 248], fontSize: 9 },
      columnStyles: {
        1: { halign: 'right', cellWidth: 55 },
        2: { halign: 'right', cellWidth: 95 },
        3: { halign: 'right', cellWidth: 105 },
      },
    });
    y = doc.lastAutoTable.finalY + 24;
  }

  // ---- totals, bottom right ----
  const { subtotal, tax, total } = computeTotals(invoice.lines || [], invoice.taxPercent);
  const totalRows = [
    ['Subtotal', money(subtotal)],
    [clean(invoice.taxPercent) ? `Tax (${clean(invoice.taxPercent)}%)` : 'Tax', money(tax)],
    ['Total', money(total)],
  ].filter(([, v]) => v);

  if (totalRows.length) {
    for (const [label, value] of totalRows) {
      const isTotal = label === 'Total';
      doc.setFontSize(isTotal ? 13 : 10);
      doc.setFont('helvetica', isTotal ? 'bold' : 'normal').setTextColor(isTotal ? 7 : 120, isTotal ? 5 : 120, isTotal ? 21 : 120);
      doc.text(label, right - 160, y);
      doc.setFont('helvetica', 'bold').setTextColor(7, 5, 21);
      doc.text(value, right, y, { align: 'right' });
      y += isTotal ? 24 : 18;
    }
  }

  // ---- UPI id + QR (both optional, both skipped when blank) ----
  const payLink = upiUri(invoice, total);
  const qr = clean(invoice.qrDataUrl) || (payLink ? await qrDataUrl(payLink) : '');

  if (clean(invoice.upiId) || qr) {
    y += 12;
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(120, 120, 120);
    doc.text('PAY VIA UPI', M, y);
    y += 15;
    if (clean(invoice.upiId)) {
      doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(7, 5, 21);
      doc.text(clean(invoice.upiId), M, y);
      y += 8;
    }
    if (qr) {
      try {
        doc.addImage(qr, 'PNG', M, y, 96, 96);
        y += 104;
      } catch {
        // an unreadable uploaded image shouldn't sink the whole bill
        y += 4;
      }
    }
  }

  // ---- notes ----
  if (clean(invoice.notes)) {
    y += 10;
    doc.setDrawColor(230, 230, 230).line(M, y, right, y);
    y += 22;
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(120, 120, 120);
    doc.text('NOTES', M, y);
    y += 15;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(70, 70, 70);
    doc.text(doc.splitTextToSize(clean(invoice.notes), right - M), M, y);
  }

  const stamp = clean(invoice.number) || clean(invoice.date) || 'draft';
  doc.save(`invoice-${stamp.replace(/[^\w.-]+/g, '-')}.pdf`);
}
