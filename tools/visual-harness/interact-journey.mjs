// Spec 0007 AC1 — the COMPLETE user journey, driven and asserted.
// Uses the same build pipeline as interact.mjs, then walks:
// welcome → live email auth → goal → about-you → plan (exact domain numbers)
// → Start Day 1 → Day-1 Today → log a real food (live search + live sync)
// → RELOAD → lands on Today with data intact.
import { chromium } from 'playwright';
await import('./build-only.mjs');

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

// Portable launch (the old hardcoded /opt/pw-browsers/chromium existed only in
// the cloud sandbox). HEADED=1 opens the user's real Google Chrome in a
// phone-portrait window with SLOWMO ms between actions so a human can watch.
const HEADED = process.env.HEADED === '1';
const SLOWMO = Number(process.env.SLOWMO ?? (HEADED ? 300 : 0));
const launchOpts = { headless: !HEADED, slowMo: SLOWMO, args: ['--window-size=410,980', '--window-position=80,40'] };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); } // fall back to bundled Chromium
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 } });
// curl transport bridge (replays method/headers/body outside the browser).
const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-body-${Math.random().toString(36).slice(2)}.json`;
  const args = ['-s', '-o', tmp, '-w', '%{http_code}', '-m', '30', '-X', req.method(), req.url()];
  const hdrs = await req.allHeaders();
  for (const [k, v] of Object.entries(hdrs)) {
    if (['apikey','authorization','content-type','prefer'].includes(k.toLowerCase())) args.push('-H', `${k}: ${v}`);
  }
  const body = req.postData();
  if (body) args.push('--data-binary', body);
  try {
    const status = Number(execFileSync('curl', args).toString().trim() || 500);
    const out = readFileSync(tmp);
    await route.fulfill({ status, contentType: 'application/json', body: out });
  } catch (e) {
    await route.fulfill({ status: 599, contentType: 'application/json', body: JSON.stringify({ error: String(e).slice(0, 120) }) });
  }
};
// Edge Functions: the DEPLOYED delete-account predates its CORS fix (B-24), so a
// browser kills the call at preflight — native apps are unaffected. Until Harish
// redeploys, only this route is bridged; auth/rest stay real browser network.
await ctx.route('**supabase.co/functions/v1/**', bridge);
// Cloud-sandbox egress relay needs the FULL bridge — opt-in via CURL_BRIDGE=1.
if (process.env.CURL_BRIDGE === '1') await ctx.route('**supabase.co/**', bridge);
const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');
if (HEADED) {
  // Raise the window — a headed browser that opens BEHIND the IDE shows nobody anything.
  await page.bringToFront();
  for (const app of ['Google Chrome', 'Chromium']) {
    try { execFileSync('osascript', ['-e', `tell application "${app}" to activate`]); break; } catch { /* next */ }
  }
}
// Human-paced typing for headed demos; instant fill otherwise.
const human = async (loc, v) => {
  if (HEADED) { await loc.click(); await loc.pressSequentially(String(v), { delay: 85 }); }
  else await loc.fill(String(v));
};

const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name, '-', String(e).split('\n')[0]); process.exitCode = 1; }
};

const EMAIL = `journey-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';

await step('app open plays the brand splash (rule 0b), THEN welcome fades in', async () => {
  await page.getByTestId('boot-splash').waitFor({ timeout: 3000 });
  await page.waitForTimeout(750);            // let the spring + wordmark land
  await page.screenshot({ path: 'out/j0-boot.png' });
});

