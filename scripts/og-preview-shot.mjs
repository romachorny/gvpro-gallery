import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1120, height: 520 }, deviceScaleFactor: 2 });
await page.goto('file://' + resolve('qa/og-preview.html'));
await page.waitForTimeout(400);
await page.screenshot({ path: 'qa/og-preview.png', fullPage: true });
await browser.close();
console.log('qa/og-preview.png');
