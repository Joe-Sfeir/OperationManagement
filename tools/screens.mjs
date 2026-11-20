// Screenshot helper for the visual review loop (brief, section 6).
// Usage: node tools/screens.mjs <url> <outPrefix>
//   -> <outPrefix>-1600x1000.png and <outPrefix>-390x844.png, both at deviceScaleFactor 2.
// Uses the pre-installed Playwright. Fails if the page logs a console error.
import { createRequire } from 'node:module';

// require() so a globally installed Playwright (NODE_PATH) is found as well as a local one.
const { chromium } = createRequire(import.meta.url)('playwright');

const [url, outPrefix] = process.argv.slice(2);
if (!url || !outPrefix) {
  console.error('usage: node tools/screens.mjs <url> <outPrefix>');
  process.exit(2);
}

const sizes = [
  { width: 1600, height: 1000 },
  { width: 390, height: 844 },
];

const browser = await chromium.launch();
const errors = [];
for (const s of sizes) {
  const page = await browser.newPage({ viewport: s, deviceScaleFactor: 2 });
  page.on('console', (m) => m.type() === 'error' && errors.push(`${s.width}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${s.width}: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const file = `${outPrefix}-${s.width}x${s.height}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
  await page.close();
}
await browser.close();
if (errors.length) {
  console.error('console errors:\n' + errors.join('\n'));
  process.exit(1);
}
