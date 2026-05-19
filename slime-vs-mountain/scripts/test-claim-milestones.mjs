// Verify milestone reward goes pending → claim flow.
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

// Trigger milestone at 5 unique — no reward should land yet.
const crossed = await page.evaluate(() => {
  const g = window.__game;
  const before = g.inventory.gold;
  for (const id of ['green', 'amber', 'pebble', 'sprout', 'twig']) g.acquireSlime(id, 'none');
  return {
    goldBefore: before,
    goldAfter: g.inventory.gold,         // should be unchanged
    pending: [...g.pendingMilestones],
    claimed: [...g.claimedMilestones],
    toast: g.toast?.text ?? null,
  };
});
console.log('CROSSED 5:', JSON.stringify(crossed), 'gold unchanged, pending=[5]');

// Player claims the reward.
const claimed = await page.evaluate(() => {
  const g = window.__game;
  const ok = g.claimMilestone(5);
  return {
    ok,
    gold: g.inventory.gold,              // should be 140 (was 40, +100)
    pending: [...g.pendingMilestones],
    claimed: [...g.claimedMilestones],
    toast: g.toast?.text ?? null,
  };
});
console.log('CLAIMED 5:', JSON.stringify(claimed), 'gold +100, pending=[], claimed=[5]');

// Claiming twice should fail.
const dupe = await page.evaluate(() => window.__game.claimMilestone(5));
console.log('CLAIM AGAIN:', dupe, '(false expected)');

// Render the Index with multiple pending milestones.
await page.evaluate(() => {
  const g = window.__game;
  for (const id of ['mossy', 'drizzle', 'blue', 'purple', 'sapphire', 'frost', 'magma', 'storm']) {
    g.acquireSlime(id, 'none');
  }
  g.showIndex = true;
  g.indexTab = 'none';
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/claim-milestones.png') });

console.log('ok');
await browser.close();
