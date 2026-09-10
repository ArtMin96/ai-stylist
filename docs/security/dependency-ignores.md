# Dependency vulnerability ignores

`just security-scan` runs `osv-scanner` and `pnpm audit --audit-level=high` against
`pnpm-lock.yaml`. Neither tool is ever weakened to get a green run: no `--allow-*` flags, no
lowered severity threshold, no lockfile exclusion. A reported vulnerability is handled in this
order of preference, and the choice is recorded in the table below.

1. **Bump the direct dependency** when the vulnerable package is one we depend on directly.
2. **Bump the dependent** when a newer minor/patch of the package that pulls in the vulnerable
   transitive already resolves it.
3. **`pnpm.overrides`** in the root `package.json`, scoped as narrowly as pnpm allows
   (`"<dependent>><package>": "<range>"`), when the dependent has no fixed release yet. Each
   override is verified with the tool that consumes the overridden package (see table).
4. **Ignore with expiry**, only when there is no fixed version or every fix path breaks a tool.

## Ignore policy

- Ignores live in two places that must stay in sync:
  - `osv-scanner.toml` (repo root, auto-discovered by osv-scanner): one `[[IgnoredVulns]]` per
    OSV/GHSA id with `reason` (package, dependency path, why it is unfixable today) and
    `ignoreUntil`.
  - `pnpm.auditConfig.ignoreGhsas` in the root `package.json`, the same id list, because
    `pnpm audit` reads only this setting and cannot express an expiry.
- `ignoreUntil` is at most **two months** from the date the entry is added. When it passes,
  osv-scanner re-reports the finding and `just security-scan` goes red until someone either fixes
  it or renews the entry with a fresh reason and a new date. Renewing also means re-checking
  the pnpm list: remove the id from `ignoreGhsas` the moment it leaves `osv-scanner.toml`.
- Never ignore a finding that has a working fix path.

## Ledger (2026-09-10)

Findings from `just security-scan` on 2026-09-10 (osv-scanner 2.5.1), and what was done.

| Package (vulnerable version) | Advisories                                                    | Dependency path                                                                                                                            | Action                                                                                                                                                                                                                                                                                                                               | Verification run                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fastify@5.11.3`             | GHSA-3m5p-2c4r-xxw2, GHSA-w2qp-rph6-63g4                      | `@ai-stylist/api` (direct pin) and `@nestjs/platform-fastify@11.2.3` (exact pin `5.11.3`; 11.2.3 is the last 11.x, 12.x is a NestJS major) | Bumped direct pin to `5.12.1` and added override `@nestjs/platform-fastify>fastify: 5.12.1` so a single version resolves                                                                                                                                                                                                             | `just test api` (18 files / 41 tests pass), `just typecheck`                                                                                                                                                               |
| `js-yaml@4.2.0`              | GHSA-2883-xcg3-v3hh, GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj | `@hey-api/openapi-ts@0.99.0` (latest) -> `@hey-api/json-schema-ref-parser@1.4.4` (latest, exact pin `4.2.0`)                               | Override `@hey-api/json-schema-ref-parser>js-yaml: ^4.3.2` (resolves 4.3.2)                                                                                                                                                                                                                                                          | `just generate --check` (output up to date)                                                                                                                                                                                |
| `esbuild@0.18.20`            | GHSA-67mh-4wv8-2f99                                           | `drizzle-kit@0.31.10` (latest) -> `@esbuild-kit/esm-loader@2.6.5` -> `@esbuild-kit/core-utils@3.3.2` (`~0.18.20`)                          | Override `@esbuild-kit/core-utils>esbuild: ^0.25.4` (dedupes onto drizzle-kit's own esbuild 0.25.12)                                                                                                                                                                                                                                 | `just db-migrate && just db-rollback && just db-migrate` against local Postgres; `drizzle-kit generate --name smoke_test` (loads `drizzle.config.ts` through the overridden loader; "No schema changes", no files written) |
| `uuid@7.0.3`                 | GHSA-w5hq-g745-h8pq                                           | `@expo/config-plugins@57.0.9` (latest) -> `xcode@3.0.1` (latest, `^7.0.3`)                                                                 | Override `xcode>uuid: ^11.1.1`. Safe because `xcode/lib/pbxProject.js` does `require('uuid')` + `uuid.v4()`, which uuid 11's CJS build still exports                                                                                                                                                                                 | `pbxProject.generateUuid()` returns valid 24-hex ids under uuid 11.1.1; `npx expo-doctor` (21/21); `npx expo export --platform android`                                                                                    |
| `image-size@1.2.1`           | GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr                      | `expo` -> `@expo/cli` / `@react-native/metro-config` -> `metro@0.87` -> `image-size`                                                       | **Ignored until 2026-11-10.** No fixed release exists: both advisories mark every version through 2.0.2 (the latest) as affected. Build-time only (Metro asset resolver); never runs in the app or API                                                                                                                               | osv-scanner filters the ids; `pnpm audit` reports them as ignored                                                                                                                                                          |
| `decode-uri-component@0.2.2` | GHSA-vcc3-ghjq-m6fr                                           | `expo-router@57.0.20` (latest) -> `query-string@7.1.3` -> `decode-uri-component`                                                           | **Ignored until 2026-11-10.** The only fixed line (>=0.5.0) is ESM-only (`export default`); `query-string@7` is CommonJS and calls `require('decode-uri-component')(value)`, so under Metro/Node CJS interop the override would make expo-router's route-path parsing throw at app runtime. expo-router still pins `query-string ^7` | osv-scanner filters the id; `pnpm audit` reports it as ignored                                                                                                                                                             |

Next review of the ignored entries: **before 2026-11-10** (check `image-size` for a fixed
release, and `expo-router` for a `query-string` >= 8 or a CJS-compatible
`decode-uri-component`).
