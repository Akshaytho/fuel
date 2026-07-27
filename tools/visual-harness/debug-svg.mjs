import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)));
page.on('console', m => console.log('CONSOLE', m.type() + ':', m.text().slice(0,200)));
await page.goto('file://' + process.cwd() + '/out/index.html');
await page.waitForTimeout(1000);
const info = await page.evaluate(() => ({
  svgs: document.querySelectorAll('svg').length,
  circles: document.querySelectorAll('circle').length,
  firstSvg: document.querySelector('svg')?.outerHTML.slice(0, 300) ?? 'NONE',
}));
console.log(JSON.stringify(info, null, 1).slice(0, 600));
await browser.close();
