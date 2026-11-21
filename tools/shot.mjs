// One screenshot of the running app, for the visual review loop.
// Usage: node tools/shot.mjs <url> <out.png> [width] [height] [waitMs] [scale]
// The app reads ?t=<minute>&scene=<id>&select=<station> so a shot is repeatable.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const [url, out, w = '1600', h = '1000', wait = '2500', scale = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
if (errors.length) {
  console.error('console errors:\n' + [...new Set(errors)].slice(0, 8).join('\n'));
  process.exit(1);
}
