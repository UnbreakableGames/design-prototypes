import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const url = process.env.URL ?? 'http://localhost:5175/';
const outPath = resolve(projectRoot, process.env.OUT ?? '.screenshots/latest.png');
const waitMs = Number(process.env.WAIT_MS ?? 250);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 620 } });
const page = await ctx.newPage();

const consoleMsgs = [];
const errors = [];
page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(waitMs);

// Optional SETUP="...js..." — runs arbitrary JS in page context with access to window.__game.
if (process.env.SETUP) {
  await page.evaluate(process.env.SETUP);
  await page.waitForTimeout(Number(process.env.SETUP_WAIT_MS ?? 500));
}

// Optional CLICK="x,y;x,y" — click each coord in order, waiting CLICK_WAIT_MS between.
if (process.env.CLICK) {
  const clickWait = Number(process.env.CLICK_WAIT_MS ?? 200);
  const canvas = await page.$('#game');
  const box = await canvas.boundingBox();
  for (const pair of process.env.CLICK.split(';')) {
    const [cx, cy] = pair.split(',').map(Number);
    await page.mouse.click(box.x + cx, box.y + cy);
    await page.waitForTimeout(clickWait);
  }
}

await page.screenshot({ path: outPath, fullPage: false });
await browser.close();

const summary = {
  url,
  outPath,
  errors,
  console: consoleMsgs,
};
writeFileSync(resolve(projectRoot, '.screenshots/last-run.json'), JSON.stringify(summary, null, 2));

if (errors.length) {
  console.error('PAGE ERRORS:', errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`OK  screenshot → ${outPath}`);
  if (consoleMsgs.length) console.log(`    ${consoleMsgs.length} console msg(s)`);
}
