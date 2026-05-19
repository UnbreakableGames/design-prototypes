// Phase 4 smoke test — food drops, click-to-feed, XP, level-up.
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
await page.waitForTimeout(300);
await page.evaluate(() => { localStorage.removeItem('svm-save'); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// Force-spawn pizza (rarest, 400xp) by patching Math.random to 0 for the
// duration of one applyImpact call. Clear goons first so the impact reaches
// the cliff (goons act as shields and absorb the hit).
const forced = await page.evaluate(() => {
  const g = window.__game;
  g.selectedVariantId = 'green';
  g.goons = []; // remove goons so applyImpact doesn't short-circuit on them
  const orig = Math.random;
  let n = 0;
  // All <0.5 returns ensure every food roll succeeds; best = pizza (rarest).
  Math.random = () => { n++; return 0.0000001; };
  try {
    g.applyImpact(g.mountain.x + 4, g.mountain.topY + 60, 1, 'physical', null, false);
  } finally {
    Math.random = orig;
  }
  const greenie = g.collection.get('green');
  return {
    randomCalls: n,
    foodCount: g.foodDrops.length,
    foodKinds: g.foodDrops.map((f) => f.kind),
    firstFood: g.foodDrops[0] ? { x: g.foodDrops[0].x, y: g.foodDrops[0].y, kind: g.foodDrops[0].kind } : null,
    greenLevel: greenie.level,
    greenXp: greenie.xp,
  };
});
console.log('FORCED SPAWN:', JSON.stringify(forced));

// Dispatch a real click on the food coords through the canvas.
const fed = await page.evaluate(async () => {
  const g = window.__game;
  const f = g.foodDrops[0];
  if (!f) return { error: 'no food' };
  const canvas = document.querySelector('canvas');
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + (f.x / 960) * rect.width;
  const cy = rect.top + (f.y / 540) * rect.height;
  canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: cx, clientY: cy, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: cx, clientY: cy, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));
  const greenie = g.collection.get('green');
  return {
    foodCount: g.foodDrops.length,
    greenLevel: greenie.level,
    greenXp: greenie.xp,
    toast: g.toast?.text ?? null,
  };
});
console.log('AFTER CLICK-TO-FEED:', JSON.stringify(fed));

// Also screenshot a state with several food drops visible.
await page.evaluate(() => {
  const g = window.__game;
  g.selectedVariantId = 'green';
  g.goons = [];
  const orig = Math.random;
  Math.random = () => 0.0000001;
  try {
    for (let i = 0; i < 5; i++) {
      g.applyImpact(g.mountain.x + 4, g.mountain.topY + 30 + i * 40, 1, 'physical', null, false);
    }
  } finally {
    Math.random = orig;
  }
});
await page.waitForTimeout(150);
await page.screenshot({ path: resolve(projectRoot, '.screenshots/phase4-food.png') });

console.log('ok');
await browser.close();
