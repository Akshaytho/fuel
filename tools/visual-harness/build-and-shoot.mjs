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
  entryPoints: ['main.tsx'],
  bundle: true,
  outfile: 'out/bundle.js',
  format: 'iife',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  resolveExtensions: ['.web.js', '.web.tsx', '.web.ts', '.tsx', '.ts', '.js', '.json'],
  alias: { 'react-native': 'react-native-web' },
  plugins: [stubPlugin],
  define: { 'process.env.NODE_ENV': '"production"', '__DEV__': 'false', 'global': 'window' },
});
writeFileSync('out/index.html', '<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="root"></div><script src="bundle.js"></script>');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 880, height: 1100 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE:', m.text()));
await page.goto('file://' + process.cwd() + '/out/index.html');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'out/primitives.png', fullPage: true });
await browser.close();
console.log('screenshot: out/primitives.png');
