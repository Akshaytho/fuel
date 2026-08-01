/**
 * DEEP-DIVE SANITY RUN — visible proof, end to end.
 *
 * One fresh account lives a full life by TAPS ONLY (rule 0a): onboard →
 * log food+water → weigh in → weigh-in ADAPTS the plan → sign out (device
 * wiped) → sign in (history RESTORED from Postgres) → server rows printed
 * straight from the database → delete account → server rows printed again
 * (zero). A numbered screenshot is captured at every proof moment and the
 * database is queried mid-flow via the Management API so the log shows the
 * server's own answer, not the app's claim about it.
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const PROJ = 'wccxzcrxdcqvprswdvlu';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 } });

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-dd-${Math.random().toString(36).slice(2)}.json`;
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
    await route.fulfill({ status: 599, contentType: 'application/json', body: JSON.stringify({ error: String(e).slice(0, 100) }) });
  }
};
if (process.env.CURL_BRIDGE === '1') await ctx.route('**supabase.co/**', bridge);
else await ctx.route('**supabase.co/functions/v1/**', bridge);

const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

let shotN = 0;
const shot = async (name) => {
  shotN += 1;
  const file = `out/dd-${String(shotN).padStart(2, '0')}-${name}.png`;
  await page.waitForTimeout(700);              // let motion settle — screenshots show the LANDED state
  await page.screenshot({ path: file });
  console.log(`SHOT ${file}`);
  return file;
};
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name, '-', String(e).split('\n')[0]); process.exitCode = 1; }
};
const human = async (loc, v) => loc.fill(String(v));

/** The database's own answer, straight from Postgres — not the app's claim. */
const sql = (query) => {
  const body = JSON.stringify({ query });
  const out = execFileSync('curl', ['-s', '-X', 'POST',
    `https://api.supabase.com/v1/projects/${PROJ}/database/query`,
    '-H', `Authorization: Bearer ${MGMT_TOKEN}`,
    '-H', 'Content-Type: application/json',
    '-H', 'User-Agent: Mozilla/5.0 (Macintosh) Chrome/126.0',
    '--data-binary', body]).toString();
  return JSON.parse(out);
};

