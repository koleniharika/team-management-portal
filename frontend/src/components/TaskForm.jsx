import { useState } from 'react';
import { api } from '../lib/api';
import { Button, ErrorNote, Field, Input, Modal, Select, TextArea } from './ui';
import { toDateTime } from '../lib/util';

const blank = { title: '', description: '', brandId: '', assignedTo: '', priority: 'medium', deadline: '' };

/**
 * Create-task dialog. Admins pick anyone; employees are locked to themselves
 * (`lockedTo` = their id) and the brand becomes optional.
 */
export default function TaskForm({ open, onClose, onCreated, employees = [], brands = [], lockedTo = null, presetAssignee = '' }) {
  const [form, setForm] = useState({ ...blank, assignedTo: lockedTo || presetAssignee });
  const [newBrand, setNewBrand] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const close = () => { setForm({ ...blank, assignedTo: lockedTo || presetAssignee }); setNewBrand(''); setError(null); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let brandId = form.brandId;
      if (brandId === '__new' && newBrand.trim()) {
        brandId = (await api.create('brands', { name: newBrand.trim() })).id;
      } else if (brandId === '__new') {
        brandId = '';
      }
      await api.create('tasks', {
        title: form.title.trim(),
        description: form.description.trim(),
        brandId,
        assignedTo: lockedTo || form.assignedTo,
        status: 'pending',
        priority: form.priority,
        deadline: toDateTime(form.deadline),
      });
      close();
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="New task" subtitle={lockedTo ? 'Assigned to you' : 'Brief someone on the team'}>
      <form onSubmit={submit}>
        <Field label="Title">
          <Input required value={form.title} onChange={set('title')} placeholder="30s reel for launch week" />
        </Field>
        <Field label="Description">
          <TextArea value={form.description} onChange={set('description')} placeholder="Deliverables, references, tone…" />
        </Field>

        <Field label="Brand" hint={lockedTo ? 'optional' : undefined}>
          <Select value={form.brandId} onChange={set('brandId')} required={!lockedTo}>
            <option value="">— none —</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="__new">+ Add new brand</option>
          </Select>
        </Field>
        {form.brandId === '__new' && (
          <Field label="New brand name">
            <Input required value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Brand name" />
          </Field>
        )}

        {!lockedTo && (
          <Field label="Assign to">
            <Select required value={form.assignedTo} onChange={set('assignedTo')}>
              <option value="">— pick someone —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.status === 'on-leave' ? ' (on leave)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="two-col">
          <Field label="Priority">
            <Select value={form.priority} onChange={set('priority')}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="Deadline">
            <Input type="date" required value={form.deadline} onChange={set('deadline')} />
          </Field>
        </div>

        <ErrorNote error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button disabled={busy}>{busy ? 'Creating…' : 'Create task'}</Button>
        </div>
      </form>
    </Modal>
  );
}
