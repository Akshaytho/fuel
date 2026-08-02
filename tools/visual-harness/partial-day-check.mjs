/**
 * PARTIAL-DAY CHECK (spec 0012) — the bug that quietly cut a user's target.
 *
 * A real person logs a full week, except Thursday when she logged breakfast
 * and got busy. Before this fix, that forgotten dinner dropped her measured
 * TDEE by 235 kcal/day and her proposed target from 1,850 to 1,662 — a cut she
 * never earned, that compounds week over week.
 *
 * This walks it by taps: build the week, open the Report, and assert that
 *   1. the week pills show THREE states (the half day is neither logged nor missed),
 *   2. the report names the excluded day out loud,
 *   3. tapping "That day is right" restores the old arithmetic — her word wins,
 *   4. and the choice survives killing the app.
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }

// Mon 2026-09-07 … the report reads the last COMPLETE week, so we live that
// week and then step into the next one to read it.
const at = (n, h, m = 0) => new Date(Date.UTC(2026, 8, 7 + n, h, m));
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });
await ctx.clock.setFixedTime(at(0, 8, 0));

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-pd-${Math.random().toString(36).slice(2)}.json`;
  const args = ['-s', '-o', tmp, '-w', '%{http_code}', '-m', '30', '-X', req.method(), req.url()];
  for (const [k, v] of Object.entries(await req.allHeaders())) {
    if (['apikey', 'authorization', 'content-type', 'prefer'].includes(k.toLowerCase())) args.push('-H', `${k}: ${v}`);
  }
  const body = req.postData();
  if (body) args.push('--data-binary', body);
  try {
    const status = Number(execFileSync('curl', args).toString().trim() || 500);
    await route.fulfill({ status, contentType: 'application/json', body: readFileSync(tmp) });
  } catch (e) {
    await route.fulfill({ status: 599, contentType: 'application/json', body: JSON.stringify({ error: String(e).slice(0, 90) }) });
  }
};
if (process.env.CURL_BRIDGE === '1') await ctx.route('**supabase.co/**', bridge);
else await ctx.route('**supabase.co/functions/v1/**', bridge);

const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

let shots = 0;
const shot = async (n) => { shots += 1; await page.waitForTimeout(1100); await page.screenshot({ path: `out/pd-${String(shots).padStart(2, '0')}-${n}.png` }); };
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/pd-FAIL-${name.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
};

const logFood = async (query, meal, portionIdx = 1) => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill(query);
  await page.waitForTimeout(2200);
  const first = page.locator('[data-testid^="add-"]').first();
  await first.waitFor({ timeout: 8000 });
  await first.click();
  await page.getByTestId('log-cta').waitFor({ timeout: 6000 });
  await page.getByTestId(`portion-${portionIdx}`).click().catch(() => {});
  await page.getByTestId(`meal-${meal}`).click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 8000 });
};
const weighIn = async (kg) => {
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('log-weight-cta').first().click();
  await page.getByTestId('weight-kg-input').fill(String(kg));
  await page.getByTestId('weight-save').click();
  await page.waitForTimeout(700);
  await page.getByTestId('tab-today').click();
};

const EMAIL = `partial-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';
console.log('ACCOUNT ' + EMAIL);

await step('onboard, then live Monday properly', async () => {
  await page.getByTestId('boot-splash').waitFor({ timeout: 5000 });
  await page.getByTestId('auth-email').click({ timeout: 9000 });
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill(PW);
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
  await weighIn(71.0);
  await logFood('beef', 'breakfast', 3);
  await logFood('beef', 'lunch', 3);
});

// Tue, Wed: full days. Thu: breakfast only — the day the bug lived on.
for (const [n, label] of [[1, 'tue'], [2, 'wed']]) {
  await step(`live ${label} in full`, async () => {
    await ctx.clock.setFixedTime(at(n, 9, 0));
    await page.reload();
    await page.getByText(new RegExp(`Day ${n + 1}`)).waitFor({ timeout: 12000 });
    await logFood('beef', 'breakfast', 3);
    await logFood('beef', 'dinner', 3);
  });
}

await step('THURSDAY: she logs breakfast and gets busy', async () => {
  await ctx.clock.setFixedTime(at(3, 8, 30));
  await page.reload();
  await page.getByText(/Day 4/).waitFor({ timeout: 12000 });
  await logFood('banana', 'breakfast', 0);      // small — well under half target
  await shot('thu-breakfast-only');
});

for (const [n, label] of [[4, 'fri'], [5, 'sat'], [6, 'sun']]) {
  await step(`live ${label} in full`, async () => {
    await ctx.clock.setFixedTime(at(n, 9, 0));
    await page.reload();
    await page.getByText(new RegExp(`Day ${n + 1}`)).waitFor({ timeout: 12000 });
    await logFood('beef', 'breakfast', 3);
    await logFood('beef', 'dinner', 3);
    if (n === 6) await weighIn(70.6);
  });
}

await step('the week strip does not claim Thursday as a logged day', async () => {
  await page.waitForTimeout(600);
  await shot('sun-week-strip');
  const wk = (await page.getByTestId('week-summary').textContent()).trim();
  console.log(`WEEK STRIP: "${wk}"`);
  if (!/6 of 7 days logged this week/.test(wk)) {
    throw new Error(`week strip counted the half-logged Thursday: ${wk}`);
  }
  const dashed = await page.getByTestId('week-dot-3').evaluate((el) => getComputedStyle(el).borderStyle);
  console.log(`THU dot borderStyle = ${dashed}`);
  if (!/dashed/.test(dashed)) throw new Error('Thursday is not drawn as a half-logged day');
});

let before = null;
await step('next Monday: the Report excludes Thursday and SAYS SO', async () => {
  await ctx.clock.setFixedTime(at(7, 9, 0));
  await page.reload();
  await page.getByText(/Day 8/).waitFor({ timeout: 12000 });
  await page.getByTestId('tab-report').click();
  await page.getByTestId('report-headline').waitFor({ timeout: 8000 });
  await shot('report-excluded');
  const days = (await page.getByTestId('report-days').textContent()).trim();
  console.log(`REPORT days logged: ${days}`);
  if (days !== '6/7') throw new Error(`report counted the half day: ${days}`);
  const ex = (await page.getByTestId('report-excluded').innerText()).replace(/\n/g, ' | ');
  console.log(`REPORT excluded block: ${ex}`);
  if (!/half-logged/.test(ex)) throw new Error('report does not name the excluded day');
  if (!/Thursday/.test(ex)) throw new Error('report does not say WHICH day: ' + ex);
  const body = await page.locator('body').innerText();
  before = (body.match(/([\d,]+)\s*\n?\s*kcal/i) ?? [])[0] ?? null;
  const pill = await page.getByTestId('report-pill-3').evaluate((el) => getComputedStyle(el).backgroundColor);
  console.log(`THU report pill = ${pill}`);
});

await step("her word wins: confirming the day changes the maths", async () => {
  const targetBefore = (await page.getByTestId('report-next-kcal').textContent().catch(() => null))?.trim() ?? null;
  console.log(`proposed BEFORE confirm: ${targetBefore}`);
  await page.getByTestId('confirm-day-2026-09-10').click();
  await page.waitForTimeout(800);
  await shot('report-after-confirm');
  const stillThere = await page.getByTestId('report-excluded').isVisible().catch(() => false);
  if (stillThere) throw new Error('the day is still listed as excluded after confirming');
  const days = (await page.getByTestId('report-days').textContent()).trim();
  console.log(`REPORT days logged after confirm: ${days}`);
  if (days !== '7/7') throw new Error(`confirm did not restore the day: ${days}`);
  const targetAfter = (await page.getByTestId('report-next-kcal').textContent().catch(() => null))?.trim() ?? null;
  console.log(`proposed AFTER confirm:  ${targetAfter}`);
  if (targetBefore !== null && targetBefore === targetAfter) {
    throw new Error('confirming a day changed nothing — the exclusion was not affecting the maths');
  }
});

await step('the choice survives killing the app', async () => {
  await page.reload();
  await page.getByText(/Day 8/).waitFor({ timeout: 12000 });
  await page.getByTestId('tab-report').click();
  await page.getByTestId('report-headline').waitFor({ timeout: 8000 });
  const days = (await page.getByTestId('report-days').textContent()).trim();
  console.log(`REPORT days logged after relaunch: ${days}`);
  if (days !== '7/7') throw new Error('the confirmation did not persist');
});

await step('cleanup', async () => {
  await page.getByTestId('tab-you').click();
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
});

await browser.close();
console.log(process.exitCode ? 'PARTIAL-DAY CHECK HAD FAILURES' : 'PARTIAL-DAY CHECK FULLY PASSED');
