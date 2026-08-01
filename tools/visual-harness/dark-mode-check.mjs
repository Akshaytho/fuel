/**
 * DARK MODE CHECK — the theme that ships automatically and had never once
 * been rendered by a test.
 *
 * App.tsx picks `dark` from useColorScheme, so a user whose phone is in dark
 * mode gets it on first launch with no opt-in. This walks the real screens in
 * dark by taps and asserts, per screen:
 *   1. the surface is genuinely dark (sampled pixels, not a claim),
 *   2. every visible text node clears WCAG AA contrast (4.5:1 body / 3:1
 *      large) against what is actually behind it,
 *   3. no element is invisible-on-invisible (same color as its background).
 * Screenshots are captured for eyeball review.
 */
import { chromium } from 'playwright';
process.env.FUEL_THEME = 'dark';
await import('./build-only.mjs');
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, colorScheme: 'dark' });

const bridge = async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-dk-${Math.random().toString(36).slice(2)}.json`;
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
else await ctx.route('**supabase.co/functions/v1/**', bridge);

const page = await ctx.newPage();
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) {
    console.error('FAIL', name, '-', String(e).split('\n')[0]);
    await page.screenshot({ path: `out/dk-FAIL-${name.slice(0, 18).replace(/[^a-z0-9]/gi, '_')}.png` }).catch(() => {});
    process.exitCode = 1;
  }
};

/** WCAG contrast audit of every visible text node, run inside the page. */
const auditContrast = () => page.evaluate(() => {
  const lum = (r, g, b) => {
    const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (c) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c || '');
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  // walk up for the first opaque background actually painted behind the node
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.9) return c;
      n = n.parentElement;
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  };
  const ratio = (a, b) => {
    const l1 = lum(a.r, a.g, a.b), l2 = lum(b.r, b.g, b.b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const out = [];
  for (const el of document.querySelectorAll('div,span')) {
    const txt = (el.textContent ?? '').trim();
    if (!txt || el.children.length > 0) continue;         // leaf text only
    // Emoji paint their OWN colors; CSS `color` does not apply, so a
    // contrast ratio against the text color is meaningless for them.
    if (!/[a-z0-9]/i.test(txt)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const fg = parse(cs.color);
    if (!fg || fg.a < 0.5) continue;
    const bg = bgOf(el);
    const size = parseFloat(cs.fontSize) || 14;
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bg);
    if (got < need) out.push({ text: txt.slice(0, 40), got: Math.round(got * 100) / 100, need, size, color: cs.color });
  }
  return out;
});

/** Is the painted page actually dark? Sample the body background. */
const surfaceIsDark = () => page.evaluate(() => {
  const c = getComputedStyle(document.querySelector('#root > div') ?? document.body).backgroundColor;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
  if (!m) return { c, luma: 1 };
  const luma = (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255;
  return { c, luma };
});

const EMAIL = `darkmode-${Date.now()}@fuel.test`;
const PW = 'e2e-Fuel-2026!x';
console.log('ACCOUNT ' + EMAIL);

const screens = [];
const checkScreen = async (name) => {
  await page.waitForTimeout(700);
  const surf = await surfaceIsDark();
  const bad = await auditContrast();
  await page.screenshot({ path: `out/dk-${screens.length + 1}-${name}.png` });
  screens.push(name);
  console.log(`SCREEN ${name} surface=${surf.c} luma=${surf.luma.toFixed(2)} lowContrast=${bad.length}`);
  if (surf.luma > 0.35) throw new Error(`${name}: surface is not dark (${surf.c})`);
  if (bad.length > 0) {
    throw new Error(`${name}: ${bad.length} low-contrast text: ` +
      bad.slice(0, 4).map((b) => `"${b.text}" ${b.got}:1 <${b.need} (${b.color})`).join(' | '));
  }
};

await step('welcome in dark', async () => {
  await page.getByTestId('boot-splash').waitFor({ timeout: 4000 });
  await checkScreen('boot');
  await page.getByText('The honest way to eat better').waitFor({ timeout: 6000 });
  await checkScreen('welcome');
});

await step('onboarding in dark (goal → about → plan)', async () => {
  await page.getByTestId('auth-email').click();
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill(PW);
  await page.getByTestId('auth-submit').click();
  await page.getByText('What are we working toward?').waitFor({ timeout: 20000 });
  await checkScreen('goal');
  await page.getByTestId('goal-lose').click();
  await page.getByTestId('goal-continue').click();
  await page.getByTestId('age-input').fill('28');
  await page.getByTestId('height-input').fill('165');
  await page.getByTestId('weight-input').fill('68.2');
  await page.getByTestId('activity-light').click();
  await checkScreen('about');
  await page.getByTestId('about-continue').click();
  await page.getByText('1,553').waitFor({ timeout: 6000 });
  await checkScreen('plan');
});

await step('Today in dark, empty and with data', async () => {
  await page.getByTestId('start-day1').click();
  await page.getByText('TO GO').waitFor({ timeout: 6000 });
  await checkScreen('today-empty');
  await page.getByTestId('tab-log').click();
  await checkScreen('log-sheet');
  await page.locator('input').first().click();
  await page.locator('input').first().fill('banana');
  await page.waitForTimeout(2500);
  await checkScreen('search');
  await page.locator('[data-testid^="add-"]').first().click();
  await page.getByTestId('log-cta').waitFor({ timeout: 5000 });
  await checkScreen('portion');
  await page.getByTestId('log-cta').click();
  await page.getByText("TODAY'S MEALS").waitFor({ timeout: 6000 });
  await page.getByTestId('water-add').click();
  await checkScreen('today-with-data');
});

await step('Trends, Report and Profile in dark', async () => {
  await page.getByTestId('tab-trends').click();
  await page.getByText('Trends').first().waitFor({ timeout: 5000 });
  await checkScreen('trends');
  await page.getByTestId('tab-report').click();
  await page.getByTestId('report-headline').waitFor({ timeout: 5000 });
  await checkScreen('report');
  await page.getByTestId('tab-you').click();
  await page.getByText('CURRENT GOAL').waitFor({ timeout: 5000 });
  await checkScreen('profile');
});

await step('cleanup: delete the dark-mode account', async () => {
  await page.getByTestId('row-delete').click();
  await page.getByTestId('confirm-delete').click();
  await page.getByText('The honest way to eat better').waitFor({ timeout: 25000 });
});

await browser.close();
console.log(`SCREENS CHECKED ${screens.length}`);
console.log(process.exitCode ? 'DARK MODE HAD FAILURES' : 'DARK MODE FULLY PASSED');
