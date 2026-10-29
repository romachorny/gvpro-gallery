import { APPS, linkOf } from './apps.js';
import { detectLang, setLang, getLang } from './i18n.js';
import { createUI } from './ui.js';
import { createField } from './field.js';
import { createGlass } from './glass.js';
import { createLite, noiseDataUrl } from './lite.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const OG = q.get('og') === '1';
const FIXED = q.get('fixed') === '1';     // no adaptive quality (QA)
const NONAV = q.get('nonav') === '1';     // record the link instead of leaving (QA)
const AUTOPLAY = q.get('autoplay') !== '0';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPOT_MS = 3600;
const PAUSE_MS = 12000;

setLang(detectLang());
$('noise').style.backgroundImage = `url(${noiseDataUrl()})`;
if (OG) document.documentElement.classList.add('og');

const stage = $('stage');
const canvas = $('glass');
const field = createField(APPS);
let glass = null, lite = null;
let raf = 0, visible = true;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let pausedUntil = 0;
let last = performance.now(), acc = 0;
let perf = { from: performance.now() + 1500, n: 0, sum: 0 };
let drag = null;
let shakeLock = 0;
let motionAsked = false, motionOn = false;
let keysBound = false;
const ms = { x: 0, t: 0, dir: 0, flips: [] };
let reel = { i: -1, next: 0 };
const api = (window.__gvpro = { field, opened: null, shakes: 0, get mode() { return glass ? 'glass' : lite ? 'lite' : 'none'; } });

const ui = createUI({
  apps: APPS,
  onShake: () => { userAction(); requestMotion(); shake(); },
  onLang: () => {
    userAction();
    setLang(getLang() === 'he' ? 'en' : 'he', { save: true });
    ui.applyStatic();
    layout();
    if (lite) lite.place();
  },
  onAllApps: () => { userAction(); $('content').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); },
});
ui.applyStatic();

// ---------- mode ----------
function webglOK() {
  if (q.get('lite') === '1') return false;
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl'); } catch { return false; }
}
const weak = navigator.deviceMemory && navigator.deviceMemory <= 2;
if (OG || (webglOK() && !weak && !reducedMotion)) {
  try { startGlass(); } catch (e) { console.warn('glass failed, lite mode', e); startLite(); }
} else startLite();

function stageBox() {
  const r = stage.getBoundingClientRect();
  return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
}
function layout() {
  const { w, h } = stageBox();
  if (OG) field.layout(w, h, { top: 18, bottom: 18, fill: 0.34 });
  else field.layout(w, h, { top: 70, bottom: w < 700 ? 200 : 170, rtl: getLang() === 'he' });
}

function startGlass() {
  glass = createGlass({ canvas, field, apps: APPS, og: OG, keep: FIXED });
  layout();
  resize();
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); toLite(); });
  window.addEventListener('resize', () => { layout(); resize(); });
  if (OG) {
    field.settle(8);
    field.bubbles.forEach((b) => { b.glow = 0.6; });
    glass.render(4.0);
    document.body.classList.add('og-ready');
    return;
  }
  field.intro();
  reel.next = performance.now() + 1800;
  bindInput();
  raf = requestAnimationFrame(frame);
}
function resize() { const { w, h } = stageBox(); glass && glass.resize(w, h, dpr); }

function startLite() {
  canvas.hidden = true;
  stage.classList.add('is-lite');
  layout();
  lite = createLite({ root: $('lite'), field, onTap: tap });
  window.addEventListener('resize', () => { layout(); lite.place(); });
  bindKeys();
  reel.next = performance.now() + 600;
  if (!reducedMotion && AUTOPLAY) setInterval(() => showreel(performance.now()), 500);
  else ui.setCaption(APPS[0], { instant: true });
}
function toLite() {
  if (lite) return;
  cancelAnimationFrame(raf);
  glass = null;
  canvas.remove();
  startLite();
}

