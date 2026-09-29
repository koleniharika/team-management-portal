import { Hono } from 'hono';
import { all, insert, remove } from '../lib/db.js';
import { requireAdmin } from '../middleware/auth.js';

const roles = new Hono();

roles.get('/', async (c) => c.json(await all(c.env.DB, 'SELECT * FROM roles ORDER BY name COLLATE NOCASE')));

roles.post('/', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.name) return c.json({ error: 'A role name is required.' }, 400);
  return c.json(await insert(c.env.DB, 'roles', { name: String(body.name).trim() }), 201);
});

roles.delete('/:id', requireAdmin, async (c) => {
  await remove(c.env.DB, 'roles', c.req.param('id'));
  return c.json({ ok: true });
});

export default roles;
