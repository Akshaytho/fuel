/**
 * DAY-IN-THE-LIFE SIMULATION — every user verb, DB-observed.
 *
 * One account lives one full day by TAPS ONLY: onboard → weigh in → CORRECT
 * the weigh-in (change) → breakfast → water ×3 → undo one water (remove) →
 * lunch → delete the mislogged lunch (remove) → change goal lose→maintain
 * (change) → dinner → check Trends → export.
 *
 * After EVERY action the script queries Postgres directly and prints a
 * LEDGER line: what the screen shows vs what the database holds. A
 * screenshot captures each screen's reaction. Screen and server must agree
 * at every step or the run fails.
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
  const tmp = `/tmp/pw-dil-${Math.random().toString(36).slice(2)}.json`;
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

const EMAIL = `dayinlife-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';
console.log('ACCOUNT ' + EMAIL);

let shotN = 0;
const shot = async (name) => {
  shotN += 1;
  const f = `out/dl-${String(shotN).padStart(2, '0')}-${name}.png`;
  await page.waitForTimeout(700);
  await page.screenshot({ path: f });
  return f;
};
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/dl-FAIL-${name.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
};

/** Postgres's answer for this account, one compact row. */
const db = () => {
  const q = `
    select coalesce((select count(*) from public.log_entries e join auth.users u on u.id=e.user_id where u.email='${EMAIL}'),0)::text as foods,
           coalesce((select string_agg(e.meal || ':' || split_part(e.food_name, ',', 1), ' | ' order by e.logged_at) from public.log_entries e join auth.users u on u.id=e.user_id where u.email='${EMAIL}'), '-') as food_list,
           coalesce((select count(*) from public.water_entries w join auth.users u on u.id=w.user_id where u.email='${EMAIL}'),0)::text as waters,
           coalesce((select sum(w.ml) from public.water_entries w join auth.users u on u.id=w.user_id where u.email='${EMAIL}'),0)::text as water_ml,
           coalesce((select string_agg(wi.weight_kg::text, ',') from public.weigh_ins wi join auth.users u on u.id=wi.user_id where u.email='${EMAIL}'), '-') as weigh_kg,
           coalesce((select p.goal || '@' || p.target_kcal from public.profiles p join auth.users u on u.id=p.id where u.email='${EMAIL}'), '-') as plan`;
  const out = execFileSync('curl', ['-s', '-X', 'POST',
    `https://api.supabase.com/v1/projects/${PROJ}/database/query`,
    '-H', `Authorization: Bearer ${MGMT_TOKEN}`, '-H', 'Content-Type: application/json',
    '-H', 'User-Agent: Mozilla/5.0 (Macintosh) Chrome/126.0',
    '--data-binary', JSON.stringify({ query: q })]).toString();
  return JSON.parse(out)[0];
};
const ledger = async (action, expect_) => {
  await page.waitForTimeout(1200);            // let sync land before asking the DB
  const r = db();
  const line = `LEDGER ${action} → DB{foods:${r.foods} [${r.food_list}] water:${r.waters}×=${r.water_ml}ml weigh:[${r.weigh_kg}] plan:${r.plan}}`;
  console.log(line);
  for (const [k, v] of Object.entries(expect_)) {
    if (r[k] !== v) throw new Error(`DB mismatch after "${action}": ${k}="${r[k]}", expected "${v}"`);
  }
};

/* ── 07:00 wake up: onboard at 68.2 kg ───────────────────────────── */
await step('07:00 onboard (f/28/165/68.2/light/lose) → plan 1,553', async () => {
  await page.getByTestId('boot-splash').waitFor({ timeout: 4000 });
  await page.getByTestId('auth-email').click({ timeout: 8000 });
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill(PW);
  await page.getByTestId('auth-submit').click();
  await page.getByText('What are we working toward?').waitFor({ timeout: 20000 });
  await page.getByTestId('goal-lose').click();
  await page.getByTestId('goal-continue').click();
  await page.getByTestId('age-input').fill('28');
  await page.getByTestId('height-input').fill('165');
  await page.getByTestId('weight-input').fill('68.2');
  await page.getByTestId('activity-light').click();
  await page.getByTestId('about-continue').click();
  await page.getByText('1,553').waitFor({ timeout: 5000 });
  await page.getByTestId('start-day1').click();
  await page.getByText('TO GO').waitFor({ timeout: 5000 });
  await shot('0700-onboarded');
  await ledger('onboarded', { foods: '0', plan: 'lose@1553' });
});

