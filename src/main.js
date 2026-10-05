import { APPS } from './apps.js';
import { detectLang, setLang, getLang } from './i18n.js';
import { createUI } from './ui.js';
import { createLiteScene, noiseDataUrl } from './lite.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const isPhone = isTouch && Math.min(screen.width, screen.height) < 800;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const OG_MODE = q.get('og') === '1';
const NO_INTRO = q.get('nointro') === '1' || OG_MODE;
const SHOT_SECONDS = 4.5;
const PAUSE_SECONDS = 14;

setLang(detectLang());
$('noise').style.backgroundImage = `url(${noiseDataUrl()})`;
if (OG_MODE) document.documentElement.classList.add('og');

const stage = $('stage');
const content = $('content');
const intro = $('intro');
const canvas = $('scene');

let shot = 0;
let three = null;
let lite = null;
let liteMode = false;
let introDone = false;
let diving = false;
let lastInput = performance.now();
let autoplayAt = 0; // time (perf.now) when autoplay should advance next
let rafId = 0;
let hintsDone = loadHints();

const ui = createUI({
  apps: APPS,
  onShot: (i) => { userAction('dots'); goTo(i); },
  onHint: (kind) => {
    if (kind === 'swipe') { markHint('swipe'); userAction('hint'); goTo(shot + 1); }
    else if (kind === 'tap') { markHint('tap'); userAction('hint'); tryDive(); }
    else if (kind === 'shake') { markHint('shake'); userAction('hint'); doShake(); }
  },
  onLang: () => { setLang(getLang() === 'he' ? 'en' : 'he'); ui.applyStatic(); ui.setShot(shot, { instant: true }); },
  onAllApps: () => { userAction('all'); content.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); },
});
ui.applyStatic();

// ---------- mode selection ----------
function webglOK() {
  if (q.get('lite') === '1') return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl;
  } catch { return false; }
}
const weakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 2);
liteMode = !webglOK() || weakDevice || (reducedMotion && !OG_MODE);

if (liteMode) startLite();
else startThree().catch((e) => { console.warn('3D failed, falling back to lite', e); startLite(); });

async function startThree() {
  const { createScene } = await import('./scene.js');
  three = createScene({ canvas, apps: APPS, quality: q.get('quality') || 'high', isPhone });
  onResize();
  window.addEventListener('resize', onResize);
  if (OG_MODE) {
    three.posterPose();
    three.update(0.016);
    three.update(0.016);
    intro.remove();
    document.body.classList.add('og-ready');
    return;
  }
  const startShot = parseInt(q.get('shot') || '0', 10) || 0;
  shot = startShot;
  three.goTo(shot, NO_INTRO);
  if (NO_INTRO) finishIntro(true);
  loop();
  if (q.get('fixed') !== '1') measureFps();
}

function startLite() {
  liteMode = true;
  canvas.remove();
  lite = createLiteScene({ root: $('lite-scene'), apps: APPS });
  if (OG_MODE) { intro.remove(); return; }
  shot = parseInt(q.get('shot') || '0', 10) || 0;
  lite.setShot(shot);
  if (NO_INTRO || reducedMotion) finishIntro(true); else setTimeout(() => finishIntro(false), 2600);
}

function onResize() {
  const r = stage.getBoundingClientRect();
  three && three.resize(Math.max(1, r.width | 0), Math.max(1, r.height | 0));
}

// ---------- intro ----------
function finishIntro(immediate) {
  if (introDone) return;
  if (q.get('trace') === '1') console.log('finishIntro', immediate, performance.now() | 0, new Error().stack.split('\n').slice(1, 4).join(' <- '));
  introDone = true;
  three && three.skipIntro();
  intro.classList.add('out');
  if (immediate) intro.style.transition = 'none';
  setTimeout(() => { intro.hidden = true; }, immediate ? 0 : 1200);
  ui.setShot(shot, { instant: true });
  autoplayAt = performance.now() + SHOT_SECONDS * 1000;
  scheduleHints();
}
intro.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (q.get('trace') === '1') console.log('intro pointerdown', e.pointerType, e.clientX, e.clientY, e.isTrusted); finishIntro(false); });
$('intro-skip').addEventListener('click', (e) => { e.stopPropagation(); finishIntro(false); });

// ---------- shots ----------
function goTo(i) {
  if (diving) return;
  if (q.get('trace') === '1') console.log('goTo', i, new Error().stack.split('\n')[2]);
  const n = APPS.length + 1;
  shot = ((i % n) + n) % n;
  three && three.goTo(shot);
  lite && lite.setShot(shot);
  ui.setShot(shot);
  autoplayAt = performance.now() + Math.max(PAUSE_SECONDS, SHOT_SECONDS) * 1000;
  scheduleHints();
}

