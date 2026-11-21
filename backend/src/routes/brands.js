import { Hono } from 'hono';
import { all, insert, one, update } from '../lib/db.js';
import { requireAdmin } from '../middleware/auth.js';

const brands = new Hono();

brands.get('/', async (c) => c.json(await all(c.env.DB, 'SELECT * FROM brands ORDER BY name COLLATE NOCASE')));

brands.get('/:id', async (c) => {
  const row = await one(c.env.DB, 'SELECT * FROM brands WHERE id = ?', [c.req.param('id')]);
  return row ? c.json(row) : c.json({ error: 'Brand not found.' }, 404);
});

// Any signed-in user can add a brand — the task form offers "+ add new brand".
brands.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.name) return c.json({ error: 'A brand name is required.' }, 400);
  return c.json(await insert(c.env.DB, 'brands', body), 201);
});

brands.patch('/:id', requireAdmin, async (c) => {
  const row = await update(c.env.DB, 'brands', c.req.param('id'), await c.req.json().catch(() => ({})));
  return row ? c.json(row) : c.json({ error: 'Brand not found.' }, 404);
});

/** Tasks survive a brand delete — they're unlinked, not removed. Its checklist goes with it. */
brands.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  // one batch = one transaction: never a deleted brand with tasks still pointing at it
  const [unlinked] = await db.batch([
    db.prepare('UPDATE tasks SET brandId = NULL WHERE brandId = ?').bind(id),
    db.prepare('DELETE FROM deliverables WHERE brandId = ?').bind(id),
    db.prepare('DELETE FROM brands WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true, tasksUnlinked: unlinked.meta.changes });
});

export default brands;
