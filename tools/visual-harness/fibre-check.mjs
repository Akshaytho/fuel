/**
 * FIBRE + DATA HONESTY (spec 0015).
 *
 * The feature is not "show a fibre number" — it is "never claim to know
 * something we don't". Of the 600 seeded foods, 513 report fibre and 87 do
 * not. Reading a missing figure as zero would tell someone they ate badly when
 * the truth is that we have no idea.
 *
 * Walked by taps, against the live database:
 *   1. log a food WITH fibre  → exact total, coverage stated
 *   2. add a food WITHOUT it  → total becomes "at least N g" and names the gap
 *   3. a day of only unknowns → shows "—", never "0 g"
 *   4. the figure reaches the server, as a real value and as a real NULL
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const MGMT = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const sql = (q) => JSON.parse(execFileSync('curl', ['-s', '-X', 'POST',
  'https://api.supabase.com/v1/projects/wccxzcrxdcqvprswdvlu/database/query',
  '-H', `Authorization: Bearer ${MGMT}`, '-H', 'Content-Type: application/json',
  '-H', 'User-Agent: Mozilla/5.0 (Macintosh) Chrome/126.0',
  '--data-binary', JSON.stringify({ query: q })]).toString());

// Pick real foods from the live DB: one that reports fibre, one that doesn't.
const withFibre = sql(`select name, fiber_g_per_100g from public.foods
  where fiber_g_per_100g > 3 and name ilike 'Bananas%' limit 1`)[0]
  ?? sql(`select name, fiber_g_per_100g from public.foods
  where fiber_g_per_100g > 3 order by name limit 1`)[0];
const noFibre = sql(`select name from public.foods
  where fiber_g_per_100g is null order by name limit 1`)[0];
console.log(`FOOD WITH FIBRE:    ${withFibre.name} (${withFibre.fiber_g_per_100g} g/100g)`);
console.log(`FOOD WITHOUT FIBRE: ${noFibre.name}`);

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-fb-${Math.random().toString(36).slice(2)}.json`;
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
const shot = async (n) => { shots += 1; await page.waitForTimeout(1100); await page.screenshot({ path: `out/fb-${String(shots).padStart(2, '0')}-${n}.png` }); };
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/fb-FAIL-${name.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
};
const logFood = async (query, meal, portionIdx = 1) => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill(query);
  // Poll rather than sleep a fixed 2.4 s: search is debounced AND network-bound,
  // and a fixed wait is exactly the kind of thing that passes ten times and
  // fails on the eleventh when the backend is busy.
  const first = page.locator('[data-testid^="add-"]').first();
  await first.waitFor({ timeout: 20000 });
  await first.click();
  await page.getByTestId('log-cta').waitFor({ timeout: 6000 });
  await page.getByTestId(`portion-${portionIdx}`).click().catch(() => {});
  await page.getByTestId(`meal-${meal}`).click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 9000 });
};
/** IA 0001: fibre lives one tap inside the nutrition card, not on the surface.
    Open the sheet, read it, close it — the way a person would. */
const strip = async () => {
  await page.getByTestId('nutrition-card').click();
  await page.getByTestId('fibre-detail').waitFor({ timeout: 9000 });
  const txt = (await page.getByTestId('fibre-detail').innerText()).replace(/\n/g, ' | ');
  await page.getByTestId('detail-close').click();
  await page.waitForTimeout(600);
  return txt;
};

const EMAIL = `fibre-${Date.now()}@fuel.test`;
console.log('ACCOUNT ' + EMAIL);

await step('onboard', async () => {
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
});

await step('a food that REPORTS fibre gives an exact total', async () => {
  await logFood(withFibre.name.split(',')[0], 'breakfast', 1);
  await shot('known-fibre');
  const s = await strip();
  console.log(`STRIP (known only): ${s}`);
  if (/at least/.test(s)) throw new Error('hedged a total we actually know: ' + s);
  if (!/from 100% of today's food/.test(s)) throw new Error('coverage not stated as complete: ' + s);
  // and it must NOT be on the Today surface any more
  const surface = await page.locator('body').innerText();
  if (/Fibre/.test(surface)) throw new Error('fibre is back on the Today surface');
  if (!/\d+(\.\d+)? g \/ 22 g/.test(s)) throw new Error('target is not the 14 g/1000 kcal figure: ' + s);
});

await step('adding a food with NO figure downgrades the claim honestly', async () => {
  await logFood(noFibre.name.split(',')[0], 'lunch', 1);
  await shot('mixed-coverage');
  const s = await strip();
  console.log(`STRIP (mixed):      ${s}`);
  if (!/at least/.test(s)) throw new Error('still claiming an exact total with a gap: ' + s);
  if (!/1 item had no fibre figure/.test(s)) throw new Error('the gap is not named: ' + s);
});

await step('the value and the NULL both reach the server', async () => {
  await page.waitForTimeout(1800);
  const rows = sql(`select e.food_name, e.fiber_g::text as fiber
    from public.log_entries e join auth.users u on u.id = e.user_id
    where u.email = '${EMAIL}' order by e.logged_at`);
  console.log('SERVER: ' + JSON.stringify(rows));
  if (rows.length !== 2) throw new Error(`expected 2 rows, got ${rows.length}`);
  const known = rows.find((r) => r.fiber !== null);
  const unknown = rows.find((r) => r.fiber === null);
  if (!known) throw new Error('the known fibre value did not reach the server');
  if (!unknown) throw new Error('the unknown food was stored as a number instead of NULL');
});

await step('a day of ONLY unknown foods shows "—", never "0 g"', async () => {
  // fresh day, so the only entry is the food with no fibre figure
  await ctx.clock.setFixedTime(new Date(Date.now() + 26 * 3600 * 1000));
  await page.reload();
  // Boot restores from the server before Today renders; under load that is
  // slower than the old 14 s allowance.
  await page.getByText(/Day 2/).waitFor({ timeout: 30000 });
  await logFood(noFibre.name.split(',')[0], 'breakfast', 1);
  await shot('all-unknown');
  const s = await strip();
  console.log(`STRIP (all unknown):${s}`);
  if (/\b0 g \/|at least 0 g/.test(s)) throw new Error('printed 0 g for a day we know nothing about: ' + s);
  if (!/—/.test(s)) throw new Error('no unknown marker: ' + s);
  if (!/isn't zero, it's unknown/.test(s)) throw new Error('does not explain the unknown: ' + s);
  const filled = await page.getByTestId('fibre-strip').locator('div').nth(3)
    .evaluate((el) => getComputedStyle(el).width).catch(() => 'n/a');
  console.log(`unknown-state bar width: ${filled}`);
});

await step('cleanup', async () => {
  sql(`delete from auth.users where email='${EMAIL}'`);
});

await browser.close();
console.log(process.exitCode ? 'FIBRE CHECK HAD FAILURES' : 'FIBRE CHECK FULLY PASSED');
