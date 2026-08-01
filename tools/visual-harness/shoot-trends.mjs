import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 440, height: 860 }, deviceScaleFactor: 2 });
await page.goto('file:///tmp/design-trends.html');
await page.waitForTimeout(600);
await page.screenshot({ path: 'out/design-trends.png', fullPage: true });
await browser.close();
console.log('ok');
