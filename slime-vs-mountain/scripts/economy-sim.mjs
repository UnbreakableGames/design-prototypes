// Headless autoplay economy sim. Chunked so node sees progress.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const URL = process.env.URL ?? 'http://localhost:5175/';
const GAME_MINUTES = Number(process.env.GAME_MINUTES ?? 30);
const SAMPLE_EVERY_SEC = 30;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 620 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR:', String(e)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(400);

await page.evaluate(() => {
  const g = window.__game;
  g.autoplay = true;
  window.__sim = {
    gameSec: 0,
    cumGoldEarned: 0,
    cumGemsEarned: 0,
    lastGold: g.inventory.gold,
    lastGems: g.inventory.gems,
    lastLevel: g.mountain.level,
    lastMaxHp: g.mountain.maxHp,
    mountainsKilled: 0,
    cumHpCleared: 0,
    fuseCount: 0,
    spinCount: 0,
  };
  const origFuse = g.fuseSlimes.bind(g);
  g.fuseSlimes = function(...a) {
    const r = origFuse(...a);
    if (r) window.__sim.fuseCount++;
    return r;
  };
  const origSpin = g.spin.bind(g);
  g.spin = function(...a) {
    const before = g.spinFlash;
    const r = origSpin(...a);
    if (before === 0 && g.spinFlash > 0) window.__sim.spinCount++;
    return r;
  };
});

const totalGameSec = GAME_MINUTES * 60;
const samples = [];
const realStart = Date.now();
console.log(`Simulating ${GAME_MINUTES} game-minutes (${totalGameSec}s)...`);

for (let chunkStart = 0; chunkStart < totalGameSec; chunkStart += SAMPLE_EVERY_SEC) {
  const sample = await page.evaluate((advanceSec) => {
    const g = window.__game;
    const sim = window.__sim;
    const dt = 1 / 60;
    const stepGameSec = dt * 4;
    const steps = Math.ceil(advanceSec / stepGameSec);
    for (let i = 0; i < steps; i++) {
      g.update(dt);
      sim.gameSec += stepGameSec;
      if (g.inventory.gold > sim.lastGold) sim.cumGoldEarned += g.inventory.gold - sim.lastGold;
      if (g.inventory.gems > sim.lastGems) sim.cumGemsEarned += g.inventory.gems - sim.lastGems;
      sim.lastGold = g.inventory.gold;
      sim.lastGems = g.inventory.gems;
      if (g.mountain.level > sim.lastLevel) {
        sim.cumHpCleared += sim.lastMaxHp;
        sim.mountainsKilled++;
        sim.lastLevel = g.mountain.level;
      }
      sim.lastMaxHp = g.mountain.maxHp;
    }
    return {
      t: Math.round(sim.gameSec),
      gold: Math.floor(g.inventory.gold),
      gems: g.inventory.gems,
      luck: g.effectiveLuck(),
      cumGoldEarned: Math.floor(sim.cumGoldEarned),
      cumGemsEarned: sim.cumGemsEarned,
      mountainsKilled: sim.mountainsKilled,
      mountainLevel: g.mountain.level + 1,
      cumHpCleared: Math.round(sim.cumHpCleared),
      spins: sim.spinCount,
      fuses: sim.fuseCount,
      perksUnlocked: g.unlockedPerks.size - 1,
      collectionSize: g.collection.length,
      spitterLimit: g.effectiveSpitterLimit(),
      runnerLimit: g.effectiveRunnerLimit(),
    };
  }, SAMPLE_EVERY_SEC);
  samples.push(sample);
  const realSoFar = ((Date.now() - realStart) / 1000).toFixed(1);
  console.log(
    `t=${String(sample.t).padStart(4)}s real=${realSoFar.padStart(5)}s ` +
    `gold=${String(sample.gold).padStart(5)} gems=${String(sample.gems).padStart(4)} ` +
    `cumG=${String(sample.cumGoldEarned).padStart(5)} cumGm=${String(sample.cumGemsEarned).padStart(4)} ` +
    `mts=${sample.mountainsKilled} lvl${sample.mountainLevel} ` +
    `perks=${String(sample.perksUnlocked).padStart(2)} coll=${String(sample.collectionSize).padStart(3)} ` +
    `${sample.spitterLimit}sp/${sample.runnerLimit}rn f=${sample.fuses} s=${sample.spins}`,
  );
}

mkdirSync(resolve(projectRoot, '.screenshots'), { recursive: true });
writeFileSync(
  resolve(projectRoot, '.screenshots/economy-sim.json'),
  JSON.stringify({ samples }, null, 2),
);

await browser.close();
console.log('\nDone.');
