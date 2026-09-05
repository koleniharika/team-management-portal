import { useRef, useState } from 'react';
import { db, files, Query } from '../lib/appwrite';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Empty, ErrorNote, Field, Modal, PageHead, TextArea } from '../components/ui';

// notes rotate through the pastels so the board looks like a pinboard, not a list
const NOTE_TONES = ['lime', 'yellow', 'lilac', 'blue', 'pink'];
const toneFor = (id) => NOTE_TONES[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % NOTE_TONES.length];

const kindOf = (file) => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  return null;
};

export default function Dump() {
  const { employee, isAdmin } = useAuth();
  const fileInput = useRef(null);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const { data, loading, error: loadError, reload } = useAsync(
    () => db.list('dumps', [Query.orderDesc('$createdAt')]),
    [],
  );
  const dumps = data || []; // a failed load leaves data null — render the empty board, not a crash

  const close = () => { setWriting(false); setText(''); setPicked([]); };

  /** One dialog: a note, files, or both. Files carry the note as their caption. */
  const save = async (e) => {
    e.preventDefault();
    const note = text.trim();
    if (!note && !picked.length) return;
    setBusy(true);
    setError(null);
    try {
      if (!picked.length) {
        await db.create('dumps', { type: 'text', content: note, createdBy: employee.userId });
      } else {
        for (const file of picked) {
          const type = kindOf(file);
          if (!type) throw new Error(`${file.name} is not an image or PDF.`);
          const uploaded = await files.upload(file);
          await db.create('dumps', {
            type, content: note, fileId: uploaded.$id, fileName: file.name, createdBy: employee.userId,
          });
        }
      }
      close();
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (dump) => {
    if (!window.confirm('Delete this dump? This can\'t be undone.')) return;
    setError(null);
    try {
      await db.remove('dumps', dump.$id);
      // the row goes first; a leftover file is cheaper to clean up than a card pointing at nothing
      if (dump.fileId) await files.remove(dump.fileId).catch(() => {});
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHead
        eyebrow={loading ? 'Loading…' : `${dumps.length} ${dumps.length === 1 ? 'thing' : 'things'} on the board`}
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
        <Empty>Nothing dumped yet. Hit <strong>Create</strong> for a note, a file, or both.</Empty>
      ) : (
        <div className="masonry">
          {dumps.map((d) => (
            <DumpCard key={d.$id} dump={d} onDelete={isAdmin ? remove : undefined} />
          ))}
        </div>
      )}

      <Modal open={writing} onClose={close} title="New dump" subtitle="A note, files, or both.">
        <form onSubmit={save}>
          <Field label="Note" hint="optional">
            <TextArea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={5}
              placeholder="Hook idea, script line, a link…" style={{ minHeight: 120 }} />
          </Field>

          <Field label="Attach" hint="images or PDFs, optional">
            <div className="row" style={{ gap: 10 }}>
              <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                Choose files
              </Button>
              {picked.length > 0 && (
                <Button type="button" variant="danger" size="sm" onClick={() => setPicked([])}>
                  Clear
                </Button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => setPicked([...e.target.files])}
                hidden
              />
            </div>
          </Field>

          {picked.length > 0 && (
            <div className="row" style={{ gap: 6, marginBottom: 16 }}>
              {picked.map((f) => <span key={f.name} className="badge badge-lilac">{f.name}</span>)}
              {picked.length > 1 && text.trim() && (
                <span className="muted" style={{ fontSize: 12 }}>the note goes on each file</span>
              )}
            </div>
          )}

          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button disabled={busy || (!text.trim() && !picked.length)}>
              {busy ? 'Saving…' : 'Add to board'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function DumpCard({ dump, onDelete }) {
  const del = onDelete && (
    <Button size="sm" variant="danger" className="dump-del" onClick={() => onDelete(dump)}
      aria-label="Delete dump">✕</Button>
  );
  const stamp = <p className="muted" style={{ margin: '12px 0 0', fontSize: 11 }}>{new Date(dump.$createdAt).toLocaleDateString()}</p>;

  if (dump.type === 'text') {
    return (
      <Card accent={toneFor(dump.$id)} className="dump-card reveal">
        {del}
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 16, lineHeight: 1.45 }}>{dump.content}</p>
        {stamp}
      </Card>
    );
  }

  if (dump.type === 'image') {
    return (
      <Card tight className="dump-card reveal" style={{ padding: 8 }}>
        {del}
        <a href={files.url(dump.fileId)} target="_blank" rel="noreferrer">
          <img className="dump-img" src={files.url(dump.fileId)} alt={dump.content || dump.fileName || 'dump'} loading="lazy" />
        </a>
        <div style={{ padding: '10px 8px 4px' }}>
          {dump.content && <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{dump.content}</p>}
          {dump.fileName && (
            <p className="muted" style={{ margin: dump.content ? '6px 0 0' : 0, fontSize: 12, wordBreak: 'break-word' }}>
              {dump.fileName}
            </p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="dump-card reveal">
      {del}
      <a className="pdf-tile link-plain" href={files.url(dump.fileId)} target="_blank" rel="noreferrer">
        <span className="pdf-mark">PDF</span>
        <strong style={{ wordBreak: 'break-word' }}>{dump.fileName || 'Document'}</strong>
        <span className="muted" style={{ fontSize: 12 }}>Open ↗</span>
      </a>
      {dump.content && <p style={{ margin: '14px 0 0', whiteSpace: 'pre-wrap', fontSize: 14 }}>{dump.content}</p>}
      {stamp}
    </Card>
  );
}
