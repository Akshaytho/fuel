/**
 * FIVE DAYS, FIVE MINDSETS — the app used like a real person, not a script.
 *
 * One account lives five consecutive days (Playwright clock advances; each
 * morning is a real relaunch). Each day a DIFFERENT human shows up:
 *
 *   Day 1  Aarti   — anxious beginner: logs immediately, checks constantly
 *   Day 2  Dev     — busy professional: forgets all day, batch-logs at 23:00
 *   Day 3  Sam     — weekend blowout: eats way over, dreads being judged
 *   Day 4  Nina    — sick day: logs nothing at all
 *   Day 5  Ravi    — back on it: big protein day, weighs in, wants the win
 *
 * Steps that FAIL are bugs. Steps that pass but feel wrong are recorded as
 * FRICTION — the things a real user would notice and no assertion catches.
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const MGMT = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const sql = (q) => JSON.parse(execFileSync('curl', ['-s', '-X', 'POST',
  'https://api.supabase.com/v1/projects/wccxzcrxdcqvprswdvlu/database/query',
  '-H', `Authorization: Bearer ${MGMT}`, '-H', 'Content-Type: application/json',
  '-H', 'User-Agent: Mozilla/5.0 (Macintosh) Chrome/126.0',
  '--data-binary', JSON.stringify({ query: q })]).toString());

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }

// Anchor the whole run to a fixed Monday so weeks/days are deterministic.
const DAY0 = Date.UTC(2026, 8, 7, 7, 30);          // Mon 2026-09-07 07:30 UTC
const dayISO = (n) => new Date(DAY0 + n * 86400000).toISOString().slice(0, 10);
const at = (n, h, m = 0) => new Date(Date.UTC(2026, 8, 7 + n, h, m));

const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });
await ctx.clock.setFixedTime(at(0, 7, 30));

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-5d-${Math.random().toString(36).slice(2)}.json`;
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

const friction = [];
const note = (day, who, what) => { friction.push({ day, who, what }); console.log(`FRICTION d${day} ${who}: ${what}`); };
let shots = 0;
const shot = async (name) => {
  shots += 1;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `out/5d-${String(shots).padStart(2, '0')}-${name}.png` });
};
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/5d-FAIL-${name.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
};

/** Log a food end-to-end the way a person does: search, pick, portion, meal. */
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
const kcalLeft = async () => {
  const t = await page.getByText(/Calories (left|over)/).first().textContent().catch(() => null);
  const el = await page.locator('text=/^\\d{1,3}(,\\d{3})?$/').first().textContent().catch(() => null);
  return { label: t, value: el };
};
const bodyHas = async (re) => (await page.locator('body').innerText()).match(re) !== null;