function currentApp() { return shot > 0 ? APPS[shot - 1] : null; }

// ---------- autoplay + hints ----------
function userAction(kind) {
  lastInput = performance.now();
  autoplayAt = lastInput + PAUSE_SECONDS * 1000;
  if (kind === 'swipe' || kind === 'wheel' || kind === 'keys') markHint('swipe');
}

let hintTimer = 0;
function scheduleHints() {
  clearTimeout(hintTimer);
  if (!introDone || diving) { ui.hideHint(); return; }
  const app = currentApp();
  if (!hintsDone.swipe) { if (ui.hint !== 'swipe') { ui.hideHint(); hintTimer = setTimeout(() => ui.showHint('swipe'), 1400); } return; }
  ui.hideHint();
  if (app && app.status === 'live' && !hintsDone.tap) { hintTimer = setTimeout(() => ui.showHint('tap'), 1200); return; }
  if (isTouch && !hintsDone.shake && !liteMode) {
    hintTimer = setTimeout(() => { if (performance.now() - lastInput > 9500) ui.showHint('shake'); else scheduleHints(); }, 10000);
  }
}
function markHint(kind) {
  if (hintsDone[kind]) return;
  hintsDone[kind] = true;
  try { localStorage.setItem('gvpro.hints', JSON.stringify(hintsDone)); } catch {}
  if (ui.hint === kind) { ui.hideHint(); setTimeout(scheduleHints, 600); }
}
function loadHints() {
  if (q.get('fresh') === '1') return {};
  try { return JSON.parse(localStorage.getItem('gvpro.hints') || '{}'); } catch { return {}; }
}

function tick(now) {
  if (introDone && !diving && now >= autoplayAt && !reducedMotion && q.get('autoplay') !== '0') {
    const next = (shot + 1) % (APPS.length + 1);
    shot = next;
    three && three.goTo(shot);
    lite && lite.setShot(shot);
    ui.setShot(shot);
    autoplayAt = now + SHOT_SECONDS * 1000;
    scheduleHints();
  }
}

// ---------- render loop ----------
let hidden = false;
let frames = 0;
function loop() {
  rafId = requestAnimationFrame(loop);
  if (hidden) return;
  frames++;
  if (frames === 2 && !introDone) {
    // start the intro clock once the first frame (shader compile) is behind us
    three.startIntroFlight(3.2);
    if (q.get('intro') !== 'hold') setTimeout(() => finishIntro(false), 3400);
  }
  tick(performance.now());
  three.update();
}
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden;
  if (!hidden) { lastInput = performance.now(); autoplayAt = lastInput + SHOT_SECONDS * 1000; }
});
if (liteMode) setInterval(() => tick(performance.now()), 250);

// ---------- adaptive quality ----------
function measureFps() {
  let frames = 0, t0 = 0, stage1 = false;
  function sample(now) {
    if (!t0) t0 = now;
    frames++;
    const el = now - t0;
    if (el >= 2000) {
      const fps = frames / (el / 1000);
      if (!stage1) {
        stage1 = true;
        if (fps < 40) {
          three.disableBloom();
          three.setPixelRatio(Math.max(0.75, three.dpr * 0.7));
          frames = 0; t0 = now;
          requestAnimationFrame(sample);
          return;
        }
        return;
      }
      if (fps < 28) switchToLite();
      return;
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}
function switchToLite() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  three.dispose();
  three = null;
  startLite();
  lite.setShot(shot);
}

// ---------- input: swipe / wheel / keys / tap ----------
let px = 0, py = 0, pt = 0, pointerDown = false, moved = false;
stage.addEventListener('pointerdown', (e) => {
  if (!introDone) return;
  pointerDown = true; moved = false; px = e.clientX; py = e.clientY; pt = performance.now();
  requestMotionPermission();
});
stage.addEventListener('pointermove', (e) => {
  if (!pointerDown) return;
  if (Math.abs(e.clientX - px) > 8 || Math.abs(e.clientY - py) > 8) moved = true;
});
stage.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  pointerDown = false;
  const dx = e.clientX - px, dy = e.clientY - py;
  const dt = performance.now() - pt;
  const horiz = Math.abs(dx) > Math.abs(dy);
  const dist = horiz ? dx : dy;
  const r = stage.getBoundingClientRect();
  if (Math.abs(dist) > 40 && (dt < 900 || Math.abs(dist) > Math.min(r.width, r.height) * 0.2)) {
    userAction('swipe');
    const rtl = document.documentElement.dir === 'rtl';
    let dir = horiz ? (dx < 0 ? 1 : -1) : (dy < 0 ? 1 : -1);
    if (horiz && rtl) dir = -dir;
    if (!horiz && dy < 0 && shot === APPS.length) { content.scrollIntoView({ behavior: 'smooth' }); return; }
    goTo(shot + dir);
    return;
  }
  if (!moved && dt < 500) handleTap(e.clientX, e.clientY);
});
stage.addEventListener('pointercancel', () => { pointerDown = false; });

