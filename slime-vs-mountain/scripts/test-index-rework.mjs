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
  for (const id of ['green', 'amber', 'pebble', 'sprout', 'twig', 'mossy', 'drizzle',
                    'blue', 'purple', 'coral', 'mint', 'sapphire']) {
    g.acquireSlime(id, 'none');
  }
  g.showIndex = true;
  g.indexTab = 'none';
  g.indexScroll = 0;
});
await page.waitForTimeout(100);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/index-rework-top.png') });

await page.evaluate(() => { window.__game.indexScroll = 220; });
await page.waitForTimeout(100);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/index-rework-scrolled.png') });

console.log('ok');
await browser.close();
