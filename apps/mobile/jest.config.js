const preset = require('jest-expo/jest-preset');

// msw@2 pulls ESM-only dependencies (rettime, until-async); babel-jest must transform them, so
// they join the preset's allowlist of transformed node_modules (pnpm layout aware).
const MSW_ESM = 'msw|@mswjs|rettime|until-async|@open-draft|outvariant|strict-event-emitter';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // The first render in a suite pays jest-expo's cold-start cost (lazy React Native mocks + msw
  // interceptors): ~2 s on a warm workstation, 5-6 s on a shared GitHub runner, which tripped
  // Jest's 5 s default on PR #1's merge and PR #2 (home-screen.test.tsx, first test only).
  testTimeout: 20_000,
  transformIgnorePatterns: preset.transformIgnorePatterns.map((pattern) =>
    pattern.replace('(?!(.pnpm|', `(?!(.pnpm|${MSW_ESM}|`),
  ),
  transform: { ...preset.transform, '\\.mjs$': preset.transform['\\.[jt]sx?$'] },
  // Test-placement rule (planning/04 §4.3): tests live only in `tests/` directories.
  testMatch: ['<rootDir>/src/**/tests/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // jest-expo resolves with the `react-native` export condition, under which msw maps `./node`
    // to null (device runtime). Tests run in Node, so point at the CJS node build directly.
    '^msw/node$': '<rootDir>/node_modules/msw/lib/node/index.js',
    // Workspace packages use NodeNext-style `./x.js` specifiers for `.ts` sources.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
