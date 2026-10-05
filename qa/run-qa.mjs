// QA with headless Chromium + SwiftShader. Needs a built site served at BASE (default: vite preview on 4173).
// Usage: npm run build && npm run qa
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const BASE = process.env.QA_BASE || 'http://localhost:4173';
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const VIEWPORTS = (process.env.QA_VIEWPORTS || '390x844,412x915,1440x900').split(',').map((v) => v.split('x').map(Number));
const LANGS = ['en', 'he'];
const report = { base: BASE, runs: [], lite: [], failures: [] };

async function ensureServer() {
  try { const r = await fetch(BASE); if (r.ok) return null; } catch {}
  const child = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); try { const r = await fetch(BASE); if (r.ok) return child; } catch {} }
  throw new Error('preview server did not start');
}

async function attach(page, errors, trace) {
  await page.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/base44\.app\/.*(icon\.svg|apple-touch-icon\.png)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="18" fill="#FFCA16"/></svg>' }));
  await page.route(/fonts\.gstatic\.com/, (r) => r.abort());
  page.on('console', (m) => {
    if (trace && /^(goTo|finishIntro|intro pointerdown)/.test(m.text())) trace.push(m.text().slice(0, 160));
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const url = (m.location() || {}).url || '';
    if (/fonts\.g(oogleapis|static)\.com/.test(url)) return; // no internet for fonts here
    errors.push(m.type() + ': ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
}

const expect = (run, name, ok, detail = '') => { run.checks.push({ name, ok: !!ok, detail }); if (!ok) report.failures.push(`${run.id}: ${name} ${detail}`); };

async function swipe(page, x1, y1, x2, y2) {
  await page.mouse.move(x1, y1); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6);
  await page.mouse.up();
}

const server = await ensureServer();
const browser = await chromium.launch({ args: ARGS });
try {
  for (const [w, h] of VIEWPORTS) for (const lang of LANGS) {
    const id = `${w}x${h}-${lang}`;
    const run = { id, checks: [], errors: [], trace: [] };
    report.runs.push(run);
    let page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900, isMobile: w < 900, locale: lang === 'he' ? 'he-IL' : 'en-US' });
    await attach(page, run.errors, run.trace);
    const t0 = Date.now();
    await page.goto(`${BASE}/?fixed=1&fresh=1&autoplay=0&trace=1&lang=${lang}`, { waitUntil: 'domcontentloaded' });
    run.loadMs = Date.now() - t0;

    // intro plays on its own and ends within a few seconds
    const introVisible = await page.waitForFunction(() => { const e = document.getElementById('intro'); return e && !e.hidden && !e.classList.contains('out') && getComputedStyle(e).opacity !== '0'; }, null, { timeout: 1500 }).then(() => true).catch(() => false);
    expect(run, 'intro visible', introVisible);
    expect(run, 'html lang/dir', await page.evaluate(() => document.documentElement.lang + '/' + document.documentElement.dir) === (lang === 'he' ? 'he/rtl' : 'en/ltr'));
    const ti = Date.now();
    await page.screenshot({ path: `qa/${id}-0-intro.png` });
    const ended = await page.waitForFunction(() => document.getElementById('intro').classList.contains('out'), null, { timeout: 12000 }).then(() => true).catch(() => false);
    run.introMs = Date.now() - ti;
    expect(run, 'intro ends on its own', ended, `${run.introMs} ms`);
    await page.close();

    // second load: intro is skippable by a tap
    const page2 = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900, isMobile: w < 900, locale: lang === 'he' ? 'he-IL' : 'en-US' });
    await attach(page2, run.errors, run.trace);
    await page2.goto(`${BASE}/?fixed=1&fresh=1&autoplay=0&trace=1&intro=hold&lang=${lang}`, { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(1500);
    const wasVisible = await page2.$eval('#intro', (e) => !e.classList.contains('out'));
    await page2.mouse.click(w / 2, h / 2);
    await page2.waitForTimeout(400);
    expect(run, 'intro skipped by tap', wasVisible && await page2.$eval('#intro', (e) => e.classList.contains('out')));
    page = page2;
    await page.waitForTimeout(5000); // let the camera settle (SwiftShader is slow)

    expect(run, 'no horizontal scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => document.documentElement.scrollWidth + '>' + window.innerWidth));
    expect(run, '3D mode (not lite)', await page.evaluate(() => !window.__gvpro.lite));
    await page.screenshot({ path: `qa/${id}-1-wide.png` });

    // hint appears
    await page.waitForTimeout(1200);
    const hintShown = await page.$eval('#hint', (e) => !e.hidden && e.classList.contains('show'));
    expect(run, 'swipe hint appears', hintShown);

    // swipe changes shot (horizontal on phones, vertical too)
    const before = await page.evaluate(() => window.__gvpro.shot);
    await swipe(page, w * 0.7, h * 0.5, w * 0.3, h * 0.5);
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => window.__gvpro.shot);
    expect(run, 'swipe changes shot', after !== before, `${before} -> ${after}`);
    await page.waitForTimeout(700);
    expect(run, 'swipe hint gone after use', await page.$eval('#hint', (e) => e.hidden || !e.classList.contains('show')));

    // wheel changes shot (not on the last shot, where wheel-down hands over to page scroll by design)
    await page.evaluate(() => window.__gvpro.goTo(2));
    await page.waitForTimeout(300);
    const b2 = await page.evaluate(() => window.__gvpro.shot);
    await page.mouse.move(w / 2, h / 2);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(600);
    const a2 = await page.evaluate(() => window.__gvpro.shot);
    expect(run, 'wheel changes shot', a2 !== b2, `${b2} -> ${a2}`);

    // keys
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    expect(run, 'arrow key changes shot', (await page.evaluate(() => window.__gvpro.shot)) !== a2);

    // hero of Yeshli + dive via tap on the planet
    await page.evaluate(() => window.__gvpro.goTo(1));
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `qa/${id}-2-hero.png` });
    expect(run, 'hero title', (await page.$eval('#shot-title', (e) => e.textContent.trim())) === 'Yeshli');
    const tapHint = await page.$eval('#hint', (e) => !e.hidden && e.dataset.kind === 'tap' && e.classList.contains('show'));
    expect(run, 'tap hint on live planet', tapHint);
    const pt = await page.evaluate(() => {
      const s = window.__gvpro.three; if (!s) return null;
      const p = s.planets[0]; const v = p.group.getWorldPosition(new (p.group.position.constructor)()).project(s.camera);
      const r = document.getElementById('stage').getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    });
    expect(run, 'planet projected on screen', pt && pt.x > 0 && pt.x < w && pt.y > 0 && pt.y < h, JSON.stringify(pt));
    if (pt) { await page.mouse.click(pt.x, pt.y); }
    await page.waitForFunction(() => { const c = document.getElementById('card'); return !c.hidden && c.classList.contains('show'); }, null, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(700);
    expect(run, 'dive opens card', await page.$eval('#card', (e) => !e.hidden && e.classList.contains('show')));
    expect(run, 'card open link href', (await page.$eval('#card-open', (e) => e.href)) === 'https://yeshli.base44.app/');
    expect(run, 'card link target/rel', await page.$eval('#card-open', (e) => e.target === '_blank' && /noopener/.test(e.rel)));
    await page.screenshot({ path: `qa/${id}-3-card.png` });
    await page.click('#card-back');
    await page.waitForTimeout(1500);
    expect(run, 'back closes card', await page.$eval('#card', (e) => e.hidden || !e.classList.contains('show')));

    // app list links
    const hrefs = await page.$$eval('#app-list a', (as) => as.map((a) => a.href));
    expect(run, 'live links in list', hrefs.includes('https://yeshli.base44.app/') && hrefs.includes('https://tiulio.base44.app/') && hrefs.length === 2, hrefs.join(','));
    expect(run, 'coming soon count', (await page.$$eval('#app-list .status.soon', (x) => x.length)) === 4);
    await page.click('#all-apps-btn');
    await page.waitForFunction(() => window.scrollY > 100, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    expect(run, 'all apps scrolls to content', await page.evaluate(() => window.scrollY > 100));
    expect(run, 'no horizontal scroll (content)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: `qa/${id}-4-list.png`, fullPage: false });
    // contacts
    const contacts = await page.$$eval('#contact-list a', (as) => as.map((a) => a.href));
    expect(run, 'contacts links', contacts.includes('https://wa.me/972539760820?text=gallery') && contacts.includes('https://t.me/GenVidPro') && contacts.includes('https://genvidpro.com/'), contacts.join(','));
    expect(run, 'email text + copy button', await page.evaluate(() => document.getElementById('email-text').textContent === 'genvidpro@gmail.com' && !!document.getElementById('copy-email')));
    expect(run, 'no console errors', run.errors.length === 0, run.errors.join(' | '));
    await page.close();
  }

  // Autoplay advances on its own
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const run = { id: `autoplay-${w}x${h}`, checks: [], errors: [] };
    report.runs.push(run);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await attach(page, run.errors);
    await page.goto(`${BASE}/?fixed=1&fresh=1&nointro=1`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const s0 = await page.evaluate(() => window.__gvpro.shot);
    await page.waitForTimeout(6500);
    const s1 = await page.evaluate(() => window.__gvpro.shot);
    expect(run, 'autoplay advances after ~4.5 s', s1 !== s0, `${s0} -> ${s1}`);
    expect(run, 'no console errors', run.errors.length === 0, run.errors.join(' | '));
    await page.close();
  }

  // Lite: WebGL disabled
  for (const [mode, opts] of [['nowebgl', { args: [...ARGS, '--disable-3d-apis'] }], ['reduced-motion', null]]) {
    const b = mode === 'nowebgl' ? await chromium.launch(opts) : browser;
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const run = { id: `lite-${mode}-${w}x${h}`, checks: [], errors: [] };
      report.lite.push(run);
      const page = await b.newPage({ viewport: { width: w, height: h } });
      if (mode === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
      await attach(page, run.errors);
      await page.goto(`${BASE}/?fresh=1&lang=${w < 900 ? 'he' : 'en'}`, { waitUntil: 'load' });
      await page.waitForTimeout(4000);
      expect(run, 'lite mode on', await page.evaluate(() => window.__gvpro.lite));
      expect(run, 'lite scene visible', await page.$eval('#lite-scene', (e) => !e.hidden && e.children.length > 6));
      expect(run, 'no canvas', (await page.$('#scene')) === null);
      expect(run, 'intro gone', await page.$eval('#intro', (e) => e.hidden || e.classList.contains('out')));
      await page.evaluate(() => window.__gvpro.goTo(1));
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__gvpro.tryDive());
      await page.waitForTimeout(800);
      expect(run, 'lite dive card', await page.$eval('#card', (e) => !e.hidden && e.classList.contains('show')));
      await page.screenshot({ path: `qa/${run.id}-card.png` });
      await page.click('#card-back');
      await page.waitForTimeout(800);
      expect(run, 'no horizontal scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await page.screenshot({ path: `qa/${run.id}.png` });
      expect(run, 'no console errors', run.errors.length === 0, run.errors.join(' | '));
      await page.close();
    }
    if (b !== browser) await b.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
await writeFile('qa/report.json', JSON.stringify(report, null, 2));
const total = [...report.runs, ...report.lite].reduce((n, r) => n + r.checks.length, 0);
console.log(`QA checks: ${total - report.failures.length}/${total} passed`);
for (const f of report.failures) console.log('FAIL', f);
process.exit(report.failures.length ? 1 : 0);
