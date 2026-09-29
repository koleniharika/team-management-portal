// Throwaway: proves migrate/seed.sql actually loads and the migrated logins work.
import { readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:8787';
let failures = 0;
const check = (label, cond, extra = '') => {
  if (cond) return console.log(`  ok   ${label}`);
  failures += 1;
  return console.log(`  FAIL ${label} ${extra}`);
};

const creds = readFileSync('migrate/credentials.txt', 'utf8')
  .split('\n').filter((l) => l.includes('@'))
  .map((l) => l.trim().split(/\s+/))
  .map(([email, role, password]) => ({ email, role, password }));

const admin = creds.find((c) => c.role === 'admin');

async function call(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

console.log('\n— migrated data —');
const login = await call('/auth/login', { method: 'POST', body: { email: admin.email, password: admin.password } });
check(`migrated admin (${admin.email}) can sign in with the temp password`, login.status === 200, JSON.stringify(login.json));
const adminToken = login.json.token;

const staff = await call('/employees', { token: adminToken });
check('all 14 employees imported', staff.json.length === 14, `got ${staff.json.length}`);
check('every migrated login is asked to set its own password', staff.json.every((e) => e.mustChangePassword === 1));
check('roles kept their names', (await call('/roles', { token: adminToken })).json.length === 3);
check('brands imported', (await call('/brands', { token: adminToken })).json.length === 12);
check('dumps imported as text notes', (await call('/dumps', { token: adminToken })).json.length === 8);

const allTasks = await call('/tasks?status=all', { token: adminToken });
check('all 37 tasks imported', allTasks.json.length === 37, `got ${allTasks.json.length}`);

// the whole point of keying employees on the old userId
const ids = new Set(staff.json.map((e) => e.id));
const orphans = allTasks.json.filter((t) => !ids.has(t.assignedTo));
check('every task still points at a real employee', orphans.length === 0,
  orphans.map((t) => `${t.title} -> ${t.assignedTo}`).join(' | '));

const brandIds = new Set((await call('/brands', { token: adminToken })).json.map((b) => b.id));
const badBrand = allTasks.json.filter((t) => t.brandId && !brandIds.has(t.brandId));
check('tasks still point at real brands', badBrand.length === 0, `${badBrand.length} broken`);

const done = allTasks.json.filter((t) => t.status === 'done');
check('completed tasks kept their completedAt', done.every((t) => t.completedAt), `${done.length} done`);

console.log('\n— migrated employee sees only their own work —');
// pick whoever actually has tasks, and check the count matches the admin's view
const byAssignee = {};
for (const t of allTasks.json) byAssignee[t.assignedTo] = (byAssignee[t.assignedTo] || 0) + 1;
const [busiestId, expected] = Object.entries(byAssignee).sort((a, b) => b[1] - a[1])[0];
const busiest = staff.json.find((e) => e.id === busiestId);
const worker = creds.find((c) => c.email === busiest.email);

const empLogin = await call('/auth/login', { method: 'POST', body: { email: worker.email, password: worker.password } });
check(`migrated employee (${worker.email}) can sign in`, empLogin.status === 200);
const empTasks = await call('/tasks', { token: empLogin.json.token });
check('their list is exactly their own tasks', empTasks.json.every((t) => t.assignedTo === busiestId));
check(`and holds all ${expected} of them`, empTasks.json.length === expected, `got ${empTasks.json.length}`);
check('migrated employee still cannot reach payroll', (await call('/payments', { token: empLogin.json.token })).status === 403);

console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nmigration verified\n');
process.exit(failures ? 1 : 0);
