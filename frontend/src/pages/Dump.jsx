import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import { embedFor, hostOf, matches, tagsOf } from '../lib/embed';
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, Modal, PageHead, TextArea } from '../components/ui';

const TABS = [
  { key: 'carousel', label: 'Carousel Dump', hint: 'Carousel posts worth stealing from.', placeholder: 'https://www.instagram.com/p/…' },
  { key: 'format', label: 'Format Dump', hint: 'Reels and Shorts with a format to reuse.', placeholder: 'Instagram reel or YouTube Short link' },
  { key: 'idea', label: 'Idea Dump', hint: 'An idea, a link, or an image link.', placeholder: 'Optional — leave blank for a text idea' },
];

// notes rotate through the pastels so the board looks like a pinboard, not a list
const NOTE_TONES = ['lime', 'yellow', 'lilac', 'blue', 'pink'];
const toneFor = (id) => NOTE_TONES[[...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) % NOTE_TONES.length];

export default function Dump() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('format');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);

  // one fetch for all three tabs: switching tabs and searching never wait on the network
  const { data, loading, error: loadError, setData, mutate } = useAsync(() => api.list('dumps'), []);
  const dumps = useMemo(() => data || [], [data]);

  const allTags = useMemo(() => [...new Set(dumps.flatMap(tagsOf))].sort(), [dumps]);
  const inTab = dumps.filter((d) => d.dumpType === tab);
  const tabTags = [...new Set(inTab.flatMap(tagsOf))].sort();
  const shown = inTab.filter((d) => (!tag || tagsOf(d).includes(tag)) && matches(d, q));
  const open = dumps.find((d) => d.id === openId);
  const current = TABS.find((t) => t.key === tab);

  const switchTab = (key) => { setTab(key); setTag(''); };
  const toggleTag = (t) => setTag((cur) => (cur === t ? '' : t));

  const remove = (dump) => {
    if (!window.confirm("Delete this from your dump? This can't be undone.")) return;
    setOpenId(null);
    mutate((list) => list.filter((d) => d.id !== dump.id), () => api.remove('dumps', dump.id));
  };

  return (
    <>
      <PageHead
        eyebrow={loading ? current.hint : `${inTab.length} saved · ${current.hint}`}
        title="Dump"
      >
        <Button onClick={() => setAdding(true)}>+ Add</Button>
      </PageHead>

      <div className="row" role="tablist" aria-label="Dumps" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <Button key={t.key} role="tab" aria-selected={tab === t.key} variant={tab === t.key ? undefined : 'ghost'}
            onClick={() => switchTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      <div className="filter-bar" style={{ gridTemplateColumns: '1fr' }}>
        <Field label="Search">
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Tag, title, a word from the description…" />
        </Field>
        {tabTags.length > 0 && (
          <div className="row" style={{ gap: 8 }}>
            {tabTags.map((t) => (
              <Button key={t} size="sm" variant={tag === t ? undefined : 'ghost'} aria-pressed={tag === t}
                onClick={() => toggleTag(t)}>
                #{t}
              </Button>
            ))}
          </div>
        )}
      </div>

      <ErrorNote error={loadError} />

      {loading ? <Loading /> : shown.length === 0 ? (
        <Empty>
          {inTab.length ? 'Nothing matches that search.' : <>Nothing in the {current.label} yet. Hit <strong>+ Add</strong>.</>}
        </Empty>
      ) : (
        <div className={`masonry ${tab === 'idea' ? '' : 'masonry-media'}`}>
          {shown.map((d) => (
            <DumpCard key={d.id} dump={d} activeTag={tag} onTag={toggleTag} onOpen={() => setOpenId(d.id)} />
          ))}
        </div>
      )}

      <AddModal key={`${tab}-${adding}`} open={adding} tab={current} knownTags={allTags}
        onClose={() => setAdding(false)} onSaved={(row) => { setAdding(false); setData((list) => [row, ...list]); }} />

      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.title || (open?.link ? hostOf(open.link) : 'Idea')}
        subtitle={open && new Date(open.createdAt).toLocaleDateString()}>
        {open && (
          <div className="dump-detail">
            <div className="dump-frame"><Media dump={open} /></div>
            {open.description && <p style={{ whiteSpace: 'pre-wrap', margin: '16px 0 0' }}>{open.description}</p>}
            {tagsOf(open).length > 0 && (
              <div className="row" style={{ gap: 6, marginTop: 16 }}>
                {tagsOf(open).map((t) => <Badge key={t}>#{t}</Badge>)}
              </div>
            )}
            {open.link && <p className="muted" style={{ fontSize: 12, wordBreak: 'break-all', margin: '16px 0 0' }}>{open.link}</p>}
            <div className="modal-actions" style={{ marginTop: 20 }}>
              {isAdmin && <Button variant="danger" onClick={() => remove(open)}>Delete</Button>}
              <CopyButton text={copyText(open)} label={open.link ? 'Copy link' : 'Copy text'} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

const copyText = (d) => d.link || [d.title, d.description].filter(Boolean).join('\n\n');

function DumpCard({ dump, activeTag, onTag, onOpen }) {
  const tags = tagsOf(dump);
  const note = !dump.link;

  // Clicks inside an embed stay in the iframe, so the strip below the player is what opens it.
  return (
    <Card tight accent={note ? toneFor(dump.id) : undefined} className="dump-card reveal" onClick={onOpen}>
      {note ? (
        <>
          {dump.title && <p className="card-title" style={{ margin: '0 0 8px' }}>{dump.title}</p>}
          {dump.description && <p className="dump-note">{dump.description}</p>}
        </>
      ) : (
        <div className="dump-media"><Media dump={dump} /></div>
      )}

      <div className="dump-meta">
        <button type="button" className="dump-open">
          {note ? 'Open' : dump.title || hostOf(dump.link)}
        </button>
        {tags.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            {tags.map((t) => (
              <button key={t} type="button" className={`badge ${activeTag === t ? 'badge-solid-ink' : ''} dump-tag`}
                onClick={(e) => { e.stopPropagation(); onTag(t); }} aria-pressed={activeTag === t}>
                #{t}
              </button>
            ))}
          </div>
        )}
        <CopyButton text={copyText(dump)} label={note ? 'Copy' : 'Copy link'} />
      </div>
    </Card>
  );
}

/** The player, the image, or — when an image link doesn't load — a plain link tile. */
function Media({ dump }) {
  const [broken, setBroken] = useState(false);
  const embed = embedFor(dump.link);

  if (!dump.link) return null;
  if (embed) {
    return (
      <div className={`embed embed-${embed.kind} ${embed.vertical ? 'embed-v' : 'embed-h'}`}>
        <iframe src={embed.src} title={dump.title || 'Embedded post'} loading="lazy" scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowFullScreen />
      </div>
    );
  }
  if (!broken) {
    return <img className="dump-img" src={dump.link} alt={dump.title || ''} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <a className="dump-link" href={dump.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      <span className="eyebrow">{hostOf(dump.link)}</span>
      <span>Open link ↗</span>
    </a>
  );
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this:', text); // clipboard blocked (http, old browser): let them copy by hand
    }
  };

  return (
    <Button type="button" size="sm" variant="ghost" onClick={copy} aria-live="polite">
      {copied ? 'Copied ✓' : label}
    </Button>
  );
}

function AddModal({ open, tab, knownTags, onClose, onSaved }) {
  const [form, setForm] = useState({ link: '', title: '', description: '' });
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const needsLink = tab.key !== 'idea';
  const empty = needsLink ? !form.link.trim() : !(form.link.trim() || form.title.trim() || form.description.trim());

  const toggle = (t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const addTag = () => {
    const t = newTag.trim().replace(/^#+/, '').replace(/,/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag('');
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // the worker cleans the link and refuses one that's already saved
      onSaved(await api.create('dumps', { dumpType: tab.key, ...form, tags }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // chips = every tag used anywhere, plus custom ones typed just now
  const chips = [...new Set([...knownTags, ...tags])];

  return (
    <Modal open={open} onClose={onClose} title={`Add to ${tab.label}`} subtitle={tab.hint}>
      <form onSubmit={save}>
        <Field label="Link" hint={needsLink ? undefined : 'optional'}>
          <Input autoFocus inputMode="url" required={needsLink} value={form.link} onChange={set('link')}
            placeholder={tab.placeholder} />
        </Field>
        <Field label="Title" hint="optional">
          <Input value={form.title} onChange={set('title')} placeholder="What's worth remembering" />
        </Field>
        <Field label="Description" hint="optional">
          <TextArea value={form.description} onChange={set('description')} rows={4}
            placeholder={needsLink ? 'Why you saved it, what to reuse…' : 'The idea itself, or notes on the link…'} />
        </Field>

        <Field label="Tags" hint="pick any, or add your own">
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="New tag"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            <Button type="button" variant="ghost" onClick={addTag} disabled={!newTag.trim()}>Add</Button>
          </div>
        </Field>
        {chips.length > 0 && (
          <div className="row" style={{ gap: 8, margin: '-4px 0 16px' }}>
            {chips.map((t) => (
              <Button key={t} type="button" size="sm" variant={tags.includes(t) ? undefined : 'ghost'}
                aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>
                #{t}
              </Button>
            ))}
          </div>
        )}

        <ErrorNote error={error} />
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button busy={busy} disabled={empty}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
