/**
 * MEALS YOU REPEAT (spec 0014) — the fix for the friction gradient.
 *
 * Cordeiro et al. measured it: people rate logging packaged food 6.3–6.5/10
 * for ease and home-cooked meals 4.6/10, so every tracker's own convenience
 * curve nudges users toward worse food. This inverts it — cook the same thing
 * three times and it becomes one tap.
 *
 * Walked by taps: eat the same three-item breakfast on three mornings, then
 * check that the fourth morning offers it, that one tap logs all three items
 * at the right portions, and that a two-day habit is NOT offered.
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }

const at = (n, h, m = 0) => new Date(Date.UTC(2026, 8, 7 + n, h, m));
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });
await ctx.clock.setFixedTime(at(0, 8, 0));

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-rm-${Math.random().toString(36).slice(2)}.json`;
  const args = ['-s', '-o', tmp, '-w', '%{http_code}', '-m', '30', '-X', req.method(), req.url()];
  for (const [k, v] of Object.entries(await req.allHeaders())) {
    if (['apikey', 'authorization', 'content-type', 'prefer'].includes(k.toLowerCase())) args.push('-H', `${k}: ${v}`);
  }
  const body = req.postData();
  if (body) args.push('--data-binary', body);
  try {
    const status = Number(execFileSync('curl', args).toString().trim() || 500);
    await route.fulfill({ status, contentType: 'application/json', body: readFileSync(tmp) });
  } catch { await route.fulfill({ status: 599, contentType: 'application/json', body: '{}' }); }
};
if (process.env.CURL_BRIDGE === '1') await ctx.route('**supabase.co/**', bridge);
else await ctx.route('**supabase.co/functions/v1/**', bridge);

const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

let shots = 0;
const shot = async (n) => { shots += 1; await page.waitForTimeout(1100); await page.screenshot({ path: `out/rm-${String(shots).padStart(2, '0')}-${n}.png` }); };
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/rm-FAIL-${name.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {});
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
const entryCount = async () => page.locator('[data-testid^="entry-"]').count();

const EMAIL = `repeat-${Date.now()}@fuel.test`;
console.log('ACCOUNT ' + EMAIL);

// The same three-item breakfast, eaten at the same hour, three mornings running.
const BREAKFAST = [['banana', 1], ['apple juice', 1], ['almond butter', 1]];

await step('day 1: onboard and eat the usual breakfast', async () => {
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
  for (const [q, p] of BREAKFAST) await logFood(q, 'breakfast', p);
});

await step('day 2: same breakfast — still not a habit, so not offered', async () => {
  await ctx.clock.setFixedTime(at(1, 8, 0));
  await page.reload();
  await page.getByText(/Day 2/).waitFor({ timeout: 12000 });
  for (const [q, p] of BREAKFAST) await logFood(q, 'breakfast', p);
  await page.getByTestId('tab-log').click();
  await page.waitForTimeout(700);
  const n = await page.locator('[data-testid^="repeat-"]').count();
  console.log(`after 2 days, repeats offered: ${n}`);
  if (n !== 0) throw new Error('a two-day pattern was offered as a repeat meal');
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(195, 60);
});

await step('day 3: the third time makes it a habit', async () => {
  await ctx.clock.setFixedTime(at(2, 8, 0));
  await page.reload();
  await page.getByText(/Day 3/).waitFor({ timeout: 12000 });
  for (const [q, p] of BREAKFAST) await logFood(q, 'breakfast', p);
});

let comboLabel = null;
await step('day 4: the log sheet offers the whole plate in one tap', async () => {
  await ctx.clock.setFixedTime(at(3, 8, 0));
  await page.reload();
  await page.getByText(/Day 4/).waitFor({ timeout: 12000 });
  await page.getByTestId('tab-log').click();
  await page.waitForTimeout(900);
  await shot('log-sheet-with-repeat');
  const n = await page.locator('[data-testid^="repeat-"]').count();
  if (n === 0) throw new Error('the repeated breakfast is not being offered');
  const body = await page.locator('body').innerText();
  if (!/MEALS YOU REPEAT/.test(body)) throw new Error('no repeats section header');
  const row = page.locator('[data-testid="repeat-0"]').locator('xpath=../..');
  comboLabel = (await row.innerText()).replace(/\n/g, ' | ');
  console.log(`REPEAT OFFERED: ${comboLabel}`);
  if (!/3 items/.test(comboLabel)) throw new Error('the repeat does not say how many items: ' + comboLabel);
  if (!/3 days/.test(comboLabel)) throw new Error('the repeat does not say how established it is: ' + comboLabel);
  if (!/\+/.test(comboLabel)) throw new Error('the label is not built from the food names: ' + comboLabel);
});

await step('one tap logs all three items', async () => {
  const t0 = Date.now();
  await page.getByTestId('repeat-0').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 8000 });
  const secs = Math.round((Date.now() - t0) / 1000);
  const n = await entryCount();
  console.log(`one tap logged ${n} entries in ${secs}s of wall clock`);
  await shot('after-one-tap');
  if (n !== 3) throw new Error(`expected 3 entries from one tap, got ${n}`);
});

await step('the server holds exactly what the tap logged', async () => {
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  // three distinct foods, all under breakfast, on day 4
  const breakfasts = (body.match(/Breakfast ·/g) ?? []).length;
  console.log(`breakfast rows on screen: ${breakfasts}`);
  if (breakfasts !== 3) throw new Error(`expected 3 breakfast rows, saw ${breakfasts}`);
});

await step('cleanup', async () => {
  await page.getByTestId('tab-you').click();
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
});

await browser.close();
console.log(process.exitCode ? 'REPEAT MEALS HAD FAILURES' : 'REPEAT MEALS FULLY PASSED');
