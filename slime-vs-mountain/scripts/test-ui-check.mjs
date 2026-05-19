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
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

await page.screenshot({ path: resolve(projectRoot, '.screenshots/ui-main-fresh.png') });

// Acquire some so the collection panel has content.
await page.evaluate(() => {
  const g = window.__game;
  for (const id of ['sprout','mudder','twig','mossy','purple','mint','cobalt']) g.acquireSlime(id);
  // Skip any open reveal so we can screenshot main view.
  g.discoveryReveal = null;
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/ui-main-rolled.png') });

await page.evaluate(() => { window.__game.showIndex = true; window.__game.indexScroll = 0; });
await page.waitForTimeout(120);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/ui-index.png') });

console.log('ok');
await browser.close();
