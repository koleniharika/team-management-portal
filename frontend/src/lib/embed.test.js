// Self-check for dump embeds + search. Run: `npm run check`
import assert from 'node:assert/strict';
import { embedFor, matches } from './embed.js';

assert.equal(embedFor('https://www.youtube.com/shorts/Ab_1').vertical, true);
assert.match(embedFor('https://www.youtube.com/shorts/Ab_1').src, /embed\/Ab_1\?autoplay=1&mute=1&loop=1&playlist=Ab_1/);
assert.equal(embedFor('https://www.youtube.com/watch?v=Ab_1').vertical, false);
assert.equal(embedFor('https://www.instagram.com/reel/C9x/').src, 'https://www.instagram.com/reel/C9x/embed/');
assert.equal(embedFor('https://www.instagram.com/p/C9x/').vertical, false, 'carousel/post');
assert.equal(embedFor('https://i.imgur.com/x.png'), null, 'images render as <img>');
assert.equal(embedFor(null), null);

const d = { title: 'Hook ideas', description: 'Before/after Skincare reveal', tags: 'skincare,ugc', link: 'https://www.instagram.com/reel/C9x/' };
assert.ok(matches(d, ''), 'empty search shows everything');
assert.ok(matches(d, 'SKIN'), 'case-insensitive partial');
assert.ok(matches(d, '#ugc'), 'hash prefix ignored');
assert.ok(matches(d, 'reveal hook'), 'words in any order, across fields');
assert.ok(matches(d, 'C9x'), 'link text');
assert.ok(!matches(d, 'hook fitness'), 'every word must match');
assert.ok(matches({ title: null, description: null, tags: '', link: null }, ''), 'blank row survives');

console.log('embed ok');
