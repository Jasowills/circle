// Pin Metro's root to this app. Without it, Expo resolves the npm
// workspace root (circle/) and ./App stops resolving.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Monorepo: expo wants the workspace root for watching, but bundles must
// resolve from this app, otherwise ./App points at circle/ instead of here.
config.projectRoot = __dirname;

module.exports = config;
