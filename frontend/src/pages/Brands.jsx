import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Button, Card, Empty, ErrorNote, Field, Input, Loading, Modal, PageHead, TextArea } from '../components/ui';
import { money } from '../lib/util';

const blank = { name: '', contactName: '', contactInfo: '', ratePerProject: '', notes: '' };

export default function Brands() {
  const [editing, setEditing] = useState(null); // row | 'new' | null
  const { data: brands, loading, error, reload, mutate } = useAsync(() => api.list('brands'), []);

  const remove = (b) => {
    if (!window.confirm(`Delete ${b.name}?\n\nIts tasks are kept — they just won't be linked to a brand anymore, `
      + 'so task history stays intact. Its deliverables checklist is deleted.')) return;
    mutate((list) => list.filter((x) => x.id !== b.id), () => api.remove('brands', b.id));
  };

  // edits show at once; a new brand waits for its id, then refreshes in place
  const save = (brand, payload) => (brand === 'new'
    ? api.create('brands', payload).then(reload)
    : mutate((list) => list.map((x) => (x.id === brand.id ? { ...x, ...payload } : x)), () => api.update('brands', brand.id, payload)));

  return (
    <>
      <PageHead eyebrow={`${brands?.length || 0} clients`} title="Brands">
        <Button onClick={() => setEditing('new')}>+ Add brand</Button>
      </PageHead>

      <ErrorNote error={error} />
      {loading ? <Loading /> : brands.length === 0 ? <Empty>No brands yet.</Empty> : (
        <div className="grid grid-cards">
          {brands.map((b) => (
            <Card key={b.id} hover className="reveal card-clickable">
              <h2 className="card-title">
                <Link to={`/brands/${b.id}`} className="link-plain card-link">{b.name} <span aria-hidden="true">→</span></Link>
              </h2>
              <p className="muted" style={{ margin: '6px 0 18px' }}>
                {b.contactName || '—'}{b.contactInfo ? ` · ${b.contactInfo}` : ''}
              </p>
              <p className="display display-md" style={{ color: 'var(--lime)' }}>
                {money(b.ratePerProject)} <span className="muted" style={{ fontFamily: 'Geist, sans-serif', fontSize: 13 }}>/ project</span>
              </p>
              {b.notes && <p className="muted" style={{ fontSize: 14 }}>{b.notes}</p>}
              <div className="row" style={{ marginTop: 20 }}>
                <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => remove(b)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BrandModal
        key={editing?.id || editing}
        brand={editing}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </>
  );
}

function BrandModal({ brand, onClose, onSave }) {
  const isNew = brand === 'new';
  const [form, setForm] = useState(() => (isNew || !brand ? blank : {
    name: brand.name || '', contactName: brand.contactName || '', contactInfo: brand.contactInfo || '',
    ratePerProject: brand.ratePerProject ?? '', notes: brand.notes || '',
  }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { ...form, ratePerProject: Number(form.ratePerProject) || 0 };
    try {
      if (isNew) await onSave(brand, payload); // wait: errors belong in this form
      else onSave(brand, payload); // edit is optimistic — a failure reverts and toasts
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!brand} onClose={onClose} title={isNew ? 'Add brand' : 'Edit brand'}>
      <form onSubmit={submit}>
        <Field label="Brand name"><Input required value={form.name} onChange={set('name')} /></Field>
        <div className="two-col">
          <Field label="Contact name"><Input value={form.contactName} onChange={set('contactName')} /></Field>
          <Field label="Contact info"><Input value={form.contactInfo} onChange={set('contactInfo')} placeholder="email / phone" /></Field>
        </div>
        <Field label="Rate per project (₹)">
          <Input type="number" min="0" step="1" value={form.ratePerProject} onChange={set('ratePerProject')} />
        </Field>
        <Field label="Notes"><TextArea value={form.notes} onChange={set('notes')} /></Field>
        <ErrorNote error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button busy={busy}>Save brand</Button>
        </div>
      </form>
    </Modal>
  );
}