const EMAIL = `fivedays-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';
console.log('ACCOUNT ' + EMAIL);

/* ══════════ DAY 1 — Aarti, anxious beginner ══════════════════════ */
await step('D1 Aarti onboards and logs breakfast within a minute', async () => {
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
  await shot('d1-morning-empty');
  await logFood('banana', 'breakfast');
  await shot('d1-after-breakfast');
});

await step('D1 she checks back twice more and logs lunch + dinner', async () => {
  await ctx.clock.setFixedTime(at(0, 13, 15));
  await logFood('apple juice', 'lunch');
  await ctx.clock.setFixedTime(at(0, 19, 40));
  await logFood('beef', 'dinner', 2);
  await page.getByTestId('water-add').click();
  await page.getByTestId('water-add').click();
  await shot('d1-evening');
  const left = await kcalLeft();
  console.log(`D1 evening: ${left.label} = ${left.value}`);
  // an anxious first-timer's core question: "am I doing this right?"
  if (!(await bodyHas(/Nice —|protein to go/))) {
    note(1, 'Aarti', 'no encouraging feedback anywhere after a full first day');
  }
});

/* ══════════ DAY 2 — Dev, busy professional, batch-logs at 23:00 ══ */
await step('D2 Dev opens at 23:00 having logged nothing all day', async () => {
  await ctx.clock.setFixedTime(at(1, 23, 5));
  await page.reload();
  await page.getByText(/Day 2/).waitFor({ timeout: 12000 });
  await shot('d2-late-night-empty');
  // Day 2 he HAS history (day 1), so he must get returning-user copy, never
  // the first-run "log your first meal" line.
  if (await bodyHas(/Log your first meal/)) {
    throw new Error('day-2 user with history is shown first-run copy');
  }
  if (!(await bodyHas(/Nothing logged yet today/))) {
    note(2, 'Dev', 'day-2 empty state did not appear as expected');
  }
});

await step('D2 he batch-logs 3 meals — measure the taps it costs', async () => {
  const t0 = Date.now();
  await page.getByTestId('tab-log').click();
  // yesterday's food should be one tap away for a repeat eater
  const hasGoTos = (await page.locator('[data-testid^="quickadd-"]').count()) > 0;
  const hasCopy = await page.getByTestId('copy-yesterday').isVisible().catch(() => false);
  console.log(`D2 shortcuts: goTos=${hasGoTos} copyYesterday=${hasCopy}`);
  if (!hasCopy) note(2, 'Dev', 'Copy-yesterday missing on the day it matters most');
  await page.getByTestId('copy-yesterday').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 8000 });
  console.log(`D2 batch-log via copy took ${Math.round((Date.now() - t0) / 1000)}s of wall clock`);
  await shot('d2-after-copy');
});

/* ══════════ DAY 3 — Sam, weekend blowout ════════════════════════ */
await step('D3 Sam eats far over target and dreads the judgement', async () => {
  await ctx.clock.setFixedTime(at(2, 12, 0));
  await page.reload();
  await page.getByText(/Day 3/).waitFor({ timeout: 12000 });
  await logFood('almond butter', 'lunch', 3);
  await logFood('almond butter', 'snack', 3);
  await logFood('beef', 'dinner', 3);
  await shot('d3-over-target');
  const over = await bodyHas(/Calories over|Over ›/);
  console.log(`D3 over-target state shown: ${over}`);
  if (!over) note(3, 'Sam', 'went over target but the screen never said so');
  const text = await page.locator('body').innerText();
  if (/failed|bad|too much|exceeded/i.test(text)) {
    note(3, 'Sam', 'over-target copy uses shaming language');
  }
  // FIXED (was FRICTION d3): the strip must give perspective, and must not
  // congratulate. This is a hard assertion now — the "Nice —" regression
  // cannot come back silently.
  const strip = (await page.getByTestId('coach-strip').textContent()).trim();
  console.log(`D3 coach strip: "${strip}"`);
  if (/^Nice/.test(strip)) throw new Error('over-target day is being congratulated: ' + strip);
  if (!/over today/.test(strip)) throw new Error('over-target strip does not name the overshoot: ' + strip);
  if (!/week|Tomorrow starts clean/.test(strip)) throw new Error('no perspective offered: ' + strip);
  // and it must not be dressed in the green "well done" surface
  const stripBg = await page.getByTestId('coach-strip').evaluate((el) => getComputedStyle(el).backgroundColor);
  console.log(`D3 strip surface: ${stripBg}`);
  if (stripBg === 'rgb(233, 249, 238)') throw new Error('perspective strip is still using the praise-green surface');
});

/* ══════════ DAY 4 — Nina, sick day, logs nothing ════════════════ */
await step('D4 Nina is ill and never opens the app', async () => {
  await ctx.clock.setFixedTime(at(3, 21, 0));
  // she genuinely does not open it — no interaction at all this day
  console.log('D4: no app usage (sick day)');
});

/* ══════════ DAY 5 — Ravi, back on it, hits target ═══════════════ */
await step('D5 the app greets a returning user after a missed day', async () => {
  await ctx.clock.setFixedTime(at(4, 8, 0));
  await page.reload();
  await page.getByText(/Day 5/).waitFor({ timeout: 12000 });
  await shot('d5-return-after-gap');
  const streakTxt = await page.getByTestId('streak-value').textContent().catch(() => 'n/a');
  console.log(`D5 streak after a missed day: "${streakTxt.trim()}"`);
  const t = await page.locator('body').innerText();
  if (/lost|broken|failed/i.test(t)) note(5, 'Ravi', 'comeback copy is punishing');
  // FIXED (was FRICTION d5): a user with history is not a first-timer.
  const comeback = (await page.getByTestId('comeback-card').textContent()).trim();
  console.log(`D5 comeback card: "${comeback.replace(/\n/g, ' | ')}"`);
  if (!/Welcome back/.test(comeback)) throw new Error('no comeback acknowledgement: ' + comeback);
  if (!/best run is 3 days/.test(comeback)) throw new Error('the app forgot his 3-day run: ' + comeback);
  if (/Log your first meal/.test(t)) throw new Error('returning user is being shown first-run copy');
  if (/Day 1 of your streak starts now/.test(t)) throw new Error('streak-start row shown to a returning user');
  // FIXED (was FRICTION d5): "how many days did I log this week", on Today.
  const wk = (await page.getByTestId('week-summary').textContent()).trim();
  console.log(`D5 week strip: "${wk}"`);
  if (!/\d+ of \d+ days? logged this week/.test(wk)) throw new Error('no week-at-a-glance: ' + wk);
});

await step('D5 he logs a protein-heavy day and weighs in', async () => {
  await logFood('beef', 'breakfast', 2);
  await logFood('applebee', 'lunch', 2);
  await ctx.clock.setFixedTime(at(4, 20, 0));
  await logFood('beans', 'dinner', 2);
  // FIXED (was FRICTION d5): design 6a fires the moment the day lands.
  // It auto-dismisses in 3 s, so catch it before it goes.
  await page.getByTestId('celebration').waitFor({ timeout: 4000 });
  const celebTitle = (await page.getByTestId('celebration-title').textContent()).trim();
  const celebBody = (await page.getByTestId('celebration').innerText()).replace(/\n/g, ' | ');
  console.log(`D5 CELEBRATION: "${celebTitle}" — ${celebBody}`);
  await shot('d5-celebration');
  await page.getByTestId('celebration-dismiss').click();
  await page.getByTestId('celebration').waitFor({ state: 'detached', timeout: 4000 });
  // once per day: it must not come back on this day, even after a relaunch
  await page.reload();
  // NB: after logging, the header reads "· DAY 5" in caps and the empty card
  // (the only place "Day 5" appears in title case) is gone — wait on the
  // meals list instead, which only exists on a day that HAS entries.
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  if (await page.getByTestId('celebration').isVisible().catch(() => false)) {
    throw new Error('celebration replayed after relaunch — it is not once-per-day');
  }
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('log-weight-cta').first().click();
  await page.getByTestId('weight-kg-input').fill('70.4');
  await page.getByTestId('weight-save').click();
  await page.waitForTimeout(900);
  await page.getByTestId('tab-today').click();
  await shot('d5-full-day');
  const t = await page.locator('body').innerText();
  console.log('D5 protein line:', (t.match(/Protein\n[^\n]+/) ?? ['?'])[0].replace('\n', ' '));
});

await step('D5 the week so far is visible somewhere', async () => {
  await page.getByTestId('tab-report').click();
  await page.getByTestId('report-headline').waitFor({ timeout: 8000 });
  const head = (await page.getByTestId('report-headline').textContent()).trim();
  console.log('D5 report headline: ' + head);
  await shot('d5-report');
  await page.getByTestId('tab-trends').click();
  await page.getByText('Energy', { exact: true }).click();
  await shot('d5-trends-energy');
});

/* ══════════ what the server holds after five days ═══════════════ */
await step('server reflects exactly the five days lived', async () => {
  await page.waitForTimeout(1500);
  const r = sql(`select e.day::text as day, count(*)::text as n, sum(e.kcal)::text as kcal
    from public.log_entries e join auth.users u on u.id=e.user_id
    where u.email='${EMAIL}' group by e.day order by e.day`);
  console.log('SERVER BY DAY: ' + JSON.stringify(r));
  const days = r.map((x) => x.day);
  if (days.includes(dayISO(3))) throw new Error('day 4 has entries but Nina logged nothing');
  if (!days.includes(dayISO(0)) || !days.includes(dayISO(4))) throw new Error('missing lived days');
});

await step('cleanup', async () => {
  sql(`delete from auth.users where email='${EMAIL}'`);
});

writeFileSync('out/5d-friction.json', JSON.stringify(friction, null, 2));
console.log(`\nFRICTION FOUND: ${friction.length}`);
for (const f of friction) console.log(`  d${f.day} ${f.who}: ${f.what}`);
await browser.close();
console.log(process.exitCode ? 'FIVE-DAYS HAD FAILURES' : 'FIVE-DAYS COMPLETED');
