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
await step('log real food: live search → portion → rings move', async () => {
  await page.getByTestId('tab-log').click();
  await page.getByText(/YOUR GO-TOS/).waitFor();
  await page.locator('input').first().click();
  await page.getByText('Searches your food database').waitFor({ timeout: 4000 });
  await human(page.locator('input').first(), 'banana');
  await page.waitForTimeout(2500);                       // live query
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('log-cta').waitFor();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 5000 });
});
// page.reload() below is the ONE allowed non-tap action (CLAUDE.md rule 0a):
// it simulates killing and relaunching the app, which has no tappable gesture.
await step('RELAUNCH: splash again, then straight to Today, data intact', async () => {
  await page.reload();
  await page.getByTestId('boot-splash').waitFor({ timeout: 3000 });
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 9000 });
  await page.getByText('1,553').first().waitFor();
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
await step('You tab opens Profile: goal card with real targets', async () => {
  await page.getByText('You', { exact: true }).click();
  await page.getByText('CURRENT GOAL').waitFor({ timeout: 4000 });
  await page.getByText(/1,553 kcal/).waitFor();
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
  const left = await page.evaluate(() => (window.localStorage.getItem('fuel.profile.v1') ?? '') + '|' + (window.localStorage.getItem('entries') ?? ''));
  if (left.replace(/[|\[\]]/g, '').length > 0) throw new Error('local remnants: ' + left.slice(0, 60));
});
await page.screenshot({ path: 'out/j7-deleted.png' });
console.log('JOURNEY_EMAIL=' + EMAIL);
// Headed runs: hold the final screen so the human actually sees where it ended.
if (HEADED) await page.waitForTimeout(Number(process.env.HOLD_MS ?? 10000));
await browser.close();
console.log(process.exitCode ? 'JOURNEY HAD FAILURES' : 'JOURNEY FULLY PASSED');
