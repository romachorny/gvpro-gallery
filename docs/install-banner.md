# Install banner — the standard for every gvpro.app app

Roma, 29.10.2026: every app of ours shows the same glass install banner with an **Install**
button on the first visit. The code lives in one file: `public/install-banner.js` in this repo.
Copy it as is; do not fork the look or the text per app.

## Hook it up

```html
<link rel="manifest" href="/manifest.webmanifest?v=N">
<script src="/install-banner.js?v=1" data-name="Coolometer" data-icon="/icon-192.png" defer></script>
```

- `data-name` — the name after "Install"; default: `application-name` meta, else the page title.
- `data-icon` — a square icon; default: `apple-touch-icon`.
- Load it in `<head>` so `beforeinstallprompt` is never missed.

## Behaviour

1. Android / Chrome: `beforeinstallprompt` is caught (`preventDefault`), 0.6 s later the banner
   slides up at the bottom. **Install** calls `prompt()`; a "dismissed" answer counts as x.
2. iOS Safari (no install event): after 1.5 s the same banner says
   "Tap Share, then Add to Home Screen", no button.
3. **x** hides it and remembers it for 14 days (`localStorage['gvp-install-dismissed']`).
4. Never shown when installed: `display-mode: standalone` / `fullscreen`, `navigator.standalone`.
   `appinstalled` hides it.
5. Must not cover the app's own bottom controls. While visible, `<html>` has class
   `gvp-install-on` and the CSS var `--gvp-install-h` (banner height + margin); lift bottom
   controls with `bottom: calc(22px + var(--gvp-install-h, 0px))`. Show and hide fire
   `gvp-install-change` on `window` — relayout canvases on it (the gallery does, so the
   bubbles and the Shake button stay above the banner).
6. `window.__gvpInstall.show()` / `.hide()` — for a "Install app" item in settings.

## Look

Glass pill-card, fixed 12 px from the bottom and sides (+ safe area), max 520 px wide,
radius 20, `rgba(22,22,28,.55)` + `backdrop-filter: blur(18px) saturate(160%)`,
1 px white 18% border, white 40 px Install pill, 40 px x. LTR, system font.

## Text (English, everywhere)

- Title: `Install <App>`
- Android line: `Opens from your home screen, like an app`; button: `Install`
- iOS line: `Tap Share, then Add to Home Screen`
- x: aria-label `Not now`

## What Chrome needs, or the event never fires

- A manifest with `name`, `short_name`, `start_url`, `display: standalone`, 192 and 512 PNG icons
  (plus a maskable 512); **every icon URL must return 200**.
- A service worker **with a `fetch` handler**, registered from the page.

## Service worker cache rule (#82, #86)

- Register as `/sw.js?v=<build>` (a new address every deploy); the worker names its cache
  from that `v` and deletes older caches on `activate`. Apps without a build register
  `sw.js?v=2` and bump the `CACHE` name by hand (`-v2`) on every change.
- The server sends `Cache-Control: no-cache` **and** `CDN-Cache-Control: no-store` +
  `Cloudflare-CDN-Cache-Control: no-store` for `sw.js` (gvpro-static `server.py` does it for every
  site), otherwise the Cloudflare edge pins phones to an old worker.
- Changed the manifest, the icons or this script? Bump their `?v=` too.

## Check

```bash
node qa/install-banner-check.mjs coolometer=https://coolometer.gvpro.app/   # Node 22, Playwright
```
Pixel 7 at 390x844, fresh profile: `beforeinstallprompt` fired and the banner is visible;
screenshot to `~/outbox/install-banner-<name>.png`.
