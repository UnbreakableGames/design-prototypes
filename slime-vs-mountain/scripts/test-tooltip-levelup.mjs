// Verify the detail card updates as a variant levels up.
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const URL = process.env.URL ?? 'http://localhost:5175/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// Select greenie + screenshot at Lv 1.
await page.evaluate(() => { window.__game.selectedVariantId = 'green'; });
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/tooltip-lv1.png') });
const lv1 = await page.evaluate(() => {
  const v = window.__game.collection.get('green');
  return { level: v.level, xp: v.xp };
});

// Force level up to 5, partial XP toward Lv 6.
await page.evaluate(() => {
  const v = window.__game.collection.get('green');
  v.level = 5;
  v.xp = 350;
});
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/tooltip-lv5.png') });
const lv5 = await page.evaluate(() => {
  const v = window.__game.collection.get('green');
  return { level: v.level, xp: v.xp };
});

// Force max-ish level 20.
await page.evaluate(() => {
  const v = window.__game.collection.get('green');
  v.level = 20;
  v.xp = 0;
});
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/tooltip-lv20.png') });
const lv20 = await page.evaluate(() => {
  const v = window.__game.collection.get('green');
  return { level: v.level, xp: v.xp };
});

console.log('LV1 :', JSON.stringify(lv1));
console.log('LV5 :', JSON.stringify(lv5));
console.log('LV20:', JSON.stringify(lv20));
console.log('ok');
await browser.close();
