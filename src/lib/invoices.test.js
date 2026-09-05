// Blank-stays-blank is the whole contract of this module. Run: `npm run check`
import assert from 'node:assert/strict';
import { num, lineAmount, computeTotals, amountText, blankInvoice } from './invoices.js';

assert.equal(num(''), '', 'empty string is blank, not 0');
assert.equal(num('   '), '', 'whitespace is blank');
assert.equal(num(undefined), '');
assert.equal(num('abc'), '', 'junk is blank');
assert.equal(num('0'), 0, 'a typed zero is a real zero');
assert.equal(num('1200.50'), 1200.5);

assert.equal(lineAmount({ amount: '500' }), 500, 'typed amount wins');
assert.equal(lineAmount({ qty: '3', rate: '100' }), 300, 'qty x rate when amount is blank');
assert.equal(lineAmount({ qty: '3', rate: '100', amount: '250' }), 250, 'typed amount beats the maths');
assert.equal(lineAmount({ qty: '3' }), '', 'qty alone is not an amount');
assert.equal(lineAmount({ description: 'reel edit' }), '', 'text-only line has no amount');
assert.equal(lineAmount({}), '');

const empty = computeTotals(blankInvoice().lines, '');
assert.deepEqual(
  { s: empty.subtotal, t: empty.tax, g: empty.total },
  { s: '', t: '', g: '' },
  'an untouched form totals to blanks, never zeroes',
);

const noAmounts = computeTotals([{ description: 'strategy call' }], '18');
assert.equal(noAmounts.subtotal, '', 'no numbers in, no subtotal out');
assert.equal(noAmounts.tax, '', 'tax percent alone does not conjure a total');

const one = computeTotals([{ amount: '1000' }, { description: 'freebie' }], '');
assert.equal(one.subtotal, 1000, 'blank lines are skipped, not counted as 0');
assert.equal(one.tax, '', 'no tax percent means a blank tax line');
assert.equal(one.total, 1000, 'total falls back to the subtotal');

const taxed = computeTotals([{ qty: '2', rate: '2500' }, { amount: '1000' }], '18');
assert.equal(taxed.subtotal, 6000);
assert.equal(taxed.tax, 1080);
assert.equal(taxed.total, 7080);
assert.deepEqual(taxed.amounts, [5000, 1000], 'per-line amounts come back for the table');

assert.equal(computeTotals([{ amount: '100' }], '2.5').tax, 2.5, 'fractional tax keeps its paise');
assert.equal(computeTotals([{ amount: '0' }], '18').subtotal, 0, 'an explicit 0 is a value, not a blank');

assert.equal(amountText(''), '', 'blank prints blank');
assert.equal(amountText(1234567), '12,34,567', 'indian digit grouping');

console.log('invoice self-check ok');
