import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const url = process.env.URL ?? 'http://localhost:5175/';
const durationSec = Number(process.env.DURATION_SEC ?? 90);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 620 } });
const page = await ctx.newPage();

const consoleMsgs = [];
page.on('console', (m) => consoleMsgs.push(m.text()));
page.on('pageerror', (e) => consoleMsgs.push(`ERROR: ${e}`));

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(300);

// === AUTOPLAY AI ===
// Plays as an "optimal" player: auto-spins, auto-slots, auto-fuses, auto-unlocks
// cheapest available perk. Snapshots metrics every 15s of real (= game) time.
await page.evaluate(({ durationMs }) => {
  console.log('AUTOPLAY_BOOTSTRAP_START');
  const g = window.__game;
  console.log('AUTOPLAY_BOOTSTRAP_HAS_GAME', !!g);

  // --- reset to a fresh start ---
  g.collection = [];
  g.spitterSlots = [];
  g.runnerSlots = [];
  g.slimes = [];
  g.inventory = { gold: 60, gems: 0, luck: 0 };
  g.unlockedPerks = new Set(['foundation']);
  g.mountain.level = 0;
  g.mountain.cycle = 0;
  g.mountain.maxHp = Math.floor(2400 * g.mountain.theme().hpMul);
  g.mountain.hp = g.mountain.maxHp;
  g.mountain.phase = 'alive';
  g.mountain.phaseT = 0;
  g.mountain.effects = [];
  g.goons = [];
  g.goonAttacks = [];

  // Starter slimes (mirror Game constructor)
  let nid = 1;
  const g1 = { id: nid++, variantId: 'green', tier: 1 };
  g.collection.push(g1);
  g.assignToSlot(g1.id, 'spitter');
  const a1 = { id: nid++, variantId: 'amber', tier: 1 };
  g.collection.push(a1);
  g.assignToSlot(a1.id, 'runner');
  g.spawnGoons();

  // --- skill tree perk list (mirror of src/skills/tree.ts) ---
  // Each branch is a straight radial row in axial-hex space, so prereq is
  // simply the previous node in the same branch.
  const BRANCHES = {
    power: [
      { id: 'spitterSlot1', costGold: 15 },
      { id: 'spitterDmg1',  costGold: 40 },
      { id: 'spitterSlot2', costGold: 100 },
      { id: 'spitterDmg2',  costGold: 80,   costGems: 8 },
      { id: 'spitterSlot3', costGold: 140,  costGems: 14 },
      { id: 'spitterCrit1', costGold: 220,  costGems: 22 },
      { id: 'spitterDmg3',  costGold: 380,  costGems: 38 },
      { id: 'spitterSlot4', costGold: 580,  costGems: 58 },
      { id: 'spitterCrit2', costGold: 800,  costGems: 80 },
      { id: 'spitterDmg4',  costGold: 1150, costGems: 115 },
      { id: 'spitterSlot5', costGold: 1550, costGems: 155 },
      { id: 'spitterCrit3', costGold: 2150, costGems: 215 },
    ],
    haul: [
      { id: 'runnerSlot1', costGold: 15 },
      { id: 'carryCap1',   costGold: 35 },
      { id: 'runnerSlot2', costGold: 90 },
      { id: 'carryCap2',   costGold: 80,   costGems: 8 },
      { id: 'runnerSlot3', costGold: 140,  costGems: 14 },
      { id: 'fasterDrop1', costGold: 220,  costGems: 22 },
      { id: 'carryCap3',   costGold: 380,  costGems: 38 },
      { id: 'runnerSlot4', costGold: 580,  costGems: 58 },
      { id: 'carryCap4',   costGold: 820,  costGems: 82 },
      { id: 'fasterDrop2', costGold: 1150, costGems: 115 },
      { id: 'runnerSlot5', costGold: 1550, costGems: 155 },
      { id: 'carryCap5',   costGold: 2150, costGems: 215 },
    ],
    speed: [
      { id: 'fasterPickup1', costGold: 20 },
      { id: 'fasterPickup2', costGold: 50 },
      { id: 'runnerSpeed1',  costGold: 120 },
      { id: 'fasterPickup3', costGold: 120,  costGems: 12 },
      { id: 'runnerSpeed2',  costGold: 200,  costGems: 20 },
      { id: 'fasterPickup4', costGold: 320,  costGems: 32 },
      { id: 'runnerSpeed3',  costGold: 500,  costGems: 50 },
      { id: 'reclaimReduce1',costGold: 750,  costGems: 75 },
      { id: 'floorMax1',     costGold: 1050, costGems: 105 },
      { id: 'runnerSpeed4',  costGold: 1450, costGems: 145 },
      { id: 'reclaimReduce2',costGold: 1950, costGems: 195 },
      { id: 'floorMax2',     costGold: 2550, costGems: 255 },
    ],
    riches: [
      { id: 'dropChance1', costGold: 25 },
      { id: 'biggerCoins1',costGold: 60 },
      { id: 'dropChance2', costGold: 140 },
      { id: 'heavyDrops1', costGold: 100,  costGems: 10 },
      { id: 'dropChance3', costGold: 180,  costGems: 18 },
      { id: 'biggerCoins2',costGold: 320,  costGems: 32 },
      { id: 'biggerGems1', costGold: 520,  costGems: 52 },
      { id: 'dropChance4', costGold: 750,  costGems: 75 },
      { id: 'heavyDrops2', costGold: 1100, costGems: 110 },
      { id: 'biggerCoins3',costGold: 1550, costGems: 155 },
      { id: 'dropChance5', costGold: 2050, costGems: 205 },
      { id: 'biggerGems2', costGold: 2750, costGems: 275 },
    ],
    luck: [
      { id: 'luckyFoot', costGold: 30 },
      { id: 'fourLeaf',  costGold: 80 },
      { id: 'horseshoe', costGold: 180 },
      { id: 'lucky4',    costGold: 160,  costGems: 16 },
      { id: 'lucky5',    costGold: 260,  costGems: 26 },
      { id: 'lucky6',    costGold: 420,  costGems: 42 },
      { id: 'lucky7',    costGold: 650,  costGems: 65 },
      { id: 'lucky8',    costGold: 1000, costGems: 100 },
      { id: 'lucky9',    costGold: 1450, costGems: 145 },
      { id: 'lucky10',   costGold: 1950, costGems: 195 },
      { id: 'lucky11',   costGold: 2550, costGems: 255 },
      { id: 'lucky12',   costGold: 3450, costGems: 345 },
    ],
    economy: [
      { id: 'autoSpin',     costGold: 25 },
      { id: 'cheaperSpin1', costGold: 70 },
      { id: 'cheaperSpin2', costGold: 160 },
      { id: 'cheaperSpin3', costGold: 200,  costGems: 20 },
      { id: 'cheaperSpin4', costGold: 360,  costGems: 36 },
      { id: 'cheaperSpin5', costGold: 580,  costGems: 58 },
      { id: 'cheaperSpin6', costGold: 880,  costGems: 88 },
      { id: 'rollMul2',     costGold: 1250, costGems: 125 },
      { id: 'rollMul4',     costGold: 1750, costGems: 175 },
      { id: 'rollMul8',     costGold: 2350, costGems: 235 },
      { id: 'luxurySpin',   costGold: 3150, costGems: 315 },
      { id: 'royalSpin',    costGold: 4150, costGems: 415 },
    ],
  };
  const TREE = [];
  for (const [branch, nodes] of Object.entries(BRANCHES)) {
    let prereq = null;
    for (const n of nodes) {
      TREE.push({ ...n, branch, prereq });
      prereq = n.id;
    }
  }

  // --- bookkeeping ---
  const STATS = {
    startMs: Date.now(),
    spins: 0,
    fuses: 0,
    mountainsKilled: 0,
    cumGoldEarned: 0,
    cumGemsEarned: 0,
    perksUnlocked: [],   // {id, t, costGold/costGems}
    mountainKills: [],   // {t, fromLevel, toLevel, hpClearedTotal}
    fuseEvents: [],      // {t, variantId, newTier}
    checkpoints: [],     // periodic snapshots
  };
  let lastGold = g.inventory.gold;
  let lastGems = g.inventory.gems;
  let lastLevel = g.mountain.level;
  let cumHpCleared = 0;
  let lastMaxHp = g.mountain.maxHp;
  const CHECKPOINT_TIMES = [10, 20, 30, 45, 60, 75, 90, 120, 150, 180];
  const seenCheckpoints = new Set();

  const tSec = () => (Date.now() - STATS.startMs) / 1000;

  const tickAI = setInterval(() => {
    // 1) Track positive deltas as "earned" (negative deltas are spending)
    if (g.inventory.gold > lastGold) STATS.cumGoldEarned += g.inventory.gold - lastGold;
    if (g.inventory.gems > lastGems) STATS.cumGemsEarned += g.inventory.gems - lastGems;
    lastGold = g.inventory.gold;
    lastGems = g.inventory.gems;

    // 2) Mountain kills
    if (g.mountain.level > lastLevel) {
      cumHpCleared += lastMaxHp;
      STATS.mountainKills.push({
        t: +tSec().toFixed(1),
        fromLevel: lastLevel + 1,
        toLevel: g.mountain.level + 1,
        hpCleared: lastMaxHp,
        totalHpCleared: cumHpCleared,
      });
      STATS.mountainsKilled++;
      lastLevel = g.mountain.level;
    }
    lastMaxHp = g.mountain.maxHp;

    // 3) Auto-spin
    if (g.spinFlash === 0) {
      g.spin();
      STATS.spins++;
    }

    // 4) Auto-slot any unslotted slime in collection
    for (const owned of g.collection) {
      const slotted = g.spitterSlots.includes(owned.id) || g.runnerSlots.includes(owned.id);
      if (slotted) continue;
      if (g.spitterSlots.length < g.effectiveSpitterLimit()) {
        g.assignToSlot(owned.id, 'spitter');
      } else if (g.runnerSlots.length < g.effectiveRunnerLimit()) {
        g.assignToSlot(owned.id, 'runner');
      }
    }

    // 5) Auto-fuse — pick the lowest-tier group with ≥3 copies
    const groups = new Map();
    for (const o of g.collection) {
      const k = `${o.variantId}|${o.tier}`;
      groups.set(k, (groups.get(k) || 0) + 1);
    }
    let fused = false;
    for (const [k, count] of groups) {
      if (count < 3) continue;
      const [variantId, tierStr] = k.split('|');
      const tier = parseInt(tierStr, 10);
      if (tier >= 4) continue;
      g.fuseSlimes(variantId, tier);
      STATS.fuses++;
      STATS.fuseEvents.push({
        t: +tSec().toFixed(1),
        variantId,
        newTier: tier + 1,
      });
      fused = true;
      break;
    }

    // 6) Auto-unlock first reachable perk (every node now requires BOTH gold + gems).
    for (const p of TREE) {
      if (g.unlockedPerks.has(p.id)) continue;
      if (p.prereq && !g.unlockedPerks.has(p.prereq)) continue;
      const needGold = p.costGold ?? 0;
      const needGems = p.costGems ?? 0;
      if (g.inventory.gold < needGold) continue;
      if (g.inventory.gems < needGems) continue;
      g.inventory.gold -= needGold;
      g.inventory.gems -= needGems;
      g.unlockedPerks.add(p.id);
      STATS.perksUnlocked.push({
        id: p.id,
        branch: p.branch,
        t: +tSec().toFixed(1),
        cost: { gold: needGold, gems: needGems },
      });
      g.rebuildActiveSlimes();
      break;
    }
  }, 150);

  // Checkpoints every 15s
  const cpInterval = setInterval(() => {
    const t = tSec();
    for (const cp of CHECKPOINT_TIMES) {
      if (seenCheckpoints.has(cp)) continue;
      if (t < cp) continue;
      seenCheckpoints.add(cp);
      STATS.checkpoints.push({
        t: cp,
        gold: Math.floor(g.inventory.gold),
        gems: g.inventory.gems,
        luck: g.effectiveLuck(),
        cumGoldEarned: Math.floor(STATS.cumGoldEarned),
        cumGemsEarned: STATS.cumGemsEarned,
        mtsKilled: STATS.mountainsKilled,
        mtLevel: g.mountain.level + 1,
        spins: STATS.spins,
        fuses: STATS.fuses,
        perksUnlocked: g.unlockedPerks.size - 1,
        collectionSize: g.collection.length,
        spittersActive: g.spitterSlots.length,
        runnersActive: g.runnerSlots.length,
        spitterLimit: g.effectiveSpitterLimit(),
        runnerLimit: g.effectiveRunnerLimit(),
      });
    }
  }, 500);

  // Final dump
  setTimeout(() => {
    clearInterval(tickAI);
    clearInterval(cpInterval);
    console.log('=== AUTOPLAY START ===');
    console.log(`Ran for ${(durationMs / 1000).toFixed(0)}s real time.`);
    console.log('CHECKPOINTS:');
    console.log(JSON.stringify(STATS.checkpoints, null, 2));
    console.log('PERKS_UNLOCKED:');
    console.log(JSON.stringify(STATS.perksUnlocked, null, 2));
    console.log('MOUNTAIN_KILLS:');
    console.log(JSON.stringify(STATS.mountainKills, null, 2));
    console.log('FUSE_EVENTS_COUNT:', STATS.fuses);
    console.log('FUSE_SAMPLE:');
    console.log(JSON.stringify(STATS.fuseEvents.slice(0, 12), null, 2));
    console.log('FINAL:');
    console.log(JSON.stringify({
      totalGoldEarned: Math.floor(STATS.cumGoldEarned),
      totalGemsEarned: STATS.cumGemsEarned,
      finalGold: Math.floor(g.inventory.gold),
      finalGems: g.inventory.gems,
      finalLuck: g.effectiveLuck(),
      spins: STATS.spins,
      fuses: STATS.fuses,
      mountainsKilled: STATS.mountainsKilled,
      finalLevel: g.mountain.level + 1,
      perksUnlocked: g.unlockedPerks.size - 1,
      collectionSize: g.collection.length,
    }, null, 2));
    console.log('=== AUTOPLAY END ===');
  }, durationMs);
}, { durationMs: durationSec * 1000 });

// Wait for the autoplay to finish + a small buffer for the final logs.
await page.waitForTimeout(durationSec * 1000 + 2000);
await browser.close();

writeFileSync(
  resolve(projectRoot, '.screenshots/autoplay.json'),
  JSON.stringify({ duration: durationSec, console: consoleMsgs }, null, 2)
);
console.log(`\nAutoplay complete — ${consoleMsgs.length} console messages\n`);
for (const m of consoleMsgs) console.log(m);
