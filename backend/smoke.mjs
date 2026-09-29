// Throwaway end-to-end check against `wrangler dev`. Not shipped.
const BASE = 'http://127.0.0.1:8787';
let failures = 0;
const arr = (x) => (Array.isArray(x) ? x : []);

const check = (label, cond, extra = '') => {
  if (cond) return console.log(`  ok   ${label}`);
  failures += 1;
  return console.log(`  FAIL ${label} ${extra}`);
};

async function call(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, res };
}

console.log('\n— auth —');
const seed = await call('/auth/seed-admin', { method: 'POST', body: { name: 'Boss', email: 'boss@studio.test', password: 'supersecret1' } });
check('seed-admin creates the first admin', seed.status === 201 && !!seed.json.token, JSON.stringify(seed.json));
const adminToken = seed.json.token;

const seedAgain = await call('/auth/seed-admin', { method: 'POST', body: { name: 'x', email: 'x@y.z', password: 'supersecret1' } });
check('seed-admin self-disables after the first admin', seedAgain.status === 403);

check('seeded admin never returns passwordHash', seed.json.user && !('passwordHash' in seed.json.user));

const badLogin = await call('/auth/login', { method: 'POST', body: { email: 'boss@studio.test', password: 'wrong' } });
check('wrong password is rejected', badLogin.status === 401);

const login = await call('/auth/login', { method: 'POST', body: { email: 'BOSS@studio.test', password: 'supersecret1' } });
check('login works and is case-insensitive on email', login.status === 200 && !!login.json.token, JSON.stringify(login.json));

const noToken = await call('/tasks');
check('protected route needs a token', noToken.status === 401);

const badToken = await call('/tasks', { token: 'not.a.jwt' });
check('garbage token is rejected', badToken.status === 401);

const me = await call('/auth/me', { token: adminToken });
check('/auth/me returns the profile', me.json.email === 'boss@studio.test' && me.json.role === 'admin');

console.log('\n— employees —');
const created = await call('/employees', { token: adminToken, method: 'POST', body: { name: 'Aashish', email: 'a@studio.test', password: 'temp12345', role: 'employee', subRole: 'Editor' } });
check('admin creates an employee', created.status === 201 && created.json.role === 'employee', JSON.stringify(created.json));
const empId = created.json.id;

const dupe = await call('/employees', { token: adminToken, method: 'POST', body: { name: 'Dupe', email: 'a@studio.test', password: 'temp12345' } });
check('duplicate email is refused', dupe.status === 409);

const empLogin = await call('/auth/login', { method: 'POST', body: { email: 'a@studio.test', password: 'temp12345' } });
check('new employee can sign in with the temp password', empLogin.status === 200);
const empToken = empLogin.json.token;

const empMakesEmployee = await call('/employees', { token: empToken, method: 'POST', body: { name: 'Nope', email: 'n@studio.test', password: 'temp12345' } });
check('employee cannot create logins', empMakesEmployee.status === 403);

console.log('\n- first-login password change -');
check('a handed-out password is flagged', created.json.mustChangePassword === 1, JSON.stringify(created.json));
check('an admin who seeded themselves is not flagged', me.json.mustChangePassword === 0);

const wrongOld = await call('/auth/change-password', { token: empToken, method: 'POST', body: { currentPassword: 'nope12345', newPassword: 'brandnew123' } });
check('changing needs the real current password', wrongOld.status === 401);

const tooShort = await call('/auth/change-password', { token: empToken, method: 'POST', body: { currentPassword: 'temp12345', newPassword: 'short' } });
check('the new password has a minimum length', tooShort.status === 400);

const same = await call('/auth/change-password', { token: empToken, method: 'POST', body: { currentPassword: 'temp12345', newPassword: 'temp12345' } });
check('reusing the same password is refused', same.status === 400);

const changed = await call('/auth/change-password', { token: empToken, method: 'POST', body: { currentPassword: 'temp12345', newPassword: 'brandnew123' } });
check('employee can change their own password', changed.status === 200, JSON.stringify(changed.json));
check('the flag clears once they pick their own', (await call('/auth/me', { token: empToken })).json.mustChangePassword === 0);
check('the old password stops working', (await call('/auth/login', { method: 'POST', body: { email: 'a@studio.test', password: 'temp12345' } })).status === 401);
check('the new password works', (await call('/auth/login', { method: 'POST', body: { email: 'a@studio.test', password: 'brandnew123' } })).status === 200);

const adminReset = await call('/employees/' + empId, { token: adminToken, method: 'PATCH', body: { password: 'resetpass123' } });
check('admin can set a password from the employees tab', adminReset.status === 200);
check('and that re-flags the account', adminReset.json.mustChangePassword === 1, JSON.stringify(adminReset.json));
check('the admin-set password signs in', (await call('/auth/login', { method: 'POST', body: { email: 'a@studio.test', password: 'resetpass123' } })).status === 200);
check('a short admin-set password is refused', (await call('/employees/' + empId, { token: adminToken, method: 'PATCH', body: { password: 'tiny' } })).status === 400);

