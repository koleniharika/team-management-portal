// Canonical form for a saved link, so the same post pasted twice is byte-identical
// and the unique index on dumps.link catches it.

// share/tracking params dropped from links we don't recognise; everything else is kept
// because image CDNs often need their query string to serve the file at all
const TRACKING = /^(utm_\w+|igsh|igshid|si|fbclid|gclid|mc_cid|mc_eid|ref_src|feature)$/i;

/** Returns the clean URL string, or null when the text isn't a usable http(s) link. */
export function cleanLink(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;

  const host = url.hostname.replace(/^(www\.|m\.)/, '');

  if (host === 'instagram.com') {
    // /p/ID, /reel/ID, /reels/ID, /tv/ID — also the /username/reel/ID/ share form
    const m = url.pathname.match(/\/(p|reels?|tv)\/([\w-]+)/);
    if (m) return `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/`;
    return `https://www.instagram.com${url.pathname.replace(/\/?$/, '/')}`;
  }

  if (host === 'youtube.com' || host === 'youtu.be') {
    const shorts = url.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shorts) return `https://www.youtube.com/shorts/${shorts[1]}`;
    const id = host === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : url.searchParams.get('v');
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }

  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  return url.toString();
}
