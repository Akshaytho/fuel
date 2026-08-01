/**
 * Spec 0010 AC3 — the RICH weekly report, proven end to end.
 *
 * Fixture: a long-term user's history is created SERVER-SIDE (the legitimate
 * home of a returning user's data), then the app is exercised purely by taps:
 * sign in → restore pulls the history → Report shows a verdict + recalibrated
 * burn → Accept new targets → the proposal on screen becomes the plan on
 * Today AND the profiles row in Postgres. Screen number and DB number must
 * be EQUAL — the script reads both and compares.
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const MGMT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const SUPA_URL = 'https://wccxzcrxdcqvprswdvlu.supabase.co';
const ANON = process.env.SUPA_ANON ?? 'sb_publishable_O7SvM3liX_m1eZTND87uxA_X4TcAckH';

const sql = (query) => JSON.parse(execFileSync('curl', ['-s', '-X', 'POST',
  'https://api.supabase.com/v1/projects/wccxzcrxdcqvprswdvlu/database/query',
  '-H', `Authorization: Bearer ${MGMT_TOKEN}`, '-H', 'Content-Type: application/json',
  '-H', 'User-Agent: Mozilla/5.0 (Macintosh) Chrome/126.0',
  '--data-binary', JSON.stringify({ query })]).toString());

const EMAIL = `reportrich-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';
console.log('ACCOUNT ' + EMAIL);

/* ── server-side fixture: 2 weeks of life for a returning user ────── */
const signup = JSON.parse(execFileSync('curl', ['-s', '-X', 'POST', `${SUPA_URL}/auth/v1/signup`,
  '-H', `apikey: ${ANON}`, '-H', 'Content-Type: application/json',
  '--data-binary', JSON.stringify({ email: EMAIL, password: PW })]).toString());
const UID = signup.user?.id;
if (!UID) { console.error('signup failed', JSON.stringify(signup).slice(0, 200)); process.exit(1); }

// dates: the last COMPLETE Mon–Sun week relative to the container's day
const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const todayDow = (new Date().getUTCDay() + 6) % 7;         // Mon=0
const lastMonOff = -todayDow - 7;                          // Monday of last complete week

const entryRows = [];
for (let i = 0; i < 7; i += 1) {
  const d = day(lastMonOff + i);
  entryRows.push(`('${crypto.randomUUID()}','${UID}','${d}','Seeded meal',300,1500,90,150,50,'manual','lunch','${d}T12:00:00Z')`);
}
const weighRows = [
  `('${UID}','${day(lastMonOff - 1)}',69.0)`,
  `('${UID}','${day(lastMonOff + 3)}',68.6)`,
  `('${UID}','${day(lastMonOff + 7)}',68.3)`,   // day after week end (inside +3 window)
];
sql(`
  update public.profiles set sex='female', age_years=28, height_cm=165, weight_kg=68.3,
    activity='light', goal='lose', target_kcal=1553, target_protein_g=135.9,
    target_carbs_g=135.9, target_fat_g=51.8 where id='${UID}';
  insert into public.log_entries (client_id,user_id,day,food_name,grams,kcal,protein_g,carbs_g,fat_g,source,meal,logged_at)
    values ${entryRows.join(',')};
  insert into public.weigh_ins (user_id,day,weight_kg) values ${weighRows.join(',')};
`);
const seeded = sql(`select
  (select count(*) from public.log_entries where user_id='${UID}') as foods,
  (select count(*) from public.weigh_ins where user_id='${UID}') as weighs`)[0];
console.log(`SEEDED foods=${seeded.foods} weighs=${seeded.weighs} week=${day(lastMonOff)}..${day(lastMonOff + 6)}`);

/* ── the app, by taps only ───────────────────────────────────────── */
const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 } });
const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-rr-${Math.random().toString(36).slice(2)}.json`;
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
const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/rr-FAIL-${name.slice(0, 18).replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
};

let screenKcal = null;

await step('sign in → restore pulls the seeded life, straight to Today', async () => {
  await page.getByTestId('boot-splash').waitFor({ timeout: 4000 });
  await page.getByTestId('auth-email').click({ timeout: 8000 });
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill(PW);
  await page.getByTestId('auth-submit').click();
  await page.getByText("TODAY'S MEALS", { exact: false }).waitFor({ timeout: 25000 }).catch(async () => {
    await page.getByText('TO GO').waitFor({ timeout: 5000 }); // empty today is fine too
  });
});

await step('Report shows a VERDICT with recalibrated burn (not locked)', async () => {
  await page.getByTestId('tab-report').click();
  await page.getByTestId('report-headline').waitFor({ timeout: 6000 });
  const head = (await page.getByTestId('report-headline').textContent()).trim();
  if (head === 'Your report is almost ready.') throw new Error('report locked despite full seeded week');
  console.log('HEADLINE ' + head);
  await page.getByTestId('report-burn').waitFor({ timeout: 4000 });
  const burn = (await page.getByTestId('report-burn').textContent()).trim();
  console.log('BURN ' + burn.replace(/\s+/g, ' '));
  const days = (await page.getByTestId('report-days').textContent()).trim();
  if (days !== '7/7') throw new Error(`days pill ${days}, expected 7/7`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'out/rr-01-report-rich.png' });
});

await step('Accept new targets → Today runs on the proposed number', async () => {
  screenKcal = Number((await page.getByTestId('report-next-kcal').textContent()).replace(/,/g, ''));
  console.log('PROPOSED ' + screenKcal);
  if (!Number.isFinite(screenKcal) || screenKcal < 1200) throw new Error('proposal unreadable');
  await page.getByTestId('accept-targets').click();
  await page.waitForTimeout(1500);
  await page.getByTestId('tab-today').click();
  await page.getByText(screenKcal.toLocaleString('en-US')).first().waitFor({ timeout: 6000 });
  await page.screenshot({ path: 'out/rr-02-today-on-new-targets.png' });
});

await step('DB CHECK: profiles.target_kcal EQUALS the number that was on screen', async () => {
  await page.waitForTimeout(1500);
  const row = sql(`select target_kcal from public.profiles where id='${UID}'`)[0];
  console.log(`DB target_kcal=${row.target_kcal} screen=${screenKcal}`);
  if (Number(row.target_kcal) !== screenKcal) {
    throw new Error(`server ${row.target_kcal} ≠ screen ${screenKcal}`);
  }
});

await step('cleanup: delete seeded account', async () => {
  sql(`delete from auth.users where id='${UID}'`);
  const left = sql(`select count(*) as n from auth.users where email='${EMAIL}'`)[0];
  if (left.n !== 0 && left.n !== '0') throw new Error('cleanup failed');
});

await browser.close();
console.log(process.exitCode ? 'REPORT-RICH HAD FAILURES' : 'REPORT-RICH FULLY PASSED');
