# gvpro-gallery

GVPro app gallery at **gvpro.app**: every app is a planet in a living 3D system, played like a showreel.
Dark, material-driven look (polished metal, frosted glass, crystal, gold), Hebrew and English, works on a mid-range Android.

## What it is

- A Vite + three.js static site. No backend, no analytics, no paid services.
- Intro (3 s, skippable) → auto-playing showreel: wide shot of the system, then a hero shot per planet with a film title.
- Swipe, mouse wheel, arrow keys or the side dots jump between shots. Any input pauses autoplay for 14 s.
- Gesture hints (swipe / tap / shake) appear one at a time as glass pills and disappear for good once used.
- Live planets glow warm with a pulsing ring; tapping one in its hero shot dives into it and opens a full-screen card with a real link.
- Coming-soon planets are frozen (frosted, cold, sparkling).
- Shake the phone: planets scatter and fly back.
- Below the 3D: a plain list of all apps (SEO, works without WebGL) and contacts.
- Lite mode (static CSS scene, same titles and cards) when WebGL is missing, `deviceMemory <= 2`, `prefers-reduced-motion`, or when measured FPS stays under 28.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview    # serves dist/ on http://localhost:4173
```

Useful URL flags while developing: `?lang=he|en`, `?nointro=1`, `?shot=3`, `?autoplay=0`, `?fixed=1` (no adaptive quality), `?lite=1`, `?fresh=1` (forget used hints), `?og=1` (poster pose, canvas only).

## Add or thaw an app

Everything lives in `src/apps.js`. One object = one planet, in orbit order.

```js
{
  id: 'coolometer',
  name: 'Coolometer',
  status: 'soon',            // 'live' thaws the planet: warm glow, ring, tap-to-dive, link in the list
  url: 'https://...',        // required when live
  icon: 'https://.../icon.png', // optional, shown on the dive card
  material: 'gold',          // chrome | glass | gold | frost (coming-soon planets are always frosted)
  color: '#70B8FF',          // flood colour of the dive
  line: { en: '...', he: '...' },
}
```

To thaw an app: change `status: 'soon'` to `status: 'live'` and add its `url`. Nothing else to touch.
To add an app: append an object. Orbits, dots, titles, list and card follow automatically (up to six orbits are defined in `src/scene.js`; add a radius there for a seventh).

Labels, hints and buttons are in `src/i18n.js`. Contacts are at the bottom of `src/apps.js`.

## OG image and favicon

`public/og.jpg` (1200×630, no text) is rendered from the real scene:

```
npm run build
npm run preview          # in another shell
npm run og               # writes public/og.jpg and public/apple-touch-icon.png
node scripts/og-preview-shot.mjs   # screenshot of qa/og-preview.html (chat card at 3 widths)
```

Open `qa/og-preview.html` in a browser to see how the WhatsApp card looks at desktop, small-window and phone widths without sending a message.

## QA

```
npm run build
npm run qa               # headless Chromium + SwiftShader, 390×844 / 412×915 / 1440×900, he + en
```

Checks: no horizontal scroll, no console errors, intro plays and can be skipped, swipe / wheel / keys change shots, hints appear and disappear after use, dive opens and back works, live links have the right hrefs, lite mode with WebGL disabled and with reduced motion. Screenshots and `qa/report.json` land in `qa/`.

## Hosting: Cloudflare Pages

Connect this repo to Cloudflare Pages (same account as genvidpro.com) and use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | Vite (or None) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node version | `NODE_VERSION = 22` (environment variable) |
| Custom domain | `gvpro.app` (+ `www.gvpro.app` redirect if wanted) |

`public/_headers` ships security headers (CSP, nosniff, referrer policy, permissions policy; frame-ancestors instead of X-Frame-Options) and a one-year immutable cache for `/assets/*`. No functions, no env secrets needed.

## Structure

```
index.html          markup, OG/Twitter meta, fonts, static app list
src/main.js         bootstrap, intro, autoplay, input, hints, shake, dive, adaptive quality
src/scene.js        three.js scene, materials, camera director, poster pose
src/ui.js           titles, dots, hint pills, dive card, list, contacts, language
src/lite.js         CSS fallback scene + procedural noise
src/apps.js         the app list (edit this)
src/i18n.js         strings and language detection
public/             _headers, manifest, favicon, og.jpg, robots, sitemap
scripts/            og render, og preview screenshot
qa/                 QA runner, og-preview.html, screenshots, report.json
```
