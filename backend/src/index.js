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

app.use('*', cors({
  // ALLOWED_ORIGINS is a comma-separated var in wrangler.toml — add the Vercel URL there.
  origin: (origin, c) => {
    const allowed = String(c.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
    return allowed.includes(origin) ? origin : allowed[0] || '';
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86400,
}));

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
