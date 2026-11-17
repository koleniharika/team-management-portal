// How a saved (already-cleaned) link renders. The worker canonicalises links, so these
// patterns only need to recognise its output — see backend/src/lib/links.js.

/** { kind, vertical, src } for links that have a platform player, otherwise null. */
export function embedFor(link) {
  if (!link) return null;
  let m = link.match(/^https:\/\/www\.youtube\.com\/shorts\/([\w-]+)/);
  // muted autoplay is the only autoplay browsers allow; loop needs playlist=<same id>
  if (m) return { kind: 'youtube', vertical: true, src: `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&playsinline=1&rel=0` };
  m = link.match(/^https:\/\/www\.youtube\.com\/watch\?v=([\w-]+)/);
  if (m) return { kind: 'youtube', vertical: false, src: `https://www.youtube.com/embed/${m[1]}?rel=0` };
  m = link.match(/^https:\/\/www\.instagram\.com\/(p|reel|tv)\/([\w-]+)\//);
  // Instagram's embed page; it never autoplays, that's their rule
  if (m) return { kind: 'instagram', vertical: m[1] !== 'p', src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/` };
  return null;
}

export const hostOf = (link) => {
  try { return new URL(link).hostname.replace(/^www\./, ''); } catch { return link; }
};

export const tagsOf = (dump) => String(dump.tags || '').split(',').filter(Boolean);

/** Every word must appear somewhere in title, description, tags or link — any order, any case. */
export function matches(dump, query) {
  const hay = `${dump.title || ''} ${dump.description || ''} ${dump.tags || ''} ${dump.link || ''}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).map((w) => w.replace(/^#+/, '')).filter(Boolean)
    .every((w) => hay.includes(w));
}
