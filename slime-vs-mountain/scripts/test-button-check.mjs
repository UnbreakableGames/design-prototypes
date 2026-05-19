import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const URL = process.env.URL ?? 'http://localhost:5175/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR:', String(e)));
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(800);

const state = await page.evaluate(() => {
  const g = window.__game;
  return {
    showTree: g.showTree,
    showEssenceTree: g.showEssenceTree,
    showShop: g.showShop,
    showSettings: g.showSettings,
    showIndex: g.showIndex,
    spinFlash: g.spinFlash,
    discoveryReveal: g.discoveryReveal,
    toast: g.toast?.text ?? null,
  };
});
console.log('STATE:', JSON.stringify(state));

await page.screenshot({ path: resolve(projectRoot, '.screenshots/button-check-1.png') });

// Spin to test mid-spin button visibility.
await page.evaluate(() => { window.__game.spin(); });
await page.waitForTimeout(200);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/button-check-2-spinning.png') });

console.log('ok');
await browser.close();
