// ESLint boundary rules (planning/04 §4.3, brief §5) — inline feedback in the editor and in
// `just lint`. dependency-cruiser (tools/depcruise/rules.cjs) is the whole-graph gate; the two
// overlap on purpose. Loaded by the root eslint.config.mjs (`BOUNDARIES` extension point).
//
// Element types: module, module-internal, shared-kernel, platform, job-handler, contracts, dev;
// composition-root is a file category (v7 dropped file-mode elements). Patterns are repo-root
// relative (boundaries/root-path), so the same config works from every workspace's `eslint .`.
import path from 'node:path';

import boundaries from 'eslint-plugin-boundaries';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

// Provider SDKs that never appear in a domain module (04 §4.2 rule 4; mirrors depcruise).
export const PROVIDER_SDKS = [
  'pg-boss',
  '@aws-sdk/*',
  '@cloudflare/*',
  '@fal-ai/*',
  'posthog-*',
  'firebase-admin',
  '@sentry/*',
];

// Composition roots are single files (04 §5); v7 classifies files through `boundaries/files`.
const FILES = [
  {
    category: 'composition-root',
    pattern: ['apps/api/src/app.module.ts', 'apps/api/src/main.ts'],
  },
];

const ELEMENTS = [
  // Order matters: the first matching descriptor wins, so nested types come first.
  {
    type: 'module-internal',
    pattern: 'apps/api/src/modules/*/internal',
    capture: ['module'],
  },
  { type: 'module', pattern: 'apps/api/src/modules/*', capture: ['module'] },
  { type: 'platform', pattern: 'apps/api/src/platform' },
  { type: 'job-handler', pattern: 'apps/api/src/jobs' },
  { type: 'dev', pattern: 'apps/api/src/dev' },
  { type: 'shared-kernel', pattern: 'packages/shared-kernel' },
  { type: 'contracts', pattern: 'packages/contracts' },
];

// `files` is resolved against the workspace that loads the config, so it is deliberately broad:
// files outside every element (no element type) match no policy.
const BOUNDARY_FILES = ['**/*.{ts,tsx,mts,cts}'];

export default [
  {
    files: BOUNDARY_FILES,
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': REPO_ROOT,
      'boundaries/elements': ELEMENTS,
      'boundaries/files': FILES,
      'boundaries/ignore': ['**/node_modules/**', '**/gen/**', '**/fixtures/**'],
      'boundaries/dependency-nodes': ['import', 'export', 'dynamic-import'],
      // NodeNext `.js` → `.ts` and workspace `exports` need the TS resolver; the node resolver
      // bundled with the plugin sees neither.
      'import/resolver': {
        typescript: {
          project: [
            path.join(REPO_ROOT, 'apps/api/tsconfig.json'),
            path.join(REPO_ROOT, 'packages/*/tsconfig.json'),
          ],
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          // Also check external/core targets (domain-no-provider-sdk); local is the default.
          checkAllOrigins: true,
          // Also check local targets that belong to no element (e.g. packages/db) — needed for
          // shared-kernel-pure. Imports inside one element stay unchecked (checkInternals=false).
          checkUnknownLocals: true,
          policies: [
            {
              // domain-no-provider-sdk (04 §4.2 rule 4). No origin filter: an SDK that is not even
              // installed (origin "unknown") must still be flagged.
              from: { element: { type: ['module', 'module-internal', 'shared-kernel'] } },
              disallow: { to: { module: { source: PROVIDER_SDKS } } },
              message:
                'domain-no-provider-sdk: "{{ to.module.source }}" is a provider SDK; declare a port and implement it in platform (04 §4.2 rule 4)',
            },
            {
              // public-api-only (04 §4.2 rule 1): another module's internal/** is unreachable.
              from: { element: { type: 'module' } },
              disallow: {
                to: {
                  element: {
                    type: 'module-internal',
                    captured: { module: '!{{ from.element.captured.module }}' },
                  },
                },
              },
              message:
                'public-api-only: module "{{ from.element.captured.module }}" may import "{{ to.element.captured.module }}" only through its index.ts (04 §4.2 rule 1)',
            },
            {
              from: { element: { type: 'module-internal' } },
              disallow: {
                to: {
                  element: {
                    type: 'module-internal',
                    captured: { module: '!{{ from.element.captured.module }}' },
                  },
                },
              },
              message:
                'public-api-only: module "{{ from.element.captured.module }}" may import "{{ to.element.captured.module }}" only through its index.ts (04 §4.2 rule 1)',
            },
            {
              // Nothing outside modules/ reaches an internal/** either.
              from: {
                element: {
                  type: ['platform', 'job-handler', 'dev', 'shared-kernel', 'contracts'],
                },
              },
              disallow: { to: { element: { type: 'module-internal' } } },
              message:
                'public-api-only: import module "{{ to.element.captured.module }}" through its index.ts, never internal/** (04 §4.2 rule 1)',
            },
            {
              from: { file: { categories: 'composition-root' } },
              disallow: { to: { element: { type: 'module-internal' } } },
              message:
                'public-api-only: the composition root wires module "{{ to.element.captured.module }}" through its index.ts, never internal/** (04 §4.2 rule 1)',
            },
            {
              // modules-not-platform (04 §4.2 rule 5): ports are bound at the composition root.
              from: { element: { type: ['module', 'module-internal'] } },
              disallow: { to: { element: { type: 'platform' } } },
              message:
                'modules-not-platform: module "{{ from.element.captured.module }}" must depend on a port, not on apps/api/src/platform (04 §4.2 rule 5)',
            },
            {
              // platform-leaf (04 §4.2 rule 5): platform knows shared-kernel, contracts, SDKs only.
              from: { element: { type: 'platform' } },
              disallow: {
                to: {
                  element: { type: ['module', 'module-internal', 'job-handler', 'dev'] },
                },
              },
              message:
                'platform-leaf: platform depends only on shared-kernel, contracts and provider SDKs (04 §4.2 rule 5)',
            },
            {
              // shared-kernel-pure (04 §4.2 rule 6).
              from: { element: { type: 'shared-kernel' } },
              disallow: { to: { module: { origin: 'local' } } },
              message:
                'shared-kernel-pure: shared-kernel imports no workspace code (04 §4.2 rule 6)',
            },
          ],
        },
      ],
    },
  },
];
