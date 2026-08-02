/**
 * TODAY, REBUILT (docs/research/0003) — proves the new information
 * architecture by taps, and asserts the rules that keep it from re-bloating.
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-ia-${Math.random().toString(36).slice(2)}.json`;
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
const shot = async (n) => { shots += 1; await page.waitForTimeout(1100); await page.screenshot({ path: `out/iat-${String(shots).padStart(2,'0')}-${n}.png` }); };
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/iat-FAIL-${name.slice(0,20).replace(/[^a-z0-9]/gi,'_')}.png` }).catch(() => {});
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

/** Count the top-level blocks inside Today's scroller, and find the meals list. */
const layout = () => page.evaluate(() => {
  const scroller = [...document.querySelectorAll('div')]
    .filter((d) => { const s = getComputedStyle(d); return /auto|scroll/.test(s.overflowY); })
    .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  const content = scroller ? scroller.firstElementChild : null;
  const kids = content ? [...content.children].filter((el) => el.getBoundingClientRect().height > 4) : [];
  const mealsIdx = kids.findIndex((el) => (el.textContent ?? '').includes("TODAY'S MEALS"));
  let y = 0;
  for (let i = 0; i < mealsIdx; i += 1) y += kids[i].getBoundingClientRect().height + 16;
  return {
    blocks: kids.length,
    labels: kids.map((el) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 42)),
    mealsTop: Math.round(y),
    totalHeight: Math.round(scroller ? scroller.scrollHeight : 0),
  };
});

const EMAIL = `iat-${Date.now()}@fuel.test`;
console.log('ACCOUNT ' + EMAIL);

await step('onboard and log a normal day', async () => {
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
  for (const [q, m] of [['banana','breakfast'],['apple juice','lunch'],['beef','dinner']]) await logFood(q, m);
  await page.getByTestId('water-add').click();
});

await step('Today holds at most 5 blocks, and the meals list is near the top', async () => {
  await shot('today-rebuilt');
  const l = await layout();
  console.log(`BLOCKS ${l.blocks} · content ${l.totalHeight}px · meals start at ${l.mealsTop}px`);
  for (const s of l.labels) console.log('   · ' + s);
  if (l.blocks > 5) throw new Error(`Today has ${l.blocks} blocks — the IA rule is at most 5`);
  // it was 705px before the rebuild; it must not have moved further away
  if (l.mealsTop > 705) throw new Error(`meals list moved DOWN to ${l.mealsTop}px (was 705)`);
});

await step('fibre is off the surface and one tap inside', async () => {
  const body = await page.locator('body').innerText();
  if (/Fibre/.test(body)) throw new Error('fibre is still on the Today surface');
  await page.getByTestId('nutrition-card').click();
  await page.getByTestId('fibre-detail').waitFor({ timeout: 5000 });
  await shot('detail-sheet');
  const sheet = (await page.getByTestId('fibre-detail').innerText()).replace(/\n/g, ' | ');
  console.log(`DETAIL fibre: ${sheet}`);
  if (!/g \/ 22 g|at least|—/.test(sheet)) throw new Error('fibre detail is not showing a value: ' + sheet);
  await page.getByTestId('detail-close').click();
  await page.waitForTimeout(600);
});

await step('the streak is a chip in the header, not a card', async () => {
  const chip = await page.getByTestId('streak-chip').isVisible().catch(() => false);
  if (!chip) throw new Error('no streak chip in the header');
  const txt = (await page.getByTestId('streak-chip').innerText()).trim();
  console.log(`STREAK CHIP: "${txt}"`);
  const body = await page.locator('body').innerText();
  if (/Streak\n/.test(body)) throw new Error('the old streak CARD is still on Today');
});

await step('water still adds in one tap, without leaving the screen', async () => {
  const before = (await page.getByTestId('water-add-value').innerText()).trim();
  await page.getByTestId('water-add').click();
  await page.waitForTimeout(700);
  const after = (await page.getByTestId('water-add-value').innerText()).trim();
  console.log(`WATER ${before} -> ${after}`);
  if (before === after) throw new Error('water row did not register the tap');
});

await step('the week strip has left Today', async () => {
  const body = await page.locator('body').innerText();
  if (/days logged this week/.test(body)) throw new Error('the week strip is still on Today');
});

await step('never two banners: only one moment renders', async () => {
  const n = await page.locator('[data-testid="coach-strip"], [data-testid="comeback-card"], [data-testid="rest-note"]').count();
  console.log(`moments on screen: ${n}`);
  if (n > 1) throw new Error(`${n} moments rendered at once — the slot allows one`);
});

await step('cleanup', async () => {
  await page.getByTestId('tab-you').click();
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
});

await browser.close();
console.log(process.exitCode ? 'TODAY IA HAD FAILURES' : 'TODAY IA FULLY PASSED');
