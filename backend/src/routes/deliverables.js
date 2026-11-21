import { Hono } from 'hono';
import { all, insert, one, remove, update } from '../lib/db.js';
import { requireAdmin } from '../middleware/auth.js';

// A per-brand checklist. Brand pages are admin-only, so the checklist is too.
const deliverables = new Hono();
deliverables.use('*', requireAdmin);

deliverables.get('/', async (c) => {
  const brandId = c.req.query('brandId');
  if (!brandId) return c.json({ error: 'brandId is required.' }, 400);
  return c.json(await all(c.env.DB, 'SELECT * FROM deliverables WHERE brandId = ? ORDER BY createdAt, rowid', [brandId]));
});

deliverables.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const text = String(body.text || '').trim();
  if (!text) return c.json({ error: 'Write the deliverable first.' }, 400);
  if (!body.brandId || !(await one(c.env.DB, 'SELECT id FROM brands WHERE id = ?', [body.brandId]))) {
    return c.json({ error: 'Brand not found.' }, 404);
  }
  return c.json(await insert(c.env.DB, 'deliverables', {
    brandId: body.brandId, text, done: 0, createdBy: c.get('user').id,
  }), 201);
});

/** Toggle (or set) done; the text can be corrected too. brandId never moves. */
deliverables.patch('/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const data = {};
  if (body.done !== undefined) data.done = body.done ? 1 : 0;
  if (body.text !== undefined) {
    data.text = String(body.text).trim();
    if (!data.text) return c.json({ error: 'A deliverable cannot be blank.' }, 400);
  }
  const row = await update(c.env.DB, 'deliverables', c.req.param('id'), data);
  return row ? c.json(row) : c.json({ error: 'Deliverable not found.' }, 404);
});

deliverables.delete('/:id', async (c) => {
  await remove(c.env.DB, 'deliverables', c.req.param('id'));
  return c.json({ ok: true });
});

export default deliverables;
