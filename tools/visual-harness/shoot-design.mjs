import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1750, height: 860 }, deviceScaleFactor: 2 });
await page.goto('file:///tmp/design-onboarding.html');
await page.waitForTimeout(600);
await page.screenshot({ path: 'out/design-onboarding.png', fullPage: true });
await browser.close();
console.log('ok');
