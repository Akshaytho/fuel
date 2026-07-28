// Metro config for a pnpm monorepo (ADR-003): watch the workspace root and
// resolve modules from both the app's and the root's node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Single-instance guarantee. pnpm gives every workspace package its OWN physical
// copy of a dependency, so @fuel/ui and apps/mobile can resolve different ones.
// Metro then bundles both, which fails at runtime, not at build:
//   react            -> "Invalid hook call" / "Cannot read property 'useContext' of null"
//   react-native-svg -> "Tried to register two views with the same name RNSVGCircle"
// Both cost a debugging session on 2026-07-28. Version pins alone are not enough
// (a caret range is all it takes to drift again), so resolution for these is
// forced to start from the app's node_modules — the app always wins.
const SINGLETONS = ['react', 'react-native', 'react-native-svg'];
const appModules = path.resolve(projectRoot, 'node_modules');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shared = SINGLETONS.some((n) => moduleName === n || moduleName.startsWith(`${n}/`));
  return context.resolveRequest(
    shared ? { ...context, originModulePath: path.join(appModules, '__singleton__.js') } : context,
    moduleName,
    platform,
  );
};

module.exports = config;
