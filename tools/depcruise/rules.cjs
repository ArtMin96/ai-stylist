// dependency-cruiser configuration — the `just arch-check` gate (planning/04 §4.2–4.4, brief §5).
// Run from the repo root (tools/depcruise/arch-check.sh does); check-fixtures.sh runs the same
// config from inside each fixture tree, which mirrors the real layout.
//
// Every rule is `severity: 'error'`: there is no warning tier. An exception needs an ADR
// (tools/depcruise/README.md). Paths are matched against repo-root-relative resolved paths;
// workspace packages (`@ai-stylist/*`) resolve through pnpm symlinks to their real `packages/<x>`
// path, so one regex covers both the bare specifier and a relative import.
'use strict';

const path = require('node:path');

// --- path vocabulary ---------------------------------------------------------------------------
const MODULES = '^apps/api/src/modules/';
const MODULE = `${MODULES}([^/]+)/`; // capture group 1 = module name
const ANY_MODULE_INTERNAL = `${MODULES}[^/]+/internal/`;
const PLATFORM = '^apps/api/src/platform/';
const PLATFORM_PORTS = '^apps/api/src/platform/ports/[^/]+\\.port\\.ts$';
const DEV = '^apps/api/src/dev/';
const SHARED_KERNEL = '^packages/shared-kernel/';
const CONTRACTS = '^packages/contracts/';
const DB = '^packages/db/';
const MOBILE_RENDER = '^apps/mobile/src/render/';
const FILAMENT = '(^|/)react-native-filament(/|$)';
const PROTOTYPE = '^prototype/';
const UTILS_DIR = '(^|/)(utils|helpers|common)/';

// Composition roots (04 §5): the only files that construct adapters and bind ports.
const COMPOSITION_ROOTS = [
  '^apps/api/src/app\\.module\\.ts$',
  '^apps/api/src/main\\.ts$',
  '^apps/api/src/jobs/',
  '^apps/mobile/src/app/_layout\\.tsx$',
  '^apps/mobile/src/lib/app-services\\.tsx$',
];

// Provider SDKs that never appear in a domain module (04 §4.2 rule 4). Matched against the
// resolved path (pnpm realpath contains `node_modules/<pkg>/`) and the bare specifier when the
// package is not installed, so an unresolvable import still fails.
const PROVIDER_SDKS =
  '(^|/)(pg-boss|@aws-sdk|@cloudflare|react-native-purchases|@fal-ai|posthog-[^/]*|firebase-admin|@sentry)(/|$)';

// --- the allowed module DAG, copied from planning/04 §4.1 ----------------------------------------
// key → modules it may import (via their index.ts). Every module may also import shared-kernel
// and contracts; nothing else. Edges not listed here are forbidden (rule allowed-edges-only).
const ALLOWED_EDGES = {
  // Application services layer
  assistant: ['profile', 'closet', 'context', 'recommendation', 'fashion-intel', 'billing'],
  admin: ['media', 'closet', 'billing', 'identity'],
  // Domain modules
  identity: [],
  profile: ['identity'],
  avatar: ['profile'],
  closet: ['profile', 'media'],
  media: [],
  outfit: ['closet'],
  context: [],
  recommendation: ['closet', 'outfit', 'profile', 'context'],
  'fashion-intel': ['profile', 'closet'],
  billing: ['identity'],
  notifications: ['identity'],
};

const allowedEdgeRules = Object.entries(ALLOWED_EDGES).map(([from, targets]) => ({
  name: 'allowed-edges-only',
  severity: 'error',
  comment: `04 §4.1: ${from} may import only [${targets.join(', ') || 'no other module'}]`,
  from: { path: `${MODULES}${from}/` },
  to: {
    path: MODULES,
    pathNot: [from, ...targets].map((m) => `${MODULES}${m}/`),
  },
}));

