import { useState } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Empty, ErrorNote, Field, Modal, PageHead, TextArea } from '../components/ui';

// notes rotate through the pastels so the board looks like a pinboard, not a list
const NOTE_TONES = ['lime', 'yellow', 'lilac', 'blue', 'pink'];
const toneFor = (id) => NOTE_TONES[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % NOTE_TONES.length];

export default function Dump() {
  const { isAdmin } = useAuth();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const { data, loading, error: loadError, reload } = useAsync(() => api.list('dumps'), []);
  const dumps = data || []; // a failed load leaves data null — render the empty board, not a crash

  const close = () => { setWriting(false); setText(''); };

  const save = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    try {
      await api.create('dumps', { content });
      close();
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (dump) => {
    if (!window.confirm('Delete this note? This can\'t be undone.')) return;
    setError(null);
    try {
      await api.remove('dumps', dump.id);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHead
        eyebrow={loading ? 'Loading…' : `${dumps.length} ${dumps.length === 1 ? 'note' : 'notes'} on the board`}
        title="Dump"
      >
        <Button onClick={() => setWriting(true)}>Create</Button>
      </PageHead>

      <ErrorNote error={loadError || error} />

      {loading ? (
        <div className="masonry" aria-hidden="true">
          {[220, 150, 280, 190, 240, 170].map((h, i) => (
            <div key={i} className="dump-skeleton" style={{ height: h }} />
          ))}
        </div>
      ) : dumps.length === 0 ? (
        <Empty>Nothing dumped yet. Hit <strong>Create</strong> to jot the first note.</Empty>
      ) : (
        <div className="masonry">
          {dumps.map((d) => (
            <Card key={d.id} accent={toneFor(d.id)} className="dump-card reveal">
              {isAdmin && (
                <Button size="sm" variant="danger" className="dump-del" onClick={() => remove(d)}
                  aria-label="Delete note">✕</Button>
              )}
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 16, lineHeight: 1.45 }}>{d.content}</p>
              <p className="muted" style={{ margin: '12px 0 0', fontSize: 11 }}>
                {new Date(d.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={writing} onClose={close} title="New note" subtitle="Anything you don't want to lose.">
        <form onSubmit={save}>
          <Field label="Note">
            <TextArea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={6}
              placeholder="Hook idea, script line, a link…" style={{ minHeight: 140 }} />
          </Field>
          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Save note'}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
