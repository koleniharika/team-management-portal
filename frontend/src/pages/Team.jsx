import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Badge, Button, Empty, ErrorNote, Field, Input, Loading, Modal, PageHead, Select } from '../components/ui';
import { fmtDate, toDateTime, today } from '../lib/util';

export default function Team() {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, loading, error, reload } = useAsync(
    () => Promise.all([
      api.list('employees'),
      api.list('roles'),
      api.list('tasks', { statusNot: 'done' }),
    ]).then(([employees, roles, tasks]) => ({ employees, roles, tasks })),
    [],
  );

  const { employees = [], roles = [], tasks = [] } = data || {};
  const active = (id) => tasks.filter((t) => t.assignedTo === id).length;

  const setStatus = async (emp, status) => { await api.update('employees', emp.id, { status }); reload(); };

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
                <tr key={e.id}>
                  <td data-label="Name">
                    <strong>{e.name}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{e.email}</div>
                  </td>
                  <td data-label="Role">
                    <Badge tone={e.role === 'admin' ? 'lilac' : undefined}>{e.role}</Badge>{' '}
                    <span className="muted">{e.subRole}</span>
                  </td>
                  <td data-label="Joined">{fmtDate(e.joinDate)}</td>
                  <td className="num" data-label="Active">{active(e.id)}</td>
                  <td data-label="Availability">
                    <Select value={e.status} onChange={(ev) => setStatus(e, ev.target.value)}
                      aria-label={`Availability for ${e.name}`} style={{ width: 'auto', padding: '8px 14px' }}>
                      <option value="available">available</option>
                      <option value="on-leave">on-leave</option>
                    </Select>
                  </td>
                  <td className="num" data-label="Report">
                    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Edit</Button>
                      <Link to={`/team/${e.id}`} className="btn btn-ghost btn-sm">Report card</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddEmployeeModal open={adding} onClose={() => setAdding(false)} roles={roles} onDone={reload} />
      <EditEmployeeModal key={editing?.id} employee={editing} roles={roles}
        onClose={() => setEditing(null)} onDone={reload} />
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
        await api.create('roles', { name: subRole });
      }

      // The worker hashes the password and writes the row, so the admin's own
      // session is never touched.
      await api.create('employees', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        subRole,
        joinDate: toDateTime(form.joinDate),
      });

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
            {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
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

/**
 * Admin edit: details plus an optional new password. Setting one flags the
 * account so the employee is asked to pick their own on the next sign-in.
 */
function EditEmployeeModal({ employee, roles, onClose, onDone }) {
  const [form, setForm] = useState(() => ({
    name: employee?.name || '',
    email: employee?.email || '',
    role: employee?.role || 'employee',
    subRole: employee?.subRole || '',
    status: employee?.status || 'available',
    joinDate: String(employee?.joinDate || '').slice(0, 10),
    password: '',
  }));
  const [newRole, setNewRole] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let subRole = form.subRole;
      if (subRole === '__new') {
        subRole = newRole.trim();
        await api.create('roles', { name: subRole });
      }

      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        subRole,
        status: form.status,
        joinDate: toDateTime(form.joinDate),
      };
      // only send a password when one was actually typed
      if (form.password) payload.password = form.password;

      await api.update('employees', employee.id, payload);
      onClose();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!employee} onClose={onClose} title="Edit employee" subtitle={employee?.email}>
      <form onSubmit={submit}>
        <Field label="Full name">
          <Input required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email">
          <Input type="email" required value={form.email} onChange={set('email')} />
        </Field>
        <div className="two-col">
          <Field label="Access level">
            <Select value={form.role} onChange={set('role')}>
              <option value="employee">employee</option>
              <option value="admin">admin</option>
            </Select>
          </Field>
          <Field label="Availability">
            <Select value={form.status} onChange={set('status')}>
              <option value="available">available</option>
              <option value="on-leave">on-leave</option>
            </Select>
          </Field>
        </div>
        <Field label="Join date">
          <Input type="date" value={form.joinDate} onChange={set('joinDate')} />
        </Field>
        <Field label="Sub role">
          <Select value={form.subRole} onChange={set('subRole')}>
            <option value="">— none —</option>
            {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            <option value="__new">+ Add new role</option>
          </Select>
        </Field>
        {form.subRole === '__new' && (
          <Field label="New role name">
            <Input required value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Video Editor" />
          </Field>
        )}

        <hr className="hr" />
        <Field label="New password" hint="leave blank to keep the current one">
          <Input type="password" minLength={8} autoComplete="new-password"
            value={form.password} onChange={set('password')} placeholder="min 8 characters" />
        </Field>
        <p className="muted" style={{ margin: '-8px 0 16px', fontSize: 12 }}>
          They will be asked to replace it the next time they sign in.
        </p>

        <ErrorNote error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </Modal>
  );
}
