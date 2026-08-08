/** CAPTURE-ALL — one life through the current build, light mode, every screen
    screenshotted for the app handbook. Tap-only, per rule 0a. */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 } });

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-ca-${Math.random().toString(36).slice(2)}.json`;
  const args = ['-s','-o',tmp,'-w','%{http_code}','-m','30','-X',req.method(),req.url()];
  for (const [k,v] of Object.entries(await req.allHeaders()))
    if (['apikey','authorization','content-type','prefer'].includes(k.toLowerCase())) args.push('-H',`${k}: ${v}`);
  const b = req.postData(); if (b) args.push('--data-binary', b);
  try {
    const st = Number(execFileSync('curl', args).toString().trim() || 500);
    await route.fulfill({ status: st, contentType: 'application/json', body: readFileSync(tmp) });
  } catch { await route.fulfill({ status: 599, contentType: 'application/json', body: '{}' }); }
};
if (process.env.CURL_BRIDGE === '1') await ctx.route('**supabase.co/**', bridge);
else await ctx.route('**supabase.co/functions/v1/**', bridge);

const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

const snap = async (name, ms = 900) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `out/cap-${name}.png` });
  console.log('SHOT', name);
};
const logFood = async (q, meal, p = 1) => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill(q);
  const first = page.locator('[data-testid^="add-"]').first();
  await first.waitFor({ timeout: 20000 });
  await first.click();
  await page.getByTestId('log-cta').waitFor({ timeout: 6000 });
  await page.getByTestId(`portion-${p}`).click().catch(() => {});
  await page.getByTestId(`meal-${meal}`).click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 9000 });
};

const EMAIL = `cap-${Date.now()}@fuel.test`;
console.log('ACCOUNT ' + EMAIL);

await page.getByTestId('boot-splash').waitFor({ timeout: 4000 });
await snap('01-boot', 400);
await page.getByText('The honest way to eat better').waitFor({ timeout: 8000 });
await snap('02-welcome');
await page.getByTestId('auth-email').click();
await snap('03-auth', 700);
await page.getByTestId('email-input').fill(EMAIL);
await page.getByTestId('password-input').fill('e2e-Fuel-2026!x');
await page.getByTestId('auth-submit').click();
await page.getByText('What are we working toward?').waitFor({ timeout: 25000 });
await snap('04-goal');
await page.getByTestId('goal-lose').click();
await page.getByTestId('goal-continue').click();
await page.getByTestId('age-input').fill('28');
await page.getByTestId('height-input').fill('165');
await page.getByTestId('weight-input').fill('68.2');
await page.getByTestId('activity-light').click();
await snap('05-about');
await page.getByTestId('about-continue').click();
await page.getByText('TO GO').waitFor({ timeout: 8000 }).catch(() => {});
await snap('06-plan');
await page.getByTestId('start-day1').click();
await page.getByText('TO GO').waitFor({ timeout: 8000 });
await snap('07-today-empty');
await page.getByTestId('tab-log').click();
await snap('08-log-sheet');
await page.locator('input').first().click();
await page.locator('input').first().fill('banana');
await page.locator('[data-testid^="add-"]').first().waitFor({ timeout: 20000 });
await snap('09-search');
await page.locator('[data-testid^="add-"]').first().click();
await page.getByTestId('log-cta').waitFor({ timeout: 6000 });
await snap('10-portion');
await page.getByTestId('meal-breakfast').click();
await page.getByTestId('log-cta').click();
await page.getByText("TODAY'S MEALS").waitFor({ timeout: 9000 });
await logFood('apple juice', 'lunch');
await logFood('beef', 'dinner', 2);
await page.getByTestId('water-add').click();
await page.getByTestId('water-add').click();
await snap('11-today-logged');
await page.getByTestId('nutrition-card').click();
await page.getByTestId('fibre-detail').waitFor({ timeout: 6000 });
await snap('12-detail-sheet');
await page.getByTestId('detail-close').click();
await page.waitForTimeout(500);
await page.getByTestId('tab-trends').click();
await page.getByTestId('week-summary').waitFor({ timeout: 9000 });
await snap('13-progress-week');
await page.getByTestId('week-log-weight').click();
await page.getByTestId('weight-kg-input').fill('68.2');
await page.getByTestId('weight-save').click();
await page.waitForTimeout(900);
await page.getByTestId('seg-1').click();
await page.getByText('trend weight today').waitFor({ timeout: 9000 }).catch(() => {});
await snap('14-progress-weight');
await page.getByTestId('seg-2').click();
await snap('15-progress-energy');
await page.getByTestId('seg-3').click();
await snap('16-progress-consistency');
await page.getByTestId('tab-you').click();
await page.getByText('CURRENT GOAL').waitFor({ timeout: 9000 });
await snap('17-profile');

// cleanup
await page.getByTestId('row-delete').click();
await page.getByTestId('confirm-delete').click();
await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
await browser.close();
console.log(process.exitCode ? 'CAPTURE HAD FAILURES' : 'CAPTURE COMPLETE');
