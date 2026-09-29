import { Hono } from 'hono';
import { all, insert, one, remove } from '../lib/db.js';
import { isAdmin, userId } from '../middleware/auth.js';

const comments = new Hono();

/** Comments inherit the task's visibility: assignee or admin, nobody else. */
const canSeeTask = async (c, taskId) => {
  const task = await one(c.env.DB, 'SELECT assignedTo FROM tasks WHERE id = ?', [taskId]);
  if (!task) return false;
  return isAdmin(c) || task.assignedTo === userId(c);
};

comments.get('/', async (c) => {
  const taskId = c.req.query('taskId');
  if (!taskId) return c.json({ error: 'taskId is required.' }, 400);
  if (!await canSeeTask(c, taskId)) return c.json({ error: 'Not your task.' }, 403);

  return c.json(await all(
    c.env.DB,
    'SELECT * FROM comments WHERE taskId = ? ORDER BY createdAt ASC',
    [taskId],
  ));
});

comments.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.taskId || !body.message) return c.json({ error: 'taskId and message are required.' }, 400);
  if (!await canSeeTask(c, body.taskId)) return c.json({ error: 'Not your task.' }, 403);

  const author = c.get('user');
  return c.json(await insert(c.env.DB, 'comments', {
    taskId: body.taskId,
    message: String(body.message).trim(),
    authorId: author.id,        // never trust a client-supplied author
    authorName: author.name || author.email,
  }), 201);
});

comments.delete('/:id', async (c) => {
  const row = await one(c.env.DB, 'SELECT * FROM comments WHERE id = ?', [c.req.param('id')]);
  if (!row) return c.json({ ok: true });
  if (!isAdmin(c) && row.authorId !== userId(c)) return c.json({ error: 'Not your comment.' }, 403);
  await remove(c.env.DB, 'comments', c.req.param('id'));
  return c.json({ ok: true });
});

export default comments;