/* ── 07:05 morning weigh-in, then CORRECT it (change) ────────────── */
await step('07:05 weigh in 68.2', async () => {
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('seg-1').click();   // IA 0001: Weight is segment 1 now
  await page.getByTestId('log-weight-cta').first().click();
  await page.getByTestId('weight-kg-input').fill('68.2');
  await page.getByTestId('weight-save').click();
  await shot('0705-weighin-682');
  await ledger('weigh-in 68.2', { weigh_kg: '68.2', plan: 'lose@1553' });
});
await step('07:06 CHANGE: re-weigh 67.8 → ONE row upserted, plan retunes to 1,549', async () => {
  await page.getByTestId('log-weight-cta').first().click();
  await page.getByTestId('weight-kg-input').fill('67.8');
  await page.getByTestId('weight-save').click();
  await page.getByTestId('tab-today').click();
  // 67.8: BMR 1408.25 ×1.375 −20% = 1549.075 → 1,549
  await page.getByText('1,549').first().waitFor({ timeout: 6000 });
  await shot('0706-corrected-678-plan-1549');
  await ledger('weigh-in corrected to 67.8', { weigh_kg: '67.8', plan: 'lose@1549' });
});

/* ── 08:00 breakfast ─────────────────────────────────────────────── */
await step('08:00 breakfast: banana → calories left 1,460', async () => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill('banana');
  await page.waitForTimeout(2500);
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('meal-breakfast').click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 6000 });
  await page.getByText('1,460').first().waitFor({ timeout: 4000 }); // 1,549 − 89
  await shot('0800-breakfast-logged');
  await ledger('breakfast banana', { foods: '1', food_list: 'breakfast:Bananas' });
});

/* ── through the morning: water ×3, then one mis-tap undone ──────── */
await step('10:30 water ×3 → 0.8 L on screen, 750 ml on server', async () => {
  await page.getByTestId('water-add').click();
  await page.getByTestId('water-add').click();
  await page.getByTestId('water-add').click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="water-add-value"]')?.textContent?.includes('0.8'), null, { timeout: 5000 });
  await shot('1030-water-3');
  await ledger('water ×3', { waters: '3', water_ml: '750' });
});
await step('10:31 REMOVE: undo one water → 0.5 L, server row DELETED', async () => {
  await page.getByTestId('water-add').click({ delay: 600 }); // long-press = undo
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="water-add-value"]')?.textContent?.includes('0.5'), null, { timeout: 5000 });
  await shot('1031-water-undone');
  await ledger('water undo', { waters: '2', water_ml: '500' });
});

/* ── 13:00 lunch logged… wrongly, then REMOVED ───────────────────── */
await step('13:00 lunch: second banana logged', async () => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill('banana');
  await page.waitForTimeout(2500);
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('meal-lunch').click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 6000 });
  await page.getByText('1,371').first().waitFor({ timeout: 4000 }); // 1,549 − 178
  await shot('1300-lunch-logged');
  await ledger('lunch banana', { foods: '2' });
});
await step('13:02 REMOVE: long-press the lunch row → confirm → gone everywhere', async () => {
  await page.locator('[data-testid^="entry-"]').last().click({ delay: 600 }); // long-press the row
  await page.getByTestId('confirm-remove-entry').waitFor({ timeout: 4000 });
  await shot('1302-remove-sheet');
  await page.getByTestId('confirm-remove-entry').click();
  await page.getByText('1,460').first().waitFor({ timeout: 5000 });     // calories restored
  await shot('1302-lunch-removed');
  await ledger('lunch entry removed', { foods: '1', food_list: 'breakfast:Bananas' });
});

