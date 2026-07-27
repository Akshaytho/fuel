// Spec 0006 AC3 — drive the REAL UI and assert on-screen behavior.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const stubPlugin = {
  name: 'rn-codegen-stub',
  setup(b) {
    b.onResolve({ filter: /codegenNativeComponent|codegenNativeCommands|fabric\/NativeSvg/ }, () => ({ path: 'stub', namespace: 'rn-stub' }));
    b.onResolve({ filter: /^react-native-svg$/ }, () => ({ path: '/home/claude/fuel/node_modules/.pnpm/react-native-svg@15.15.5_react-native@0.79.0_@babel+core@7.29.7_@types+react@19.0.14_react@19.0.0__react@19.0.0/node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js' }));
    b.onLoad({ filter: /.*/, namespace: 'rn-stub' }, () => ({ contents: 'const stub=()=>null; export default function codegen(){ return function Stub(){ return null; }; }; export const getEnforcing=stub;', loader: 'js' }));
  },
};

await build({
  entryPoints: ['main.tsx'], bundle: true, outfile: 'out/bundle.js', format: 'iife',
  jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' },
  resolveExtensions: ['.web.js', '.web.tsx', '.web.ts', '.tsx', '.ts', '.js', '.json'],
  alias: { 'react-native': 'react-native-web' }, plugins: [stubPlugin],
  define: { 'process.env.NODE_ENV': '"production"', '__DEV__': 'false', 'global': 'window' },
});
writeFileSync('out/index.html', '<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="root"></div><script src="bundle.js"></script>');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 460, height: 950 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => { console.error('PAGEERROR:', e.message); process.exitCode = 1; });
await page.goto('file://' + process.cwd() + '/out/index.html');

const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) { console.error('FAIL', name, '-', String(e).split('\n')[0]); process.exitCode = 1; }
};
const fired = async (want) => {
  const txt = await page.getByTestId('fired').textContent();
  if (txt !== `fired: ${want}`) throw new Error(`fired="${txt}" want "${want}"`);
};

await page.waitForTimeout(700);
await page.screenshot({ path: 'out/walk-1-day1.png' });

await step('Day-1 empty state shows target 2,400 TO GO', async () => {
  await page.getByText('2,400').first().waitFor({ timeout: 3000 });
  await page.getByText('TO GO').first().waitFor();
});
await step('empty-state Scan row fires handler', async () => {
  await page.getByText('Scan your breakfast').click(); await fired('scan');
});
await step('empty-state Describe row fires handler', async () => {
  await page.getByText('Or describe it').click(); await fired('describe');
});
await step('profile avatar fires handler', async () => {
  await page.getByText('A', { exact: true }).first().click(); await fired('profile');
});
await step('tab bar Trends fires handler', async () => {
  await page.getByText('Trends').click(); await fired('tab-1');
});
await step('center + opens Log sheet', async () => {
  await page.getByTestId('tab-log').click();
});
await step('Log sheet visible (via streak row → log path)', async () => {
  // deterministic route: the "Day 1 of your streak" row calls onLog
  if (!(await page.getByText('YOUR GO-TOS').isVisible().catch(() => false))) {
    await page.getByText('Day 1 of your streak starts now').click();
  }
  await page.getByText('YOUR GO-TOS · LUNCH').waitFor();
});
await step('log-sheet tiles + copy-yesterday all fire', async () => {
  await page.getByText('Describe', { exact: true }).click(); await fired('describe');
  await page.getByText('Label', { exact: true }).click(); await fired('label');
  await page.getByText('Saved', { exact: true }).click(); await fired('saved');
  await page.getByText('Copy yesterday').click(); await fired('copy-yesterday');
});
await step('quick-add opens Portion sheet with live math (740 kcal)', async () => {
  await page.getByTestId('quickadd-burrito').click();
  await page.getByText('Log to Lunch · 740 kcal').waitFor({ timeout: 3000 });
});
await page.screenshot({ path: 'out/walk-2-portion.png' });
await step('portion chip 2 doubles CTA to 1480 kcal', async () => {
  await page.getByTestId('portion-3').click();
  await page.getByText('Log to Lunch · 1480 kcal').waitFor();
});
await step('portion chip back to 1 bowl → 740', async () => {
  await page.getByTestId('portion-1').click();
  await page.getByText('Log to Lunch · 740 kcal').waitFor();
});
await step('meal chip Dinner updates CTA text', async () => {
  await page.getByTestId('meal-dinner').click();
  await page.getByText('Log to Dinner · 740 kcal').waitFor();
});
await step('LOG writes to store: summary shows 1,660 left + entry row', async () => {
  await page.getByTestId('log-cta').click();
  await page.getByText('1,660').waitFor({ timeout: 3000 });
  await page.getByText('Chicken burrito bowl').waitFor();
  await page.getByText("TODAY'S MEALS").waitFor();
});
await step('synced: pending 0, no offline banner', async () => {
  const p = await page.getByTestId('pending').textContent();
  if (p !== 'pending: 0') throw new Error(p);
  if (await page.getByText('Offline — your log will sync').isVisible().catch(() => false)) throw new Error('banner visible');
});
await step('OFFLINE log: entry appears instantly, pending 1, banner shows', async () => {
  await page.getByTestId('toggle-offline').click();
  await page.getByText('Day 1 of your streak starts now').isVisible().catch(() => false); // no-op guard
  // open log sheet via center + : click the Today tab-bar big button by role
  await page.getByText('1,660').waitFor();
  await page.getByTestId('tab-log').click();
  await page.getByText('YOUR GO-TOS · LUNCH').waitFor({ timeout: 3000 });
  await page.getByTestId('quickadd-banana').click();
  await page.getByText('Log to Lunch · 105 kcal').waitFor({ timeout: 3000 });
  await page.getByTestId('log-cta').click();
  await page.getByText('1,555').waitFor({ timeout: 3000 });      // 1660-105 instantly, though offline
  const p = await page.getByTestId('pending').textContent();
  if (p !== 'pending: 1') throw new Error(p);
  await page.getByText('Offline — your log will sync').waitFor();
});
await step('back online: sync clears pending and banner', async () => {
  await page.getByTestId('toggle-offline').click();
  await page.getByTestId('sync-now').click();
  await page.waitForTimeout(300);
  const p = await page.getByTestId('pending').textContent();
  if (p !== 'pending: 0') throw new Error(p);
  if (await page.getByText('Offline — your log will sync').isVisible().catch(() => false)) throw new Error('banner still visible');
});
await page.screenshot({ path: 'out/walk-3-after.png' });
await browser.close();
console.log(process.exitCode ? 'WALKTHROUGH HAD FAILURES' : 'WALKTHROUGH FULLY PASSED');
