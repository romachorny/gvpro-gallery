// QA with headless Chromium + SwiftShader. Needs a built site served at BASE (vite preview on 4173).
// Usage: npm run build && npm run qa
// Every request that leaves localhost is blocked and counted: the page must not need the network.
// QA_PLAYWRIGHT points at another Playwright install (on roma-server: a project's node_modules/playwright/index.mjs).
const { chromium } = await import(process.env.QA_PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.mjs');
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { APPS, linkOf } from '../src/apps.js';

const BASE = process.env.QA_BASE || 'http://localhost:4173';
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const VIEWPORTS = (process.env.QA_VIEWPORTS || '390x844,412x915,1440x900').split(',').map((v) => v.split('x').map(Number));
const LANGS = ['he', 'en'];
// Built from src/apps.js, so the QA follows the list: indexes of the first app of each status, live links by id.
const LIVE = Object.fromEntries(APPS.filter((a) => a.status === 'live').map((a) => [a.id, linkOf(a)]));
const IDX = { live: APPS.findIndex((a) => a.status === 'live'), building: APPS.findIndex((a) => a.status === 'building'), soon: APPS.findIndex((a) => a.status === 'soon') };
const LIVE2 = APPS.findIndex((a, i) => a.status === 'live' && i > IDX.live);
const N = APPS.length;
const report = { base: BASE, date: new Date().toISOString(), runs: [], failures: [] };
await mkdir('qa/shots', { recursive: true });

async function ensureServer() {
  try { const r = await fetch(BASE); if (r.ok) return null; } catch {}
  const child = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); try { const r = await fetch(BASE); if (r.ok) return child; } catch {} }
  throw new Error('preview server did not start');
}

async function newPage(browser, run, w, h, lang, { reduced = false } = {}) {
  const mobile = w < 900;
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: lang === 'he' ? 'he-IL' : 'en-US' });
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  // iOS-style permission prompt, to check it is asked quietly on the first tap
  await page.addInitScript(() => {
    window.__perm = 0;
    if (window.DeviceMotionEvent) window.DeviceMotionEvent.requestPermission = () => { window.__perm++; return Promise.resolve('granted'); };
  });
  run.external = run.external || [];
  await page.route(/^(?!http:\/\/localhost)/, (r) => { run.external.push(r.request().url()); r.abort(); });
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    run.errors.push(m.type() + ': ' + m.text());
  });
  page.on('pageerror', (e) => run.errors.push('pageerror: ' + e.message));
  return page;
}

const expect = (run, name, ok, detail = '') => { run.checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 300) }); if (!ok) report.failures.push(`${run.id}: ${name} ${detail}`); };
const pt = (page, i) => page.evaluate((k) => window.__gvpro.point(k), i);
const shot = (page, run, name) => page.screenshot({ path: `qa/shots/${run.id}-${name}.png` });
const visible = (page, sel) => page.$eval(sel, (e) => !e.hidden && getComputedStyle(e).display !== 'none' && e.classList.contains('show'));
async function tapAt(page, x, y, mobile) { if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }

