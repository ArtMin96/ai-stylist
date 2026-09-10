// Mobile ESLint: root config (type-checked TS, no-skip, prettier) + react-hooks + expo +
// react-native plugins + the mobile boundary rules from planning/04 §4.3.
// eslint-config-expo 57 and eslint-plugin-react-native 5 are NOT used: both crash on ESLint 10
// (eslint-plugin-react 7.37 / react-native 5.0 still call the removed `context.getFilename` /
// `getSourceCode`). Revisit when they support ESLint 10; the a11y lint (brief §1) also waits on that.
import expoPlugin from 'eslint-plugin-expo';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

import base, { ignores } from '../../eslint.config.mjs';

// render-boundary: anything outside src/render and the designated 3D feature must not reach
// the renderer (src/render/README.md).
const RENDER_PATTERNS = [
  {
    group: ['react-native-filament', 'react-native-filament/**'],
    message:
      'render-boundary: only src/render/** and src/features/avatar/** may import Filament (src/render/README.md).',
  },
  {
    group: ['@/render', '@/render/**', '@ai-stylist/mobile/src/render/**', '**/render/**'],
    message:
      'render-boundary: import 3D screens from src/features/avatar, not src/render directly.',
  },
];

// mobile/workers-not-server: only contracts + shared-kernel from the workspace.
const NOT_SERVER_PATTERNS = [
  {
    group: [
      '@ai-stylist/api',
      '@ai-stylist/api/**',
      '@ai-stylist/db',
      '@ai-stylist/db/**',
      '@ai-stylist/seed-data',
      '@ai-stylist/seed-data/**',
      '@ai-stylist/test-support',
      '@ai-stylist/test-support/**',
    ],
    message:
      'mobile/workers-not-server: mobile may import only @ai-stylist/contracts and @ai-stylist/shared-kernel.',
  },
];

// `no-restricted-imports` does not merge across config entries, so each file set lists its full pattern set.
const BOUNDARIES = [
  {
    files: ['**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: NOT_SERVER_PATTERNS }] },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/render/**', 'src/features/avatar/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...NOT_SERVER_PATTERNS, ...RENDER_PATTERNS] },
      ],
    },
  },
];

export default [
  ...base,
  {
    ...ignores,
    ignores: [...ignores.ignores, '.expo/**', 'android/**', 'ios/**', 'expo-env.d.ts'],
  },
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, __DEV__: 'readonly', process: 'readonly' },
    },
    plugins: { expo: expoPlugin },
    rules: {
      // No console in product code (11 §8): analytics/crash go through ports.
      'no-console': 'error',
      // EXPO_PUBLIC_* inlining only works for literal member access.
      'expo/no-dynamic-env-var': 'error',
      'expo/no-env-var-destructuring': 'error',
      'expo/use-dom-exports': 'error',
    },
  },
  ...BOUNDARIES,
  {
    // CommonJS tooling files Expo/Jest load in Node (babel.config.js, jest.config.js).
    files: ['**/*.{js,cjs}'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
];
