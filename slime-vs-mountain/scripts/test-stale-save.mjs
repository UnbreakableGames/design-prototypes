// Plant a save full of cut/unknown IDs and verify the game loads cleanly,
// scrubbing the bad data instead of crashing.
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

// Suppress the running game's save so its beforeunload doesn't clobber the
// stale data we're about to plant.
await page.evaluate(() => { window.__game.saveSuppressed = true; });

// Plant a save with: cut variants (pebble/blue/sunny), cut perks (bigDice,
// bigUnlock, shinyDice), cut milestones (45, 50), a real variant (green).
await page.evaluate(() => {
  const stale = {
    v: 2,
    inv: { gold: 100, gems: 5, luck: 3, essence: 1, rolls: 50 },
    collection: [
      { variantId: 'green',  count: 10, timesRolled: 10, slotted: 0, level: 3, xp: 50 },
      { variantId: 'pebble', count: 5,  timesRolled: 5,  slotted: 0, level: 1, xp: 0 }, // CUT
      { variantId: 'blue',   count: 3,  timesRolled: 3,  slotted: 0, level: 1, xp: 0 }, // CUT
      { variantId: 'amber',  count: 2,  timesRolled: 2,  slotted: 0, level: 2, xp: 30 },
    ],
    spitterSlots: ['pebble', 'green', 'blue'],   // 2 cut + 1 valid
    runnerSlots:  ['amber', 'sunny'],            // 1 cut + 1 valid
    unlockedPerks: ['foundation', 'spitterSlot1', 'bigDice', 'shinyUnlock', 'hugeDice'],
    essenceUnlocked: ['wealth1', 'fakeNode'],
    claimedMilestones: [5, 45, 50, 99],          // 45/50/99 don't exist anymore
    pendingMilestones: [50],                      // also stale
    ownedShopItems: ['starterPack', 'phantomItem'],
    boosts: { serverLuck: 0, serverCoins: 0, luckySpinsLeft: 0 },
    rebirthBoostCharges: 0,
    quickRollChargesLeft: 0,
    runGoldEarned: 0,
    runMountainsKilled: 0,
    totalMountainsKilled: 0,
    mountainLevel: 0,
    mountainCycle: 0,
    mountainHp: 600,
    autoRoll: false,
  };
  localStorage.setItem('svm-save', JSON.stringify(stale));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);

const state = await page.evaluate(() => {
  const g = window.__game;
  return {
    collectionIds: Array.from(g.collection.keys()),
    spitterSlots: [...g.spitterSlots],
    runnerSlots: [...g.runnerSlots],
    activeSlimeIds: g.slimes.map((s) => s.variant.id),
    unlockedPerks: [...g.unlockedPerks],
    essenceUnlocked: [...g.essenceUnlocked],
    claimedMilestones: [...g.claimedMilestones],
    pendingMilestones: [...g.pendingMilestones],
    ownedShopItems: [...g.ownedShopItems],
  };
});
console.log('LOADED STATE:', JSON.stringify(state, null, 2));

await page.screenshot({ path: resolve(projectRoot, '.screenshots/stale-save-load.png') });
console.log('ok');
await browser.close();
