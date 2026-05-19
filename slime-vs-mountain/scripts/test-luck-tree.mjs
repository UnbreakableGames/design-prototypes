// Screenshot the skill tree after the luck rebalance — verify the LUCK row
// renders 6 nodes (not 12) and the luckMul sub-branch still sits cleanly.
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const URL = process.env.URL ?? 'http://localhost:5175/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR:', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CON ERR:', m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// Open the skill tree, zoom out + pan NE so the full LUCK row + multipliers
// are framed in one screenshot.
await page.evaluate(() => {
  const g = window.__game;
  g.showTree = true;
  // Unlock the whole luck spine + multipliers so the row renders "lit" — easier
  // to read in the screenshot than a row of dim locked hexes.
  for (const id of ['luckyFoot', 'fourLeaf', 'horseshoe', 'lucky4', 'lucky5', 'lucky6',
                    'luckMul1', 'luckMul2', 'luckMul3', 'luckMul4']) {
    g.unlockedPerks.add(id);
  }
  g.treeZoom = 0.9;
  g.treePanX = -260;
  g.treePanY = 240;
});
await page.waitForTimeout(200);

// Report the live node IDs on the LUCK branch so we know we're rendering the
// updated set, not a stale build.
const info = await page.evaluate(async () => {
  const mod = await import('/src/skills/tree.ts');
  const luckRow = mod.SKILL_TREE.filter((n) => n.branch === 'luck').map((n) => n.id);
  return { luckRow, total: mod.SKILL_TREE.length };
});
console.log('LUCK nodes:', info.luckRow.join(', '));
console.log('Total tree nodes:', info.total);

await page.screenshot({ path: resolve(projectRoot, '.screenshots/luck-tree-after.png') });
console.log('ok');
await browser.close();
