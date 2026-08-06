/**
 * EVIDENCE PACK (spec 0017) — three retention mechanics from docs/research/0004,
 * lived by taps:
 *
 *   E-06  hourly go-tos — the 7:30 food leads at 7:30, the 12:30 food at 12:30
 *   E-05  the weekly floor — "3+ days" line appears at 3 logged days, never before
 *   E-04  quiet re-entry — 45 days away → a card with NO numbers in it
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const at = (n, h, m = 0) => new Date(Date.UTC(2026, 8, 7 + n, h, m));   // Mon 2026-09-07
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });
await ctx.clock.setFixedTime(at(0, 7, 30));

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-ep-${Math.random().toString(36).slice(2)}.json`;
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

let shots = 0;
const shot = async (n) => { shots += 1; await page.waitForTimeout(1100); await page.screenshot({ path: `out/ep-${String(shots).padStart(2,'0')}-${n}.png` }); };
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/ep-FAIL-${name.slice(0,20).replace(/[^a-z0-9]/gi,'_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
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
const closeSheet = async () => { await page.mouse.click(195, 40); await page.waitForTimeout(500); };
const firstGoTo = async () => {
  await page.getByTestId('tab-log').click();
  await page.waitForTimeout(800);
  const rows = page.locator('[data-testid^="quickadd-"]');
  await rows.first().waitFor({ timeout: 9000 });
  // the go-to's food name lives two levels up from the + button
  const name = (await rows.first().locator('xpath=../..').innerText()).split('\n')[0];
  await closeSheet();
  return name;
};

const EMAIL = `ep-${Date.now()}@fuel.test`;
console.log('ACCOUNT ' + EMAIL);

await step('onboard, then three days of a morning food and a midday food', async () => {
  await page.getByTestId('boot-splash').waitFor({ timeout: 5000 });
  await page.getByTestId('auth-email').click({ timeout: 9000 });
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill('e2e-Fuel-2026!x');
  await page.getByTestId('auth-submit').click();
  await page.getByText('What are we working toward?').waitFor({ timeout: 25000 });
  await page.getByTestId('goal-lose').click();
  await page.getByTestId('goal-continue').click();
  await page.getByTestId('age-input').fill('31');
  await page.getByTestId('height-input').fill('162');
  await page.getByTestId('weight-input').fill('71');
  await page.getByTestId('activity-light').click();
  await page.getByTestId('about-continue').click();
  await page.getByTestId('start-day1').click();
  await page.getByText('TO GO').waitFor({ timeout: 8000 });
  for (let n = 0; n < 3; n += 1) {
    if (n > 0) {
      await ctx.clock.setFixedTime(at(n, 7, 30));
      await page.reload();
      await page.getByText(new RegExp(`Day ${n + 1}`)).waitFor({ timeout: 14000 });
    }
    await logFood('banana', 'breakfast', 1);            // the 7:30 food
    await ctx.clock.setFixedTime(at(n, 12, 30));
    await logFood('apple juice', 'breakfast', 1);       // the 12:30 food, same slot
    // dinner is eaten AT DINNER TIME — the first run of this harness logged it
    // at 12:30 wall-clock and correctly got it ranked as a midday food, which
    // is the feature working, not the test passing
    await ctx.clock.setFixedTime(at(n, 19, 30));
    await logFood('beef', 'dinner', 2);                 // makes the day full (E-05 needs 3 full days)
  }
});

await step('E-06: at 7:30 the morning food leads', async () => {
  await ctx.clock.setFixedTime(at(3, 7, 30));
  await page.reload();
  await page.getByText(/Day 4/).waitFor({ timeout: 14000 });
  const name = await firstGoTo();
  console.log(`7:30 first go-to: "${name}"`);
  if (!/banana/i.test(name)) throw new Error('morning list is not led by the morning food: ' + name);
});

await step('E-06: at 12:30 the midday food leads — same meal slot, different hour', async () => {
  await ctx.clock.setFixedTime(at(3, 12, 30));
  await page.reload();
  await page.getByText(/Day 4/).waitFor({ timeout: 14000 });
  const name = await firstGoTo();
  console.log(`12:30 first go-to: "${name}"`);
  await shot('hourly-gotos');
  if (!/apple juice/i.test(name)) throw new Error('midday list is not led by the midday food: ' + name);
});

await step('E-05: three logged days light up the weekly floor on Progress', async () => {
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('week-summary').waitFor({ timeout: 9000 });
  await page.getByTestId('weekly-floor').waitFor({ timeout: 6000 });
  const line = (await page.getByTestId('weekly-floor').innerText()).trim();
  console.log(`FLOOR LINE: "${line}"`);
  await shot('weekly-floor');
  if (!/3\+ days a week/.test(line)) throw new Error('floor line wrong: ' + line);
  if (!/you.re there/i.test(line)) throw new Error('floor line does not affirm: ' + line);
  await page.getByTestId('tab-today').click();
  await page.waitForTimeout(600);
});

await step('E-04: 45 days away → a comeback card with NO numbers in it', async () => {
  await ctx.clock.setFixedTime(at(3 + 45, 9, 0));
  await page.reload();
  await page.getByTestId('comeback-card').waitFor({ timeout: 16000 });
  const card = (await page.getByTestId('comeback-card').innerText()).replace(/\n/g, ' | ');
  console.log(`QUIET CARD: "${card}"`);
  await shot('quiet-reentry');
  if (!/Good to see you/.test(card)) throw new Error('not the quiet card: ' + card);
  if (/\d/.test(card)) throw new Error('the quiet card contains a NUMBER: ' + card);
  if (/best run/i.test(card)) throw new Error('the quiet card brags about an old streak: ' + card);
  // and the floor line must NOT be lurking on Progress as a judgment
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('week-summary').waitFor({ timeout: 9000 });
  if (await page.getByTestId('weekly-floor').isVisible().catch(() => false)) {
    throw new Error('weekly floor line shown on an empty week');
  }
  await page.getByTestId('tab-today').click();
  await page.waitForTimeout(600);
});

await step('cleanup', async () => {
  await page.getByTestId('tab-you').click();
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
});

await browser.close();
console.log(process.exitCode ? 'EVIDENCE PACK HAD FAILURES' : 'EVIDENCE PACK FULLY PASSED');
