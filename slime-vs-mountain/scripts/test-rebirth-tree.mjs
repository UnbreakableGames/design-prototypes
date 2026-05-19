// Verify the rebirth-tree flow end-to-end:
//   1. mountain kills accumulate to pendingEssence, not inventory.essence
//   2. tree purchases are blocked while only pending essence exists
//   3. rebirth() transfers pending → spendable
//   4. tree node purchase works after rebirth (essence deducts, node unlocks)
//   5. overlay header reads "REBIRTH TREE"
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const URL = process.env.URL ?? 'http://localhost:5175/';

function assertEq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  if (!ok) process.exitCode = 1;
}

function assertTrue(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) process.exitCode = 1;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR:', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CON ERR:', m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// --- Step 1: drop 3 mountains via direct hp=0 + update ticks. ---
const afterKills = await page.evaluate(() => {
  const g = window.__game;
  // Kill three mountains: hp=0, then enough updates to advance the
  // alive→falling→rising→alive state machine so the next kill registers.
  for (let i = 0; i < 3; i++) {
    g.mountain.hp = 0;
    // Spin the mountain death state machine forward enough to fully revive.
    // Each phase eats ~1s; advance 5 seconds in 1/60s ticks to be safe.
    for (let t = 0; t < 300; t++) g.update(1 / 60);
  }
  return {
    pendingEssence: g.pendingEssence,
    spendableEssence: g.inventory.essence,
    runMountainsKilled: g.runMountainsKilled,
    totalMountainsKilled: g.totalMountainsKilled,
  };
});
console.log('AFTER 3 KILLS:', JSON.stringify(afterKills));
assertEq('inventory.essence stays 0 during run', afterKills.spendableEssence, 0);
assertTrue('pendingEssence > 0 after kills', afterKills.pendingEssence > 0);
assertEq('totalMountainsKilled == 3', afterKills.totalMountainsKilled, 3);

// --- Step 2: tree purchase blocked while only pending essence exists. ---
const blocked = await page.evaluate(() => {
  const g = window.__game;
  const sizeBefore = g.essenceUnlocked.size;
  const ok = g.tryUnlockEssence('wealth1');
  return {
    ok,
    sizeBefore,
    sizeAfter: g.essenceUnlocked.size,
    essence: g.inventory.essence,
  };
});
console.log('BLOCKED PURCHASE:', JSON.stringify(blocked));
assertEq('purchase before rebirth fails', blocked.sizeAfter, blocked.sizeBefore);

// --- Step 3: rebirth transfers pending → spendable. ---
const afterRebirth = await page.evaluate(() => {
  const g = window.__game;
  const pendingBefore = g.pendingEssence;
  const payoutPreview = g.rebirthPreview();
  g.rebirth();
  return {
    pendingBefore,
    payoutPreview,
    pendingAfter: g.pendingEssence,
    spendableAfter: g.inventory.essence,
  };
});
console.log('AFTER REBIRTH:', JSON.stringify(afterRebirth));
assertEq('pendingEssence reset to 0', afterRebirth.pendingAfter, 0);
assertEq(
  'spendable == pendingBefore + payoutPreview',
  afterRebirth.spendableAfter,
  afterRebirth.pendingBefore + afterRebirth.payoutPreview,
);
assertTrue('spendable >= 5 (enough to buy wealth1)', afterRebirth.spendableAfter >= 5);

// --- Step 4: tree node purchase succeeds after rebirth. ---
const afterBuy = await page.evaluate(() => {
  const g = window.__game;
  const essenceBefore = g.inventory.essence;
  const ok = g.tryUnlockEssence('wealth1');
  return {
    ok,
    essenceBefore,
    essenceAfter: g.inventory.essence,
    unlocked: [...g.essenceUnlocked],
  };
});
console.log('AFTER BUY wealth1:', JSON.stringify(afterBuy));
assertTrue('tryUnlockEssence returned true', afterBuy.ok === true);
assertEq('wealth1 unlocked', afterBuy.unlocked.includes('wealth1'), true);
assertEq('essence deducted by 5', afterBuy.essenceBefore - afterBuy.essenceAfter, 5);

// --- Step 5: open overlay, screenshot, verify rename in canvas. ---
await page.evaluate(() => { window.__game.showEssenceTree = true; });
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/rebirth-tree-open.png') });

console.log('---');
console.log(process.exitCode ? 'FAILED' : 'ALL CHECKS PASSED');
await browser.close();
