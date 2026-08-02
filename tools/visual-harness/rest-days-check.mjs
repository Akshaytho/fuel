/**
 * REST DAYS (spec 0013) — the streak that survives a sick day.
 *
 * The churn literature's dominant abandonment cascade is "missed a day → the
 * summary is wrong → logging feels pointless → gone", and only 23% of people
 * who quit a food tracker did so because they reached their goal. This walks a
 * real person through earning a rest day, spending it, and being told the
 * truth about it — all by taps, with the clock advancing a day at a time.
 *
 * The hard rule under test: a rest day must NEVER be presented as a logged day.
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }

const at = (n, h, m = 0) => new Date(Date.UTC(2026, 8, 7 + n, h, m));   // Mon 2026-09-07
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });
await ctx.clock.setFixedTime(at(0, 8, 0));

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-rd-${Math.random().toString(36).slice(2)}.json`;
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
const shot = async (n) => { shots += 1; await page.waitForTimeout(1100); await page.screenshot({ path: `out/rd-${String(shots).padStart(2, '0')}-${n}.png` }); };
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/rd-FAIL-${name.slice(0, 20).replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
};
const logFood = async (meal) => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill('beef');
  await page.waitForTimeout(2200);
  const first = page.locator('[data-testid^="add-"]').first();
  await first.waitFor({ timeout: 8000 });
  await first.click();
  await page.getByTestId('log-cta').waitFor({ timeout: 6000 });
  await page.getByTestId('portion-2').click().catch(() => {});
  await page.getByTestId(`meal-${meal}`).click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 8000 });
};
/** IA 0001: the run detail ("8 days · 1 rest day") lives on Progress now.
    Walk there by tapping, read it, and come back — no shortcuts. */
const streakText = async () => {
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('streak-detail').waitFor({ timeout: 9000 });
  const txt = (await page.getByTestId('streak-detail').innerText()).replace(/\n/g, ' ');
  await page.getByTestId('tab-today').click();
  await page.waitForTimeout(600);
  return txt;
};

const EMAIL = `rest-${Date.now()}@fuel.test`;
console.log('ACCOUNT ' + EMAIL);

await step('day 1: onboard and log', async () => {
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
  await logFood('breakfast');
  await logFood('dinner');
});

for (let n = 1; n <= 6; n += 1) {
  await step(`day ${n + 1}: keep the run going`, async () => {
    await ctx.clock.setFixedTime(at(n, 9, 0));
    await page.reload();
    await page.getByText(new RegExp(`Day ${n + 1}`)).waitFor({ timeout: 12000 });
    await logFood('breakfast');
    await logFood('dinner');
  });
}

await step('after 7 days the streak reads 7 and a rest day is banked', async () => {
  const txt = await streakText();
  console.log(`STREAK after 7 days: "${txt.trim()}"`);
  await shot('day7-streak-7');
  if (!/\b7\b/.test(txt)) throw new Error('streak is not 7: ' + txt);
});

await step('DAY 8: she is ill and never opens the app', async () => {
  console.log('day 8: no usage at all');
});

await step('DAY 9: the streak HELD, and the app says why', async () => {
  await ctx.clock.setFixedTime(at(8, 8, 30));
  await page.reload();
  await page.getByText(/Day 9/).waitFor({ timeout: 12000 });
  await shot('day9-streak-held');
  const body = await page.locator('body').innerText();
  if (/Day 1 of your streak starts now/.test(body)) {
    throw new Error('the streak was reset — a rest day should have covered day 8');
  }
  const note = (await page.getByTestId('rest-note').innerText()).replace(/\n/g, ' | ');
  console.log(`REST NOTE: ${note}`);
  if (!/streak held/i.test(note)) throw new Error('no acknowledgement that the streak held: ' + note);
  if (!/earned it/i.test(note)) throw new Error('does not say the rest day was earned: ' + note);
  // Day 9 is the Tuesday of a NEW week: Monday was the rested day. The strip
  // must draw Monday as RESTED — neither logged (a lie) nor missed (unfair).
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('week-summary').waitFor({ timeout: 9000 });
  const wk = (await page.getByTestId('week-summary').textContent()).trim();
  console.log(`WEEK STRIP on day 9 (Progress): "${wk}"`);
  if (!/No days logged yet this week/.test(wk)) {
    throw new Error('week strip counted the rested day as a logged day: ' + wk);
  }
  const mon = await page.getByTestId('week-dot-0').evaluate((el) => ({
    border: getComputedStyle(el).borderColor,
    label: el.getAttribute('aria-label') ?? el.getAttribute('data-testid'),
    kids: el.children.length,
  }));
  console.log(`MONDAY dot: ${JSON.stringify(mon)}`);
  if (mon.kids === 0) throw new Error('the rested Monday has no rest marker on it');
  if (!/255, 159, 10/.test(mon.border)) throw new Error('rested day is not drawn as a rest day: ' + mon.border);
  await page.getByTestId('tab-today').click();
  await page.waitForTimeout(600);
});

await step('logging today continues the run to 8, and SAYS a rest day was used', async () => {
  await logFood('breakfast');
  await logFood('dinner');
  await shot('day9-after-logging');
  const txt = await streakText();
  console.log(`STREAK after the save: "${txt.trim()}"`);
  if (!/\b8\b/.test(txt)) throw new Error('run did not continue to 8 logged days: ' + txt);
  if (!/1 rest day/.test(txt)) throw new Error('the rest day is hidden from the user: ' + txt);
  if (/\b9 days\b/.test(txt)) throw new Error('the app is claiming a day she did not log');
});

await step('DAYS 10-11 missed with nothing banked: it breaks, honestly', async () => {
  await ctx.clock.setFixedTime(at(11, 9, 0));
  await page.reload();
  await page.getByText(/Day 12/).waitFor({ timeout: 12000 });
  await shot('day12-broken');
  const body = await page.locator('body').innerText();
  if (!/Welcome back/.test(body)) throw new Error('a real break should get the comeback card');
  if (/streak held/i.test(body)) throw new Error('claiming the streak held after a two-day gap');
  console.log('two-day gap: comeback shown, no false save');
});

await step('cleanup', async () => {
  await page.getByTestId('tab-you').click();
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
});

await browser.close();
console.log(process.exitCode ? 'REST DAYS HAD FAILURES' : 'REST DAYS FULLY PASSED');
