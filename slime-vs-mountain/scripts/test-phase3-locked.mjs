// Verify the Index renders silhouettes for undiscovered variants.
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
await page.waitForTimeout(300);
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(300);

// Discover just 4 — under the 5-milestone — and 6 — past the first milestone.
await page.evaluate(() => {
  const g = window.__game;
  for (const id of ['sprout', 'mudder', 'twig', 'mossy']) g.acquireSlime(id);
});
await page.waitForTimeout(100);
const st = await page.evaluate(() => {
  const g = window.__game;
  return { size: g.collection.size, claimed: [...g.claimedMilestones] };
});
console.log('AT 6 UNIQUE:', JSON.stringify(st));

await page.evaluate(() => { window.__game.showIndex = true; });
await page.waitForTimeout(100);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/phase3-locked.png') });

console.log('ok');
await browser.close();