await step('Welcome renders: brand, tagline, three promises, auth options', async () => {
  await page.getByText('The honest way to eat better').waitFor({ timeout: 6000 });
  await page.screenshot({ path: 'out/j1-welcome.png' });
  await page.getByText('Scan, describe, or snap a label — done').waitFor();
  await page.getByText('Sign in with Apple').waitFor();
});
await step('Apple button is honest (coming-soon), not fake', async () => {
  await page.getByTestId('auth-apple').click();
  const a = await page.getByTestId('alert').textContent();
  if (!a.includes('Coming soon')) throw new Error(a);
});
await step('email path → LIVE signup against Supabase', async () => {
  await page.getByTestId('auth-email').click();
  await human(page.getByTestId('email-input'), EMAIL);
  await human(page.getByTestId('password-input'), PW);
  await page.getByTestId('auth-submit').click();
  await page.getByText('What are we working toward?').waitFor({ timeout: 15000 });
});
await page.screenshot({ path: 'out/j2-goal.png' });
await step('goal cards select exclusively; continue gated then advances', async () => {
  await page.getByTestId('goal-lose').click();
  await page.getByTestId('goal-continue').click();
  await page.getByText('About you').waitFor();
});
await step('about-you: continue disabled until valid, then advances', async () => {
  await page.getByTestId('about-continue').click();          // invalid yet → stays
  await page.getByText('About you').waitFor();
  await human(page.getByTestId('age-input'), '28');
  await human(page.getByTestId('height-input'), '165');
  await human(page.getByTestId('weight-input'), '68.2');
  await page.getByTestId('activity-light').click();
  await page.getByTestId('about-continue').click();
  await page.getByText('Your starting plan').waitFor();
});
await page.screenshot({ path: 'out/j3-plan.png' });
await step('plan shows EXACT domain-computed targets (f/28/165/68.2/light/lose)', async () => {
  // Research 0001: BMR=1412.25 ×1.375=1941.84 −20%=1553.475 → 1,553 kcal;
  // protein: lose 2.0 g/kg of ref weight, capped at 35% kcal → 135.9 → 136g; water 2.5L
  await page.getByText('1,553').waitFor();
  // protein AND carbs both land on 136g for this profile (35% cap + 35% remainder)
  await page.getByText('136g').first().waitFor();
  await page.getByText('2.5L').waitFor();
});
await step('reminder toggle flips', async () => {
  await page.getByTestId('reminder-toggle').click(); // on→off (no crash = pass; state visual)
});
await step('Start Day 1 → Day-1 empty Today with OUR targets', async () => {
  await page.getByTestId('start-day1').click();
  await page.getByText('TO GO').waitFor({ timeout: 4000 });
  await page.getByText('1,553').first().waitFor();
});
await page.screenshot({ path: 'out/j4-day1.png' });
await step('log real food: live search → pick MEAL → portion → rings move', async () => {
  await page.getByTestId('tab-log').click();
  await page.getByText(/YOUR GO-TOS/).waitFor();
  // spec 0011: a brand-new user has no history — the row says so, it does not
  // invent a list (and 'Copy yesterday' is absent, since yesterday is empty)
  await page.getByTestId('gotos-empty').waitFor({ timeout: 4000 });
  if (await page.getByTestId('copy-yesterday').isVisible().catch(() => false)) {
    throw new Error('copy-yesterday offered with nothing to copy');
  }
  await page.locator('input').first().click();
  await page.getByText('Searches your food database').waitFor({ timeout: 4000 });
  await human(page.locator('input').first(), 'banana');
  await page.waitForTimeout(2500);                       // live query
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('log-cta').waitFor();
  await page.getByTestId('meal-dinner').click();         // B-12: was a dead control
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 5000 });
});
await step('B-12: the meal I picked survives the log and shows on the entry', async () => {
  await page.getByText(/Dinner ·/).waitFor({ timeout: 4000 });
});
await step('B-18: avatar shows MY initial, not a hardcoded "A"', async () => {
  const initial = await page.getByTestId('avatar').textContent();
  if (initial !== 'J') throw new Error(`avatar showed "${initial}" for a journey-* account`);
});
await step('B-16: streak reads 1 from REAL logged days (not a hardcoded 1)', async () => {
  const v = (await page.getByTestId('streak-value').textContent()).trim();
  if (v !== '1 day') throw new Error(`streak showed "${v}" after exactly one logged day`);
});
await step('B-16: water is a LIVE control — two taps make it 0.5 L', async () => {
  const wtxt = () => page.getByTestId('water-value').textContent().then((x) => x.trim());
  const first = await wtxt();
  if (first !== '0 / 2.5 L') throw new Error(`fresh day showed ${first}`);
  const settle = (want) => page.waitForFunction(
    (w) => document.querySelector('[data-testid="water-value"]')?.textContent?.trim() === w,
    want, { timeout: 5000 });
  await page.getByTestId('water-add').click();
  await settle('0.3 / 2.5 L');                                    // 250 ml
  await page.getByTestId('water-add').click();
  await settle('0.5 / 2.5 L');
});
// page.reload() below is the ONE allowed non-tap action (CLAUDE.md rule 0a):
// it simulates killing and relaunching the app, which has no tappable gesture.
await step('RELAUNCH: splash again, then straight to Today, data intact', async () => {
  await page.reload();
  await page.getByTestId('boot-splash').waitFor({ timeout: 3000 });
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 9000 });
  await page.getByText('1,553').first().waitFor();
  await page.waitForFunction(                                      // water survived relaunch
    () => document.querySelector('[data-testid="water-value"]')?.textContent?.trim() === '0.5 / 2.5 L',
    null, { timeout: 6000 });
  if (await page.getByText('What are we working toward?').isVisible().catch(() => false)) {
    throw new Error('onboarding shown again');
  }
});
await step('rings SWEEP to value on relaunch (rule 0b), not snap', async () => {
  // Sample the outer ring arc mid-sweep and after it settles; a static
  // screen renders identical dasharrays and fails this step.
  const arcs = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('circle[stroke-dasharray]'))
      .map((c) => c.getAttribute('stroke-dasharray')).join('|'));
  const mid = await arcs();
  await page.waitForTimeout(1400);
  const settled = await arcs();
  if (mid === settled) throw new Error('ring arcs did not animate: ' + mid.slice(0, 80));
  if (!settled) throw new Error('no ring arcs rendered');
});
await page.screenshot({ path: 'out/j5-relaunch.png' });

