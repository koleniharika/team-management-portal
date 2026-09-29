import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth } from './middleware/auth.js';
import auth from './routes/auth.js';
import employees from './routes/employees.js';
import roles from './routes/roles.js';
import brands from './routes/brands.js';
import tasks from './routes/tasks.js';
import comments from './routes/comments.js';
import payments from './routes/payments.js';
import dumps from './routes/dumps.js';

const app = new Hono();

// A browser sends Origin with no trailing slash, so trim one off both sides —
// a pasted "https://site.com/" would otherwise never match and look like a bug.
const trimSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

app.use('*', cors({
  // ALLOWED_ORIGINS is a comma-separated var in wrangler.toml — add the Vercel URL there.
  origin: (origin, c) => {
    const allowed = String(c.env.ALLOWED_ORIGINS || '').split(',').map(trimSlash).filter(Boolean);
    if (allowed.includes(trimSlash(origin))) return origin;
    // Send no header rather than a misleading one: the browser then says the
    // header is missing, and this line names the origin that was turned away.
    console.error(JSON.stringify({ msg: 'CORS: origin not allowed', origin, allowed }));
    return null;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86400,
}));

// A missing binding or secret otherwise surfaces as an inscrutable runtime
// error (signing with an undefined secret throws "reading 'includes'").
// Runs after CORS so the browser can actually read this message.
app.use('*', async (c, next) => {
  const missing = [];
  if (!c.env.DB) missing.push('the D1 binding "DB"');
  if (!c.env.JWT_SECRET) missing.push('the secret "JWT_SECRET"');
  if (missing.length) {
    console.error(JSON.stringify({ msg: 'worker misconfigured', missing }));
    return c.json({ error: `Server misconfigured: ${missing.join(' and ')} is not set on this Worker.` }, 500);
  }
  await next();
});

app.get('/', (c) => c.json({ ok: true, service: 'erp-api' }));

app.route('/auth', auth);

// everything below needs a valid token
app.use('/employees/*', requireAuth);
app.use('/roles/*', requireAuth);
app.use('/brands/*', requireAuth);
app.use('/tasks/*', requireAuth);
app.use('/comments/*', requireAuth);
app.use('/payments/*', requireAuth);
app.use('/dumps/*', requireAuth);

app.route('/employees', employees);
app.route('/roles', roles);
app.route('/brands', brands);
app.route('/tasks', tasks);
app.route('/comments', comments);
app.route('/payments', payments);
app.route('/dumps', dumps);

app.notFound((c) => c.json({ error: `No route for ${c.req.method} ${c.req.path}` }, 404));

app.onError((err, c) => {
  console.error(JSON.stringify({ message: err.message, path: c.req.path, method: c.req.method }));
  return c.json({ error: err.message || 'Something broke.' }, 500);
});

export default app;
