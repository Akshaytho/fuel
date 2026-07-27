import { build } from 'esbuild';
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
  define: { 'process.env.NODE_ENV': '"production"', '__DEV__': 'false', 'global': 'window', 'process.env.SUPA_URL': '"https://wccxzcrxdcqvprswdvlu.supabase.co"', 'process.env.SUPA_ANON': '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjY3h6Y3J4ZGNxdnByc3dkdmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Mzg3NjcsImV4cCI6MjA5OTAxNDc2N30.0G-e_dHSAKk2UW50HmFO0EcBzmOXu73Fuu6iLuy7-Cg"' },
});
writeFileSync('out/index.html', '<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="root"></div><script src="bundle.js"></script>');
