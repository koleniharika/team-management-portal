import { verifyToken } from '../lib/jwt.js';
import { one } from '../lib/db.js';

/** Puts { id, role } on the context, or 401s. Every route except /auth/login uses this. */
export async function requireAuth(c, next) {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return c.json({ error: 'Not signed in.' }, 401);

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload?.sub) return c.json({ error: 'Session expired. Sign in again.' }, 401);

  // The row is the source of truth for the role — a token minted before a
  // demotion must not keep admin powers until it expires.
  const user = await one(
    c.env.DB,
    'SELECT id, name, email, role, subRole, status, joinDate, mustChangePassword, createdAt FROM employees WHERE id = ?',
    [payload.sub],
  );
  if (!user) return c.json({ error: 'Your account no longer exists.' }, 401);

  c.set('user', user);
  await next();
}

export async function requireAdmin(c, next) {
  if (c.get('user')?.role !== 'admin') return c.json({ error: 'Admins only.' }, 403);
  await next();
}

export const isAdmin = (c) => c.get('user')?.role === 'admin';
export const userId = (c) => c.get('user')?.id;
