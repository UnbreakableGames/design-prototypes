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

// Acquire some high-tier slimes so we can see they exist + are discovered.
const stats = await page.evaluate(() => {
  const g = window.__game;
  for (const id of ['green','amber','lucky','icy','ninja','bucky','wizzy','ufo','sharky','drakey','galaxy','meaty','zappy']) {
    g.acquireSlime(id);
  }
  return {
    collectionSize: g.collection.size,
    knownVariants: Array.from(g.collection.keys()),
  };
});
console.log('STATE:', JSON.stringify(stats));

await page.evaluate(() => { window.__game.showIndex = true; window.__game.indexScroll = 0; });
await page.waitForTimeout(100);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/index-scroll-top.png') });

await page.evaluate(() => { window.__game.indexScroll = 350; });
await page.waitForTimeout(80);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/index-scroll-mid.png') });

await page.evaluate(() => { window.__game.indexScroll = 700; });
await page.waitForTimeout(80);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/index-scroll-bottom.png') });

console.log('ok');
await browser.close();
