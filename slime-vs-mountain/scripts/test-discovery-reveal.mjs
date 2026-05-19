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

// First-time discoveries: a common, a legendary, and a mythic to compare the
// reveal durations + tier glow colors.
const test = async (variantId, label, tFreeze) => {
  await page.evaluate((id) => {
    const g = window.__game;
    // Skip starter reveal that was cleared in constructor — only fresh acquires.
    if (!g.collection.has(id)) g.acquireSlime(id);
  }, variantId);
  // Freeze the animation at a specific time by overriding the reveal state.
  await page.evaluate((t) => {
    if (window.__game.discoveryReveal) window.__game.discoveryReveal.t = t;
  }, tFreeze);
  await page.waitForTimeout(80);
  await page.screenshot({ path: resolve(projectRoot, `.screenshots/discovery-${label}.png`) });
  // Dismiss before next test.
  await page.evaluate(() => { window.__game.discoveryReveal = null; });
};

await test('frost', 'rare-peak', 1.4);     // rare slime, peak of hold phase
await test('diamond', 'legendary-peak', 1.6); // legendary
await test('lucky', 'mythic-peak', 1.7);   // mythic
await test('zappy', 'lunar-peak', 2.0);    // lunar (rarest)

console.log('ok');
await browser.close();
