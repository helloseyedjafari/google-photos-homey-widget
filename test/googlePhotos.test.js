'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  matchBracket,
  parseAlbumHtml,
  sizedUrl,
} = require('../lib/googlePhotos');

// A miniature version of a real Google Photos share page. Two photos are
// encoded in the media-node shape, plus deliberate noise: an owner avatar
// (wrong shape, "/a/" path) and a caption string containing a "]" to make
// sure the bracket matcher is string-aware.
const FIXTURE = `
<!doctype html><html><head><title>Album</title></head><body>
<script nonce="x">
window.foo = 1;
AF_initDataCallback({key: 'ds:0', hash: '1', data:[["https://lh3.googleusercontent.com/a/AVATAR123"]], sideChannel: {}});
</script>
<script nonce="y">
AF_initDataCallback({key: 'ds:3', hash: '9', data:[null,[
["MEDIAID_ONE",["https://lh3.googleusercontent.com/pw/PHOTO_AAA",4000,3000],1600000000000,null,"a caption with a ] bracket"],
["MEDIAID_TWO",["https://lh3.googleusercontent.com/pw/PHOTO_BBB",3000,4000],1600000100000]
],"trailing-string"], sideChannel: {}});
</script>
</body></html>
`;

test('matchBracket ignores brackets inside string literals', () => {
  const s = 'x[1,"a]b",[2,3]]y';
  const open = s.indexOf('[');
  const close = matchBracket(s, open);
  assert.strictEqual(s.slice(open, close + 1), '[1,"a]b",[2,3]]');
});

test('parseAlbumHtml extracts photos with dimensions and timestamps', () => {
  const photos = parseAlbumHtml(FIXTURE);
  assert.strictEqual(photos.length, 2, 'should find exactly two photos');

  assert.deepStrictEqual(photos[0], {
    url: 'https://lh3.googleusercontent.com/pw/PHOTO_AAA',
    width: 4000,
    height: 3000,
    timestamp: 1600000000000,
  });
  assert.deepStrictEqual(photos[1], {
    url: 'https://lh3.googleusercontent.com/pw/PHOTO_BBB',
    width: 3000,
    height: 4000,
    timestamp: 1600000100000,
  });
});

test('parseAlbumHtml excludes avatars and other non-media images', () => {
  const photos = parseAlbumHtml(FIXTURE);
  const urls = photos.map((p) => p.url);
  assert.ok(!urls.some((u) => u.includes('/a/AVATAR')), 'avatar must be excluded');
});

test('parseAlbumHtml de-duplicates repeated URLs', () => {
  const dup = FIXTURE + FIXTURE;
  const photos = parseAlbumHtml(dup);
  assert.strictEqual(photos.length, 2, 'duplicates across blocks should collapse');
});

test('parseAlbumHtml regex fallback finds /pw/ photo URLs when structure is absent', () => {
  const html =
    '<html><body>no callbacks here ' +
    'src="https://lh3.googleusercontent.com/pw/ONLY_ONE=w100-h100" ' +
    'avatar="https://lh3.googleusercontent.com/a/SKIP_ME"</body></html>';
  const photos = parseAlbumHtml(html);
  assert.strictEqual(photos.length, 1);
  assert.strictEqual(photos[0].url, 'https://lh3.googleusercontent.com/pw/ONLY_ONE');
});

test('parseAlbumHtml returns empty array for a page with no photos', () => {
  assert.deepStrictEqual(parseAlbumHtml('<html><body>nothing</body></html>'), []);
});

test('sizedUrl appends a size and replaces any existing size suffix', () => {
  assert.strictEqual(
    sizedUrl('https://lh3.googleusercontent.com/pw/AAA', 800, 600),
    'https://lh3.googleusercontent.com/pw/AAA=w800-h600'
  );
  assert.strictEqual(
    sizedUrl('https://lh3.googleusercontent.com/pw/AAA=w100-h100-c', 1920, 1080),
    'https://lh3.googleusercontent.com/pw/AAA=w1920-h1080'
  );
});
