import { Hono } from 'hono';
import { all, insert, remove } from '../lib/db.js';
import { requireAdmin } from '../middleware/auth.js';

// Text notes only — there is no file storage in this project.
const dumps = new Hono();

dumps.get('/', async (c) => c.json(
  await all(c.env.DB, 'SELECT * FROM dumps ORDER BY createdAt DESC'),
));

dumps.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const content = String(body.content || '').trim();
  if (!content) return c.json({ error: 'Nothing to save.' }, 400);

  return c.json(await insert(c.env.DB, 'dumps', { content, createdBy: c.get('user').id }), 201);
});

/** Anyone can post a note; only admins clear the board. */
dumps.delete('/:id', requireAdmin, async (c) => {
  await remove(c.env.DB, 'dumps', c.req.param('id'));
  return c.json({ ok: true });
});

export default dumps;
