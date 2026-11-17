import { Hono } from 'hono';
import { all, csv, insert, one, remove } from '../lib/db.js';
import { cleanLink } from '../lib/links.js';
import { requireAdmin } from '../middleware/auth.js';

// Links and text only — there is no file storage in this project; images are saved as links.
const dumps = new Hono();

const TYPES = { carousel: 'Carousel Dump', format: 'Format Dump', idea: 'Idea Dump' };

/** Tags are stored as 'a,b,c': lower-case, no commas inside a tag, no repeats. */
const cleanTags = (value) => [...new Set(csv(value)
  .map((t) => t.replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase())
  .filter(Boolean))].join(',');

// % and _ typed into the search box are literal characters, not LIKE wildcards
const like = (text) => `%${String(text).toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;

/** ?dumpType=format&tag=skincare&q=hook — every filter optional, newest first. */
dumps.get('/', async (c) => {
  const { dumpType, tag, q } = c.req.query();
  const where = [];
  const params = [];
  if (dumpType) { where.push('dumpType = ?'); params.push(dumpType); }
  if (tag) {
    // wrapping in commas makes this an exact tag match: 'care' does not hit 'skincare'
    where.push(`(',' || lower(tags) || ',') LIKE ? ESCAPE '\\'`);
    params.push(like(`,${cleanTags(tag)},`));
  }
  if (q?.trim()) {
    where.push(`lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(tags, '') || ' ' || coalesce(link, '')) LIKE ? ESCAPE '\\'`);
    params.push(like(q.trim()));
  }
  return c.json(await all(
    c.env.DB,
    `SELECT * FROM dumps ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY createdAt DESC`,
    params,
  ));
});

dumps.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const dumpType = String(body.dumpType || '');
  if (!TYPES[dumpType]) return c.json({ error: 'Pick a dump: carousel, format or idea.' }, 400);

  const rawLink = String(body.link || '').trim();
  const link = rawLink ? cleanLink(rawLink) : null;
  if (rawLink && !link) return c.json({ error: "That link doesn't look like a web address." }, 400);
  if (!link && dumpType !== 'idea') return c.json({ error: 'Paste the link to save.' }, 400);

  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  if (!link && !title && !description) return c.json({ error: 'Nothing to save.' }, 400);

  if (link) {
    const existing = await one(c.env.DB, 'SELECT dumpType FROM dumps WHERE link = ?', [link]);
    if (existing) return c.json({ error: `Already in your dump (${TYPES[existing.dumpType] || existing.dumpType}).`, link }, 409);
  }

  try {
    // link stays NULL (never '') for text ideas, so the unique index lets any number of them in
    return c.json(await insert(c.env.DB, 'dumps', {
      dumpType, link, title, description, tags: cleanTags(body.tags), createdBy: c.get('user').id,
    }), 201);
  } catch (err) {
    // two saves of the same link racing past the check above
    if (/UNIQUE/i.test(err.message)) return c.json({ error: 'Already in your dump.', link }, 409);
    throw err;
  }
});

/** Anyone can save; only admins clear the board. */
dumps.delete('/:id', requireAdmin, async (c) => {
  await remove(c.env.DB, 'dumps', c.req.param('id'));
  return c.json({ ok: true });
});

export default dumps;
