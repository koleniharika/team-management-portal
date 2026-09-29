import { Hono } from 'hono';
import { insert, one, update } from '../lib/db.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const auth = new Hono();

const publicFields = ({ passwordHash, ...rest }) => rest; // eslint-disable-line no-unused-vars

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  if (!email || !password) return c.json({ error: 'Email and password are required.' }, 400);

  const user = await one(c.env.DB, 'SELECT * FROM employees WHERE email = ?', [String(email).trim().toLowerCase()]);
  // Same message and roughly the same work either way — don't leak which emails exist.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!ok) return c.json({ error: 'Wrong email or password.' }, 401);

  return c.json({ token: await signToken(user, c.env.JWT_SECRET), user: publicFields(user) });
});

auth.get('/me', requireAuth, (c) => c.json(c.get('user')));

/**
 * Anyone can swap their own password, and the first login after an admin hands
 * one out requires it (mustChangePassword). Old password is always required, so
 * a borrowed tab can't lock the owner out.
 */
auth.post('/change-password', requireAuth, async (c) => {
  const { currentPassword, newPassword } = await c.req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) {
    return c.json({ error: 'Both the current and the new password are required.' }, 400);
  }
  if (String(newPassword).length < 8) {
    return c.json({ error: 'The new password needs at least 8 characters.' }, 400);
  }
  if (currentPassword === newPassword) {
    return c.json({ error: 'That is the same password you already have.' }, 400);
  }

  const me = c.get('user');
  const row = await one(c.env.DB, 'SELECT passwordHash FROM employees WHERE id = ?', [me.id]);
  if (!await verifyPassword(currentPassword, row?.passwordHash)) {
    return c.json({ error: 'Your current password is wrong.' }, 401);
  }

  await update(
    c.env.DB,
    'employees',
    me.id,
    { passwordHash: await hashPassword(newPassword), mustChangePassword: 0 },
    { extra: ['passwordHash', 'mustChangePassword'] },
  );
  return c.json({ ok: true });
});

/**
 * Bootstrap the first admin. Self-disables the moment any employee exists, so
 * leaving it deployed is not an open door — delete it anyway once you are in.
 */
auth.post('/seed-admin', async (c) => {
  const existing = await one(c.env.DB, 'SELECT COUNT(*) AS n FROM employees');
  if (existing?.n > 0) return c.json({ error: 'Already seeded. Remove this route.' }, 403);

  const { name, email, password } = await c.req.json().catch(() => ({}));
  if (!email || !password || String(password).length < 8) {
    return c.json({ error: 'name, email and a password of at least 8 characters are required.' }, 400);
  }

  const user = await insert(
    c.env.DB,
    'employees',
    {
      name: name || 'Admin',
      email: String(email).trim().toLowerCase(),
      role: 'admin',
      status: 'available',
      joinDate: new Date().toISOString().slice(0, 10),
      passwordHash: await hashPassword(password),
      mustChangePassword: 0, // they chose this one themselves
    },
    { extra: ['passwordHash', 'mustChangePassword'] },
  );

  return c.json({ token: await signToken(user, c.env.JWT_SECRET), user: publicFields(user) }, 201);
});

export default auth;
