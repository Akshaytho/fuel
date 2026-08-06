/**
 * EASY DAY (spec 0016) — the highest-evidence unshipped feature in the
 * category: simplified logging produced 97% of days tracked vs 49% with
 * identical weight loss (JMIR Formative 2022). One tap logs your usual day.
 *
 * Lived by taps across four clock-advanced days:
 *   d1-3  she eats the same breakfast combo + dinner staple (building a usual)
 *   d1-3  the offer must NOT appear yet / for a new user
 *   d4    the log sheet offers "Your usual day"; one tap logs BOTH meals
 *   d4    server rows carry source='easy' — the record keeps the truth
 *   d4b   with breakfast already logged, only the honest remainder is offered
 *
 * Also proves the two UI-debt fixes: the + is a floating action button above
 * the bar's trailing edge, and Week carries a weigh-in affordance.
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

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const at = (n, h, m = 0) => new Date(Date.UTC(2026, 8, 7 + n, h, m));
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });
await ctx.clock.setFixedTime(at(0, 8, 0));

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-ed-${Math.random().toString(36).slice(2)}.json`;
  const args = ['-s','-o',tmp,'-w','%{http_code}','-m','30','-X',req.method(),req.url()];
  for (const [k,v] of Object.entries(await req.allHeaders()))
    if (['apikey','authorization','content-type','prefer'].includes(k.toLowerCase())) args.push('-H',`${k}: ${v}`);
  const b = req.postData(); if (b) args.push('--data-binary', b);
  try {
    const st = Number(execFileSync('curl', args).toString().trim() || 500);
    await route.fulfill({ status: st, contentType: 'application/json', body: readFileSync(tmp) });
  } catch { await route.fulfill({ status: 599, contentType: 'application/json', body: '{}' }); }
};
if (process.env.CURL_BRIDGE === '1') await ctx.route('**supabase.co/**', bridge);
else await ctx.route('**supabase.co/functions/v1/**', bridge);

const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

let shots = 0;
const shot = async (n) => { shots += 1; await page.waitForTimeout(1100); await page.screenshot({ path: `out/ed-${String(shots).padStart(2,'0')}-${n}.png` }); };
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/ed-FAIL-${name.slice(0,20).replace(/[^a-z0-9]/gi,'_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
};
const logFood = async (q, meal, p = 1) => {
  await page.getByTestId('tab-log').click();
  await page.locator('input').first().click();
  await page.locator('input').first().fill(q);
  const first = page.locator('[data-testid^="add-"]').first();
  await first.waitFor({ timeout: 20000 });
  await first.click();
  await page.getByTestId('log-cta').waitFor({ timeout: 6000 });
  await page.getByTestId(`portion-${p}`).click().catch(() => {});
  await page.getByTestId(`meal-${meal}`).click();
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 9000 });
};
const closeSheet = async () => { await page.mouse.click(195, 40); await page.waitForTimeout(500); };

const EMAIL = `easy-${Date.now()}@fuel.test`;
console.log('ACCOUNT ' + EMAIL);

await step('onboard; a NEW user is never offered a usual day', async () => {
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
  await page.getByTestId('tab-log').click();
  await page.waitForTimeout(700);
  if (await page.getByTestId('easy-day').isVisible().catch(() => false)) {
    throw new Error('a brand-new user was offered a "usual day" that does not exist');
  }
  await closeSheet();
});

for (let n = 0; n < 3; n += 1) {
  await step(`day ${n + 1}: the same breakfast combo + dinner staple`, async () => {
    if (n > 0) {
      await ctx.clock.setFixedTime(at(n, 8, 0));
      await page.reload();
      await page.getByText(new RegExp(`Day ${n + 1}`)).waitFor({ timeout: 14000 });
    }
    await logFood('banana', 'breakfast', 1);
    await logFood('apple juice', 'breakfast', 1);
    await logFood('beef', 'dinner', 2);
  });
}

await step('day 4: the log sheet offers the usual day', async () => {
  await ctx.clock.setFixedTime(at(3, 8, 0));
  await page.reload();
  await page.getByText(/Day 4/).waitFor({ timeout: 14000 });
  await page.getByTestId('tab-log').click();
  await page.getByTestId('easy-day').waitFor({ timeout: 9000 });
  await shot('offer');
  const offer = (await page.getByTestId('easy-day').innerText()).replace(/\n/g, ' | ');
  console.log(`OFFER: ${offer}`);
  if (!/Your usual day/.test(offer)) throw new Error('offer is not the full usual day: ' + offer);
  if (!/Breakfast \+ Dinner/.test(offer)) throw new Error('offer does not name the meals: ' + offer);
  if (!/one tap/.test(offer)) throw new Error('offer does not say the cost: ' + offer);
});

await step('one tap logs BOTH meals', async () => {
  await page.getByTestId('easy-day').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 9000 });
  await shot('after-tap');
  const n = await page.locator('[data-testid^="entry-"]').count();
  console.log(`entries after one tap: ${n}`);
  if (n !== 3) throw new Error(`expected 3 entries (2 breakfast + 1 dinner), got ${n}`);
  const body = await page.locator('body').innerText();
  if (!/Breakfast ·/.test(body) || !/Dinner ·/.test(body)) throw new Error('meals not assigned to their slots');
});

await step("the server keeps the truth: source='easy'", async () => {
  await page.waitForTimeout(1800);
  const rows = sql(`select e.source, count(*)::int as n
    from public.log_entries e join auth.users u on u.id=e.user_id
    where u.email='${EMAIL}' and e.day='2026-09-10' group by e.source`);
  console.log('SERVER day-4: ' + JSON.stringify(rows));
  const easy = rows.find((r) => r.source === 'easy');
  if (!easy || easy.n !== 3) throw new Error('easy entries not stored with source=easy: ' + JSON.stringify(rows));
});

await step('day 5: with breakfast logged, only the honest remainder is offered', async () => {
  await ctx.clock.setFixedTime(at(4, 8, 0));
  await page.reload();
  await page.getByText(/Day 5/).waitFor({ timeout: 14000 });
  await logFood('almond butter', 'breakfast', 1);   // something else for breakfast
  await page.getByTestId('tab-log').click();
  await page.getByTestId('easy-day').waitFor({ timeout: 9000 });
  const offer = (await page.getByTestId('easy-day').innerText()).replace(/\n/g, ' | ');
  console.log(`REMAINDER OFFER: ${offer}`);
  await shot('remainder');
  if (!/usual dinner/i.test(offer)) throw new Error('remainder is not scoped to dinner: ' + offer);
  if (/Breakfast/.test(offer)) throw new Error('offering breakfast that is already logged: ' + offer);
  await closeSheet();
});

await step('UI debt: the + is a FAB above the trailing edge, not at 62%', async () => {
  const pos = await page.getByTestId('tab-log').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { cx: Math.round(r.left + r.width / 2), top: Math.round(r.top), vw: window.innerWidth };
  });
  console.log(`FAB centre x=${pos.cx} of ${pos.vw}, top=${pos.top}`);
  if (pos.cx < pos.vw * 0.8) throw new Error(`the + is not docked at the trailing edge (${pos.cx}/${pos.vw})`);
  await shot('fab');
});

await step('UI debt: Week carries a weigh-in affordance', async () => {
  await page.getByTestId('tab-trends').click();
  await page.getByTestId('week-log-weight').waitFor({ timeout: 9000 });
  await page.getByTestId('week-log-weight').click();
  await page.getByTestId('weight-kg-input').waitFor({ timeout: 6000 });
  await page.getByTestId('weight-kg-input').fill('70.6');
  await page.getByTestId('weight-save').click();
  await page.waitForTimeout(900);
  console.log('weigh-in from the Week segment: saved');
  await page.getByTestId('tab-today').click();
  await page.waitForTimeout(600);
});

await step('cleanup', async () => {
  await page.getByTestId('tab-you').click();
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
});

await browser.close();
console.log(process.exitCode ? 'EASY DAY HAD FAILURES' : 'EASY DAY FULLY PASSED');
