// Smoke test for the Phase 0+1+2 refactor.
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
page.on('console', (m) => { if (m.type() === 'error') console.log('CON ERR:', m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(800);

// Force a clean start (old v:1 save is now ignored, but be explicit).
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);

const initial = await page.evaluate(() => {
  const g = window.__game;
  return {
    collectionSize: g.collection.size,
    collectionEntries: [...g.collection.values()].map((v) => ({
      variantId: v.variantId, count: v.count, slotted: v.slotted, level: v.level, xp: v.xp, rolled: v.timesRolled,
    })),
    spitterSlots: g.spitterSlots,
    runnerSlots: g.runnerSlots,
    activeSlimes: g.slimes.length,
  };
});
console.log('INITIAL:', JSON.stringify(initial, null, 2));

// Roll a few times to grow the collection, then snapshot
await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 30; i++) {
    g.spinFlash = 0;
    g.bonusFlash = 0;
    g.spin();
    if (g.pendingSpawn) {
      // Eagerly resolve the pending spawn so the test doesn't wait for animations
      for (const id of g.pendingSpawn.ids) g.acquireSlime(id);
      g.pendingSpawn = null;
      g.spinFlash = 0;
    }
  }
});
await page.waitForTimeout(200);

const afterRolls = await page.evaluate(() => {
  const g = window.__game;
  return {
    collectionSize: g.collection.size,
    totalCopies: [...g.collection.values()].reduce((s, v) => s + v.count, 0),
    distinctVariants: g.collection.size,
    sampleTop3: [...g.collection.values()]
      .sort((a, b) => b.timesRolled - a.timesRolled)
      .slice(0, 3)
      .map((v) => ({ id: v.variantId, count: v.count, rolled: v.timesRolled, level: v.level })),
  };
});
console.log('AFTER 30 ROLLS:', JSON.stringify(afterRolls, null, 2));

await page.screenshot({ path: resolve(projectRoot, '.screenshots/stack-refactor.png') });
await browser.close();
console.log('ok');
