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

// Pick a slime with rich data (an ability + projectile + crit). 'sapphire' has
// spear projectile, 25% crit, antiGoon — exercises all badge slots.
await page.evaluate(() => {
  const g = window.__game;
  g.acquireSlime('sapphire');
  g.acquireSlime('sapphire');
  g.acquireSlime('sapphire');
  // Add some XP to show the bar partly filled.
  const v = g.collection.get('sapphire');
  v.xp = 60;
  g.selectedVariantId = 'sapphire';
});
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/tooltip-condensed.png') });
console.log('ok');
await browser.close();
