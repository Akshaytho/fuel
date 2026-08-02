import { chromium } from 'playwright';
let b; try { b = await chromium.launch({ channel:'chrome', headless:true }); } catch { b = await chromium.launch({headless:true}); }
const p = await (await b.newContext({ viewport:{width:1500,height:1200}, deviceScaleFactor:2 })).newPage();
await p.goto('file:///home/claude/fuel/out/fuel-ia-proposal.html');
await p.waitForTimeout(900);
await p.screenshot({ path:'/home/claude/fuel/out/ia-proposal-full.png', fullPage:true });
console.log('ok');
await b.close();
