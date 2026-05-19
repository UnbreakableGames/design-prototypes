// Verify food now ejects from cliff, falls, settles on the ground.
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

// Spawn several food items via patched RNG, then run real time so physics
// can settle them on the ground.
await page.evaluate(() => {
  const g = window.__game;
  g.selectedVariantId = 'green';
  g.goons = [];
  const orig = Math.random;
  Math.random = () => 0.0000001;
  try {
    for (let i = 0; i < 5; i++) {
      g.applyImpact(g.mountain.x + 4, g.mountain.topY + 30 + i * 50, 1, 'physical', null, false);
    }
  } finally {
    Math.random = orig;
  }
});

// Let physics settle.
await page.waitForTimeout(1500);

// Close the detail card so it doesn't obscure the loot band.
await page.evaluate(() => { window.__game.selectedVariantId = null; });
await page.waitForTimeout(50);

const afterSettle = await page.evaluate(() => {
  const g = window.__game;
  return g.foodDrops.map((f) => ({
    kind: f.kind, x: Math.round(f.x), y: Math.round(f.y), settled: f.settled,
  }));
});
console.log('AFTER SETTLE:', JSON.stringify(afterSettle, null, 2));

await page.screenshot({ path: resolve(projectRoot, '.screenshots/phase4-food-physics.png') });
console.log('ok');
await browser.close();
