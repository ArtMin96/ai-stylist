// Repo-wide lint rules that are not boundaries (brief §5 test-placement, §6 forbidden-field,
// §8 row 8 file-size). Loaded by the root eslint.config.mjs next to boundaries.mjs. Every rule is
// documented in tools/eslint/README.md.
import path from 'node:path';

import noLogRequestBody from './rules/no-log-request-body.mjs';
import testPlacement from './rules/test-placement.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** Source files above this many lines get a warning (NFR-TEAM-050; number recorded in doc 15). */
export const FILE_SIZE_MAX_LINES = 400;

export const qualityPlugin = {
  meta: { name: 'ai-stylist-quality', version: '0.1.0' },
  rules: {
    'test-placement': testPlacement,
    'no-log-request-body': noLogRequestBody,
  },
};

const SOURCE = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
const GENERATED = ['**/gen/**', '**/generated/**', '**/*.gen.ts', '**/fixtures/**'];
const TESTS = ['**/tests/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/e2e/**'];
// CLIs that talk to a human on stdout: workspace `scripts/` dirs, the repo `scripts/`, codegen.
const CLIS = ['**/scripts/**', 'tools/codegen/**'];

export default [
  {
    files: SOURCE,
    plugins: { quality: qualityPlugin },
    rules: {
      'quality/test-placement': ['error', { root: REPO_ROOT }],
      'quality/no-log-request-body': 'error',
    },
  },
  {
    // no-console everywhere (11 §8): server + shared code log through pino with the redaction
    // allowlist; tooling uses process.stdout.
    files: SOURCE,
    ignores: [...CLIS, ...GENERATED],
    rules: { 'no-console': 'error' },
  },
  {
    // file-size: warn only (brief §8 row 8); tests and generated code are exempt.
    files: SOURCE,
    ignores: [...GENERATED, ...TESTS],
    rules: {
      'max-lines': [
        'warn',
        { max: FILE_SIZE_MAX_LINES, skipBlankLines: false, skipComments: false },
      ],
    },
  },
];
