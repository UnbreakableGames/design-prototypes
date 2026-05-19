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

const counts = await page.evaluate(() => {
  const g = window.__game;
  // ALL_VARIANT_IDS is module-level; reach it via SLIME_VARIANTS-like surface.
  // The mountain reel knows; just count Object.keys on collection size info.
  // Easiest: trigger rollOnce many times with rng=0 to bias toward rarest,
  // but skip that — instead just acquire every variant id we know about.
  const ids = [
    'green','pebble','sprout','mudder','puddle','twig','mossy','drizzle','sandy','acorn',
    'blue','purple','amber','coral','mint','sunny','cinder','cobalt',
    'frost','magma','storm','sapphire','emerald','ruby',
    'onyx','quartz','phantom','titanium',
    'diamond','void',
    'lucky','crafty','pondy',
    'icy','aegis','wicked',
    'ninja','geode','stormy',
    'bucky','unicorn',
    'wizzy','halo',
    'ufo','blackhole',
    'sharky','dino',
    'drakey',
    'galaxy',
    'meaty',
    'zappy',
  ];
  for (const id of ids) g.acquireSlime(id, 'none');
  return { acquired: ids.length, collectionSize: g.collection.size };
});
console.log('VARIANTS:', JSON.stringify(counts));

// Open the Index to screenshot the new roster.
await page.evaluate(() => {
  const g = window.__game;
  g.showIndex = true;
  g.indexTab = 'none';
  g.indexScroll = 0;
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/50-slimes-top.png') });

await page.evaluate(() => { window.__game.indexScroll = 400; });
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/50-slimes-bottom.png') });

console.log('ok');
await browser.close();
