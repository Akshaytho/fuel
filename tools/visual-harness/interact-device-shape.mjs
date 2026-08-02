/**
 * B-23 — the DEVICE-SHAPED check.
 *
 * The journey harness runs react-native-web in Chromium, which has
 * crypto.randomUUID and (in CI) a UTC clock. Both of session 2's P0 bugs were
 * therefore structurally uncatchable here — they only appeared on Harish's
 * phone. This run reshapes the browser to look like a real device before the
 * app boots:
 *
 *   1. NO Web Crypto  — Hermes ships none (Expo 54 installs TextDecoder, URL
 *      and structuredClone, but not crypto), so the store's fallback id
 *      generator IS the only path on device. If it emits anything that isn't
 *      a real RFC 4122 v4, Postgres rejects it with 22P02 and sync silently
 *      dies forever (P0-A).
 *   2. Asia/Kolkata at 00:30 local — i.e. the PREVIOUS UTC day. A day bucket
 *      derived from toISOString() files this log under yesterday and it
 *      vanishes from Today (P0-B).
 *
 * Everything else is the real app, real Supabase, and taps only (rule 0a).
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

// Same portable launch as the journey harness: prefer the user's real Chrome,
// fall back to whatever Chromium this machine has (the sandbox pins one).
const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch {
  try { browser = await chromium.launch(launchOpts); }
  catch { browser = await chromium.launch({ ...launchOpts, executablePath: '/opt/pw-browsers/chromium/chrome' }); }
}

// 00:30 on 2026-08-02 in IST == 19:00 UTC on 2026-08-01 — the exact window
// where a UTC day bucket and a local header date disagree.
const LOCAL_DAY = '2026-08-02';
const FIXED_INSTANT = new Date('2026-08-01T19:00:00.000Z');

const ctx = await browser.newContext({
  viewport: { width: 390, height: 890 },
  timezoneId: 'Asia/Kolkata',
  locale: 'en-US',
});
await ctx.clock.setFixedTime(FIXED_INSTANT);

// Strip Web Crypto BEFORE any app code runs — this is the Hermes shape.
await ctx.addInitScript(() => {
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  } catch { /* already gone */ }
});

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-dev-${Math.random().toString(36).slice(2)}.json`;
  const args = ['-s', '-o', tmp, '-w', '%{http_code}', '-m', '30', '-X', req.method(), req.url()];
  const hdrs = await req.allHeaders();
  for (const [k, v] of Object.entries(hdrs)) {
    if (['apikey', 'authorization', 'content-type', 'prefer'].includes(k.toLowerCase())) args.push('-H', `${k}: ${v}`);
  }
  const body = req.postData();
  if (body) args.push('--data-binary', body);
  try {
    const status = Number(execFileSync('curl', args).toString().trim() || 500);
    await route.fulfill({ status, contentType: 'application/json', body: readFileSync(tmp) });
  } catch (e) {
    await route.fulfill({ status: 599, contentType: 'application/json', body: JSON.stringify({ error: String(e).slice(0, 120) }) });
  }
};
if (process.env.CURL_BRIDGE === '1') await ctx.route('**supabase.co/**', bridge);
else await ctx.route('**supabase.co/functions/v1/**', bridge);

const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name, '-', String(e).split('\n')[0]); process.exitCode = 1; }
};

const EMAIL = `device-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';

await step('precondition: the page really has NO Web Crypto (Hermes shape)', async () => {
  const has = await page.evaluate(() => typeof globalThis.crypto?.randomUUID === 'function');
  if (has) throw new Error('crypto.randomUUID still present — the shim did not apply');
});

await step('precondition: local day and UTC day genuinely disagree', async () => {
  const { local, utc } = await page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return {
      local: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      utc: d.toISOString().slice(0, 10),
    };
  });
  if (local === utc) throw new Error(`clock/timezone shim ineffective (both ${local})`);
  if (local !== LOCAL_DAY) throw new Error(`expected local ${LOCAL_DAY}, got ${local}`);
});

await step('onboard by tapping, exactly like a human', async () => {
  await page.getByTestId('boot-splash').waitFor({ timeout: 4000 });
  await page.getByTestId('auth-email').click({ timeout: 8000 });
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill(PW);
  await page.getByTestId('auth-submit').click();
  await page.getByText('What are we working toward?').waitFor({ timeout: 20000 });
  await page.getByTestId('goal-lose').click();
  await page.getByTestId('goal-continue').click();
  await page.getByTestId('age-input').fill('30');
  await page.getByTestId('height-input').fill('175');
  await page.getByTestId('weight-input').fill('70');
  await page.getByTestId('activity-moderate').click().catch(async () => {
    await page.getByTestId('activity-light').click();
  });
  await page.getByTestId('about-continue').click();
  await page.getByTestId('start-day1').click();
  await page.getByText('TO GO').waitFor({ timeout: 6000 });
});

await step('P0-A shape: id generated WITHOUT Web Crypto is a real RFC 4122 v4', async () => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill('banana');
  await page.waitForTimeout(2500);
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 8000 });
  const ids = await page.evaluate(() => JSON.parse(window.localStorage.getItem('entries') ?? '[]').map((e) => e.client_id));
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (ids.length === 0) throw new Error('no entry was written');
  for (const id of ids) if (!V4.test(id)) throw new Error(`non-uuid client_id on the device path: ${id}`);
});

await step('P0-A consequence: that id was ACCEPTED by Postgres (sync really happened)', async () => {
  await page.waitForFunction(
    () => JSON.parse(window.localStorage.getItem('entries') ?? '[]').every((e) => e.synced === true),
    null, { timeout: 20000 },
  );
});

await step('P0-B shape: the log files under the LOCAL day shown in the header', async () => {
  const days = await page.evaluate(() => JSON.parse(window.localStorage.getItem('entries') ?? '[]').map((e) => e.day));
  for (const d of days) {
    if (d !== LOCAL_DAY) throw new Error(`entry filed under ${d}, header says ${LOCAL_DAY} (UTC-bucket regression)`);
  }
});

await step('water also files under the local day (same bucket contract)', async () => {
  await page.getByTestId('water-add').click();
  await page.waitForFunction(
    (d) => JSON.parse(window.localStorage.getItem('water') ?? '[]').every((e) => e.day === d),
    LOCAL_DAY, { timeout: 5000 },
  );
});

await step('P0-B consequence: entry SURVIVES the UTC rollover (the 05:30 IST vanish)', async () => {
  // This is the step that reproduces the actual user-visible failure. At a
  // single instant a UTC-bucketed entry still shows (the app queries the same
  // wrong day). The bug bites when UTC rolls over a few hours later: the
  // query moves to the new day, the entry stays on the old one, and the
  // user's breakfast disappears. So: advance the clock past the rollover,
  // relaunch, and demand the log still be there.
  await ctx.clock.setFixedTime(new Date('2026-08-02T06:00:00.000Z'));  // 11:30 IST, same local day
  await page.reload();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 12000 });
  const shown = await page.locator('text=/\\d+ g · \\d+ kcal/').count();
  if (shown === 0) throw new Error('the logged meal vanished when UTC rolled over — P0-B is back');
  const water = (await page.getByTestId('water-add-value').textContent()).trim();
  if (water.startsWith('0 /')) throw new Error('water vanished when UTC rolled over');
});

await page.screenshot({ path: 'out/d1-device-shape.png' });
console.log('DEVICE_EMAIL=' + EMAIL);
await browser.close();
console.log(process.exitCode ? 'DEVICE-SHAPE CHECK HAD FAILURES' : 'DEVICE-SHAPE CHECK FULLY PASSED');