const server = await ensureServer();
const browser = await chromium.launch({ args: ARGS });
try {
  // ---------- glass mode ----------
  for (const [w, h] of VIEWPORTS) for (const lang of LANGS) {
    const id = `${w}x${h}-${lang}`;
    const mobile = w < 900;
    const run = { id, checks: [], errors: [] };
    report.runs.push(run);
    const page = await newPage(browser, run, w, h, lang);
    const t0 = Date.now();
    await page.goto(`${BASE}/?fixed=1&nonav=1&lang=${lang}`, { waitUntil: 'load' });
    run.loadMs = Date.now() - t0;
    expect(run, 'html lang/dir', await page.evaluate(() => document.documentElement.lang + '/' + document.documentElement.dir) === (lang === 'he' ? 'he/rtl' : 'en/ltr'));
    expect(run, 'glass mode (WebGL)', (await page.evaluate(() => window.__gvpro.mode)) === 'glass');

    // showreel plays on its own: bubbles rise, caption appears, spotlight moves
    await page.waitForTimeout(4500);
    const cap1 = await page.$eval('#cap-name', (e) => e.textContent);
    expect(run, 'showreel caption on its own', await visible(page, '#caption') && cap1.length > 0, cap1);
    expect(run, 'all bubbles inflated', await page.evaluate(() => window.__gvpro.field.bubbles.every((b) => b.scale > 0.8)));
    const sizes = await page.evaluate(() => window.__gvpro.field.bubbles.map((b) => [b.status, Math.round(b.r)]));
    const rOf = (s) => (sizes.find((x) => x[0] === s) || [s, null])[1];
    const order = ['live', 'building', 'soon'].map(rOf).filter((r) => r !== null);
    expect(run, 'size by status live > building > soon', order.every((r, i) => i === 0 || order[i - 1] > r), JSON.stringify(sizes));
    const inside = await page.evaluate(() => { const f = window.__gvpro.field; return f.bubbles.every((b) => b.x - b.r > -2 && b.x + b.r < f.w + 2 && b.y + b.r > 0 && b.y - b.r < f.h); });
    expect(run, 'bubbles inside the screen', inside);
    expect(run, 'no horizontal scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.waitForTimeout(3000);
    expect(run, 'spotlight advances', (await page.$eval('#cap-name', (e) => e.textContent)) !== cap1);
    await shot(page, run, '1-idle');

    // LIVE: tap bursts, then the app opens (recorded, not followed)
    let p = await pt(page, IDX.live);
    await tapAt(page, p.x, p.y, mobile);
    await page.waitForTimeout(120);
    const drops = await page.evaluate(() => window.__gvpro.field.droplets.length);
    expect(run, 'live tap bursts into droplets', drops > 10, drops);
    await shot(page, run, '2-burst');
    await page.waitForTimeout(450);
    expect(run, 'live tap opens the app', (await page.evaluate(() => window.__gvpro.opened)) === LIVE[APPS[IDX.live].id], await page.evaluate(() => window.__gvpro.opened));
    expect(run, 'iOS motion permission asked on first tap', (await page.evaluate(() => window.__perm)) === 1);
    await page.waitForTimeout(1200);
    expect(run, 'live bubble re-inflates', await page.evaluate(() => !window.__gvpro.field.bubbles[0].hidden));

    // BUILDING: burst, then a glass card (only while the list has a building app)
    if (IDX.building >= 0) {
    p = await pt(page, IDX.building);
    await tapAt(page, p.x, p.y, mobile);
    await page.waitForTimeout(1400);
    expect(run, 'building tap opens card', await visible(page, '#card'));
    expect(run, 'building card text', (await page.$eval('#card-soon', (e) => e.textContent)) === (lang === 'he' ? 'האפליקציה תיפתח בקרוב' : 'Opens soon'));
    expect(run, 'building did not navigate', (await page.evaluate(() => window.__gvpro.opened)) === LIVE[APPS[IDX.live].id]);
    await shot(page, run, '3-building-card');
    await page.click('#card-back');
    await page.waitForTimeout(600);
    expect(run, 'card closes', await page.$eval('#card', (e) => e.hidden));
    }

    // SOON: wobble + toast, never bursts
    await page.waitForTimeout(800);
    p = await pt(page, IDX.soon);
    await tapAt(page, p.x, p.y, mobile);
    await page.waitForTimeout(400);
    const soon = await page.evaluate((k) => { const b = window.__gvpro.field.bubbles[k]; return { hidden: b.hidden, pop: b.pop, wobble: b.wobble }; }, IDX.soon);
    expect(run, 'soon never bursts', !soon.hidden && soon.pop < 0, JSON.stringify(soon));
    expect(run, 'soon wobbles', soon.wobble > 0.1, soon.wobble);
    expect(run, 'soon toast', await visible(page, '#toast'));
    expect(run, 'soon toast says soon', (await page.$eval('#toast-soon', (e) => e.textContent)) === (lang === 'he' ? 'בקרוב' : 'Soon'));
    const tb = await page.$eval('#toast', (e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0; });
    expect(run, 'toast inside the screen', tb);
    await shot(page, run, '4-soon-tap');
    await page.waitForTimeout(3200);

    // drag and throw: moves the bubble, does not open it
    const before = await page.evaluate(() => window.__gvpro.opened);
    p = await pt(page, 1);
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(p.x + i * 6, p.y - i * 8);
    const moved = await page.evaluate(() => window.__gvpro.field.bubbles[1].dragged);
    await page.mouse.up();
    expect(run, 'bubble can be grabbed', moved);
    expect(run, 'thrown bubble keeps speed', await page.evaluate(() => Math.hypot(window.__gvpro.field.bubbles[1].vx, window.__gvpro.field.bubbles[1].vy) > 50));
    expect(run, 'drag does not open', (await page.evaluate(() => window.__gvpro.opened)) === before);
    await page.waitForTimeout(1500);

    // SHAKE: pill on phones, Space on desktop
    const s0 = await page.evaluate(() => window.__gvpro.shakes);
    if (mobile) await page.tap('#shake'); else await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    const st = await page.evaluate(() => window.__gvpro.field.bubbles.map((b) => [b.status, b.hidden || b.pop >= 0]));
    expect(run, 'shake bursts all live and building', st.filter((x) => x[0] !== 'soon').every((x) => x[1]), JSON.stringify(st));
    expect(run, 'shake keeps soon bubbles', st.filter((x) => x[0] === 'soon').every((x) => !x[1]));
    expect(run, 'shake pill active', await page.$eval('#shake', (e) => e.classList.contains('active')));
    await shot(page, run, '5-shake');
    expect(run, 'shake did not open an app', (await page.evaluate(() => window.__gvpro.opened)) === before);
    await page.waitForTimeout(1800);
    expect(run, 'bubbles re-inflate after ~1 s', await page.evaluate(() => window.__gvpro.field.bubbles.every((b) => !b.hidden && b.scale > 0.5)));
    if (mobile) {
      // phone shake via DeviceMotion
      await page.waitForTimeout(600);
      await page.evaluate(() => { for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1; window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 18 * s, y: 9.8, z: 4 * s } })); } });
      expect(run, 'device shake triggers', (await page.evaluate(() => window.__gvpro.shakes)) > s0 + 1);
    } else {
      // fast mouse shake
      await page.waitForTimeout(600);
      await page.mouse.move(700, 120);
      for (let i = 0; i < 10; i++) await page.mouse.move(i % 2 ? 900 : 600, 120, { steps: 2 });
      expect(run, 'mouse shake triggers', (await page.evaluate(() => window.__gvpro.shakes)) > s0 + 1);
    }

    // language switch flips direction and mirrors the layout
    const x0 = await page.evaluate(() => window.__gvpro.field.bubbles[0].hx);
    await page.click('#lang-btn');
    await page.waitForTimeout(300);
    const other = lang === 'he' ? 'en' : 'he';
    expect(run, 'language switch', await page.evaluate(() => document.documentElement.lang + '/' + document.documentElement.dir) === (other === 'he' ? 'he/rtl' : 'en/ltr'));
    expect(run, 'layout mirrors with direction', Math.abs((await page.evaluate(() => window.__gvpro.field.bubbles[0].hx)) - x0) > 20);
    await page.click('#lang-btn');

    // plain list under the canvas
    const hrefs = await page.$$eval('#app-list a', (as) => as.map((a) => a.href));
    expect(run, 'list: live links', hrefs.length === Object.keys(LIVE).length && Object.values(LIVE).every((u) => hrefs.includes(u)), hrefs.join(','));
    expect(run, `list: ${N} apps`, (await page.$$eval('#app-list li', (x) => x.length)) === N);
    expect(run, 'no contacts or forms', (await page.$$('form, input, #contact-list, a[href^="mailto:"], a[href*="wa.me"]')).length === 0);
    await page.click('#all-apps-btn');
    await page.waitForFunction(() => window.scrollY > 100, null, { timeout: 6000 }).catch(() => {});
    expect(run, 'all apps scrolls to the list', await page.evaluate(() => window.scrollY > 100));
    expect(run, 'no horizontal scroll (list)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await shot(page, run, '6-list');
    expect(run, 'no request leaves localhost', run.external.length === 0, run.external.join(' '));
    expect(run, 'no console errors', run.errors.length === 0, run.errors.join(' | '));
    await page.close();
  }

  // ---------- lite mode ----------
  const noGL = await chromium.launch({ args: [...ARGS, '--disable-3d-apis'] });
  const liteCases = [];
  for (const [w, h] of VIEWPORTS) for (const lang of LANGS) liteCases.push(['nowebgl', w, h, lang]);
  liteCases.push(['reduced-motion', 390, 844, 'he'], ['reduced-motion', 1440, 900, 'en']);
  for (const [kind, w, h, lang] of liteCases) {
    const mobile = w < 900;
    const run = { id: `lite-${kind}-${w}x${h}-${lang}`, checks: [], errors: [] };
    report.runs.push(run);
    const page = await newPage(kind === 'nowebgl' ? noGL : browser, run, w, h, lang, { reduced: kind === 'reduced-motion' });
    await page.goto(`${BASE}/?nonav=1&lang=${lang}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    expect(run, 'lite mode on', (await page.evaluate(() => window.__gvpro.mode)) === 'lite');
    expect(run, `${N} glass buttons`, (await page.$$('#lite .lb')).length === N);
    expect(run, 'no horizontal scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await shot(page, run, 'idle');
    const el = await page.$$('#lite .lb');
    await el[IDX.soon].click();
    await page.waitForTimeout(400);
    expect(run, 'soon toast', await visible(page, '#toast'));
    await shot(page, run, 'soon-tap');
    if (IDX.building >= 0) {
      await el[IDX.building].click();
      await page.waitForTimeout(900);
      expect(run, 'building card', await visible(page, '#card'));
      await page.click('#card-back');
      await page.waitForTimeout(600);
    }
    await el[LIVE2].click();
    await page.waitForTimeout(500);
    expect(run, 'live opens', (await page.evaluate(() => window.__gvpro.opened)) === LIVE[APPS[LIVE2].id]);
    expect(run, 'no console errors', run.errors.length === 0, run.errors.join(' | '));
    await page.close();
  }
  await noGL.close();
} finally {
  await browser.close();
  if (server) server.kill();
}
await writeFile('qa/report.json', JSON.stringify(report, null, 2));
const total = report.runs.reduce((n, r) => n + r.checks.length, 0);
console.log(`QA checks: ${total - report.failures.length}/${total} passed`);
for (const f of report.failures) console.log('FAIL', f);
process.exit(report.failures.length ? 1 : 0);
