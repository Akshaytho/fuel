import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 460, height: 980 } });
ctx.on('requestfailed', r => console.log('REQFAIL:', r.url().slice(0,70)));
await ctx.route('**supabase.co/**', async (route) => {
  const req = route.request();
  console.log('ROUTE HIT:', req.method(), req.url().slice(0, 80));
  const args = ['-s', '-i', '-m', '30', '-X', req.method(), req.url()];
  const hdrs = await req.allHeaders();
  for (const [k, v] of Object.entries(hdrs)) {
    if (['apikey','authorization','content-type','prefer'].includes(k.toLowerCase())) args.push('-H', `${k}: ${v}`);
  }
  const body = req.postData();
  if (body) args.push('--data-binary', body);
  const raw = execFileSync('curl', args, { maxBuffer: 10*1024*1024 }).toString('latin1');
  const splitAt = raw.indexOf('\r\n\r\n');
  const status = Number(raw.slice(0, splitAt).split('\r\n')[0].split(' ')[1] ?? 500);
  console.log('  curl status:', status);
  await route.fulfill({ status, contentType: 'application/json', body: Buffer.from(raw.slice(splitAt+4),'latin1') });
});
const page = await ctx.newPage();
await page.goto('file://' + process.cwd() + '/out/index.html');
await page.waitForTimeout(700);
await page.getByTestId('auth-email').click();
await page.getByTestId('email-input').fill(`dbg-${Date.now()}@fuel.test`);
await page.getByTestId('password-input').fill('e2e-Fuel-2026!x');
await page.getByTestId('auth-submit').click();
await page.waitForTimeout(8000);
console.log('goal visible:', await page.getByText('What are we working toward?').isVisible().catch(()=>false));
console.log('auth-error:', await page.getByTestId('auth-error').textContent().catch(()=> 'none'));
await browser.close();