/* ---------- spec 0008: profile, export, DELETE (the full GDPR arc) ---------- */
/* ---------- spec 0009: Trends, walked by taps ---------- */
await step('Trends tab is LIVE: opens with Weight empty state (no weigh-ins yet)', async () => {
  await page.getByTestId('tab-trends').click();
  await page.getByText('Your weight trend starts with one number.').waitFor({ timeout: 5000 });
});
await page.waitForTimeout(600);            // let the fade land before shooting
await page.screenshot({ path: 'out/j8-trends-empty.png' });
await step('log a weigh-in through the sheet → hero + chart appear', async () => {
  await page.getByTestId('log-weight-cta').click();
  await page.getByTestId('weight-kg-input').waitFor({ timeout: 4000 });
  await human(page.getByTestId('weight-kg-input'), '68.2');
  await page.getByTestId('weight-save').click();
  const hero = await page.getByTestId('weight-hero').textContent({ timeout: 5000 });
  if (!hero.includes('68.2')) throw new Error(`hero showed "${hero}"`);
});
await page.waitForTimeout(900);            // settle fade + chart sweep
await page.screenshot({ path: 'out/j8b-weight.png' });
await step('slope tile is an HONEST dash with one data point, never a fake number', async () => {
  const slope = (await page.getByTestId('slope-tile').textContent()).trim();
  if (!slope.startsWith('—')) throw new Error(`slope tile fabricated "${slope}" from one weigh-in`);
});
await step('Energy segment: real bar day + target line footnote', async () => {
  await page.getByText('Energy', { exact: true }).click();
  await page.getByText('Calories eaten, last 14 days').waitFor({ timeout: 4000 });
  await page.getByText(/line = your 1,553 kcal target/).waitFor();
  await page.getByTestId('avg-eaten-tile').waitFor();
});
await step('Consistency segment: protein weeks chart from real logs', async () => {
  await page.getByText('Consistency', { exact: true }).click();
  await page.getByText('Protein days hit, by week').waitFor({ timeout: 4000 });
  await page.getByTestId('logged-pct-tile').waitFor();
});
await page.waitForTimeout(900);            // settle fade + bar growth
await page.screenshot({ path: 'out/j9-trends.png' });
await step('weigh-in push ACCEPTED by the server (synced=true only after HTTP ok)', async () => {
  await page.waitForFunction(
    () => JSON.parse(window.localStorage.getItem('weighins') ?? '[]').every((e) => e.synced === true)
      && JSON.parse(window.localStorage.getItem('weighins') ?? '[]').length > 0,
    null, { timeout: 15000 },
  );
});
await step('spec 0011: the logged food becomes a GO-TO; one tap re-logs it', async () => {
  await page.getByTestId('tab-log').click();
  await page.getByText(/YOUR GO-TOS/).waitFor({ timeout: 4000 });
  // the banana logged minutes ago is now the user's go-to — from real history
  const quick = page.locator('[data-testid^="quickadd-"]').first();
  await quick.waitFor({ timeout: 4000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'out/j11-gotos.png' });
  await quick.click();                                  // ONE TAP re-log
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 6000 });
  // two entries now; calories dropped by the banana again (1,553-89-89 = 1,375)
  const rows = await page.locator('[data-testid^="entry-"]').count();
  if (rows !== 2) throw new Error(`expected 2 entries after quick-add, saw ${rows}`);
  await page.getByText('1,375').first().waitFor({ timeout: 5000 });
});
await step('spec 0011: the quick-added entry reaches the server too', async () => {
  await page.waitForFunction(
    () => JSON.parse(window.localStorage.getItem('entries') ?? '[]').length === 2
      && JSON.parse(window.localStorage.getItem('entries') ?? '[]').every((e) => e.synced === true),
    null, { timeout: 15000 });
});
await step('spec 0011: remove the duplicate again (cleanup keeps later steps exact)', async () => {
  await page.locator('[data-testid^="entry-"]').last().click({ delay: 600 });
  await page.getByTestId('confirm-remove-entry').click();
  await page.getByText('1,464').first().waitFor({ timeout: 5000 });
});

