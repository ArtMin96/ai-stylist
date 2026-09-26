# Dependency vulnerability ignores

`just security-scan` runs `scripts/ci/osv-scan.sh` (`osv-scanner scan --recursive` over the
checkout) and `pnpm audit --audit-level=high`. osv-scanner reads every lockfile in the tree:
`pnpm-lock.yaml`, `workers/uv.lock`, the Android `gradle.lockfile`s
(`apps/android/**/gradle.lockfile`, `apps/android/buildscript-gradle.lockfile`) plus
`apps/android/gradle/verification-metadata.xml`, and the iOS `apps/ios/Packages/*/Package.resolved`.
The wrapper fails an empty scan and any tracked lockfile the scan did not report, and scans a git
worktree through a symlink so an enclosing repository's `.gitignore` cannot hide it;
`scripts/ci/osv-scan.sh --fixtures` (in `just ci-parity`) proves both. `pnpm audit` covers npm only. Neither tool is ever weakened to get a green run: no `--allow-*` flags, no
lowered severity threshold, no lockfile exclusion. A reported vulnerability is handled in this
order of preference, and the choice is recorded in the table below.

1. **Bump the direct dependency** when the vulnerable package is one we depend on directly.
2. **Bump the dependent** when a newer minor/patch of the package that pulls in the vulnerable
   transitive already resolves it.
3. **`overrides`** in `pnpm-workspace.yaml`, scoped as narrowly as pnpm allows
   (`'<dependent>><package>': <range>`), when the dependent has no fixed release yet. Each
   override is verified with the tool that consumes the overridden package (see table).
4. **Ignore with expiry**, only when there is no fixed version or every fix path breaks a tool.

The license gate that runs in the same recipe follows the same discipline; see
[licenses.md](licenses.md) for its policy file and exception format.

## Ignore policy

- Ignores live in two places that must stay in sync:
  - `osv-scanner.toml` (repo root, auto-discovered by osv-scanner): one `[[IgnoredVulns]]` per
    OSV/GHSA id with `reason` (package, dependency path, why it is unfixable today) and
    `ignoreUntil`.
  - `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` (pnpm 12 ignores the `pnpm` field of
    `package.json`), the same id list, because
    `pnpm audit` reads only this setting and cannot express an expiry.
    Maven (Gradle) and SwiftPM ignores live only in osv-scanner config; `pnpm audit` never sees
    them.
  - osv-scanner (observed on 2.5.1; re-check after a bump with `just security-scan`) applies only the `osv-scanner.toml` in the **same directory** as the
    lockfile that reported the finding; a root entry for a finding from a subdirectory is loaded
    but never matched ("has unused ignores"). So an Android finding from
    `apps/android/gradle/verification-metadata.xml` is ignored in
    `apps/android/gradle/osv-scanner.toml`, with the same fields and the same ledger row here.
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
`[[IgnoredVulns]]` and `pnpm-workspace.yaml` has no `auditConfig`.

2026-09-26: pnpm 12 reads its settings only from `pnpm-workspace.yaml`, so the three overrides above
moved there from `package.json#pnpm.overrides` (pnpm 12.6.0 dropped them from the lockfile while
they were in `package.json`).

2026-09-26 (dependency upgrade): the `@nestjs/platform-fastify>fastify: 5.12.1` override was
removed. `@nestjs/platform-fastify@12.1.0` pins `fastify@5.12.5` itself, which is past both fastify
advisories above, and the direct pin in `apps/api/package.json` moved to the same `5.12.5`, so one
fastify version resolves without an override (the old override would have forced a downgrade). The
two remaining overrides stay: `@hey-api/json-schema-ref-parser@1.4.4` (still latest) still pins
`js-yaml@4.2.0`, and `drizzle-kit@0.31.11` (latest) still pulls `@esbuild-kit/core-utils@3.3.2`
(`esbuild ~0.18.20`). Verified with `just security-scan` (no known vulnerabilities).

2026-09-23: the native apps' lockfiles are in the scan (osv-scanner 2.5.1 reads Gradle lockfiles,
`verification-metadata.xml` and SwiftPM `Package.resolved` natively; no configuration needed). The
first run reported **Maven findings: 65 packages, 286 advisories**, all Android. The packages are
`io.netty:*`, `org.bouncycastle:*`, `org.bitbucket.b_c:jose4j`, `ch.qos.logback:logback-core`,
`org.apache.commons:commons-lang3`, `org.apache.httpcomponents:httpclient`, `org.jdom:jdom2` and
`org.jetbrains.kotlin:kotlin-gradle-plugin`. The samples checked come from build-tool Gradle
configurations (`classpath`, `androidLintTool`, `unified-test-platform-*`), not from the app's
runtime classpath.
The SwiftPM `Package.resolved` files had no findings.