const empEditsOther = await call('/employees/' + me.json.id, { token: empToken, method: 'PATCH', body: { password: 'hijack12345' } });
check('employees cannot change anyone elses password', empEditsOther.status === 403);

console.log('\n— tasks: visibility is server-side —');
const mine = await call('/tasks', { token: adminToken, method: 'POST', body: { title: 'Employee task', assignedTo: empId, priority: 'high', deadline: '2026-10-10' } });
const theirs = await call('/tasks', { token: adminToken, method: 'POST', body: { title: 'Admin task', assignedTo: me.json.id, priority: 'low', deadline: '2026-10-02' } });
const doneOne = await call('/tasks', { token: adminToken, method: 'POST', body: { title: 'Old task', assignedTo: empId, status: 'done', completedAt: '2026-09-01' } });
check('tasks created', mine.status === 201 && theirs.status === 201 && doneOne.status === 201);

const empList = await call('/tasks', { token: empToken });
check('employee sees only their own tasks', arr(empList.json).every((t) => t.assignedTo === empId), JSON.stringify(arr(empList.json).map((t) => t.title)));
check('employee list includes their done task too', arr(empList.json).length === 2);

const empTriesOthers = await call('/tasks?assignedTo=' + me.json.id, { token: empToken });
check('employee cannot query someone else via assignedTo', arr(empTriesOthers.json).every((t) => t.assignedTo === empId));

const empReadsOthersTask = await call('/tasks/' + theirs.json.id, { token: empToken });
check('employee cannot open another persons task by id', empReadsOthersTask.status === 403);

const adminDefault = await call('/tasks', { token: adminToken });
check('admin default is pending only', arr(adminDefault.json).every((t) => t.status === 'pending') && arr(adminDefault.json).length === 2, JSON.stringify(arr(adminDefault.json).map((t) => t.status)));

const adminAll = await call('/tasks?status=all', { token: adminToken });
check('admin can ask for everything', arr(adminAll.json).length === 3);

const adminOpen = await call('/tasks?statusNot=done', { token: adminToken });
check('admin can exclude done', arr(adminOpen.json).length === 2 && arr(adminOpen.json).every((t) => t.status !== 'done'));

const adminReview = await call('/tasks?status=submitted,approved,done', { token: adminToken });
check('admin can ask for a status list', arr(adminReview.json).length === 1 && arr(adminReview.json)[0].status === 'done');

console.log('\n— tasks: employee write limits —');
const submit = await call('/tasks/' + mine.json.id, { token: empToken, method: 'PATCH', body: { status: 'submitted', submissionLink: 'https://drive.example/x', remarks: 'done' } });
check('employee can submit their own task', submit.json.status === 'submitted' && submit.json.submissionLink === 'https://drive.example/x');

const sneak = await call('/tasks/' + mine.json.id, { token: empToken, method: 'PATCH', body: { status: 'done', assignedTo: 'someone-else' } });
check('employee cannot approve or reassign', sneak.json.status === 'submitted' && sneak.json.assignedTo === empId);

const empSelfTask = await call('/tasks', { token: empToken, method: 'POST', body: { title: 'Self brief', assignedTo: me.json.id } });
check('employee task creation is forced onto themselves', empSelfTask.json.assignedTo === empId);

const empDeletesOthers = await call('/tasks/' + theirs.json.id, { token: empToken, method: 'DELETE' });
check('employee cannot delete a task they did not create', empDeletesOthers.status === 403);

console.log('\n— comments cascade —');
await call('/comments', { token: adminToken, method: 'POST', body: { taskId: mine.json.id, message: 'looks good' } });
const beforeDelete = await call('/comments?taskId=' + mine.json.id, { token: adminToken });
check('comment saved with server-side author', arr(beforeDelete.json).length === 1 && arr(beforeDelete.json)[0].authorName === 'Boss');

const delTask = await call('/tasks/' + mine.json.id, { token: adminToken, method: 'DELETE' });
check('admin deletes any task', delTask.status === 200);
const orphan = await call('/comments?taskId=' + mine.json.id, { token: adminToken });
check('deleting a task takes its comments with it', orphan.status === 403 || (orphan.json.length ?? 0) === 0);

console.log('\n— dumps (text only) —');
const note = await call('/dumps', { token: empToken, method: 'POST', body: { content: 'hook idea' } });
check('anyone can post a note', note.status === 201 && note.json.content === 'hook idea', JSON.stringify(note.json));

const empDeletesDump = await call('/dumps/' + note.json.id, { token: empToken, method: 'DELETE' });
check('employees cannot delete dumps', empDeletesDump.status === 403);
const adminDeletesDump = await call('/dumps/' + note.json.id, { token: adminToken, method: 'DELETE' });
check('admins can delete dumps', adminDeletesDump.status === 200);

console.log('\n— payroll is admin-only —');
check('employee cannot read payments', (await call('/payments', { token: empToken })).status === 403);
const pay = await call('/payments', { token: adminToken, method: 'POST', body: { employeeId: empId, month: '2026-09', base: 15000, bonus: 1000, status: 'unpaid' } });
check('admin can record a payment', pay.status === 201 && pay.json.base === 15000);

console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nall backend checks passed\n');
process.exit(failures ? 1 : 0);
