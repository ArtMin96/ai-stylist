# Dependency vulnerability ignores

`just security-scan` runs `osv-scanner scan --recursive .` and `pnpm audit --audit-level=high`.
osv-scanner reads every lockfile in the tree: `pnpm-lock.yaml`, `workers/uv.lock`, the Android
`gradle.lockfile`s (`apps/android/**/gradle.lockfile`, `apps/android/*-gradle.lockfile`) plus
`apps/android/gradle/verification-metadata.xml`, and the iOS `apps/ios/Packages/*/Package.resolved`.
`pnpm audit` covers npm only. Neither tool is ever weakened to get a green run: no `--allow-*` flags, no
lowered severity threshold, no lockfile exclusion. A reported vulnerability is handled in this
order of preference, and the choice is recorded in the table below.

1. **Bump the direct dependency** when the vulnerable package is one we depend on directly.
2. **Bump the dependent** when a newer minor/patch of the package that pulls in the vulnerable
   transitive already resolves it.
3. **`pnpm.overrides`** in the root `package.json`, scoped as narrowly as pnpm allows
   (`"<dependent>><package>": "<range>"`), when the dependent has no fixed release yet. Each
   override is verified with the tool that consumes the overridden package (see table).
4. **Ignore with expiry**, only when there is no fixed version or every fix path breaks a tool.

The license gate that runs in the same recipe follows the same discipline; see
[licenses.md](licenses.md) for its policy file and exception format.

## Ignore policy

- Ignores live in two places that must stay in sync:
  - `osv-scanner.toml` (repo root, auto-discovered by osv-scanner): one `[[IgnoredVulns]]` per
    OSV/GHSA id with `reason` (package, dependency path, why it is unfixable today) and
    `ignoreUntil`.
  - `pnpm.auditConfig.ignoreGhsas` in the root `package.json`, the same id list, because
    `pnpm audit` reads only this setting and cannot express an expiry.
    Maven (Gradle) and SwiftPM ignores live only in `osv-scanner.toml`; `pnpm audit` never sees
    them.
- `ignoreUntil` is at most **two months** from the date the entry is added. When it passes,
  osv-scanner re-reports the finding and `just security-scan` goes red until someone either fixes
  it or renews the entry with a fresh reason and a new date. Renewing also means re-checking
  the pnpm list: remove the id from `ignoreGhsas` the moment it leaves `osv-scanner.toml`.
- Never ignore a finding that has a working fix path.

## Ledger (2026-09-10)

Findings from `just security-scan` on 2026-09-10 (osv-scanner 2.5.1), and what was done.

| Package (vulnerable version) | Advisories                                                    | Dependency path                                                                                                                            | Action                                                                                                                   | Verification run                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fastify@5.11.3`             | GHSA-3m5p-2c4r-xxw2, GHSA-w2qp-rph6-63g4                      | `@ai-stylist/api` (direct pin) and `@nestjs/platform-fastify@11.2.3` (exact pin `5.11.3`; 11.2.3 is the last 11.x, 12.x is a NestJS major) | Bumped direct pin to `5.12.1` and added override `@nestjs/platform-fastify>fastify: 5.12.1` so a single version resolves | `just test api` (18 files / 41 tests pass), `just typecheck`                                                                                                                                                               |
| `js-yaml@4.2.0`              | GHSA-2883-xcg3-v3hh, GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj | `@hey-api/openapi-ts@0.99.0` (latest) -> `@hey-api/json-schema-ref-parser@1.4.4` (latest, exact pin `4.2.0`)                               | Override `@hey-api/json-schema-ref-parser>js-yaml: ^4.3.2` (resolves 4.3.2)                                              | `just generate --check` (output up to date)                                                                                                                                                                                |
| `esbuild@0.18.20`            | GHSA-67mh-4wv8-2f99                                           | `drizzle-kit@0.31.10` (latest) -> `@esbuild-kit/esm-loader@2.6.5` -> `@esbuild-kit/core-utils@3.3.2` (`~0.18.20`)                          | Override `@esbuild-kit/core-utils>esbuild: ^0.25.4` (dedupes onto drizzle-kit's own esbuild 0.25.12)                     | `just db-migrate && just db-rollback && just db-migrate` against local Postgres; `drizzle-kit generate --name smoke_test` (loads `drizzle.config.ts` through the overridden loader; "No schema changes", no files written) |

2026-09-22: the React Native / Expo app was removed. That also removed the `xcode>uuid` override and
the three ignored entries (`image-size` GHSA-5p2g-fcmc-qvqq and GHSA-w3rx-r6r6-pgpr,
`decode-uri-component` GHSA-vcc3-ghjq-m6fr), whose only dependency paths ran through Expo. No
ignored entries remain; `osv-scanner.toml` has no
`[[IgnoredVulns]]` and `package.json` has no `pnpm.auditConfig`.

2026-09-23: the native apps' lockfiles are in the scan (osv-scanner 2.5.1 reads Gradle lockfiles,
`verification-metadata.xml` and SwiftPM `Package.resolved` natively; no configuration needed). The
first run reported **Maven findings: 65 packages, 286 advisories**, all Android. The packages are
`io.netty:*`, `org.bouncycastle:*`, `org.bitbucket.b_c:jose4j`, `ch.qos.logback:logback-core`,
`org.apache.commons:commons-lang3`, `org.apache.httpcomponents:httpclient`, `org.jdom:jdom2` and
`org.jetbrains.kotlin:kotlin-gradle-plugin`. The samples checked come from build-tool Gradle
configurations (`classpath`, `androidLintTool`, `unified-test-platform-*`), not from the app's
runtime classpath. **Open, owner: Android.** Bump AGP, Kotlin or the lint and test-platform
versions where a fixed release exists. Otherwise add expiring `osv-scanner.toml` entries per the
policy above, each with the Gradle configuration that pulls it in. Until then `just security-scan` is red.
The SwiftPM `Package.resolved` files had no findings.