/* ── 17:00 CHANGE the goal: lose → maintain (prefilled flow) ─────── */
await step('17:00 change goal to maintain → plan jumps to 1,936, fields PREFILLED', async () => {
  await page.getByTestId('tab-you').click();
  await page.getByText('Change', { exact: true }).click();
  // there is no "maintain" card — Recomp ("hold weight") maps to maintain
  await page.getByTestId('goal-recomp').click();
  await page.getByTestId('goal-continue').click();
  // D-8 fix: about screen arrives PREFILLED with 67.8 — assert, don't retype
  const w = await page.getByTestId('weight-input').inputValue();
  if (w !== '67.8') throw new Error(`about screen weight prefilled "${w}", expected 67.8`);
  await page.getByTestId('about-continue').click();
  // maintain @67.8: TDEE 1936.34 → 1,936
  await page.getByText('1,936').waitFor({ timeout: 5000 });
  await shot('1700-plan-maintain-1936');
  await page.getByTestId('start-day1').click();
  await page.getByText('TO GO').waitFor({ timeout: 5000 }).catch(() => {});
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 5000 });
  await shot('1700-today-under-new-goal');
  await ledger('goal → maintain', { plan: 'maintain@1936', foods: '1' });
});

/* ── 20:00 dinner ────────────────────────────────────────────────── */
await step('20:00 dinner: chicken', async () => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill('chicken');
  await page.waitForTimeout(2500);
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('meal-dinner').click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 6000 });
  await shot('2000-dinner-logged');
  await ledger('dinner chicken', { foods: '2' });
});

/* ── 22:00 review the day: Trends reacts to everything ───────────── */
await step('22:00 Progress: week, weight 67.8, energy bar for today, consistency alive', async () => {
  await page.getByTestId('tab-trends').click();
  // IA 0001: Progress opens on Week; the weight hero is one segment across.
  await page.getByTestId('week-summary').waitFor({ timeout: 9000 });
  await shot('2200-progress-week');
  await page.getByTestId('seg-1').click();
  await page.getByText('67.8').first().waitFor({ timeout: 9000 });
  await shot('2200-trends-weight');
  await page.getByTestId('seg-2').click();
  await page.getByText('Calories eaten, last 14 days').waitFor({ timeout: 6000 });
  await shot('2200-trends-energy');
  await page.getByTestId('seg-3').click();
  await page.getByText('Protein days hit, by week').waitFor({ timeout: 6000 });
  await shot('2200-trends-consistency');
});

/* ── 22:05 export: the CSV mirrors the day exactly ───────────────── */
await step('22:05 export CSV reflects exactly what remains (2 foods, 2 waters, 1 weigh-in)', async () => {
  await page.getByTestId('tab-you').click();
  await page.getByTestId('row-export').click();
  await page.waitForTimeout(400);
  const csv = await page.evaluate(() => window.__export ?? '');
  const foodRows = csv.split('\n').filter((l) => /,(breakfast|lunch|dinner|snack),/.test(l));
  const waterRows = csv.split('\n').filter((l) => /,250,(true|false)$/.test(l));
  const weighRows = csv.split('\n').filter((l) => /,67\.8,(true|false)$/.test(l));
  console.log(`EXPORT foods=${foodRows.length} waters=${waterRows.length} weighs=${weighRows.length}`);
  if (foodRows.length !== 2) throw new Error(`export has ${foodRows.length} food rows, expected 2`);
  if (waterRows.length !== 2) throw new Error(`export has ${waterRows.length} water rows, expected 2 (undo respected)`);
  if (weighRows.length !== 1) throw new Error(`export has ${weighRows.length} weigh rows, expected 1 (correction upserted)`);
  await shot('2205-profile-export');
});

/* ── cleanup: this is a test account ─────────────────────────────── */
await step('cleanup: delete the account; server returns to zero', async () => {
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
  await ledger('account deleted', { foods: '0', waters: '0', weigh_kg: '-', plan: '-' });
});

await browser.close();
console.log(process.exitCode ? 'DAY-IN-LIFE HAD FAILURES' : 'DAY-IN-LIFE FULLY PASSED');
