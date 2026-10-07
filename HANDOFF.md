# GVPro Gallery — handoff (07.10.26)

## Project
Static site for gvpro.app by GenVidPro (owner: Roman Chorny). A living 3D solar system played like a showreel: each planet is one app. Awwwards-style, resend.com-like restraint (dark, thin gradient borders, glass panels, Instrument Serif titles, Inter body; Hebrew: Frank Ruhl Libre + Heebo). Must run smoothly on a mid-range Android (Realme 11 Pro).

Repo: https://github.com/romachorny/gvpro-gallery (branch main, PR #1 merged)
Stack: Vite 8 + three.js 0.186, no backend, no paid services.

## Apps (src/apps.js — one object per planet)
1. Yeshli — LIVE — https://yeshli.base44.app/ — liquid chrome, warm light inside
2. Tiulio — LIVE — https://tiulio.base44.app/ — clear glass, four season particle groups
3. Coolometer — soon — gold sphere + gold ring under frost
4. Three Screens — soon — frosted
5. Order Agent — soon — frosted
6. Logo Motion — soon — frosted
Thaw an app: set status 'live' and add url.

## What is built
- Intro ~3.5 s (GenVidPro presents → GVPro → fly-in), skippable by tap.
- Autoplay showreel: wide shot, then hero shot per planet (4.5 s) with film title. Swipe / wheel / arrows / side dots navigate; any input pauses autoplay 14 s.
- Gesture hint pills (swipe, tap, shake), each disappears forever after use.
- Shake (DeviceMotion) scatters planets, they spring back.
- Dive: tap live planet in hero shot → camera dives, color flood, full-screen card with icon, real link, "Back to the system".
- Below 3D: app list (also static HTML for SEO) + contacts (WhatsApp, email with copy, Telegram, genvidpro.com).
- he/en with toggle, Hebrew default for he browsers, RTL mirroring.
- Adaptive quality: <40 fps drops bloom and pixel ratio, <28 fps switches to lite. Lite (CSS orbs) also for no WebGL, deviceMemory ≤2, reduced motion.
- public/og.jpg 1200×630, no text, rendered from the scene; Hebrew og:title "אפליקציות שאפשר לנסות עכשיו", og:description "פותחים בטלפון ומנסים בלי להתקין". qa/og-preview.html shows the WhatsApp card at 3 widths.
- Cloudflare Pages ready: build "npm run build", output "dist", public/_headers (CSP, nosniff, immutable cache for /assets). Not deployed.

## Files
index.html · src/main.js (flow, input, hints, dive, quality) · src/scene.js (three.js scene, camera, materials, poster pose) · src/ui.js · src/lite.js · src/apps.js · src/i18n.js · src/style.css · scripts/render-og.mjs · qa/run-qa.mjs · README.md
URL flags: ?lang=he|en ?nointro=1 ?shot=N ?autoplay=0 ?lite=1 ?fixed=1 ?fresh=1 ?og=1

## QA results
- Playwright + SwiftShader, 390×844 / 412×915 / 1440×900, he + en: 181/182 checks pass (one timing flake on desktop intro under software rendering).
- JS total ~155 KB gzipped (limit 350).
- Lighthouse mobile, 3D page: perf 34 (software WebGL, not representative), a11y 100, best practices 96, SEO 100. Lite page: 96 / 100 / 96 / 100.

## Still open
1. Test on a real Realme 11 Pro and an iPhone: smoothness, shake, iOS motion permission, Google Fonts loading, runtime app icons.
2. Deploy: connect repo to Cloudflare Pages (genvidpro.com account), domain gvpro.app.
3. GVPro logo/icon — separate task (do not use the GVP icon).
4. qa/ screenshots (~12 MB) are committed; consider moving out of the repo.
5. Optional polish: Tiulio glass reads grey on some angles; chrome Yeshli can look pearl-white under bloom.

## Rules from Roman
No paid services or sign-ups without asking. Never send anything in his name. Working texts and on-screen text in English (plus Hebrew UI). Do not invent a GVPro logo.
