const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workspace packages (@ai-stylist/contracts, shared-kernel) are NodeNext TypeScript sources whose
// relative imports carry a `.js` suffix (`./sdk.gen.js` → `sdk.gen.ts`). Metro does not apply the
// TypeScript `.js` → `.ts` fallback, so retry without the suffix when the literal path is missing.
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest;
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName, platform);
    } catch (error) {
      try {
        return resolve(context, moduleName.slice(0, -'.js'.length), platform);
      } catch {
        throw error;
      }
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
