// Phase 5 smoke — Rolls currency, Quick Roll + Big Dice consumables.
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

// 1) Manual spins should mint +1 roll each. Auto-roll spins should not.
const minted = await page.evaluate(async () => {
  const g = window.__game;
  const before = g.inventory.rolls;
  // 3 manual spins (each clears the spinFlash before the next).
  for (let i = 0; i < 3; i++) {
    g.spin(true);
    g.spinFlash = 0;
    g.bonusFlash = 0;
    if (g.pendingSpawn) g.pendingSpawn = null;
  }
  // 2 auto-roll spins
  for (let i = 0; i < 2; i++) {
    g.spin(false);
    g.spinFlash = 0;
    g.bonusFlash = 0;
    if (g.pendingSpawn) g.pendingSpawn = null;
  }
  return { before, after: g.inventory.rolls };
});
console.log('ROLLS MINT:', JSON.stringify(minted));

// 2) Find the bigDice/quickRoll nodes in SKILL_TREE — they should be available
//    via tryUnlock once autoSpin (their adjacent neighbor) is unlocked. Force
//    the prerequisite then activate Big Dice.
const big = await page.evaluate(() => {
  const g = window.__game;
  // Give the player enough gold + rolls to unlock autoSpin then activate bigDice.
  g.inventory.gold = 1000;
  g.inventory.rolls = 50;
  // Manually unlock autoSpin so bigDice becomes adjacent-reachable.
  g.unlockedPerks.add('autoSpin');
  // Reach into SKILL_TREE — exposed via the module's exports through window? not directly. Use tryUnlock by passing a synthetic node.
  // Easier: walk SKILL_TREE via the constructor's source. We expose it on __game.
  // For this test we set bigDiceArmed directly via tryUnlock-equivalent.
  // Find the node via global module — fallback: manipulate state directly.
  g.bigDiceArmed = false;
  g.applyConsumablePerk('bigDice');
  return { armed: g.bigDiceArmed, toast: g.toast?.text };
});
console.log('BIG DICE:', JSON.stringify(big));

// 3) Quick Roll: arm 10 charges and verify spinDuration is halved.
const qr = await page.evaluate(() => {
  const g = window.__game;
  g.quickRollChargesLeft = 0;
  const normalDur = g.effectiveSpinDuration();
  g.applyConsumablePerk('quickRoll');
  const boostedDur = g.effectiveSpinDuration();
  return { normalDur, boostedDur, charges: g.quickRollChargesLeft, toast: g.toast?.text };
});
console.log('QUICK ROLL:', JSON.stringify(qr));

// 4) Verify charges decrement on spin and the next-spin rarity floor is forced.
const decrement = await page.evaluate(() => {
  const g = window.__game;
  g.quickRollChargesLeft = 3;
  g.bigDiceArmed = true;
  const floorBefore = g.effectiveMinRarityIdx();
  g.spin(true);
  g.spinFlash = 0;
  g.bonusFlash = 0;
  if (g.pendingSpawn) g.pendingSpawn = null;
  return {
    floorBefore,
    chargesAfter: g.quickRollChargesLeft,
    armedAfter: g.bigDiceArmed,
  };
});
console.log('AFTER ONE SPIN:', JSON.stringify(decrement));

await page.evaluate(() => { window.__game.showTree = true; });
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/phase5-tree.png') });
console.log('ok');
await browser.close();