2026-09-23 (resolved, branch `fix/android-osv-advisories`): the 286 rows are 20 unique
package versions and 92 unique advisories. Every lockfile line was checked: **none is on an app
runtime classpath** (`*RuntimeClasspath` of `:app`, `:feature:*`, `:core:*`). All are build
tooling. No owning-tool release fixes them: AGP 9.4.1 still pulls the same versions, ktlint 1.8.0
is the latest release, and Kotlin 2.4.20 and Gradle 9.7.1 were the latest GA releases that day (2026-09-26: Gradle is pinned at 9.7.1; 9.8.0 exists but adds an AGP 9.4.1 deprecation warning, which warnings-as-errors fails). So they are
fixed with **upgrade-only security floors**: the `floor-*` entries in
`apps/android/gradle/libs.versions.toml`, applied by the root `build.gradle.kts` (plugin
classpath) and `build-logic/.../BuildToolSecurityFloors.kt` (`androidLintTool`,
`unified-test-platform-*`, and a component metadata rule on Spotless's `ktlint-cli`). The lockfiles and
`verification-metadata.xml` were regenerated with `just android-deps-lock`. Gradle never deletes
superseded entries, so the 34 stale components were pruned. A strict-verification build without
the configuration cache then passed, which shows none of them is still fetched. Remove a floor
once its owning tool ships the fixed version.

| Package (vulnerable version)                                                                                 | Advisories                                                    | Gradle configuration (build tool)                                                                                                                | Action                                                                                                                                                                                                                                                                                                                                                                                                                 | Verification run                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `io.netty:*@4.1.93.Final`, `@4.1.110.Final` (codec, codec-http, codec-http2, common, handler, handler-proxy) | 41 unique ids (e.g. GHSA-8c42-7qj2-3j46, GHSA-c4c3-7fpv-j4q5) | `unified-test-platform-core`, `unified-test-platform-android-test-plugin-host-emulator-control` (UTP, via grpc-netty) in `:app`, `:feature:home` | Floor `io.netty:netty-bom:4.1.137.Final` on `unified-test-platform-*` only                                                                                                                                                                                                                                                                                                                                             | `just android-deps-lock`, `just android-check` (UTP itself runs only for instrumented tests on a device; not run here) |
| `org.bouncycastle:bcprov/bcpkix/bcutil-jdk18on@1.79`                                                         | 5 (GHSA-qp49-qgx5-5m26, GHSA-9pwp-9qqc-pr26, …)               | root `classpath` (AGP), `androidLintTool`, `unified-test-platform-android-test-plugin-result-listener-gradle`                                    | Floor 1.85                                                                                                                                                                                                                                                                                                                                                                                                             | `just android-check` (release signing + lint)                                                                          |
| `org.apache.commons:commons-lang3@3.16.0`                                                                    | GHSA-j288-q9x7-2f5v                                           | root `classpath`, `androidLintTool`, UTP result listener                                                                                         | Floor 3.18.0                                                                                                                                                                                                                                                                                                                                                                                                           | `just android-check`                                                                                                   |
| `org.apache.httpcomponents:httpclient@4.5.6`                                                                 | GHSA-7r82-7xv7-xcpj                                           | `androidLintTool`, UTP result listener                                                                                                           | Floor 4.5.14                                                                                                                                                                                                                                                                                                                                                                                                           | `just android-check` (lint)                                                                                            |
| `org.bitbucket.b_c:jose4j@0.9.5`                                                                             | GHSA-3677-xxcr-wjqv                                           | root `classpath` (AGP)                                                                                                                           | Floor 0.9.6                                                                                                                                                                                                                                                                                                                                                                                                            | `just android-check`                                                                                                   |
| `org.jdom:jdom2@2.0.6`                                                                                       | GHSA-2363-cqg2-863c                                           | root `classpath` (AGP)                                                                                                                           | Floor 2.0.6.1                                                                                                                                                                                                                                                                                                                                                                                                          | `just android-check`                                                                                                   |
| `ch.qos.logback:logback-core@1.3.16`                                                                         | GHSA-qqpg-mvqg-649v, GHSA-p47f-322f-whfh, GHSA-jhq6-gfmj-v8fx | Spotless's detached ktlint configuration (`ktlint-cli:1.8.0` -> `logback-classic:1.3.16`); not in any lockfile                                   | Component metadata rule on `ktlint-cli` raises logback to 1.5.34                                                                                                                                                                                                                                                                                                                                                       | `just android-check` (`spotlessCheck`)                                                                                 |
| `org.jetbrains.kotlin:kotlin-gradle-plugin@2.4.0`                                                            | GHSA-r937-wjx7-w2jp                                           | `apps/android/build-logic` buildscript classpath, via Gradle 9.7.1's bundled `kotlin-dsl` (6.7.3); not locked, verification-metadata only        | **Ignored until 2026-11-22** in `apps/android/gradle/osv-scanner.toml`. Both fix paths break the build: a KGP 2.4.20 classpath constraint, and pinning `kotlin-dsl` 6.7.11. Either way, `:build-logic:convention:compileKotlin` fails under `allWarningsAsErrors` (`-Xuse-fir-lt` deprecated). Fix: Gradle 9.8.0 (GA by 2026-09-26, but Gradle is pinned at 9.7.1 because 9.8.0 adds an AGP 9.4.1 deprecation warning) | osv-scanner reports it filtered, `No issues found`                                                                     |
