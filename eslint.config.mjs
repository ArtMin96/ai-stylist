// Root ESLint flat config for the AI Stylist monorepo (planning/15 §5, 04 §4.3).
//
// Workspaces import this as their base:
//   import base from '../../eslint.config.mjs';
//   export default [...base, /* workspace overrides */];
//
// Rules in the P02 lint bundle land here or in tools/eslint/*.mjs:
//   boundaries (T06), no-skip (here), forbidden-field (T09), a11y (T10), no-utils (T06),
//   test-placement (T06), expired-flag (T09), file-size (T06).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// ---------------------------------------------------------------------------
// Custom inline rule: no-skip-without-issue
// `it.skip` / `xit` / `test.skip` / `describe.skip` / `xdescribe` / `xtest` must
// carry an issue ID in the test title, e.g. "#123" or "APP-42" (brief §5 no-skip).
// ---------------------------------------------------------------------------
const ISSUE_ID = /#\d+|[A-Z]+-\d+/;
const SKIP_CALLEES = new Set(['xit', 'xtest', 'xdescribe']);
const SKIP_OBJECTS = new Set(['it', 'test', 'describe']);

function isSkipCall(callee) {
  if (callee.type === 'Identifier') return SKIP_CALLEES.has(callee.name);
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    SKIP_OBJECTS.has(callee.object.name) &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'skip'
  ) {
    return true;
  }
  return false;
}

function titleOf(node) {
  const first = node.arguments[0];
  if (!first) return null;
  if (first.type === 'Literal' && typeof first.value === 'string') return first.value;
  if (first.type === 'TemplateLiteral')
    return first.quasis.map((q) => q.value.cooked ?? '').join('');
  return null;
}

const noSkipWithoutIssue = {
  meta: {
    type: 'problem',
    docs: { description: 'skipped tests must reference an issue ID in their title' },
    schema: [],
    messages: {
      needsIssue: 'skipped test needs an issue ID in the name (e.g. "#123" or "APP-42")',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isSkipCall(node.callee)) return;
        const title = titleOf(node);
        if (title !== null && ISSUE_ID.test(title)) return;
        context.report({ node: node.callee, messageId: 'needsIssue' });
      },
    };
  },
};

export const localPlugin = {
  meta: { name: 'ai-stylist-local', version: '0.1.0' },
  rules: { 'no-skip-without-issue': noSkipWithoutIssue },
};

// ---------------------------------------------------------------------------
// BOUNDARIES: extended in tools/eslint/boundaries.mjs (added by arch agent, T06).
// That file must `export default` an array of flat-config entries using
// eslint-plugin-boundaries (element types: module, module-internal, shared-kernel,
// platform, composition-root, trigger-task, contracts). Loaded only if present.
// ---------------------------------------------------------------------------
async function loadBoundaries() {
  try {
    const mod = await import('./tools/eslint/boundaries.mjs');
    return Array.isArray(mod.default) ? mod.default : [];
  } catch (err) {
    if (err && err.code === 'ERR_MODULE_NOT_FOUND') return [];
    throw err;
  }
}

export const ignores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/gen/**',
    '**/generated/**',
    '**/.expo/**',
    '**/ios/**',
    '**/android/**',
    'planning/**',
    '.claude/**',
    'workers/**',
  ],
};

export const base = [
  ignores,
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { local: localPlugin },
    rules: {
      'local/no-skip-without-issue': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // No console in server + shared code: use the pino logger with the redaction allowlist (11 §8).
    files: ['apps/api/src/**/*.{ts,mts,cts}', 'packages/**/*.{ts,mts,cts}'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    // Config / script files are plain JS: do not type-check them.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  ...(await loadBoundaries()),
  prettier, // must stay last: turns off formatting rules
];

export default base;
