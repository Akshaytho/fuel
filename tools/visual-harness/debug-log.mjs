import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 460, height: 980 } });
await ctx.route('**supabase.co/**', async (route) => {
  const req = route.request();
  const tmp = `/tmp/pw-body-${Math.random().toString(36).slice(2)}.json`;
  const args = ['-s', '-o', tmp, '-w', '%{http_code}', '-m', '30', '-X', req.method(), req.url()];
  const hdrs = await req.allHeaders();
  for (const [k, v] of Object.entries(hdrs)) if (['apikey','authorization','content-type','prefer'].includes(k.toLowerCase())) args.push('-H', `${k}: ${v}`);
  const body = req.postData(); if (body) args.push('--data-binary', body);
  const status = Number(execFileSync('curl', args).toString().trim() || 500);
  console.log('BRIDGE', req.method(), req.url().split('/rest')[1]?.slice(0,60) ?? req.url().slice(30,90), '→', status);
  await route.fulfill({ status, contentType: 'application/json', body: readFileSync(tmp) });
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,150)));
await page.goto('file://' + process.cwd() + '/out/index.html');
await page.waitForTimeout(800);
// seed straight to today by injecting profile like a returning user
await page.evaluate(() => {
  localStorage.setItem('fuel.profile.v1', JSON.stringify({
    profile: { sex:'female', age_years:28, height_cm:165, weight_kg:68.2, activity:'light', goal:'lose' },
    targets: { kcal:1553, protein_g:122.8, carbs_g:157.9, fat_g:51.8, clamped:false },
    water_l: 2.5, reminder: true,
  }));
});
await page.reload(); await page.waitForTimeout(1000);
console.log('today visible:', await page.getByText('TO GO').isVisible().catch(()=>false));
await page.getByTestId('tab-log').click();
console.log('log sheet:', await page.getByText('Search any food').isVisible().catch(()=>false));
await page.locator('input').first().click();
await page.waitForTimeout(500);
console.log('search caption:', await page.getByText('Searches your food database').isVisible().catch(()=>false));
await page.locator('input').first().fill('banana');
await page.waitForTimeout(3000);
const adds = await page.locator('[data-testid^="add-"]').count();
console.log('add buttons:', adds);
if (adds > 0) {
  await page.locator('[data-testid^="add-"]').first().click();
  await page.waitForTimeout(600);
  console.log('portion visible:', await page.getByTestId('log-cta').isVisible().catch(()=>false));
  await page.getByTestId('log-cta').click();
  await page.waitForTimeout(1500);
  console.log('meals visible:', await page.getByText("TODAY'S MEALS").isVisible().catch(()=>false));
}
await page.screenshot({ path: 'out/debug-log.png' });
await browser.close();
