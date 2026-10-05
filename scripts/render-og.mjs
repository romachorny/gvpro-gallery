// Renders public/og.jpg (1200x630, no text) from the live scene with headless Chromium + SwiftShader.
// Usage: npm run build && npm run preview (in another shell) && npm run og
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';

const base = process.env.OG_BASE || 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`${base}/?og=1&fixed=1`, { waitUntil: 'load' });
await page.waitForSelector('body.og-ready', { timeout: 30000 });
await page.waitForTimeout(800);
let quality = 86;
for (;;) {
  await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  const { size } = await stat('public/og.jpg');
  console.log(`og.jpg quality ${quality}: ${(size / 1024).toFixed(0)} KB`);
  if (size < 300 * 1024 || quality <= 50) break;
  quality -= 8;
}
// Apple touch icon from the favicon (180x180)
const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
await icon.setContent(`<html><body style="margin:0;background:#000"><img src="${base}/favicon.svg" width="180" height="180"></body></html>`);
await icon.waitForTimeout(300);
await icon.screenshot({ path: 'public/apple-touch-icon.png', type: 'png' });
await browser.close();
console.log('done', existsSync('public/og.jpg'));
