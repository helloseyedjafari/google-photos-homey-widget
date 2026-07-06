<div align="center">

# 📸 Google Photos Slideshow

**Turn any public Google Photos album into a live slideshow on your Homey Pro dashboard — just paste a link.**

No copying. No folders. No Google API. No API keys.

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Homey Pro](https://img.shields.io/badge/Homey%20Pro-%E2%89%A5%2012.3.0-4285F4.svg)](https://homey.app/homey-pro/)
[![Apps SDK](https://img.shields.io/badge/Apps%20SDK-v3-4285F4.svg)](https://apps.developer.homey.app/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A5%2018-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Google API](https://img.shields.io/badge/Google%20API-not%20required-EA4335.svg)](#-how-it-works)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](test/googlePhotos.test.js)

</div>

---

Homey Pro has beautiful dashboards, but no way to slideshow a Google Photos
album — and third-party dashboards keep freezing when the screen goes idle.
This widget fixes both: it streams photos straight from a **public shared
album** and, like the dashboard clock, **keeps running even when the screen
dims**.

## ✨ Features

- 🔗 **Just a link.** Paste a public Google Photos share link — that's the whole setup.
- 🗂️ **Zero copying.** Photos stream from Google's CDN; the widget only ever holds URLs. Nothing is downloaded, moved, or duplicated.
- 🔓 **No Google API / OAuth / keys.** Reads the same public page your browser sees. (The Google Photos Library API's read & sharing scopes were removed on 31 Mar 2025 — this deliberately avoids them.)
- ⏰ **Doesn't freeze when idle.** Self-contained JavaScript with a wall-clock–derived index: the instant the display wakes, it snaps to the right photo and keeps cycling — exactly like the clock widget.
- 🎛️ **Configurable.** Seconds per photo, order (shuffle / newest / oldest), fill vs. fit, crossfade, and how often to re-scan for new photos.
- 🖼️ **Sharp on any size.** Requests images at your widget's exact pixel size.
- 🛟 **Resilient.** In-memory cache, serves the last good result on a hiccup, and auto-falls-back through the app if a webview policy ever blocks Google's image host.

> [!NOTE]
> **Photos only.** Videos in the album are automatically skipped. See
> [Limitations](#️-limitations) for the ~300-photo cap.

## 🚀 Quick start

> Requires **Homey Pro** on firmware **≥ 12.3.0**. (Widgets don't run on Homey Cloud.)

```bash
# 1. Install the Homey CLI
npm install -g homey

# 2. Log in with your (free) Homey developer account  (interactive)
homey login

# 3. Install the app onto your Homey Pro
git clone git@github.com:helloseyedjafari/google-photos-homey-widget.git
cd google-photos-homey-widget
homey app install
```

Then on your dashboard: **Edit → add widget → Slideshow**, open
its settings, and paste your album link.

> 💡 Prefer live-reload while tinkering? Use `homey app run` instead of
> `install` — it streams logs and reloads on save, but stops when you close the
> terminal.

### Getting the album link

In Google Photos: open the album → **Share** → **Create link** → copy. It looks
like `https://photos.app.goo.gl/…`. Link sharing **must** be enabled, otherwise
the album isn't publicly readable.

## ⚙️ Settings

| Setting | Default | Notes |
|---|---|---|
| **Album link** | – | Public Google Photos shared link |
| **Seconds per photo** | `8` | 2–3600 |
| **Order** | `Shuffle` | Shuffle · Newest first · Oldest first |
| **Image fit** | `Fill` | Fill (crop to frame) or Fit (whole photo, letterboxed) |
| **Transition** | `Crossfade` | Crossfade or None |
| **Re-scan album every** | `30 min` | Picks up newly added photos |

### 📐 Sizing

Set the widget's **height** in
[`widgets/slideshow/widget.compose.json`](widgets/slideshow/widget.compose.json)
(`"height": 300`), or resize it on the dashboard. Its **width** follows the
dashboard's grid columns (Homey doesn't offer free-form drag-resize yet). The
photo fills whatever size the widget is, per the *Image fit* setting.

## 🧠 How it works

```
Homey app backend (app.js)                 Widget webview (index.html)
──────────────────────────                 ───────────────────────────
getPhotos(albumUrl)                         onHomeyReady:
  → fetch the public share page               read settings
  → parse lh3.googleusercontent URLs          Homey.api('POST','/photos') ──┐
  → cache in memory, return list   ◀──────────────────────────────────────┘
                                              cycle background-images using
                                              a wall-clock index
```

- **[`lib/googlePhotos.js`](lib/googlePhotos.js)** — fetches the share page and
  extracts the direct image URLs from its `AF_initDataCallback(...)` data blocks
  (with a regex fallback if Google changes the layout). Entries without numeric
  width/height (videos) are skipped, keeping it photos-only.
- **[`app.js`](app.js)** — caches results, serves stale data on error, and
  exposes an image-proxy endpoint used only as a fallback.
- **[`widgets/slideshow/`](widgets/slideshow/)** — the widget definition, its
  backend API, and the frontend slideshow.

### Why it survives an idle screen

The widget never trusts its timer to have fired. It computes *which photo should
be on screen right now* from the wall clock:

```js
index = Math.floor(Date.now() / 1000 / intervalSeconds) % photos.length;
```

So the moment the display wakes, refocuses, or repaints, it jumps straight to
the correct current photo and carries on — the same reason a clock always shows
the right time after the screen dims. While the screen is on (even dimmed), it
advances normally every second.

## 🖥️ Running on a wall tablet

Because the slideshow is self-contained JS, it keeps running as long as the
display is actually rendering. Just keep the tablet from fully sleeping:

- **Homey Kiosk Mode** (hold a dashboard → *Start Kiosk Mode*) with the device
  screen-timeout set to never; or
- **Fully Kiosk Browser** pointed at the dashboard, with *Keep Screen On*.

A dimmed-but-on screen is fine — after any true sleep it snaps to the correct
photo on wake.

## ⚠️ Limitations

> [!IMPORTANT]
> **Only the first ~300 photos of an album are shown.**
> The public share page loads ~300 photos up front and lazy-loads the rest as
> you scroll in a browser. If your album has **≤ 300 photos you get all of
> them**; if it's larger, the slideshow cycles the first ~300 (plenty for a
> photo frame). Fetching *everything* would require paginating Google's internal
> endpoint — more complex and more fragile — so it isn't done by default.
> [Open an issue](../../issues) if you need full-album support.

- **Public albums only.** Link sharing must be enabled on the album.
- **Photos only.** Videos are skipped.
- **Unofficial source.** This reads Google's public share page, not an official
  API. Google occasionally changes that page's internal format; the parser has a
  fallback, but a change may need a small update to `lib/googlePhotos.js`. This
  is the one inherent maintenance risk of the approach.

## 🛠️ Troubleshooting

| Symptom | Fix |
|---|---|
| *"No photos found."* | The album link isn't public — re-check **Share → Create link**. |
| Album is public but nothing shows | A webview policy may block Google's image host; the widget auto-retries via the app's `/image` proxy. Check the widget console if it persists. |
| Worked, then broke | Google likely changed the share-page format — update `lib/googlePhotos.js`. |

**Debugging:** attach Chrome/Safari DevTools to the widget webview (Homey docs →
*Widgets → Debugging*) for its console. Backend logs appear in `homey app run`.

## 👩‍💻 Development

```bash
npm test            # parser unit tests (node --test)
npm run gen:images  # regenerate the banner + widget previews (needs Python + Pillow)
```

```
.
├── app.js                              # backend: fetch, cache, proxy
├── lib/googlePhotos.js                 # share-page parser (unit-tested)
├── widgets/slideshow/
│   ├── widget.compose.json             # name, settings, height, API
│   ├── api.js                          # widget → app bridge
│   ├── public/index.html               # the slideshow itself
│   └── preview-{light,dark}.png        # widget-picker previews
├── assets/icon.svg                     # app icon
├── assets/images/*.png                 # App Store banner (gen: scripts/gen-assets.py)
├── .homeycompose/app.json              # app-level manifest source
├── app.json                            # compiled manifest (regenerated by build)
└── test/googlePhotos.test.js
```

> **`app.json` is the compiled manifest** and is committed — the Homey CLI needs
> it to exist. `homey app build` regenerates it by merging `.homeycompose/app.json`
> with the `widgets/` compose files, so edit those sources and rebuild rather than
> editing `app.json` by hand.

## 📦 Publishing to the App Store (optional)

For personal use, `homey app install` is enough. The app icon
(`assets/icon.svg`), App Store banner (`assets/images/*`) and widget previews are
generated by `scripts/gen-assets.py`. To publish, you may also want real
in-context screenshots and a `.homeychangelog.json`, then run `homey app publish`.

## 🙏 Credits

Inspired by the Home Assistant
[`album_slideshow`](https://github.com/eyalgal/album_slideshow) project, rebuilt
natively for Homey Pro.

## 📄 License

[MIT](LICENSE) © Seyed Jafari
