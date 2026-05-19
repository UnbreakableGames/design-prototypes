// Force the spitter cap to 9 (3 full columns) and confirm visually the
// column-of-3 stacking + 40% smaller slimes.
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

// Grant cheat resources, buy all 5 spitter-slot perks (cap → 7), and fill the
// spitter slots with copies of greens so we can see 7 stacked across columns.
await page.evaluate(() => {
  const g = window.__game;
  g.grantCheatResources();
  for (const id of ['spitterSlot1','spitterSlot2','spitterSlot3','spitterSlot4','spitterSlot5']) {
    g.unlockedPerks.add(id);
  }
  // Make sure we have plenty of greens to slot.
  let green = g.collection.get('green');
  if (!green) {
    g.collection.set('green', { variantId: 'green', count: 7, timesRolled: 7, slotted: 0, level: 1, xp: 0 });
  } else {
    green.count = Math.max(green.count, 7);
  }
  // Clear current slots and re-fill all spitter slots with greens.
  g.spitterSlots = [];
  const cap = g.effectiveSpitterLimit();
  green = g.collection.get('green');
  green.slotted = 0;
  for (let i = 0; i < cap; i++) {
    g.spitterSlots.push('green');
    green.slotted++;
  }
  g.rebuildActiveSlimes();
});
await page.waitForTimeout(400);

const layout = await page.evaluate(() => {
  const g = window.__game;
  return g.slimes
    .filter((s) => s.slotType === 'spitter')
    .map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), index: s.slotIndex }));
});
console.log('Spitter positions:');
for (const s of layout) console.log(`  slot ${s.index}: x=${s.x} y=${s.y}`);

await page.screenshot({ path: resolve(projectRoot, '.screenshots/spitter-stacking.png') });
console.log('ok');
await browser.close();
