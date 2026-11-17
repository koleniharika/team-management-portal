// Self-check for link cleaning. Run: `npm run check`
import assert from 'node:assert/strict';
import { cleanLink } from './links.js';

const reel = 'https://www.instagram.com/reel/ABC123/';
assert.equal(cleanLink('https://www.instagram.com/reel/ABC123/?igsh=MWx0eXZ3&utm_source=ig'), reel);
assert.equal(cleanLink('  instagram.com/reel/ABC123  '), reel, 'no scheme, spaces, no trailing slash');
assert.equal(cleanLink('https://m.instagram.com/reels/ABC123/'), reel, 'm. host and /reels/');
assert.equal(cleanLink('https://www.instagram.com/someone/reel/ABC123/?igsh=x'), reel, 'username share form');
assert.equal(cleanLink('https://www.instagram.com/p/C_x-9/?img_index=2'), 'https://www.instagram.com/p/C_x-9/', 'carousel post');

const short = 'https://www.youtube.com/shorts/XyZ_12';
assert.equal(cleanLink('https://youtube.com/shorts/XyZ_12?si=abcDEF'), short);
assert.equal(cleanLink('https://m.youtube.com/shorts/XyZ_12/?feature=share'), short);
assert.equal(cleanLink('https://youtu.be/XyZ_12?si=a'), 'https://www.youtube.com/watch?v=XyZ_12');
assert.equal(cleanLink('https://www.youtube.com/watch?v=XyZ_12&t=30s&si=a'), 'https://www.youtube.com/watch?v=XyZ_12');

assert.equal(cleanLink('https://img.example.com/a.jpg?w=800&utm_source=x#top'), 'https://img.example.com/a.jpg?w=800',
  'other links keep real params, lose tracking and hash');
assert.equal(cleanLink(''), null);
assert.equal(cleanLink('just an idea'), null);
assert.equal(cleanLink('javascript:alert(1)'), null);

console.log('links ok');
