const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The living-memory engine is a sibling package linked via `file:../engine`.
// Metro must watch its real location (outside the app root) to bundle it,
// and honor the package's "exports" map (for the "/provider" subpath).
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '..', 'engine')];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
