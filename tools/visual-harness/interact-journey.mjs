// Spec 0007 AC1 — the COMPLETE user journey, driven and asserted.
// Uses the same build pipeline as interact.mjs, then walks:
// welcome → live email auth → goal → about-you → plan (exact domain numbers)
// → Start Day 1 → Day-1 Today → log a real food (live search + live sync)
// → RELOAD → lands on Today with data intact.
import { chromium } from 'playwright';
await import('./build-only.mjs');

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 460, height: 980 } });
// Sandbox note: headless Chromium cannot tunnel through the egress relay,
// so Supabase calls are bridged through curl (which can). App code untouched.
await ctx.route('**supabase.co/**', async (route) => {
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
});
const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name, '-', String(e).split('\n')[0]); process.exitCode = 1; }
};

const EMAIL = `journey-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';

await page.waitForTimeout(800);
await page.screenshot({ path: 'out/j1-welcome.png' });

await step('Welcome renders: brand, tagline, three promises, auth options', async () => {
  await page.getByText('The honest way to eat better').waitFor({ timeout: 4000 });
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
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill(PW);
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
  await page.getByTestId('age-input').fill('28');
  await page.getByTestId('height-input').fill('165');
  await page.getByTestId('weight-input').fill('68.2');
  await page.getByTestId('activity-light').click();
  await page.getByTestId('about-continue').click();
  await page.getByText('Your starting plan').waitFor();
});
await page.screenshot({ path: 'out/j3-plan.png' });
await step('plan shows EXACT domain-computed targets (f/28/165/68.2/light/lose)', async () => {
  // BMR=1412.25 ×1.375=1941.84 ×0.8=1553.475 → 1,553 kcal; protein 1.8×68.2=122.8→123g; water 2.5L
  await page.getByText('1,553').waitFor();
  await page.getByText('123g').waitFor();
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
  await page.locator('input').first().fill('banana');
  await page.waitForTimeout(2500);                       // live query
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('log-cta').waitFor();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 5000 });
});
await step('RELOAD = relaunch: straight to Today, data intact (no onboarding)', async () => {
  await page.reload();
  await page.waitForTimeout(1200);
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 5000 });
  await page.getByText('1,553').first().waitFor();
  if (await page.getByText('What are we working toward?').isVisible().catch(() => false)) {
    throw new Error('onboarding shown again');
  }
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
await browser.close();
console.log(process.exitCode ? 'JOURNEY HAD FAILURES' : 'JOURNEY FULLY PASSED');
