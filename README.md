# gvpro-gallery

GVPro app gallery at **gvpro.app**: every app is a floating glass bubble with its real icon inside.
Dark, calm, premium. Hebrew first (full RTL), English behind a switch. Plays like a showreel the moment it opens.

## What it is

- Vite static site, no libraries at runtime. Rendering is raw WebGL (one backdrop pass, one quad per bubble, one point batch for droplets): refraction of the backdrop, the icon inside, a thin iridescent film, rim light and highlights. About 13 KB of JS gzipped.
- No backend, no analytics, no accounts, no forms, no contacts, no paid services. A pure storefront.
- Bubbles drift and gently push each other. Grab one with a finger or the mouse and throw it.
- Nothing random: positions and sizes come from the app order and status (`src/field.js`). The layout mirrors in Hebrew.
- Showreel on open: bubbles rise and inflate one by one, a spotlight walks through the apps with a caption, then a shake plays, and it loops. Any touch pauses it for 12 s.
- Below the canvas: a plain HTML list of all apps (SEO, works without JS).

## Status rules

| status | size | tap |
| --- | --- | --- |
| `live` | large, brightest | bursts into droplets (~300 ms), then the app opens |
| `building` | medium | bursts, then a glass card says it opens soon |
| `soon` | small, frosted | never bursts: a wobble plus name, one line and "בקרוב" |

**Shake** (glass pill at the bottom, phone shake, fast mouse shake or the Space key) bursts every `live` and `building` bubble at once; they re-inflate about 1 s later. On iOS the motion permission is asked quietly on the first tap.

## Apps and links

Everything lives in `src/apps.js`, one object per bubble, in display order.

```js
{
  id: 'yeshli',                         // also the icon file name
  name: 'Yeshli',
  status: 'live',                       // 'live' | 'building' | 'soon'
  url: 'https://yeshli.base44.app/',    // where it opens today
  home: 'https://yeshli.gvpro.app/',    // its future <name>.gvpro.app
  tint: '#FFCA16',                      // glow colour of the bubble
  line: { he: '...', en: '...' },
}
```

Every app lives at `<name>.gvpro.app` in the end. When the subdomains are live, change one line at the top of `src/apps.js`:

```js
export const LINK_TARGET = 'home'; // was 'url'
```

All bubble taps and list links switch to `home`.

To promote an app: change its `status` (and add `url` when it goes live). Layout, size, caption, list and tap behaviour follow.

## Icons

Drop `public/icons/<id>.png` (1024 px square, rounded corners) and rebuild. That is the only step: the build lists which icon files exist (`vite.config.js`), so the page never asks for a missing one. Until a file is there, a neutral glass tile with the app initial is drawn.

After adding icons, re-render the link preview image (`npm run og`, below).

## Lite mode

Used when WebGL is missing, `navigator.deviceMemory <= 2`, `prefers-reduced-motion`, or when a phone stays under ~22 fps even at pixel ratio 1. Same layout, CSS glass bubbles as real buttons, same tap rules, no animation loop. On slower phones the pixel ratio drops from 2 to 1.5 to 1 before that.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview    # serves dist/ on http://localhost:4173
```

URL flags: `?lang=he|en`, `?lite=1`, `?autoplay=0`, `?fixed=1` (no adaptive quality), `?nonav=1` (record the link instead of leaving), `?og=1` (poster pose, canvas only).

## Link preview (WhatsApp)

Title and description are Hebrew only, no dots, no Latin letters. `public/og.jpg` (1200×630) is a bright frame of the real renderer with no text at all.

```
npm run build
npm run preview          # in another shell
npm run og               # writes public/og.jpg and public/apple-touch-icon.png
node scripts/og-preview-shot.mjs   # qa/og-preview.png: the chat card at desktop, narrow window and phone widths
```

## QA

```
npm run build
npm run qa
```

Headless Chromium + SwiftShader at 390×844, 412×915 and 1440×900, Hebrew and English. Checks: showreel runs on its own, sizes by status, bubbles stay on screen, live tap bursts and opens the right link, building card, soon wobble and toast, drag and throw, shake (pill, Space, mouse shake, DeviceMotion), iOS permission on first tap, language switch mirrors the layout, list links, no horizontal scroll, no console errors, and no request ever leaves localhost. Lite mode with WebGL disabled and with reduced motion.
Screenshots land in `qa/shots/`, results in `qa/report.json`, Lighthouse in `qa/lighthouse-summary.json`.

## Hosting: Cloudflare Pages

| Setting | Value |
| --- | --- |
| Framework preset | Vite (or None) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `NODE_VERSION = 22` |
| Custom domain | `gvpro.app` |

`public/_headers` ships security headers (CSP without third-party images, motion sensors allowed for shake) and long caching for `/assets/*` and `/icons/*`.

## Structure

```
index.html        markup, OG meta, static app list
src/apps.js       the app list and the link switch (edit this)
src/field.js      layout by status, physics, drag, burst, droplets
src/glass.js      WebGL glass renderer and the backdrop
src/icons.js      icon files and the glass placeholder
src/main.js       bootstrap, showreel, input, shake, adaptive quality
src/ui.js         caption, Shake pill, soon toast, building card, list, language
src/lite.js       lite mode (CSS glass)
src/i18n.js       Hebrew and English strings
public/           _headers, icons/, manifest, favicon, og.jpg, robots, sitemap
scripts/          og render, og preview screenshot
qa/               QA runner, og-preview.html, shots/, report.json, lighthouse-summary.json
```
