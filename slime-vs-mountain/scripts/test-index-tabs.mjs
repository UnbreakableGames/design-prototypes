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

await page.evaluate(() => {
  const g = window.__game;
  // BASIC: 8 distinct variants
  for (const id of ['green', 'amber', 'pebble', 'sprout', 'twig', 'mossy', 'blue', 'amber']) {
    g.acquireSlime(id, 'none');
  }
  // BIG: a handful
  g.acquireSlime('green', 'big');
  g.acquireSlime('pebble', 'big');
  g.acquireSlime('blue', 'big');
  // SHINY: just one
  g.acquireSlime('sprout', 'shiny');
  // HUGE: zero (locked / undiscovered)
  // INVERTED: one rare drop
  g.acquireSlime('sapphire', 'inverted');
  g.showIndex = true;
  g.indexTab = 'none';
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/index-tab-basic.png') });

await page.evaluate(() => { window.__game.indexTab = 'big'; });
await page.waitForTimeout(100);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/index-tab-big.png') });

await page.evaluate(() => { window.__game.indexTab = 'inverted'; });
await page.waitForTimeout(100);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/index-tab-inverted.png') });

console.log('ok');
await browser.close();
