// Phase F smoke — luck mults, bonus chance, mutations.
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
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// 1) Luck multipliers stack onto effective luck.
const luck = await page.evaluate(() => {
  const g = window.__game;
  g.inventory.luck = 100;
  g.unlockedPerks.add('luckMul1');
  g.unlockedPerks.add('luckMul2');
  return { withTwoMuls: g.effectiveLuck() };
});
console.log('LUCK MULT:', JSON.stringify(luck), 'expected ~137.5 (100 * 1.10 * 1.25)');

// 2) Bonus chance perks reduce the threshold.
const bonus = await page.evaluate(() => {
  const g = window.__game;
  const orig = Math.random;
  Math.random = () => 0.06; // base 5% would fail this, +50% bonus (now 7.5%) passes
  g.unlockedPerks.delete('bonusChance1');
  const without = g.rollBonusMul();
  g.unlockedPerks.add('bonusChance1');
  g.unlockedPerks.add('bonusChance2');
  g.unlockedPerks.add('bonusChance3');
  Math.random = () => 0.20; // 0.20 < 22.5% (cumulative chance) — passes
  Math.random = (() => { let i = 0; return () => i++ === 0 ? 0.20 : 0.4; })();
  const withAll = g.rollBonusMul();
  Math.random = orig;
  return { without, withAll };
});
console.log('BONUS CHANCE:', JSON.stringify(bonus), 'without should be 1 (no bonus), withAll > 1 (bonus triggered)');

// 3) Forced mutation arms + applies to a manual spin.
const mut = await page.evaluate(() => {
  const g = window.__game;
  g.applyConsumablePerk('bigDice');
  const armed = g.forcedMutation;
  // Manually trigger a spin so we can inspect the pending mutations.
  g.spinFlash = 0; g.bonusFlash = 0;
  // Force pickFoodDrop / luck rolls deterministic: bonusMul should be 1.
  const orig = Math.random;
  Math.random = () => 0.99;
  g.spin();
  Math.random = orig;
  const pending = g.pendingSpawn;
  return {
    armed,
    pendingMutations: pending?.mutations ?? null,
    forcedAfter: g.forcedMutation,
  };
});
console.log('FORCED MUTATION:', JSON.stringify(mut), 'should arm big, apply to all spawned, then clear');

// 4) Acquire a mutated slime and verify it tracks per-mutation count + stat mul.
const acquire = await page.evaluate(() => {
  const g = window.__game;
  g.spinFlash = 0; g.bonusFlash = 0; g.pendingSpawn = null;
  g.acquireSlime('green', 'huge');
  g.acquireSlime('green', 'big');
  g.acquireSlime('green', 'none');
  const v = g.collection.get('green');
  return {
    count: v.count,
    mutations: v.mutations,
    bestMutation: g.bestAvailableMutation('green'),
  };
});
console.log('ACQUIRE MIX:', JSON.stringify(acquire), 'bestMutation should be huge');

// 5) Slot the best — should pick huge (rarest) over big.
const slot = await page.evaluate(() => {
  const g = window.__game;
  // Clear existing slot
  while (g.spitterSlots.length > 0) g.removeFromSlot('spitter', 0, false);
  g.assignToSlot('green', 'spitter');
  const slime = g.slimes.find((s) => s.slotType === 'spitter');
  return {
    slotMutation: g.spitterMutations[0],
    slimeMutation: slime?.mutation,
  };
});
console.log('SLOT BEST:', JSON.stringify(slot), 'both should be huge');

console.log('ok');
await browser.close();
