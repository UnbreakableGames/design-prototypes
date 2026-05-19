import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();

const targets = [
  'https://web.archive.org/web/2024/https://slime-rng.fandom.com/wiki/Slimes',
  'https://web.archive.org/web/2024/https://slime-rng.fandom.com/wiki/Upgrades',
  'https://web.archive.org/web/2024/https://slime-rng.fandom.com/wiki/Crafting',
  'https://web.archive.org/web/2024/https://slime-rng.fandom.com/wiki/Rebirths',
  'https://web.archive.org/web/2024/https://slime-rng.fandom.com/wiki/Items',
  'https://web.archive.org/web/2024/https://slime-rng.fandom.com/wiki/Index',
];

for (const url of targets) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const text = await page.evaluate(() => {
      const main = document.querySelector('.mw-parser-output') || document.querySelector('main') || document.body;
      return main.innerText.slice(0, 7000);
    });
    console.log('=== ' + url + ' ===');
    console.log(text);
    console.log('');
  } catch (e) {
    console.log('FAIL ' + url + ' : ' + e.message);
  }
}
await browser.close();
