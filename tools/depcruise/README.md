# tools/depcruise — `just arch-check`

dependency-cruiser is the whole-graph architecture gate (planning/04 §4.3, brief §5). `just arch-check`
runs `depcruise --config tools/depcruise/rules.cjs apps packages tools/codegen` from the repo root, then
scans for banned `utils/ | helpers/ | common/` directories. `just arch-check --fixtures` runs
`check-fixtures.sh`: every tree under `fixtures/<case>/` must fail on its named rule. Both run in
`just ci-parity`. `prototype/` is never a cruise source; it only ever appears as a forbidden target.

Every rule is `severity: 'error'` — there is no warning tier.

## Rules (one line each)

| Rule                               | Forbids                                                                                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public-api-only`                  | a module importing another module's `internal/**` (only that module's own `index.ts` may)                                                                                               |
| `public-api-only-external`         | anything outside `modules/` (platform, dev, tests, roots) importing any `modules/*/internal/**`                                                                                         |
| `no-cycles`                        | any dependency cycle, type-only edges included                                                                                                                                          |
| `allowed-edges-only`               | a `modules/<a>` → `modules/<b>` edge absent from the 04 §4.1 DAG (`ALLOWED_EDGES` in `rules.cjs` is that DAG, one rule instance per source module)                                      |
| `unknown-module`                   | a directory under `modules/` that is not one of the 13 SPINE §3 names                                                                                                                   |
| `recommendation-not-renderer`      | `modules/recommendation/**` importing `modules/avatar`, `assets/`, or `.glb/.gltf/.ktx2`                                                                                                |
| `recommendation-outfit-types-only` | `modules/recommendation/**` importing `modules/outfit` for anything but types (`import type`)                                                                                           |
| `assistant-app-services-only`      | `modules/assistant/**` importing any `internal/**`, `platform`, `packages/db`, `drizzle-orm`, or a `schema.ts`                                                                          |
| `domain-no-provider-sdk`           | `modules/**` importing `pg-boss`, `@aws-sdk/*`, `@cloudflare/*`, `@fal-ai/*`, `posthog-*`, `firebase-admin`, `@sentry/*`                                                                |
| `platform-leaf`                    | `apps/api/src/platform/**` (tests excepted) importing workspace code other than `shared-kernel` and `contracts` (generated types)                                                       |
| `modules-not-platform`             | `modules/**` importing `apps/api/src/platform/**` at all — ports are bound at the composition root                                                                                      |
| `shared-kernel-pure`               | `packages/shared-kernel/src/**` importing anything but its own files and `ulid`                                                                                                         |
| `no-utils-dirs`                    | a file inside, or an import from, a `utils/`, `helpers/`, `common/` directory (`arch-check.sh` also `find`s empty ones)                                                                 |
| `prototype-unimportable`           | any import of `prototype/**`                                                                                                                                                            |
| `composition-root-only`            | any file except the composition roots (`app.module.ts`, `main.ts`, `jobs/**`), `apps/api/tests/**`, `platform` itself, `dev`, and the seed CLI importing `platform/**` or `packages/db` |
| `dev-ports-only`                   | `apps/api/src/dev/**` importing anything from `platform/**` other than `platform/ports/*.port.ts`, or `packages/db`                                                                     |
| `not-to-unresolvable`              | an import that does not resolve (typo, missing workspace dependency)                                                                                                                    |

Notes:

- `platform-leaf` allows `packages/contracts` on top of 04 §4.2 rule 5 because the generated OpenAPI
  types are the single source of truth for response shapes (`VersionInfo` in `version.controller.ts`).
- `modules-not-platform` is strict: the port tokens currently in `platform/ports/*.port.ts` must move to
  `shared-kernel` or a module's public API (04 §4.2 rule 4) before the first module injects one.
- `tsconfig.json` here only gives dependency-cruiser a TypeScript config (no `paths` aliases); module
  resolution (NodeNext `.js` → `.ts`, workspace `exports`) is configured in `rules.cjs`.
- The `no-utils-dirs` directory scan covers the native app trees (`apps/ios`, `apps/android`) too;
  only build output (`build/`, `.build/`, `.gradle/`, `DerivedData/`) is skipped.

## Adding an ADR-backed exception

1. Write the ADR (`docs/adr/NNNN-slug.md`, template in `templates/`) stating the edge, why the rule
   cannot hold, and the exit condition.
2. Narrow the rule in `rules.cjs` with a `pathNot` (or a `dependencyTypesNot`) that names exactly the
   excepted path — never delete or downgrade the rule, never add a `warn` tier.
3. Reference the ADR in the rule's `comment` and in the table above.
4. Keep every fixture failing: `just arch-check --fixtures` must still report all six.
