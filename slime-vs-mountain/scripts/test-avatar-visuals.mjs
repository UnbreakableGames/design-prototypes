// Snapshot the new R6-style avatar in three poses:
//   1. idle, mid-screen (clean look)
//   2. walking with carry pile (counter visible)
//   3. mid-toss into dropoff (arcing coins captured in flight)
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

// 1) idle avatar at center of screen
await page.evaluate(() => {
  const g = window.__game;
  g.player.x = 480;
  g.player.targetX = null;
  // suppress slimes + loot so the screenshot is clean
  g.loot = [];
  g.spitterSlots = [];
  g.runnerSlots = [];
  g.rebuildActiveSlimes();
});
await page.waitForTimeout(100);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/avatar-idle.png') });

// 2) walking with carry stack — plant 4 coins under the avatar, then walk
await page.evaluate(() => {
  const g = window.__game;
  // Re-make a dummy loot so we can find the Loot constructor
  const SMALL_GOLD = { kind: 'gold', shape: 'coin', size: 4, color: '#ffd24a', outline: '#a87a10', value: 1 };
  const Loot = g.loot.length > 0 ? g.loot[0].constructor : (eval('window').__lootCtor);
  // Force-create one coin to grab its constructor reference if needed
  if (!Loot) {
    // Spawn a fake hit so Game.ts creates loot, giving us a constructor handle
    g.mountain.hp = Math.max(1, g.mountain.hp);
  }
});
await page.evaluate(() => {
  const g = window.__game;
  // Trigger a spin to natively spawn loot via the projectile pipeline.
  for (let i = 0; i < 200; i++) g.update(1/60);
});
// Plant 4 coins right under the avatar so the carry counter shows up.
await page.evaluate(() => {
  const g = window.__game;
  const Loot = g.loot.length > 0 ? g.loot[0].constructor : null;
  if (!Loot) return;
  const SMALL_GOLD = { kind: 'gold', shape: 'coin', size: 4, color: '#ffd24a', outline: '#a87a10', value: 1 };
  for (let i = 0; i < 4; i++) {
    const l = new Loot(g.player.x + (i - 2) * 5, 455, SMALL_GOLD);
    l.vx = 0; l.vy = 0; l.settled = true;
    g.loot.push(l);
  }
});
await page.waitForTimeout(200);
// Send the avatar walking left — carrying the 4 coins now.
await page.evaluate(() => { window.__game.player.setTarget(300, 460); });
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/avatar-walking.png') });

// 3) mid-toss into dropoff — walk to dropoff and screenshot when tossing[] is non-empty
await page.evaluate(() => { window.__game.player.setTarget(110, 460); });
// Poll every 50ms for up to 3s, fire the screenshot the moment a toss is in flight.
let captured = false;
for (let i = 0; i < 60 && !captured; i++) {
  await page.waitForTimeout(50);
  const tossing = await page.evaluate(() => window.__game.player.tossing?.length ?? 0);
  if (tossing > 0) {
    // Wait one more frame so the arc is well into flight, then capture.
    await page.waitForTimeout(80);
    await page.screenshot({ path: resolve(projectRoot, '.screenshots/avatar-tossing.png') });
    captured = true;
  }
}
if (!captured) {
  console.log('WARN: never caught an in-flight toss; capturing final state anyway');
  await page.screenshot({ path: resolve(projectRoot, '.screenshots/avatar-tossing.png') });
}
console.log('ok');
await browser.close();
