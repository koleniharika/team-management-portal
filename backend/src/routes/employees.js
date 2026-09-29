import { Hono } from 'hono';
import { all, insert, one, remove, update } from '../lib/db.js';
import { hashPassword } from '../lib/password.js';
import { requireAdmin } from '../middleware/auth.js';

const employees = new Hono();

// passwordHash never leaves the worker
const FIELDS = 'id, name, email, role, subRole, status, joinDate, mustChangePassword, createdAt';

// Any signed-in user may read the roster — task cards and comments show names.
employees.get('/', async (c) => c.json(
  await all(c.env.DB, `SELECT ${FIELDS} FROM employees ORDER BY name COLLATE NOCASE`),
));

employees.get('/:id', async (c) => {
  const row = await one(c.env.DB, `SELECT ${FIELDS} FROM employees WHERE id = ?`, [c.req.param('id')]);
  return row ? c.json(row) : c.json({ error: 'Employee not found.' }, 404);
});

/** Replaces the old client-side account.create: the admin's own session is untouched. */
employees.post('/', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!body.name || !email || password.length < 8) {
    return c.json({ error: 'Name, email and a password of at least 8 characters are required.' }, 400);
  }
  if (await one(c.env.DB, 'SELECT id FROM employees WHERE email = ?', [email])) {
    return c.json({ error: 'That email already has a login.' }, 409);
  }

  const row = await insert(
    c.env.DB,
    'employees',
    {
      name: String(body.name).trim(),
      email,
      role: body.role === 'admin' ? 'admin' : 'employee',
      subRole: body.subRole || '',
      status: 'available',
      joinDate: body.joinDate || new Date().toISOString().slice(0, 10),
      passwordHash: await hashPassword(password),
      mustChangePassword: 1, // it's a temporary password until they pick their own
    },
    { extra: ['passwordHash', 'mustChangePassword'] },
  );

  const { passwordHash, ...safe } = row; // eslint-disable-line no-unused-vars
  return c.json(safe, 201);
});

employees.patch('/:id', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const data = { ...body };
  // Changing a password goes through the same hashing path as creation.
  const extra = [];
  if (body.password) {
    if (String(body.password).length < 8) {
      return c.json({ error: 'A password needs at least 8 characters.' }, 400);
    }
    data.passwordHash = await hashPassword(String(body.password));
    data.mustChangePassword = 1; // admin-set password: prompt them to replace it
    extra.push('passwordHash', 'mustChangePassword');
  }
  const row = await update(c.env.DB, 'employees', c.req.param('id'), data, { extra });
  if (!row) return c.json({ error: 'Employee not found.' }, 404);
  const { passwordHash, ...safe } = row; // eslint-disable-line no-unused-vars
  return c.json(safe);
});

employees.delete('/:id', requireAdmin, async (c) => {
  await remove(c.env.DB, 'employees', c.req.param('id'));
  return c.json({ ok: true });
});

export default employees;
