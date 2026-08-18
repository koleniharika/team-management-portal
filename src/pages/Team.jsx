import { useState } from 'react';
import { Link } from 'react-router-dom';
import { account, db, ID, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { Badge, Button, Empty, ErrorNote, Field, Input, Loading, Modal, PageHead, Select } from '../components/ui';
import { fmtDate, toDateTime, today } from '../lib/util';

export default function Team() {
  const [adding, setAdding] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => Promise.all([
      db.list('employees', [Query.orderAsc('name')]),
      db.list('roles', [Query.orderAsc('name')]),
      db.list('tasks', [Query.notEqual('status', 'done'), Query.limit(500)]),
    ]).then(([employees, roles, tasks]) => ({ employees, roles, tasks })),
    [],
  );

  const { employees = [], roles = [], tasks = [] } = data || {};
  const active = (userId) => tasks.filter((t) => t.assignedTo === userId).length;

  const setStatus = async (emp, status) => { await db.update('employees', emp.$id, { status }); reload(); };

  return (
    <>
      <PageHead eyebrow={`${employees.length} people`} title="The team">
        <Button onClick={() => setAdding(true)}>+ Add employee</Button>
      </PageHead>

      <ErrorNote error={error} />
      {loading ? <Loading /> : employees.length === 0 ? <Empty>No employees yet.</Empty> : (
        <div className="table-wrap">
          <table className="table-stack">
            <thead>
              <tr>
                <th>Name</th><th>Role</th><th>Joined</th>
                <th className="num">Active</th><th>Availability</th><th className="num">Report</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.$id}>
                  <td data-label="Name">
                    <strong>{e.name}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{e.email}</div>
                  </td>
                  <td data-label="Role">
                    <Badge tone={e.role === 'admin' ? 'purple' : undefined}>{e.role}</Badge>{' '}
                    <span className="muted">{e.subRole}</span>
                  </td>
                  <td data-label="Joined">{fmtDate(e.joinDate)}</td>
                  <td className="num" data-label="Active">{active(e.userId)}</td>
                  <td data-label="Availability">
                    <Select value={e.status} onChange={(ev) => setStatus(e, ev.target.value)}
                      aria-label={`Availability for ${e.name}`} style={{ width: 'auto', padding: '8px 14px' }}>
                      <option value="available">available</option>
                      <option value="on-leave">on-leave</option>
                    </Select>
                  </td>
                  <td className="num" data-label="Report">
                    <Link to={`/team/${e.userId}`} className="btn btn-ghost btn-sm">Report card</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddEmployeeModal open={adding} onClose={() => setAdding(false)} roles={roles} onDone={reload} />
    </>
  );
}

const blank = { name: '', email: '', password: '', role: 'employee', subRole: '', joinDate: today() };

function AddEmployeeModal({ open, onClose, roles, onDone }) {
  const [form, setForm] = useState(blank);
  const [newRole, setNewRole] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const close = () => { setForm(blank); setNewRole(''); setError(null); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let subRole = form.subRole;
      if (subRole === '__new') {
        subRole = newRole.trim();
        await db.create('roles', { name: subRole });
      }

      const email = form.email.trim().toLowerCase();
      const name = form.name.trim();
      // account.create() only creates the login — it starts no session, so the admin
      // filling in this form stays signed in as themselves.
      const user = await account.create({ userId: ID.unique(), email, password: form.password, name });
      // Row id = the auth user's id, so login and profile share one identifier.
      await db.create('employees', {
        userId: user.$id,
        name,
        email,
        role: form.role,
        subRole,
        status: 'available',
        joinDate: toDateTime(form.joinDate),
      }, user.$id);

      close();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add employee" subtitle="Creates their login and employee record.">
      <form onSubmit={submit}>
        <Field label="Full name">
          <Input required value={form.name} onChange={set('name')} placeholder="Aashish Kumar" />
        </Field>
        <Field label="Email">
          <Input type="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Temporary password" hint="min 8 characters">
          <Input type="password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <div className="two-col">
          <Field label="Access level">
            <Select value={form.role} onChange={set('role')}>
              <option value="employee">employee</option>
              <option value="admin">admin</option>
            </Select>
          </Field>
          <Field label="Join date">
            <Input type="date" required value={form.joinDate} onChange={set('joinDate')} />
          </Field>
        </div>
        <Field label="Sub role">
          <Select required value={form.subRole} onChange={set('subRole')}>
            <option value="">— pick a role —</option>
            {roles.map((r) => <option key={r.$id} value={r.name}>{r.name}</option>)}
            <option value="__new">+ Add new role</option>
          </Select>
        </Field>
        {form.subRole === '__new' && (
          <Field label="New role name">
            <Input required value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Video Editor" />
          </Field>
        )}

        <ErrorNote error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button disabled={busy}>{busy ? 'Creating…' : 'Create login'}</Button>
        </div>
      </form>
    </Modal>
  );
}
