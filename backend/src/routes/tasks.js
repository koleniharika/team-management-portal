import { Hono } from 'hono';
import { all, csv, insert, one, remove, run, update } from '../lib/db.js';
import { isAdmin, userId } from '../middleware/auth.js';

const tasks = new Hono();

const placeholders = (list) => list.map(() => '?').join(', ');

/**
 * Visibility is enforced here, not in the UI:
 *  - an employee only ever sees tasks assigned to them, whatever they ask for;
 *  - an admin gets pending tasks unless they ask for other statuses on purpose.
 * `status=all` opts out of the status filter (analytics, report cards).
 */
tasks.get('/', async (c) => {
  const { status, statusNot, assignedTo, brandId } = c.req.query();
  const where = [];
  const params = [];

  if (isAdmin(c)) {
    if (assignedTo) { where.push('assignedTo = ?'); params.push(assignedTo); }

    if (!status && !statusNot) {
      where.push('status = ?');
      params.push('pending');
    }
  } else {
    // non-negotiable: their own tasks only
    where.push('assignedTo = ?');
    params.push(userId(c));
  }

  const wanted = status && status !== 'all' ? csv(status) : [];
  if (wanted.length) {
    where.push(`status IN (${placeholders(wanted)})`);
    params.push(...wanted);
  }

  const excluded = statusNot ? csv(statusNot) : [];
  if (excluded.length) {
    where.push(`status NOT IN (${placeholders(excluded)})`);
    params.push(...excluded);
  }

  if (brandId) { where.push('brandId = ?'); params.push(brandId); }

  const sql = `SELECT * FROM tasks ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`
    + ' ORDER BY (deadline IS NULL), deadline ASC, createdAt DESC';
  return c.json(await all(c.env.DB, sql, params));
});

tasks.get('/:id', async (c) => {
  const row = await one(c.env.DB, 'SELECT * FROM tasks WHERE id = ?', [c.req.param('id')]);
  if (!row) return c.json({ error: 'Task not found.' }, 404);
  if (!isAdmin(c) && row.assignedTo !== userId(c)) return c.json({ error: 'Not your task.' }, 403);
  return c.json(row);
});

tasks.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.title) return c.json({ error: 'A title is required.' }, 400);

  // employees can only brief themselves; the creator is always the caller
  const assignedTo = isAdmin(c) ? (body.assignedTo || userId(c)) : userId(c);
  return c.json(
    await insert(c.env.DB, 'tasks', { ...body, assignedTo, createdBy: userId(c), status: body.status || 'pending' }),
    201,
  );
});

tasks.patch('/:id', async (c) => {
  const existing = await one(c.env.DB, 'SELECT * FROM tasks WHERE id = ?', [c.req.param('id')]);
  if (!existing) return c.json({ error: 'Task not found.' }, 404);
  if (!isAdmin(c) && existing.assignedTo !== userId(c)) return c.json({ error: 'Not your task.' }, 403);

  const body = await c.req.json().catch(() => ({}));
  // an employee submitting work must not be able to reassign or approve it
  const data = isAdmin(c) ? body : {
    status: body.status === 'submitted' ? 'submitted' : existing.status,
    submissionLink: body.submissionLink,
    remarks: body.remarks,
  };
  return c.json(await update(c.env.DB, 'tasks', c.req.param('id'), data));
});

/** Admins delete anything; everyone else only what they created. Comments go too. */
tasks.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await one(c.env.DB, 'SELECT * FROM tasks WHERE id = ?', [id]);
  if (!existing) return c.json({ error: 'Task not found.' }, 404);
  if (!isAdmin(c) && existing.createdBy !== userId(c)) {
    return c.json({ error: 'You can only delete tasks you created.' }, 403);
  }

  await run(c.env.DB, 'DELETE FROM comments WHERE taskId = ?', [id]);
  await remove(c.env.DB, 'tasks', id);
  return c.json({ ok: true });
});

export default tasks;
