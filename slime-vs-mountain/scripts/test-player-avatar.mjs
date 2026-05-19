// Verify the player avatar end-to-end:
//  1. base runner cap is 0 on fresh save (runners gated behind runnerUnlock)
//  2. clicking empty world sets avatar's walk target → avatar walks
//  3. loot in pickup radius is magnetized into `carried[]` (NOT instantly
//     credited — player has to walk to the dropoff pad)
//  4. carry cap is enforced (no more pickups while full)
//  5. walking through dropoff zone deposits everything → inventory.gold ticks up
//  6. runnerUnlock perk restores the +2 runner slot baseline
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const URL = process.env.URL ?? 'http://localhost:5175/';

function pass(label, cond) { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) process.exitCode = 1; }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR:', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CON ERR:', m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// --- 1) Fresh-save runner cap is 0. ---
const capInfo = await page.evaluate(() => ({
  runnerCap: window.__game.effectiveRunnerLimit?.() ?? null,
  spitterCap: window.__game.effectiveSpitterLimit?.() ?? null,
  runnerUnlocked: window.__game.unlockedPerks.has('runnerUnlock'),
}));
console.log('Fresh-save caps:', JSON.stringify(capInfo));
pass('runner cap is 0 before runnerUnlock', capInfo.runnerCap === 0);
pass('runnerUnlock not granted on fresh save', capInfo.runnerUnlocked === false);
pass('spitter cap unaffected (still 2)', capInfo.spitterCap === 2);

// --- 2) Click in mid-air, avatar walks toward target. ---
const startX = await page.evaluate(() => window.__game.player.x);
// (500, 300) — middle of the world, mid-air, no overlaps.
await page.mouse.click(500, 300);
await page.waitForTimeout(50);
const targetX = await page.evaluate(() => window.__game.player.targetX);
console.log(`startX=${startX} targetX=${targetX}`);
pass('click sets walk target', targetX !== null && Math.abs(targetX - 500) < 5);

// Wait long enough for the avatar to reach the target and stop.
await page.waitForTimeout(2500);
const moved = await page.evaluate(() => ({ x: window.__game.player.x, target: window.__game.player.targetX }));
console.log('After walk:', JSON.stringify(moved));
pass('avatar moved toward click', moved.x > startX + 100);
pass('avatar stopped at target', moved.target === null);

// --- 3) Plant loot under the now-stationary avatar, confirm magnet pickup. ---
const beforeGoldRaw = await page.evaluate(() => Math.floor(window.__game.inventory.gold));
await page.evaluate(() => {
  const g = window.__game;
  const Loot = g.loot.length > 0 ? g.loot[0].constructor : null;
  if (!Loot) return;
  const SMALL_GOLD = { kind: 'gold', shape: 'coin', size: 4, color: '#ffd24a', outline: '#a87a10', value: 1 };
  // Plant 8 coins right under the avatar — more than CARRY_CAP (5) so we can
  // also validate the carry-cap stop condition.
  for (let i = 0; i < 8; i++) {
    const l = new Loot(g.player.x + (i - 4) * 4, 455, SMALL_GOLD);
    l.vx = 0; l.vy = 0; l.settled = true;
    g.loot.push(l);
  }
});
await page.waitForTimeout(200);
const pickedUp = await page.evaluate(() => ({
  carriedCount: window.__game.player.carried.length,
  gold: Math.floor(window.__game.inventory.gold),
}));
console.log('After magnet pickup:', JSON.stringify(pickedUp));
pass('avatar carries up to cap', pickedUp.carriedCount === 5);
pass('inventory not yet credited (deposit pending)', pickedUp.gold === beforeGoldRaw);

// --- 4) Walk back to the dropoff pad — should deposit all 5. ---
await page.mouse.click(110, 460);   // WORLD.dropoffX = 110
await page.waitForTimeout(2500);
const afterDeposit = await page.evaluate(() => ({
  carriedCount: window.__game.player.carried.length,
  gold: Math.floor(window.__game.inventory.gold),
  playerX: window.__game.player.x,
}));
console.log('After dropoff walk:', JSON.stringify(afterDeposit));
pass('carried pile emptied after dropoff', afterDeposit.carriedCount === 0);
pass('gold credited by 5 on deposit', afterDeposit.gold >= beforeGoldRaw + 5);

// --- 5) runnerUnlock raises runner cap to 1 (one starter runner). ---
const afterUnlock = await page.evaluate(() => {
  window.__game.unlockedPerks.add('runnerUnlock');
  return window.__game.effectiveRunnerLimit();
});
pass('runnerUnlock grants +1 runner slot', afterUnlock === 1);

await page.screenshot({ path: resolve(projectRoot, '.screenshots/player-avatar.png') });
console.log('---');
console.log(process.exitCode ? 'FAILED' : 'ALL CHECKS PASSED');
await browser.close();