await step('spec 0010: Report tab is LIVE; fresh user sees the honest locked state', async () => {
  await page.getByTestId('tab-report').click();
  await page.getByText('Your report is almost ready.').waitFor({ timeout: 5000 });
  await page.getByText(/Log meals on \d+ more day/).waitFor({ timeout: 4000 });
  await page.getByText(/Weigh in \d+ more day/).waitFor({ timeout: 4000 });
  // NO fabricated numbers while locked
  if (await page.getByTestId('report-burn').isVisible().catch(() => false)) {
    throw new Error('burn card shown without sufficient data');
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'out/j10-report-locked.png' });
});

await step('back to Today via the tab bar (tap, not URL)', async () => {
  await page.getByTestId('tab-today').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 4000 });
});

/* ---------- QA RC-3 (D-4): a weigh-in RETUNES the whole plan ---------- */
await step('D-4: logging 60.0 kg recomputes targets — Today drops 1,553 -> 1,463', async () => {
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('log-weight-cta').first().click();
  await page.getByTestId('weight-kg-input').waitFor({ timeout: 4000 });
  await human(page.getByTestId('weight-kg-input'), '60');
  await page.getByTestId('weight-save').click();
  await page.waitForTimeout(600);
  await page.getByTestId('tab-today').click();
  // f/28/165/60/light/lose -> BMR 1330.25 x1.375 -20% = 1463.3 -> 1,463
  await page.getByText('1,463').first().waitFor({ timeout: 5000 });
  if (await page.getByText('1,553').first().isVisible().catch(() => false)) {
    throw new Error('old frozen target still on screen after weigh-in');
  }
});