// Names present in modules/ that are not in the DAG are caught here.
const KNOWN_MODULES = Object.keys(ALLOWED_EDGES);

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'public-api-only',
      severity: 'error',
      comment: '04 §4.2 rule 1: a module reaches another module only through its index.ts',
      from: { path: MODULE },
      to: { path: ANY_MODULE_INTERNAL, pathNot: `${MODULES}$1/` },
    },
    {
      name: 'public-api-only-external',
      severity: 'error',
      comment: '04 §4.2 rule 1: nothing outside modules/ imports a module internal/**',
      from: { pathNot: MODULES },
      to: { path: ANY_MODULE_INTERNAL },
    },
    {
      name: 'no-cycles',
      severity: 'error',
      comment: '04 §4.2 rule 7: the dependency graph is a DAG (type-only edges included)',
      from: {},
      to: { circular: true },
    },
    ...allowedEdgeRules,
    {
      name: 'unknown-module',
      severity: 'error',
      comment: 'SPINE §3: only the 13 canonical module names exist under modules/',
      from: {},
      to: { path: MODULES, pathNot: KNOWN_MODULES.map((m) => `${MODULES}${m}/`) },
    },
    {
      name: 'recommendation-not-renderer',
      severity: 'error',
      comment: '04 §4.2 rule 2: recommendation never touches avatar, the renderer, or 3D assets',
      from: { path: `${MODULES}recommendation/` },
      to: {
        path: [`${MODULES}avatar/`, MOBILE_RENDER, FILAMENT, '^assets/', '\\.(glb|gltf|ktx2)$'],
      },
    },
    {
      name: 'recommendation-outfit-types-only',
      severity: 'error',
      comment: '04 §4.2 rule 2: recommendation → outfit only for item/composition types',
      from: { path: `${MODULES}recommendation/` },
      to: { path: `${MODULES}outfit/`, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'assistant-app-services-only',
      severity: 'error',
      comment: '04 §4.2 rule 3: assistant calls public application services only',
      from: { path: `${MODULES}assistant/` },
      to: {
        path: [ANY_MODULE_INTERNAL, PLATFORM, DB, '(^|/)drizzle-orm(/|$)', '(^|/)schema\\.ts$'],
      },
    },
    {
      name: 'domain-no-provider-sdk',
      severity: 'error',
      comment: '04 §4.2 rule 4: domains declare ports; platform implements provider SDKs',
      from: { path: MODULES },
      to: { path: PROVIDER_SDKS },
    },
    {
      name: 'platform-leaf',
      severity: 'error',
      comment:
        '04 §4.2 rule 5: platform depends on shared-kernel, contracts (generated types) and SDKs only',
      from: { path: PLATFORM, pathNot: `${PLATFORM}tests/` },
      to: {
        path: '^(apps|packages|tools|workers|prototype)/',
        pathNot: [PLATFORM, SHARED_KERNEL, CONTRACTS],
      },
    },
    {
      name: 'modules-not-platform',
      severity: 'error',
      comment: '04 §4.2 rule 5: modules depend on ports, bound at the composition root',
      from: { path: MODULES },
      to: { path: PLATFORM },
    },
    {
      name: 'shared-kernel-pure',
      severity: 'error',
      comment: '04 §4.2 rule 6: shared-kernel imports nothing but ulid (no I/O, no framework)',
      from: { path: `${SHARED_KERNEL}src/` },
      to: { pathNot: [`${SHARED_KERNEL}src/`, '(^|/)ulid(/|$)'] },
    },
    {
      name: 'no-utils-dirs',
      severity: 'error',
      comment: '04 §4.4: no utils/, helpers/, common/ directories (also checked by find)',
      from: { path: UTILS_DIR },
      to: {},
    },
    {
      name: 'no-utils-dirs',
      severity: 'error',
      comment: '04 §4.4: nothing imports from a utils/, helpers/, common/ directory',
      from: {},
      to: { path: UTILS_DIR, pathNot: 'node_modules' },
    },
    {
      name: 'prototype-unimportable',
      severity: 'error',
      comment: 'prototype/** is a P01 spike, never production code',
      from: {},
      to: { path: PROTOTYPE },
    },
    {
      name: 'render-boundary',
      severity: 'error',
      comment: '04 §4.3: only src/render/** and src/features/avatar/** touch Filament',
      from: {
        path: '^apps/mobile/',
        pathNot: [MOBILE_RENDER, '^apps/mobile/src/features/avatar/'],
      },
      to: { path: [MOBILE_RENDER, FILAMENT] },
    },
    {
      name: 'mobile-workers-not-server',
      severity: 'error',
      comment: 'brief §5: mobile imports only contracts and shared-kernel from the workspace',
      from: { path: '^apps/mobile/' },
      to: { path: '^(apps|packages)/', pathNot: ['^apps/mobile/', CONTRACTS, SHARED_KERNEL] },
    },
    {
      name: 'composition-root-only',
      severity: 'error',
      comment:
        '04 §5: only composition roots (and api tests / the seed CLI) import platform adapters or packages/db',
      from: {
        pathNot: [
          ...COMPOSITION_ROOTS,
          PLATFORM,
          DEV,
          DB,
          '^apps/api/tests/',
          '^packages/seed-data/scripts/seed\\.ts$',
        ],
      },
      to: { path: [PLATFORM, DB] },
    },
    {
      name: 'dev-ports-only',
      severity: 'error',
      comment:
        'apps/api/src/dev is dev-only: it may import platform port files, never adapters or db',
      from: { path: DEV },
      to: { path: [PLATFORM, DB], pathNot: PLATFORM_PORTS },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'every import must resolve (a typo or a missing workspace dependency)',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '/gen/', '/generated/'] },
    exclude: {
      path: [
        '/dist/',
        '/build/',
        '/coverage/',
        '\\.turbo/',
        '\\.expo/',
        '(^|/)fixtures/',
        '^apps/mobile/(android|ios)/',
      ],
    },
    tsPreCompilationDeps: true,
    // One tsconfig for the whole tree: only the mobile `@/*` alias needs `paths`; NodeNext `.js`
    // → `.ts` and workspace `exports` resolve through enhanced-resolve below.
    tsConfig: { fileName: path.join(__dirname, 'tsconfig.json') },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
      extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