// ---------- loop ----------
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!visible || !glass) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= 1 / 60 && steps < 4) { field.step(1 / 60); acc -= 1 / 60; steps++; }
  if (steps === 4) acc = 0;
  showreel(now);
  glass.render(field.t);
  adapt(now, dt);
}
// Adaptive quality: lower the pixel ratio on slow phones, lite mode if still too slow.
function adapt(now, dt) {
  if (FIXED || now < perf.from) return;
  perf.n++; perf.sum += dt;
  if (perf.n < 90) return;
  const avg = perf.sum / perf.n;
  perf = { from: now + 1000, n: 0, sum: 0 };
  if (avg > 0.026 && dpr > 1) { dpr = Math.max(1, dpr - 0.5); resize(); }
  else if (avg > 0.045 && dpr <= 1) toLite();
  else perf.from = Infinity;
}
document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting && !document.hidden; }).observe(stage);

// ---------- showreel: spotlight each app in turn, then a shake ----------
function spotlight(i) {
  field.bubbles.forEach((b) => { b.glowTarget = b.i === i ? 1 : 0; });
  if (lite) lite.spotlight(i);
  if (i >= 0) ui.setCaption(APPS[i]);
}
function showreel(now) {
  if (!AUTOPLAY || now < pausedUntil || now < reel.next || ui.cardOpen) return;
  reel.i++;
  if (reel.i === APPS.length) {
    spotlight(-1);
    if (!lite || !reducedMotion) shake({ demo: true });
    reel.next = now + 2600;
    return;
  }
  if (reel.i > APPS.length) reel.i = 0;
  spotlight(reel.i);
  reel.next = now + SPOT_MS;
}
function userAction() {
  pausedUntil = performance.now() + PAUSE_MS;
  reel.next = pausedUntil;
}

// ---------- taps ----------
function tap(b) {
  userAction();
  requestMotion();
  ui.hideToast();
  reel.i = b.i;
  spotlight(b.i);
  if (b.status === 'soon') {
    if (glass) field.poke(b); else lite.wobble(b);
    ui.showToast(b.app, b.x, b.y - b.r * Math.max(b.scale, 1), stage.getBoundingClientRect());
    return;
  }
  burst(b);
  setTimeout(() => {
    if (b.status === 'live') openApp(b.app);
    else ui.openCard(b.app);
  }, 300);
}
function burst(b) {
  if (glass) field.burst(b, 1.0);
  else lite.pop(b);
}
function openApp(app) {
  const href = linkOf(app);
  api.opened = href;
  if (!href || NONAV) return;
  location.assign(href);
}

// ---------- shake ----------
function shake({ demo = false } = {}) {
  const now = performance.now();
  if (now < shakeLock) return;
  shakeLock = now + 1400;
  api.shakes++;
  ui.hideToast();
  ui.shaking(true);
  setTimeout(() => ui.shaking(false), 1300);
  for (const b of field.bubbles) {
    if (b.status === 'soon') { if (glass) field.poke(b); else lite.wobble(b); }
    else burst(b);
  }
  if (!demo && navigator.vibrate) { try { navigator.vibrate(20); } catch {} }
}

