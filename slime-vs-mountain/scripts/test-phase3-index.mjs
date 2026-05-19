// Phase 3 smoke test — Index overlay + milestones.
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
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// Force-discover the first 6 variants from ALL_VARIANT_IDS so we cross the
// 5-unique milestone (and the 5th claim path).
const before = await page.evaluate(() => {
  const g = window.__game;
  const ids = g.ALL_VARIANT_IDS ?? null;
  return {
    invGoldBefore: g.inventory?.gold ?? null,
    collectionSizeBefore: g.collection.size,
    claimedBefore: [...(g.claimedMilestones ?? [])],
  };
});
console.log('BEFORE:', JSON.stringify(before));

// Drive milestones by acquiring across distinct variants.
await page.evaluate(() => {
  const g = window.__game;
  // Use the engine's own variant ids list. The test poke uses any new variant.
  const ids = [
    'green', 'amber', 'pebble', 'sprout', 'mudder', 'puddle', 'twig', 'mossy',
    'drizzle', 'sandy', 'acorn', 'blue', 'purple', 'coral', 'mint', 'sunny',
    'cinder', 'cobalt', 'frost', 'magma', 'storm', 'sapphire', 'emerald',
    'ruby', 'onyx', 'quartz', 'phantom', 'titanium', 'diamond', 'void',
  ];
  for (const id of ids) g.acquireSlime(id);
});
await page.waitForTimeout(150);

const after = await page.evaluate(() => {
  const g = window.__game;
  return {
    collectionSize: g.collection.size,
    claimed: [...g.claimedMilestones],
    inv: { ...g.inventory },
    toast: g.toast ? g.toast.text : null,
  };
});
console.log('AFTER ACQUIRE ALL:', JSON.stringify(after, null, 2));

// Open the Index overlay and screenshot
await page.evaluate(() => { window.__game.showIndex = true; });
await page.waitForTimeout(100);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/phase3-index.png') });

console.log('ok');
await browser.close();
