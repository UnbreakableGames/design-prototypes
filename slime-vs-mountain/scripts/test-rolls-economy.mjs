// Verify: roll upgrades cost rolls; auto-rolls mint rolls.
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

// 1) Spin mints +1 regardless of how it's called.
const minted = await page.evaluate(async () => {
  const g = window.__game;
  const before = g.inventory.rolls;
  for (let i = 0; i < 8; i++) {
    g.spin();
    g.spinFlash = 0; g.bonusFlash = 0;
    if (g.pendingSpawn) g.pendingSpawn = null;
  }
  return { before, after: g.inventory.rolls };
});
console.log('SPIN MINT (8 spins, no manual flag):', JSON.stringify(minted));

// 2) Try to unlock autoSpin via rolls cost.
const unlock = await page.evaluate(() => {
  const g = window.__game;
  // We're at rolls = 8 now. autoSpin costs 5. Should unlock.
  const node = g.SKILL_TREE ?? null;
  // Reach into the skill tree module via window? Not directly. Use tryUnlock proxy.
  const before = g.inventory.rolls;
  // Build a synthetic node-shaped object; tryUnlock checks adjacency. autoSpin is
  // adjacent to foundation which is always unlocked, so this should pass.
  // Easiest: call tryUnlock with the actual SKILL_TREE entry. Module exports it
  // — but we can also fish it out: each visible node hangs on the tree drawing.
  // Pragmatic path: import via a lazily-attached helper. Game.ts has tryUnlock
  // as a private method; reach via instance.
  const fakeNode = {
    id: 'autoSpin', branch: 'economy', q: -1, r: 1,
    name: 'Auto Roll', desc: '', costRolls: 5,
  };
  const ok = g.tryUnlock(fakeNode);
  return {
    ok,
    rollsBefore: before,
    rollsAfter: g.inventory.rolls,
    autoSpinOwned: g.unlockedPerks.has('autoSpin'),
  };
});
console.log('UNLOCK AUTOSPIN (costs 5 rolls):', JSON.stringify(unlock));

// 3) Open the tree to screenshot the new cost labels.
await page.evaluate(() => {
  const g = window.__game;
  g.inventory.rolls = 10000;
  g.showTree = true;
  g.treeZoom = 1.6;
  g.treePanY = -40;
  g.treePanX = 60;
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/rolls-economy-tree.png') });

console.log('ok');
await browser.close();
