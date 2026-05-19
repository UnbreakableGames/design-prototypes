// FTUE smoke test — drive each step in turn and confirm the step counter
// advances. Also verifies the "first roll = brand-new slime" guarantee.
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

// --- Step 1: fresh-save should park us at step 1 with no slot filled. ---
const start = await page.evaluate(() => ({
  step: window.__game.ftue.step,
  spitter: window.__game.spitterSlots.length,
  runner: window.__game.runnerSlots.length,
  collectionSize: window.__game.collection.size,
}));
console.log('Start:', JSON.stringify(start));
pass('FTUE starts at step 1', start.step === 1);
pass('no auto-slotted spitter', start.spitter === 0);
pass('no auto-slotted runner', start.runner === 0);
pass('only green in collection (1 starter bee)', start.collectionSize === 1);

// --- Drive step 1 → 2: assign green to spitter ---
await page.evaluate(() => { window.__game.assignToSlot('green', 'spitter'); });
await page.waitForTimeout(50);
let step = await page.evaluate(() => window.__game.ftue.step);
pass('step 1 → 2 after assign', step === 2);

// --- Drive step 2 → 3: simulate a pickup directly by pushing a fake item
//     into the avatar's carry pile. The magnet/deposit pipeline has its own
//     smoke test (test-player-avatar.mjs); here we only care that FTUE
//     advances on the state-machine condition (carried.length >= 1). ---
await page.evaluate(() => { window.__game.player.carried.push({ kind: 'gold', value: 1 }); });
await page.waitForTimeout(60);
step = await page.evaluate(() => window.__game.ftue.step);
pass('step 2 → 3 after pickup (state-machine)', step === 3);

// --- Drive step 3 → 4: simulate a deposit: clear carried + bump inventory.
//     Detection wants gold > snapshot AND carried === 0. ---
await page.evaluate(() => {
  window.__game.player.carried.length = 0;
  window.__game.inventory.gold += 5;
});
await page.waitForTimeout(60);
step = await page.evaluate(() => ({ step: window.__game.ftue.step, gold: window.__game.inventory.gold }));
console.log('After deposit (simulated):', JSON.stringify(step));
pass('step 3 → 4 after deposit', step.step === 4);

// --- Drive step 4 → 5: unlock runnerUnlock directly ---
await page.evaluate(() => { window.__game.unlockedPerks.add('runnerUnlock'); });
await page.waitForTimeout(50);
step = await page.evaluate(() => window.__game.ftue.step);
pass('step 4 → 5 after runnerUnlock', step === 5);

// --- Drive step 5 → 6: trigger a roll AND verify new-variant guarantee ---
const beforeRoll = await page.evaluate(() => ({
  collection: [...window.__game.collection.keys()].sort(),
  rolls: [...window.__game.collection.values()].reduce((s, v) => s + v.timesRolled, 0),
}));
console.log('Pre-roll:', JSON.stringify(beforeRoll));
await page.evaluate(() => {
  // spinFlash is the rate-limiter — clear and trigger.
  window.__game.spinFlash = 0;
  window.__game.bonusFlash = 0;
  window.__game.spin();
});
// Spin animation IS the cooldown again — constant-velocity scroll for ~6s
// then a ~1.4s settle. Wait the full duration plus a small buffer.
await page.waitForTimeout(9000);
const afterRoll = await page.evaluate(() => ({
  collection: [...window.__game.collection.keys()].sort(),
  step: window.__game.ftue.step,
}));
console.log('Post-roll:', JSON.stringify(afterRoll));
pass('step 5 → 6 after roll', afterRoll.step === 6);
const newVariants = afterRoll.collection.filter((v) => !beforeRoll.collection.includes(v));
pass('first roll added a brand-new variant', newVariants.length >= 1);
console.log('  new variant(s):', newVariants.join(', '));

// --- Drive step 6 → 0: assign the rolled bee to the new runner slot ---
const secondVariant = newVariants[0] ?? 'green';
await page.evaluate((id) => { window.__game.assignToSlot(id, 'runner'); }, secondVariant);
await page.waitForTimeout(50);
step = await page.evaluate(() => window.__game.ftue.step);
pass('step 6 → 0 (done) after runner assign', step === 0);

await page.screenshot({ path: resolve(projectRoot, '.screenshots/ftue-done.png') });
console.log('---');
console.log(process.exitCode ? 'FAILED' : 'ALL CHECKS PASSED');
await browser.close();
