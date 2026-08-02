/**
 * IA AUDIT — measure what each screen actually carries, from the real app.
 * No opinions: element counts, scroll depth, and how far below the fold the
 * primary job of each screen sits.
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC' });

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-ia-${Math.random().toString(36).slice(2)}.json`;
  const args = ['-s','-o',tmp,'-w','%{http_code}','-m','30','-X',req.method(),req.url()];
  for (const [k,v] of Object.entries(await req.allHeaders())) {
    if (['apikey','authorization','content-type','prefer'].includes(k.toLowerCase())) args.push('-H',`${k}: ${v}`);
  }
  const b = req.postData(); if (b) args.push('--data-binary', b);
  try {
    const st = Number(execFileSync('curl', args).toString().trim() || 500);
    await route.fulfill({ status: st, contentType: 'application/json', body: readFileSync(tmp) });
  } catch { await route.fulfill({ status: 599, contentType: 'application/json', body: '{}' }); }
};
if (process.env.CURL_BRIDGE === '1') await ctx.route('**supabase.co/**', bridge);
else await ctx.route('**supabase.co/functions/v1/**', bridge);

const page = await ctx.newPage();
await page.goto('file://' + process.cwd() + '/out/index.html');

const VIEWPORT = 890;
/** Measure the scroller: total content height, and every top-level card. */
const measure = (name) => page.evaluate(({ name, VIEWPORT }) => {
  const scroller = [...document.querySelectorAll('div')]
    .filter((d) => { const s = getComputedStyle(d); return /auto|scroll/.test(s.overflowY) && d.scrollHeight > d.clientHeight + 4; })
    .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  const content = scroller ? scroller.firstElementChild : null;
  const cards = content ? [...content.children].map((el) => {
    const r = el.getBoundingClientRect();
    const txt = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return { h: Math.round(r.height), text: txt };
  }).filter((c) => c.h > 4) : [];
  const total = scroller ? scroller.scrollHeight : document.body.scrollHeight;
  return {
    name,
    totalHeight: Math.round(total),
    screensOfScroll: Math.round((total / VIEWPORT) * 10) / 10,
    topLevelCards: cards.length,
    cards,
  };
}, { name, VIEWPORT });

const EMAIL = `ia-${Date.now()}@fuel.test`;
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

const out = [];
out.push(await measure('Today — empty'));
for (const [q, m] of [['banana','breakfast'],['apple juice','lunch'],['beef','dinner']]) await logFood(q, m);
await page.getByTestId('water-add').click();
await page.waitForTimeout(900);
out.push(await measure('Today — a normal logged day'));
await page.screenshot({ path: 'out/ia-today-full.png', fullPage: false });

await page.getByTestId('tab-log').click();
await page.waitForTimeout(700);
out.push(await measure('Log sheet'));
await page.mouse.click(195, 40);
await page.waitForTimeout(500);

for (const [tab, wait] of [['tab-trends','Trends'], ['tab-report','Report'], ['tab-you','CURRENT GOAL']]) {
  await page.getByTestId(tab).click();
  await page.getByText(wait).first().waitFor({ timeout: 9000 });
  await page.waitForTimeout(900);
  out.push(await measure(tab.replace('tab-','')));
}

console.log('\n=== FUEL IA AUDIT (390x890 viewport) ===\n');
for (const s of out) {
  console.log(`${s.name}`);
  console.log(`  content height ${s.totalHeight}px = ${s.screensOfScroll} screens · ${s.topLevelCards} top-level blocks`);
  let y = 0;
  for (const c of s.cards) {
    const fold = y > VIEWPORT - 120 ? '  ⟵ below the fold' : '';
    console.log(`    ${String(y).padStart(4)}px  ${String(c.h).padStart(4)}px  ${c.text}${fold}`);
    y += c.h + 16;
  }
  console.log('');
}
writeFileSync('out/ia-audit.json', JSON.stringify(out, null, 2));

await page.getByTestId('tab-you').click();
await page.getByTestId('row-delete').click();
await page.getByTestId('confirm-delete').click();
await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
await browser.close();
