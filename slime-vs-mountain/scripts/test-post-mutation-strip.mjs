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
await page.waitForTimeout(400);

await page.evaluate(() => {
  const g = window.__game;
  // Acquire some variety so the Index has content.
  for (const id of ['green','pebble','sprout','blue','purple','frost','onyx','diamond']) {
    g.acquireSlime(id);
  }
  const v = g.collection.get('green');
  v.level = 3; v.xp = 40;
  g.selectedVariantId = 'green';
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/post-mutation-strip-main.png') });

await page.evaluate(() => { window.__game.showIndex = true; });
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/post-mutation-strip-index.png') });

console.log('ok');
await browser.close();
