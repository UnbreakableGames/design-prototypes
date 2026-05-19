// Visual check: are food drops actually in front of the cliff face?
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
await page.waitForTimeout(500);

// Spawn one of each food kind at fixed y values along the cliff so we can
// see the face placement at top, middle, and bottom of the slope.
const placed = await page.evaluate(() => {
  const g = window.__game;
  g.goons = [];
  // Reach the FoodDrop class via an existing instance — none exist, so we
  // use Game's spawn path with rng patched and y forced.
  const orig = Math.random;
  // We need pickFoodDrop to return a specific food. Patch rng to always-clear
  // and let the loop pick rarest = pizza. Run 4 impacts at 4 y bands and grab
  // whatever spawns.
  const ys = [g.mountain.topY + 8, g.mountain.topY + 60, g.mountain.topY + 140, g.mountain.bottomY - 60];
  for (const y of ys) {
    Math.random = () => 0.0000001;
    try {
      g.applyImpact(g.mountain.x + 4, y, 1, 'physical', null, false);
    } finally {
      Math.random = orig;
    }
  }
  return {
    mountainX: g.mountain.x,
    topY: g.mountain.topY,
    bottomY: g.mountain.bottomY,
    foodDrops: g.foodDrops.map((f) => ({ x: f.x, y: f.y, kind: f.kind })),
    faceXAtY: ys.map((y) => ({ y, faceX: g.mountain.cliffFaceX(y) })),
  };
});
console.log('SPAWNED:', JSON.stringify(placed, null, 2));
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/phase4-face-fix.png') });
console.log('ok');
await browser.close();
