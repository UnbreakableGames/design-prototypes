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

// 1) Without bigUnlock, rollMutation never produces Big. Force rng to favor big.
const locked = await page.evaluate(() => {
  const g = window.__game;
  const orig = Math.random;
  Math.random = () => 0.000001; // would clear every tier
  const results = [];
  for (let i = 0; i < 5; i++) results.push(window.rollMutation ? window.rollMutation(new Set(['none'])) : null);
  Math.random = orig;
  // Use the actual game's allowedMutations API
  Math.random = () => 0.000001;
  const allowed = g.allowedMutations();
  Math.random = orig;
  // Simulate one spin and inspect pendingSpawn mutations
  // First two Math.random calls drive rollBonusMul — return high values so
  // we skip the bonus branch. After that, return tiny values so every
  // mutation-tier roll clears.
  let n = 0;
  Math.random = () => (n++ < 2 ? 0.99 : 0.000001);
  g.spinFlash = 0; g.bonusFlash = 0;
  g.spin();
  Math.random = orig;
  return {
    allowedMutations: [...allowed],
    pendingMutations: g.pendingSpawn?.mutations ?? null,
  };
});
console.log('LOCKED (no unlocks):', JSON.stringify(locked));

// 2) Unlock big, rollMutation can produce big.
const unlocked = await page.evaluate(() => {
  const g = window.__game;
  g.unlockedPerks.add('bigUnlock');
  const orig = Math.random;
  // First two Math.random calls drive rollBonusMul — return high values so
  // we skip the bonus branch. After that, return tiny values so every
  // mutation-tier roll clears.
  let n = 0;
  Math.random = () => (n++ < 2 ? 0.99 : 0.000001);
  g.spinFlash = 0; g.bonusFlash = 0;
  g.pendingSpawn = null;
  g.spin();
  Math.random = orig;
  return {
    allowedMutations: [...g.allowedMutations()],
    pendingMutations: g.pendingSpawn?.mutations ?? null,
  };
});
console.log('BIG UNLOCKED:', JSON.stringify(unlocked));

// 3) Tree screenshot: cheat in to walk down + open tree.
await page.evaluate(() => {
  const g = window.__game;
  g.grantCheatResources();
  g.grantCheatResources();
  g.grantCheatResources();
  // Walk economy + bonus + dice unlocks so the dice tree is visible.
  for (const id of [
    'autoSpin', 'cheaperSpin1', 'cheaperSpin2',
    'bonusChance1',
    'quickRoll', // repeatable; just for adjacency unlock chain we add a perk
    'bigUnlock', 'shinyUnlock', 'hugeUnlock', 'invertedUnlock',
  ]) g.unlockedPerks.add(id);
  g.showTree = true;
  g.treeZoom = 1.5;
  g.treePanY = -80;
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/dice-tree.png') });

console.log('ok');
await browser.close();
