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

const before = await page.evaluate(() => ({ ...window.__game.inventory }));
await page.evaluate(() => {
  const g = window.__game;
  g.showSettings = true;
  g.grantCheatResources();
});
await page.waitForTimeout(150);
const after = await page.evaluate(() => ({ ...window.__game.inventory, toast: window.__game.toast?.text ?? null }));
console.log('BEFORE:', JSON.stringify(before));
console.log('AFTER :', JSON.stringify(after));
await page.screenshot({ path: resolve(projectRoot, '.screenshots/settings-cheat.png') });
console.log('ok');
await browser.close();
