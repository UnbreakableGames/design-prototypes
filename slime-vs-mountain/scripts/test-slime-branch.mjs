// Visual snapshot of the rebuilt skill tree: PLAYER (4 nodes, west) +
// SLIME (long row, east with spitter/runner unlocks interleaved).
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
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

await page.evaluate(() => {
  const g = window.__game;
  g.showTree = true;
  // Unlock the first few nodes of each so the row directions are obvious.
  for (const id of [
    'playerCarry1', 'shootUnlock',
    'spitterSlot1', 'spitterDmg1', 'runnerUnlock', 'spitterSlot2', 'runnerSlot1',
  ]) g.unlockedPerks.add(id);
  g.treeZoom = 1.0;
  g.treePanX = 0;
  g.treePanY = 0;
});
await page.waitForTimeout(150);

const info = await page.evaluate(async () => {
  const mod = await import('/src/skills/tree.ts');
  const byBranch = {};
  for (const n of mod.SKILL_TREE) {
    if (n.branch === 'root') continue;
    byBranch[n.branch] = (byBranch[n.branch] ?? 0) + 1;
  }
  return byBranch;
});
console.log('Nodes per branch:', JSON.stringify(info, null, 2));

await page.screenshot({ path: resolve(projectRoot, '.screenshots/tree-slime-branch.png') });
console.log('ok');
await browser.close();