/* ---------- QA RC-1 (D-1 + D-6): sign-out wipes; sign-in RESTORES ---------- */
await step('D-1: sign out clears this device back to Welcome', async () => {
  await page.getByText('You', { exact: true }).click();
  await page.getByText('CURRENT GOAL').waitFor({ timeout: 4000 });
  await page.getByTestId('row-signout').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 8000 });
  const left = await page.evaluate(() =>
    (window.localStorage.getItem('fuel.profile.v1') ?? '') + (window.localStorage.getItem('entries') ?? '[]'));
  if (left.replace(/[\[\]]/g, '').length > 0) throw new Error('local data survived sign-out: ' + left.slice(0, 50));
});
await step('D-6: signing back in RESTORES history from the server — no fake Day 1', async () => {
  await page.getByTestId('auth-email').click();
  await human(page.getByTestId('email-input'), EMAIL);
  await human(page.getByTestId('password-input'), PW);
  await page.getByTestId('auth-submit').click();
  // straight to Today (onboarding SKIPPED), meals + targets back from Postgres
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 20000 });
  await page.getByText('1,463').first().waitFor({ timeout: 5000 });
  await page.getByText(/Dinner ·/).waitFor({ timeout: 5000 });   // the logged banana came back
  if (await page.getByText('What are we working toward?').isVisible().catch(() => false)) {
    throw new Error('restore fell into onboarding despite server profile');
  }
});

await step('You tab opens Profile: goal card with real targets', async () => {
  await page.getByText('You', { exact: true }).click();
  await page.getByText('CURRENT GOAL').waitFor({ timeout: 4000 });
  await page.getByText(/1,463 kcal/).waitFor();   // post-weigh-in adapted target
  await page.getByText(/Fueling since/).waitFor();
  await page.getByText('your data stays yours').waitFor();
});
await page.screenshot({ path: 'out/j6-profile.png' });
await step('coming-soon rows are honest', async () => {
  await page.getByTestId('row-reminders').click();
  const a = await page.getByTestId('alert').textContent();
  if (!a.includes('Reminders')) throw new Error(a);
});
await step('Export: CSV has profile lines + logged entry', async () => {
  await page.getByTestId('row-export').click();
  await page.waitForTimeout(300);
  const csv = await page.evaluate(() => window.__export ?? '');
  if (!csv.includes('# profile:')) throw new Error('no profile lines');
  if (!csv.includes('day,logged_at,food_name')) throw new Error('no header');
  if (csv.trim().split('\n').length < 5) throw new Error('no entry rows: ' + csv.split('\n').length);
  const a = await page.getByTestId('alert').textContent();
  if (!a.includes('Export ready')) throw new Error(a);
});
await step('Delete asks confirmation; cancel keeps everything', async () => {
  await page.getByTestId('row-delete').click();
  await page.getByText('Delete everything?').waitFor();
  await page.getByTestId('cancel-delete').click();
  await page.getByText('CURRENT GOAL').waitFor();
});
await step('Delete confirmed: server + local erased, back to Welcome', async () => {
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 20000 });
  const left = await page.evaluate(() => (window.localStorage.getItem('fuel.profile.v1') ?? '') + '|'
    + (window.localStorage.getItem('entries') ?? '') + '|' + (window.localStorage.getItem('water') ?? '')
    + '|' + (window.localStorage.getItem('weighins') ?? ''));
  if (left.replace(/[|\[\]]/g, '').length > 0) throw new Error('local remnants: ' + left.slice(0, 60));
});
await page.screenshot({ path: 'out/j7-deleted.png' });
console.log('JOURNEY_EMAIL=' + EMAIL);
// Headed runs: hold the final screen so the human actually sees where it ended.
if (HEADED) await page.waitForTimeout(Number(process.env.HOLD_MS ?? 10000));
await browser.close();
console.log(process.exitCode ? 'JOURNEY HAD FAILURES' : 'JOURNEY FULLY PASSED');
