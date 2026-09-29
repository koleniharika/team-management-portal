import { Hono } from 'hono';
import { all, insert, one, remove, update } from '../lib/db.js';
import { requireAdmin } from '../middleware/auth.js';

// Payroll is admin-only, end to end.
const payments = new Hono();
payments.use('*', requireAdmin);

payments.get('/', async (c) => {
  const { employeeId, month } = c.req.query();
  const where = [];
  const params = [];
  if (employeeId) { where.push('employeeId = ?'); params.push(employeeId); }
  if (month) { where.push('month = ?'); params.push(month); }
  const sql = `SELECT * FROM payments ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY month DESC`;
  return c.json(await all(c.env.DB, sql, params));
});

payments.get('/:id', async (c) => {
  const row = await one(c.env.DB, 'SELECT * FROM payments WHERE id = ?', [c.req.param('id')]);
  return row ? c.json(row) : c.json({ error: 'Payment not found.' }, 404);
});

payments.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.employeeId || !body.month) return c.json({ error: 'employeeId and month are required.' }, 400);
  return c.json(await insert(c.env.DB, 'payments', body), 201);
});

payments.patch('/:id', async (c) => {
  const row = await update(c.env.DB, 'payments', c.req.param('id'), await c.req.json().catch(() => ({})));
  return row ? c.json(row) : c.json({ error: 'Payment not found.' }, 404);
});

payments.delete('/:id', async (c) => {
  await remove(c.env.DB, 'payments', c.req.param('id'));
  return c.json({ ok: true });
});

export default payments;
