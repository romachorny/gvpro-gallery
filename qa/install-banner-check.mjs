// #86: install banner standard check. For each app: Pixel 7 emulation at 390x844, fresh persistent profile,
// did beforeinstallprompt fire, installability errors (CDP), is the banner (#gvp-install or .install) visible.
//   node install-banner-check.mjs name=url ...    -> JSON lines; screenshots ~/outbox/install-banner-<name>.png
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
const { chromium, devices } = await import(process.env.QA_PLAYWRIGHT || '/home/roma/bridge-verifier/node_modules/playwright/index.mjs');
const out = path.join(os.homedir(), 'outbox');
const SEL = process.env.BANNER_SEL || '#gvp-install, #install:not(.hidden)';
let fail = 0;
for (const arg of process.argv.slice(2)) {
  const [name, url] = arg.split(/=(.*)/s);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bip-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, headless: true, channel: 'chromium',
    args: ['--bypass-app-banner-engagement-checks'],
  });
  await ctx.addInitScript(() => { window.__bip86 = 0; addEventListener('beforeinstallprompt', () => { window.__bip86++; }, true); });
  const page = ctx.pages()[0] || await ctx.newPage();
  const r = { name, url };
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__bip86 > 0, null, { timeout: 8000 }).catch(() => {});
    if (!(await page.evaluate(() => window.__bip86))) {
      // first visit installs the service worker; Chrome re-checks installability once it controls the page
      await page.evaluate(() => navigator.serviceWorker?.ready).catch(() => {});
      await page.waitForTimeout(1500);
      await page.reload({ waitUntil: 'load' });
      r.reloaded = true;
      await page.waitForFunction(() => window.__bip86 > 0, null, { timeout: 12000 }).catch(() => {});
    }
    r.bip = await page.evaluate(() => window.__bip86);
    const cdp = await ctx.newCDPSession(page);
    r.installErrors = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map(e => e.errorId);
    const m = await cdp.send('Page.getAppManifest');
    r.manifestErrors = (m.errors || []).map(e => e.message);
    r.sw = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistration())?.active?.scriptURL || null);
    await page.locator(SEL).first().waitFor({ state: "visible", timeout: 6000 }).catch(() => {});
    r.banner = await page.locator(SEL).first().isVisible().catch(() => false);
    r.bannerText = r.banner ? (await page.locator(SEL).first().innerText()).replace(/\s+/g, ' ').trim() : '';
    await page.screenshot({ path: path.join(out, `install-banner-${name}.png`) });
  } catch (e) { r.error = String(e).slice(0, 200); }
  r.ok = r.bip > 0 && r.banner === true;
  if (!r.ok) fail++;
  console.log(JSON.stringify(r));
  await ctx.close();
}
process.exit(fail ? 1 : 0);
