# Google Photos Slideshow — Homey Pro dashboard widget

A Homey Pro dashboard widget that slideshows a **public Google Photos album**.
You paste a shared album link and it cycles the photos — that's it.

- **No copying, no folders, no moving files.** The widget only ever holds a
  list of image URLs; photos stream straight from Google's CDN.
- **No Google API, no OAuth, no API key.** It reads the same *public* share
  page you'd open in a browser. (The Google Photos Library API's read/sharing
  scopes were removed on 31 Mar 2025 — this deliberately doesn't use them.)
- **Keeps slideshowing when the screen is idle/dim.** The slideshow is
  self-contained JavaScript, exactly like the dashboard clock — it doesn't wait
  for Homey to push data, so it doesn't freeze the way device widgets can.
- **Configurable:** seconds per photo, order (shuffle / newest / oldest),
  fill vs. fit, crossfade, and how often to re-scan for new photos.

---

## How it works

```
Homey app backend (app.js)                Widget webview (index.html)
──────────────────────────                ───────────────────────────
getPhotos(albumUrl)                        onHomeyReady:
  → fetch public share page                  read settings
  → parse lh3.googleusercontent URLs         Homey.api('POST','/photos') ──┐
  → cache in memory, return list  ◀──────────────────────────────────────┘
                                             cycle <div> background-images
                                             using a wall-clock index
```

- **`lib/googlePhotos.js`** — fetches the share page and extracts the direct
  image URLs from the page's `AF_initDataCallback(...)` data blocks (with a
  regex fallback if Google changes the layout). Photos-only: entries without
  numeric width/height (videos) are skipped.
- **`app.js`** — caches results in memory (default: re-scan every 30 min) and
  serves the last good result if a fetch fails. Also exposes an image proxy
  used only as a fallback (see *Troubleshooting*).
- **`widgets/slideshow/`** — the widget definition, its backend API, and the
  frontend slideshow.

### Why it survives an idle screen

The widget doesn't trust its timer to have fired. It computes *which photo
should be showing right now* from the wall clock:

```js
index = Math.floor(Date.now() / 1000 / intervalSeconds) % photos.length
```

So the instant the display wakes, refocuses, or repaints, it jumps straight to
the correct current photo and carries on — the same reason a clock always shows
the right time after the screen dims. While the screen is on (even dimmed), it
advances every second as normal.

---

## Install it on your Homey Pro

Widgets require **Homey Pro** on firmware **≥ 12.3.0** (they don't run on Homey
Cloud).

1. Install Node.js (already have it) and the Homey CLI:
   ```bash
   npm install -g homey
   ```
2. Log in with your (free) Homey developer account — this step is interactive:
   ```bash
   homey login
   ```
3. From this folder, install the app onto your Homey Pro:
   ```bash
   homey app install
   ```
   (During development you can use `homey app run` instead — it live-reloads
   and streams logs, but stops when you close the terminal. `install` stays on
   the Homey.)
4. On your dashboard: **Edit → add widget → Google Photos Slideshow**, open its
   settings, and paste your album link.

> The Homey CLI generates the compiled `app.json` from `.homeycompose/` and the
> `widgets/` folder during `run`/`install`, so there is intentionally no
> `app.json` committed here.

### Getting the album link

In Google Photos: open the album → **Share** → **Create link** → copy. It looks
like `https://photos.app.goo.gl/…`. Link sharing **must** be on, or the album
isn't publicly readable.

---

## Settings

| Setting | Default | Notes |
|---|---|---|
| Album link | – | Public Google Photos shared link |
| Seconds per photo | 8 | 2–3600 |
| Order | Shuffle | Shuffle / Newest first / Oldest first |
| Image fit | Fill | Fill (crop to frame) or Fit (whole photo, letterboxed) |
| Transition | Crossfade | Crossfade or None |
| Re-scan album every (minutes) | 30 | Picks up newly added photos |

### Sizing / "resizable"

Set the widget's **height** in `widgets/slideshow/widget.compose.json`
(`"height": 300`) — or resize it on the dashboard. Its **width** follows the
dashboard's grid columns (Homey doesn't offer free-form drag-resize yet). The
photo fills whatever size the widget is, per the *Image fit* setting.

---

## Displaying it on a wall tablet

Because the slideshow is self-contained JS, it keeps running as long as the
display is actually rendering. Just make sure the tablet doesn't fully sleep:

- **Homey Kiosk Mode** (hold a dashboard → *Start Kiosk Mode*), with the
  device's screen-timeout set to never; or
- **Fully Kiosk Browser** pointed at the dashboard, with *Keep Screen On*.

A dimmed-but-on screen is fine — the slideshow keeps advancing, and after any
true sleep it snaps to the correct photo on wake.

---

## Troubleshooting

- **"No photos found."** The album link isn't public — re-check *Share → Create
  link*.
- **Photos don't appear but the album is public.** A webview Content-Security-
  Policy may be blocking Google's image host. The widget automatically retries
  each image through the app's built-in proxy (`/image` endpoint), so this
  should self-heal; if it doesn't, check the widget's console (see below).
- **It worked, then broke for everyone.** Google occasionally changes the share
  page's internal format. The parser has a fallback, but a format change may
  need a small update to `lib/googlePhotos.js`. This is the one inherent risk of
  reading the public page instead of an official API.

### Known limit: ~300 photos

The public share page loads only the first **~300 photos** of an album (Google
lazy-loads the rest as you scroll in a browser). If your album has 300 or fewer,
you get all of them; if it's larger, the slideshow cycles the first ~300. That's
plenty for a photo frame, but fetching *everything* would require paginating
Google's internal endpoint — more complex and more fragile. Open an issue /
extend `lib/googlePhotos.js` if you need it.

### Debugging

Attach Chrome/Safari DevTools to the widget webview (see the Homey docs:
*Widgets → Debugging*) to view its console. Backend logs appear in
`homey app run`.

---

## Develop

```bash
npm test                 # run the parser unit tests (node --test)
npm run gen:images       # regenerate placeholder store images
```

The parser is unit-tested offline against a synthetic share page. The live
format is exercised the moment you point it at a real album.

## Publishing to the App Store (optional)

For personal use, `homey app install` is enough. To publish, you'd add real
store screenshots (`assets/images/*` — placeholders are generated here), widget
preview images, a `.homeychangelog.json`, and run `homey app publish`.

---

*Inspired by the Home Assistant [`album_slideshow`](https://github.com/eyalgal/album_slideshow)
project, rebuilt natively for Homey Pro.*
