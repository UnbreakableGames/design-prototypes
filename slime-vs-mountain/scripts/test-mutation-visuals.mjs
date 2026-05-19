// Spawn every mutation tier in slots so the render treatments are visible.
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

await page.evaluate(() => {
  const g = window.__game;
  // Pretend we paid for slot expansion so all 5 mutation tiers can spawn.
  g.unlockedPerks.add('spitterSlot1');
  g.unlockedPerks.add('spitterSlot2');
  g.unlockedPerks.add('spitterSlot3');
  g.unlockedPerks.add('runnerSlot1');
  g.unlockedPerks.add('runnerSlot2');
  g.unlockedPerks.add('runnerSlot3');
  // Clear existing slots.
  while (g.spitterSlots.length > 0) g.removeFromSlot('spitter', 0, false);
  while (g.runnerSlots.length > 0)  g.removeFromSlot('runner', 0, false);
  // Acquire one copy per mutation tier of green, then slot each.
  g.acquireSlime('green', 'none');
  g.acquireSlime('green', 'big');
  g.acquireSlime('green', 'shiny');
  g.acquireSlime('green', 'huge');
  g.acquireSlime('green', 'inverted');
  // Slot one of each via forced mutation.
  for (const m of ['none', 'big', 'shiny', 'huge']) {
    g.assignToSlot('green', 'spitter', m);
  }
  // Last one goes to runner so we can see it moving.
  g.assignToSlot('green', 'runner', 'inverted');
  // Also a base amber runner for contrast.
  g.acquireSlime('amber', 'none');
  g.assignToSlot('amber', 'runner', 'none');
});
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/mutation-visuals.png') });
console.log('ok');
await browser.close();
