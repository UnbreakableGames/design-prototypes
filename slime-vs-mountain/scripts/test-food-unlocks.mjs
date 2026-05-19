// Verify food drops are gated by unlock perks + tooltip shows mutation stats.
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

// 1) Without cheeseUnlock, force-favorable rng on a cliff hit should produce
//    NO food (allowed set is empty).
const locked = await page.evaluate(() => {
  const g = window.__game;
  g.goons = [];
  const orig = Math.random;
  Math.random = () => 0.0000001; // would clear every food tier
  g.applyImpact(g.mountain.x + 4, g.mountain.topY + 30, 1, 'physical', null, false);
  Math.random = orig;
  return { allowed: [...g.allowedFoods()], foodDrops: g.foodDrops.map(f => f.kind) };
});
console.log('LOCKED (no unlocks):', JSON.stringify(locked));

// 2) Unlock cheese → cheese drops on next favorable hit.
const cheeseOnly = await page.evaluate(() => {
  const g = window.__game;
  g.unlockedPerks.add('cheeseUnlock');
  g.foodDrops = [];
  const orig = Math.random;
  Math.random = () => 0.0000001;
  g.applyImpact(g.mountain.x + 4, g.mountain.topY + 30, 1, 'physical', null, false);
  Math.random = orig;
  return { allowed: [...g.allowedFoods()], foodDrops: g.foodDrops.map(f => f.kind) };
});
console.log('CHEESE ONLY:', JSON.stringify(cheeseOnly));

// 3) Unlock all four → rarest (pizza) wins.
const allUnlocked = await page.evaluate(() => {
  const g = window.__game;
  for (const p of ['eggUnlock','drumstickUnlock','pizzaUnlock']) g.unlockedPerks.add(p);
  g.foodDrops = [];
  const orig = Math.random;
  Math.random = () => 0.0000001;
  g.applyImpact(g.mountain.x + 4, g.mountain.topY + 30, 1, 'physical', null, false);
  Math.random = orig;
  return { allowed: [...g.allowedFoods()], foodDrops: g.foodDrops.map(f => f.kind) };
});
console.log('ALL UNLOCKED:', JSON.stringify(allUnlocked));

// 4) Tooltip stat with a Huge mutation owned.
await page.evaluate(() => {
  const g = window.__game;
  g.acquireSlime('green', 'huge');
  const v = g.collection.get('green');
  v.level = 5;
  g.selectedVariantId = 'green';
});
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/tooltip-mutation-stats.png') });

// 5) Tree screenshot showing the food-unlock cluster.
await page.evaluate(() => {
  const g = window.__game;
  g.inventory.gold = 50000;
  g.inventory.gems = 5000;
  g.unlockedPerks.add('dropChance1');
  g.unlockedPerks.add('biggerCoins1');
  g.unlockedPerks.add('dropChance2');
  g.unlockedPerks.add('heavyDrops1');
  g.showTree = true;
  g.treeZoom = 1.6;
  g.treePanX = -120;
  g.treePanY = -100;
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/food-unlock-tree.png') });

console.log('ok');
await browser.close();