const EMAIL = `sanity-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';
console.log('ACCOUNT ' + EMAIL);

/* 1 ─ boot + onboarding at 68.2 kg */
await step('boot splash plays', async () => {
  await page.getByTestId('boot-splash').waitFor({ timeout: 4000 });
  await shot('boot-splash');
});
await step('onboard: f/28/165/68.2/light/lose → plan 1,553 kcal', async () => {
  await page.getByTestId('auth-email').click({ timeout: 8000 });
  await human(page.getByTestId('email-input'), EMAIL);
  await human(page.getByTestId('password-input'), PW);
  await page.getByTestId('auth-submit').click();
  await page.getByText('What are we working toward?').waitFor({ timeout: 20000 });
  await page.getByTestId('goal-lose').click();
  await page.getByTestId('goal-continue').click();
  await human(page.getByTestId('age-input'), '28');
  await human(page.getByTestId('height-input'), '165');
  await human(page.getByTestId('weight-input'), '68.2');
  await page.getByTestId('activity-light').click();
  await page.getByTestId('about-continue').click();
  await page.getByText('1,553').waitFor({ timeout: 5000 });
  await shot('plan-1553-at-68kg');
  await page.getByTestId('start-day1').click();
  await page.getByText('TO GO').waitFor({ timeout: 5000 });
  await shot('today-day1-empty');
});

/* 2 ─ a real day: food + water */
await step('log banana as Dinner; rings move', async () => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill('banana');
  await page.waitForTimeout(2500);
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('meal-dinner').click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 6000 });
  await shot('today-after-food');
});
await step('two taps of water → 0.5 L', async () => {
  await page.getByTestId('water-add').click();
  await page.getByTestId('water-add').click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="water-value"]')?.textContent?.includes('0.5'), null, { timeout: 5000 });
  await shot('today-water-05');
});

/* 3 ─ THE ADAPTATION PROOF: weigh in at 60.0, watch the plan retune */
await step('weigh in 60.0 kg → target on Today drops 1,553 → 1,463', async () => {
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('log-weight-cta').first().click();
  await page.getByTestId('weight-kg-input').waitFor({ timeout: 5000 });
  await page.getByTestId('weight-kg-input').fill('60');
  await shot('weight-sheet-60');
  await page.getByTestId('weight-save').click();
  await page.waitForTimeout(800);
  await shot('trends-after-weighin');
  await page.getByTestId('tab-today').click();
  await page.getByText('1,463').first().waitFor({ timeout: 6000 });
  await shot('today-adapted-1463');
  if (await page.getByText('1,553').first().isVisible().catch(() => false)) {
    throw new Error('frozen 1,553 still shown');
  }
});

/* 4 ─ server truth, mid-flow, from Postgres itself */
await step('DATABASE CHECK #1 — the server has everything', async () => {
  await page.waitForTimeout(1500); // let final syncs land
  const rows = sql(`
    select 'profile' as what, count(*)::text as n,
           max(p.target_kcal)::text as detail
      from public.profiles p join auth.users u on u.id = p.id where u.email = '${EMAIL}'
    union all
    select 'log_entries', count(*)::text, string_agg(e.food_name || ' (' || e.meal || ')', ', ')
      from public.log_entries e join auth.users u on u.id = e.user_id where u.email = '${EMAIL}'
    union all
    select 'water_entries', count(*)::text, sum(w.ml)::text || ' ml'
      from public.water_entries w join auth.users u on u.id = w.user_id where u.email = '${EMAIL}'
    union all
    select 'weigh_ins', count(*)::text, string_agg(wi.weight_kg::text, ',')
      from public.weigh_ins wi join auth.users u on u.id = wi.user_id where u.email = '${EMAIL}'`);
  console.log('DB#1 ' + JSON.stringify(rows));
  const by = Object.fromEntries(rows.map((r) => [r.what, r]));
  if (by.profile.detail !== '1463') throw new Error(`server target_kcal = ${by.profile.detail}, expected 1463 (adaptation synced)`);
  if (Number(by.log_entries.n) < 1) throw new Error('no food on server');
  if (by.water_entries.detail !== '500 ml') throw new Error(`water on server = ${by.water_entries.detail}`);
  if (by.weigh_ins.detail !== '60.0') throw new Error(`weigh-in on server = ${by.weigh_ins.detail} (upsert should leave ONE row at 60.0)`);
});

/* 5 ─ sign out wipes the device */
await step('sign out → device wiped → Welcome', async () => {
  await page.getByText('You', { exact: true }).click();
  await page.getByText('CURRENT GOAL').waitFor({ timeout: 5000 });
  await shot('profile-before-signout');
  await page.getByTestId('row-signout').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 10000 });
  const left = await page.evaluate(() => ['fuel.profile.v1', 'entries', 'water', 'weighins']
    .map((k) => (window.localStorage.getItem(k) ?? '').replace(/[\[\]]/g, '')).join(''));
  console.log('LOCAL AFTER SIGNOUT: "' + left + '" (empty = wiped)');
  if (left.length > 0) throw new Error('device retained data after sign-out');
  await shot('welcome-after-signout-device-empty');
});

/* 6 ─ sign in restores the whole life from the server */
await step('sign back in → history RESTORED, onboarding skipped', async () => {
  await page.getByTestId('auth-email').click();
  await human(page.getByTestId('email-input'), EMAIL);
  await human(page.getByTestId('password-input'), PW);
  await page.getByTestId('auth-submit').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 25000 });
  await page.getByText('1,463').first().waitFor({ timeout: 6000 });
  await page.getByText(/Dinner ·/).waitFor({ timeout: 6000 });
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="water-value"]')?.textContent?.includes('0.5'), null, { timeout: 6000 });
  await shot('today-restored-from-server');
});

/* 7 ─ delete account, then let the database answer again */
await step('delete account by taps → Welcome', async () => {
  await page.getByText('You', { exact: true }).click();
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
  await shot('welcome-after-delete');
});
await step('DATABASE CHECK #2 — the server holds NOTHING', async () => {
  const rows = sql(`
    select (select count(*) from auth.users where email = '${EMAIL}')::text as auth_users,
           (select count(*) from public.log_entries e join auth.users u on u.id = e.user_id where u.email = '${EMAIL}')::text as log_entries,
           (select count(*) from public.water_entries w join auth.users u on u.id = w.user_id where u.email = '${EMAIL}')::text as water,
           (select count(*) from public.weigh_ins wi join auth.users u on u.id = wi.user_id where u.email = '${EMAIL}')::text as weigh_ins`);
  console.log('DB#2 ' + JSON.stringify(rows));
  const r = rows[0];
  if (r.auth_users !== '0' || r.log_entries !== '0' || r.water !== '0' || r.weigh_ins !== '0') {
    throw new Error('server rows survived deletion: ' + JSON.stringify(r));
  }
});

await browser.close();
console.log(process.exitCode ? 'DEEP-DIVE HAD FAILURES' : 'DEEP-DIVE FULLY PASSED');
