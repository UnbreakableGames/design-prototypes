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

// Acquire a juicy mix of mutations so the cell badges + detail card show.
await page.evaluate(() => {
  const g = window.__game;
  // Greenie: many copies + multiple mutations.
  g.acquireSlime('green', 'none');
  g.acquireSlime('green', 'none');
  g.acquireSlime('green', 'big');
  g.acquireSlime('green', 'big');
  g.acquireSlime('green', 'shiny');
  g.acquireSlime('green', 'huge');
  // Some other variants for variety.
  g.acquireSlime('amber', 'big');
  g.acquireSlime('pebble', 'shiny');
  g.acquireSlime('sprout', 'inverted');
  // Add some XP so detail card looks alive.
  const v = g.collection.get('green');
  v.level = 3;
  v.xp = 120;
  g.selectedVariantId = 'green';
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/mutations-collection.png') });

// Now open the tree to see the new mutation dice nodes.
await page.evaluate(() => {
  const g = window.__game;
  g.inventory.gold = 50000;
  g.inventory.gems = 5000;
  g.inventory.rolls = 500;
  g.unlockedPerks.add('autoSpin');
  g.unlockedPerks.add('bigDice');     // make adjacent nodes visible
  g.unlockedPerks.add('shinyDice');
  g.unlockedPerks.add('hugeDice');
  g.unlockedPerks.add('bonusChance1');
  g.unlockedPerks.add('bonusChance2');
  g.unlockedPerks.add('luckMul1');
  g.showTree = true;
  g.treeZoom = 1.4;
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/mutations-tree.png') });

console.log('ok');
await browser.close();
