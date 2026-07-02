'use strict';

/**
 * Google Photos public shared-album reader.
 *
 * This does NOT use the Google Photos API (whose read/sharing scopes were
 * removed on 31 March 2025). Instead it reads the *public* share page that
 * Google serves for a "Create link" shared album, and extracts the direct,
 * long-lived image URLs (https://lh3.googleusercontent.com/...) that are
 * embedded in the page's `AF_initDataCallback(...)` data blocks.
 *
 * Nothing is downloaded, copied or stored: we only return a list of URLs.
 *
 * The page format is an undocumented Google implementation detail and can
 * change. Parsing is therefore defensive, with a regex fallback.
 */

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/**
 * Given the index of an opening bracket ('[' or '{') in `str`, return the
 * index of its matching closing bracket. String-aware: brackets that appear
 * inside "..." or '...' string literals (respecting backslash escapes) are
 * ignored. Returns -1 if no match is found.
 */
function matchBracket(str, open) {
  let depth = 0;
  let inStr = false;
  let quote = '';
  for (let i = open; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue; }
    if (ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Extract every JSON array that immediately follows a `data:` key inside the
 * page's AF_initDataCallback blocks. Invalid/garbage matches are silently
 * skipped, so this is safe to run over an entire HTML document.
 */
function extractDataArrays(html) {
  const arrays = [];
  let idx = 0;
  while ((idx = html.indexOf('data:', idx)) !== -1) {
    const start = html.indexOf('[', idx + 5);
    if (start === -1) break;
    // The '[' must directly follow `data:` (allowing only whitespace between).
    if (html.slice(idx + 5, start).trim() !== '') {
      idx += 5;
      continue;
    }
    const end = matchBracket(html, start);
    if (end === -1) { idx += 5; continue; }
    const raw = html.slice(start, end + 1);
    try {
      arrays.push(JSON.parse(raw));
    } catch (err) {
      // Not valid JSON (e.g. contained JS values) — ignore this candidate.
    }
    idx = end + 1;
  }
  return arrays;
}

/**
 * A Google Photos media item is encoded as:
 *   [ "<mediaId>", [ "<baseUrl>", <width>, <height> ], <creationTimestampMs>, ... ]
 * Videos and other entries whose width/height are not numbers are ignored,
 * which conveniently keeps this photos-only.
 */
function isMediaNode(node) {
  return (
    Array.isArray(node) &&
    typeof node[0] === 'string' &&
    Array.isArray(node[1]) &&
    typeof node[1][0] === 'string' &&
    node[1][0].indexOf('googleusercontent.com') !== -1 &&
    typeof node[1][1] === 'number' &&
    typeof node[1][2] === 'number'
  );
}

function collectMedia(node, out) {
  if (!Array.isArray(node)) return;
  if (isMediaNode(node)) {
    const [url, width, height] = node[1];
    out.push({
      url,
      width,
      height,
      timestamp: typeof node[2] === 'number' ? node[2] : null,
    });
    return; // don't descend into a matched media node
  }
  for (const child of node) {
    if (Array.isArray(child)) collectMedia(child, out);
  }
}

/**
 * Parse a Google Photos public shared-album HTML page into a list of photos.
 * @param {string} html
 * @returns {Array<{url:string,width:?number,height:?number,timestamp:?number}>}
 */
function parseAlbumHtml(html) {
  const media = [];
  for (const arr of extractDataArrays(html)) collectMedia(arr, media);

  // Fallback: if the structured parse found nothing (format changed), scrape
  // photo URLs directly. Photo URLs use the "/pw/" path; avatars use "/a/".
  if (media.length === 0) {
    const re = /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_\-]+/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      media.push({ url: m[0], width: null, height: null, timestamp: null });
    }
  }

  // De-duplicate by base URL, preserving first-seen order.
  const seen = new Set();
  const out = [];
  for (const item of media) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

/** Append a size suffix (=w{W}-h{H}) to a Google Photos base URL. */
function sizedUrl(baseUrl, width, height) {
  const clean = baseUrl.replace(/=.*$/, '');
  return `${clean}=w${Math.round(width)}-h${Math.round(height)}`;
}

/** Fetch the raw HTML of a (possibly shortened) shared-album link. */
async function fetchAlbumHtml(shareUrl) {
  const res = await fetch(shareUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': DESKTOP_UA,
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) {
    throw new Error(`Google Photos returned HTTP ${res.status}`);
  }
  return res.text();
}

/** Fetch and parse a shared album into a list of photos. */
async function getAlbumPhotos(shareUrl) {
  const html = await fetchAlbumHtml(shareUrl);
  const photos = parseAlbumHtml(html);
  if (photos.length === 0) {
    throw new Error(
      'No photos found in the album. Make sure link sharing is enabled ' +
      '(Share → Create link) and the link is public.'
    );
  }
  return photos;
}

module.exports = {
  matchBracket,
  extractDataArrays,
  isMediaNode,
  parseAlbumHtml,
  sizedUrl,
  fetchAlbumHtml,
  getAlbumPhotos,
};