// Desktop: a fast left-right mouse shake. Phone: DeviceMotion.
function mouseShake(e) {
  if (e.pointerType !== 'mouse' || drag) return;
  const now = e.timeStamp, dx = e.clientX - ms.x, dt = now - ms.t;
  ms.x = e.clientX; ms.t = now;
  if (dt <= 0 || dt > 120) return;
  const v = dx / dt;
  if (Math.abs(v) < 1.1) return;
  const dir = Math.sign(v);
  if (dir === ms.dir) return;
  ms.dir = dir;
  ms.flips = ms.flips.filter((t) => now - t < 900);
  ms.flips.push(now);
  if (ms.flips.length >= 5) { ms.flips = []; userAction(); shake(); }
}
function listenMotion() {
  if (motionOn) return;
  motionOn = true;
  let p = null, hits = [];
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x == null) return;
    if (p) {
      const d = Math.abs(a.x - p.x) + Math.abs(a.y - p.y) + Math.abs(a.z - p.z);
      if (d > 26) {
        const now = performance.now();
        hits = hits.filter((t) => now - t < 700);
        hits.push(now);
        if (hits.length >= 3) { hits = []; userAction(); shake(); }
      }
    }
    p = { x: a.x, y: a.y, z: a.z };
  });
}
// iOS asks for permission; do it quietly on the first tap.
function requestMotion() {
  if (motionAsked) return;
  motionAsked = true;
  const D = window.DeviceMotionEvent;
  if (D && typeof D.requestPermission === 'function') {
    try { D.requestPermission().then((s) => { if (s === 'granted') listenMotion(); }).catch(() => {}); } catch {}
  }
}
if (window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission !== 'function') listenMotion();
else { document.addEventListener('touchend', requestMotion, { once: true, passive: true }); document.addEventListener('click', requestMotion, { once: true }); }

// ---------- drag, throw, tap (glass mode) ----------
function local(e) { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function bindInput() {
  // Let the page scroll unless the finger lands on a bubble.
  stage.addEventListener('touchstart', (e) => {
    const p = local(e.touches[0]);
    if (field.hit(p.x, p.y)) e.preventDefault();
  }, { passive: false });
  stage.addEventListener('pointerdown', (e) => {
    const p = local(e);
    const b = field.hit(p.x, p.y);
    if (!b) { ui.hideToast(); return; }
    userAction();
    try { stage.setPointerCapture(e.pointerId); } catch {}
    drag = { b, id: e.pointerId, ox: b.x - p.x, oy: b.y - p.y, sx: p.x, sy: p.y, moved: false, hist: [{ x: p.x, y: p.y, t: e.timeStamp }] };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = local(e);
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) { drag.moved = true; drag.b.dragged = true; ui.hideToast(); }
    if (!drag.moved) return;
    drag.b.x = p.x + drag.ox; drag.b.y = p.y + drag.oy;
    drag.hist.push({ x: p.x, y: p.y, t: e.timeStamp });
    while (drag.hist.length > 2 && e.timeStamp - drag.hist[0].t > 90) drag.hist.shift();
  });
  const end = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.moved) { if (!cancel) tap(d.b); return; }
    const a = d.hist[0], z = d.hist[d.hist.length - 1];
    const dt = Math.max(16, z.t - a.t) / 1000;
    let vx = (z.x - a.x) / dt, vy = (z.y - a.y) / dt;
    const sp = Math.hypot(vx, vy), max = 2400;
    if (sp > max) { vx *= max / sp; vy *= max / sp; }
    d.b.vx = cancel ? 0 : vx; d.b.vy = cancel ? 0 : vy;
    d.b.dragged = false;
    d.b.wobble = Math.min(1, sp / 2500);
  };
  stage.addEventListener('pointerup', (e) => end(e, false));
  stage.addEventListener('pointercancel', (e) => end(e, true));
  window.addEventListener('pointermove', mouseShake);
  bindKeys();
}
function bindKeys() {
  if (keysBound) return;
  keysBound = true;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { ui.closeCard(); ui.hideToast(); return; }
    if (e.code === 'Space' || e.key === ' ') {
      const a = document.activeElement;
      if (a && /^(BUTTON|A|INPUT|TEXTAREA)$/.test(a.tagName)) return;
      e.preventDefault();
      userAction();
      shake();
    }
  });
}

// QA hooks
api.tap = (i) => tap(field.bubbles[i]);
api.shake = () => shake();
api.point = (i) => { const b = field.bubbles[i]; const r = stage.getBoundingClientRect(); return { x: r.left + b.x, y: r.top + b.y, r: b.r }; };