function handleTap(x, y) {
  if (diving || !introDone) return;
  if (document.getElementById('card').contains(document.elementFromPoint(x, y))) return;
  const r = stage.getBoundingClientRect();
  const idx = three ? three.pick(x - r.left, y - r.top) : lite.pick(x, y);
  if (idx < 0) { userAction('tap'); return; }
  if (idx === shot - 1) { userAction('tap'); tryDive(); }
  else { userAction('tap'); goTo(idx + 1); }
}

let wheelLock = 0;
stage.addEventListener('wheel', (e) => {
  if (!introDone || diving) return;
  const atLast = shot === APPS.length;
  if (atLast && e.deltaY > 0) return; // let the page scroll to the content
  e.preventDefault();
  const now = performance.now();
  if (now - wheelLock < 700 || Math.abs(e.deltaY) + Math.abs(e.deltaX) < 8) return;
  wheelLock = now;
  userAction('wheel');
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  goTo(shot + (d > 0 ? 1 : -1));
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (!introDone) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') finishIntro(false); return; }
  if (diving) { if (e.key === 'Escape') undive(); return; }
  if (window.scrollY > 40) return;
  const rtl = document.documentElement.dir === 'rtl';
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); userAction('keys'); goTo(shot + (e.key === 'ArrowRight' && rtl ? -1 : 1)); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); userAction('keys'); goTo(shot + (e.key === 'ArrowLeft' && rtl ? 1 : -1)); }
  else if (e.key === 'Enter') { userAction('keys'); tryDive(); }
});

// ---------- dive ----------
function tryDive() {
  const app = currentApp();
  if (!app || app.status !== 'live' || diving) return;
  markHint('tap');
  diving = true;
  ui.hideHint();
  ui.showTitles(false);
  document.body.classList.add('lock');
  let opened = false;
  const open = () => { if (opened || !diving) return; opened = true; ui.openCard(app, app.color); };
  if (three) {
    ui.floodOnly(true);
    three.dive(shot - 1, open);
    setTimeout(open, 1150); // wall-clock fallback: scene time can run slow on weak GPUs
  } else open();
}
function undive() {
  if (!diving) return;
  ui.closeCard();
  three && three.undive();
  diving = false;
  document.body.classList.remove('lock');
  setTimeout(() => { ui.setShot(shot, { instant: true }); }, 300);
  autoplayAt = performance.now() + PAUSE_SECONDS * 1000;
  scheduleHints();
}
$('card-back').addEventListener('click', undive);
$('card').addEventListener('pointerdown', (e) => e.stopPropagation());
$('card').addEventListener('pointerup', (e) => e.stopPropagation());

// ---------- shake ----------
let motionAsked = false, lastShake = 0, accPrev = null;
function requestMotionPermission() {
  if (motionAsked || !isTouch) return;
  motionAsked = true;
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') {
    DME.requestPermission().then((s) => { if (s === 'granted') listenMotion(); }).catch(() => {});
  } else if (DME) listenMotion();
}
function listenMotion() {
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    if (accPrev) {
      const d = Math.abs(a.x - accPrev.x) + Math.abs(a.y - accPrev.y) + Math.abs(a.z - accPrev.z);
      if (d > 28 && performance.now() - lastShake > 1200) { lastShake = performance.now(); doShake(); }
    }
    accPrev = { x: a.x, y: a.y, z: a.z };
  });
}
function doShake() {
  markHint('shake');
  userAction('shake');
  three && three.shake(1);
  if (lite) { $('lite-scene').animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-8px,4px)' }, { transform: 'translate(6px,-6px)' }, { transform: 'translate(0,0)' }], { duration: 500 }); }
}
if (!isTouch) listenMotion();
window.__gvpro = { goTo, get shot() { return shot; }, tryDive, undive, doShake, get lite() { return liteMode; }, get diving() { return diving; }, finishIntro, get three() { return three; } };
