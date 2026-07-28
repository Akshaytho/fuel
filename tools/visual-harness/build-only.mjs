import { build } from 'esbuild';
import { writeFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Resolve react-native-svg's web entry from THIS package's node_modules —
// never hardcode a store path (the previous absolute /home/claude/... path
// only existed in the cloud sandbox and broke every laptop run).
const require = createRequire(import.meta.url);
const svgWeb = join(
  dirname(require.resolve('react-native-svg/package.json')),
  'lib/module/ReactNativeSVG.web.js',
);
if (!existsSync(svgWeb)) throw new Error(`rn-svg web entry missing: ${svgWeb}`);

// Supabase target: env override first, else the project defaults.
// The anon/publishable key is client-safe by design (RLS enforces access).
const SUPA_URL = process.env.SUPA_URL ?? 'https://wccxzcrxdcqvprswdvlu.supabase.co';
const SUPA_ANON = process.env.SUPA_ANON ?? 'sb_publishable_O7SvM3liX_m1eZTND87uxA_X4TcAckH';

const stubPlugin = {
  name: 'rn-codegen-stub',
  setup(b) {
    b.onResolve({ filter: /codegenNativeComponent|codegenNativeCommands|fabric\/NativeSvg/ }, () => ({ path: 'stub', namespace: 'rn-stub' }));
    b.onResolve({ filter: /^react-native-svg$/ }, () => ({ path: svgWeb }));
    b.onLoad({ filter: /.*/, namespace: 'rn-stub' }, () => ({ contents: 'const stub=()=>null; export default function codegen(){ return function Stub(){ return null; }; }; export const getEnforcing=stub;', loader: 'js' }));
  },
};

await build({
  entryPoints: ['main.tsx'], bundle: true, outfile: 'out/bundle.js', format: 'iife',
  jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts' },
  resolveExtensions: ['.web.js', '.web.tsx', '.web.ts', '.tsx', '.ts', '.js', '.json'],
  alias: { 'react-native': 'react-native-web' }, plugins: [stubPlugin],
  define: {
    'process.env.NODE_ENV': '"production"', '__DEV__': 'false', 'global': 'window',
    'process.env.SUPA_URL': JSON.stringify(SUPA_URL),
    'process.env.SUPA_ANON': JSON.stringify(SUPA_ANON),
  },
});
writeFileSync('out/index.html', '<!doctype html><meta charset="utf-8"><title>Fuel — live journey</title><body style="margin:0;background:#000"><div id="root"></div><script src="bundle.js"></script>');
