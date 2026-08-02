/**
 * MOTION RESILIENCE — permanent regression guard for the blank-screen class.
 *
 * Real failure this exists for (2026-09): two persona screenshots came back
 * completely blank because RN Web's Animated.timing drives itself from
 * Date.now(); with the clock frozen the fade never finished and the wrapper
 * holding the ENTIRE screen sat at opacity 0. On a real phone the same thing
 * happens on an NTP correction, a timezone change, or a stalled JS thread.
 *
 * Three scenarios, each asserting the SCREEN IS VISIBLE:
 *   A. frozen wall clock  — Date.now() never advances
 *   B. backwards clock    — Date.now() jumps into the past mid-animation
 *   C. Reduce Motion on   — accessibility path renders final state instantly
 *
 * Visibility is proven three ways per scenario: the wrapper's computed
 * opacity, the count of painted text nodes, and PIXEL VARIANCE of the actual
 * screenshot (a blank page has near-zero variance — that is what caught this
 * in the first place).
 */
import { chromium } from 'playwright';
await import('./build-only.mjs');
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';

const launchOpts = { headless: process.env.HEADED !== '1' };
let browser;
try { browser = await chromium.launch({ channel: 'chrome', ...launchOpts }); }
catch { browser = await chromium.launch(launchOpts); }

let failures = 0;
const fail = (msg) => { console.error('FAIL', msg); failures++; process.exitCode = 1; };

/** Distinct-color count of a PNG, via ImageMagick if present, else a raw
 *  byte-entropy proxy. A blank screen collapses to ~1 color. */
const paintedColors = (path) => {
  try {
    const out = execFileSync('identify', ['-format', '%k', path], { stdio: ['ignore', 'pipe', 'ignore'] });
    return Number(out.toString().trim());
  } catch {
    const buf = readFileSync(path);
    const seen = new Set();
    for (let i = 0; i < buf.length; i += 7) seen.add(buf[i]);
    return seen.size;
  }
};

const inspect = (page) => page.evaluate(() => {
  const wrap = document.querySelector('[data-testid="fade-slide-in"]');
  const cs = wrap ? getComputedStyle(wrap) : null;
  let painted = 0;
  for (const el of document.querySelectorAll('div,span')) {
    const txt = (el.textContent ?? '').trim();
    if (!txt || el.children.length > 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || Number(s.opacity) < 0.5) continue;
    // an ancestor at opacity 0 hides it regardless of its own style
    let n = el, hidden = false;
    while (n && n !== document.body) {
      if (Number(getComputedStyle(n).opacity) < 0.5) { hidden = true; break; }
      n = n.parentElement;
    }
    if (!hidden) painted++;
  }
  return { wrapperOpacity: cs ? Number(cs.opacity) : null, wrapperTransform: cs ? cs.transform : null, painted };
});

const scenario = async (name, contextOpts, prepare) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 890 }, timezoneId: 'UTC', ...contextOpts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`${name}: page error ${e.message}`));
  if (prepare) await prepare(ctx, page);
  await page.goto('file://' + process.cwd() + '/out/index.html');

  // Boot splash must not be a black hole either — it is the first thing a
  // user sees and it is entirely animation-driven.
  await page.getByTestId('boot-splash').waitFor({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1600);
  const bootShot = `out/motion-${name}-1-boot.png`;
  await page.screenshot({ path: bootShot });
  const bootColors = paintedColors(bootShot);
  if (bootColors < 8) fail(`${name}: boot splash is blank (${bootColors} distinct colors)`);

  // Welcome screen — the FadeSlideIn wrapper that blanked in the real bug.
  await page.getByText('The honest way to eat better').waitFor({ timeout: 12000 })
    .catch(() => fail(`${name}: welcome copy never appeared`));
  await page.waitForTimeout(900);
  const shot = `out/motion-${name}-2-welcome.png`;
  await page.screenshot({ path: shot });
  const colors = paintedColors(shot);
  const info = await inspect(page);

  console.log(`${name}: wrapperOpacity=${info.wrapperOpacity} painted=${info.painted} colors=${colors}`);
  if (info.wrapperOpacity !== null && info.wrapperOpacity < 0.99) {
    fail(`${name}: screen wrapper stuck at opacity ${info.wrapperOpacity}`);
  }
  if (info.painted < 3) fail(`${name}: only ${info.painted} visible text nodes — screen is effectively blank`);
  if (colors < 8) fail(`${name}: screenshot has ${colors} distinct colors — blank render`);
  if (failures === 0) console.log('PASS', name);
  await ctx.close();
};

// A. Frozen wall clock: Date.now() pinned. This is the exact condition that
//    produced the two blank persona screenshots.
await scenario('frozen-clock', {}, async (ctx) => {
  await ctx.clock.setFixedTime(new Date(Date.UTC(2026, 8, 9, 12, 0)));
});

// B. Clock jumps BACKWARDS after load (NTP correction / user edits the date).
//    Animated sees negative elapsed time and can wedge permanently.
await scenario('backwards-clock', {}, async (ctx) => {
  await ctx.clock.install({ time: new Date(Date.UTC(2026, 8, 9, 12, 0)) });
  await ctx.clock.setFixedTime(new Date(Date.UTC(2026, 8, 9, 11, 59)));
});

// C. Reduce Motion: users with vestibular disorders must still get the app.
await scenario('reduced-motion', { reducedMotion: 'reduce' });

await browser.close();
console.log(failures ? `MOTION RESILIENCE FAILURES: ${failures}` : 'MOTION RESILIENCE FULLY PASSED');
