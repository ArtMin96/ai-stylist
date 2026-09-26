# ADR-0006 — Track latest stable toolchains and dependencies

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** owner (human-authorized repo-wide upgrade, 2026-09-26) + implementing session (branch `fix/prompt-audit-followups`)
- **Decision-log entry:** DEC-56 in [16-risks-open-questions-and-decision-log.md](../../planning/16-risks-open-questions-and-decision-log.md). Resolves OQ-13. Amends DEC-37, DEC-43 and DEC-54.
- **Supersedes:** the version pins in [ADR-0001](0001-monorepo-tooling-and-toolchain-pins.md) item 8 (Node 22.x, pnpm 10.x, Python 3.12.x), [ADR-0003](0003-self-hosted-infrastructure-baseline.md) (PostgreSQL 17, `pgvector/pgvector:pg17`) and [ADR-0004](0004-native-ios-and-android-clients.md) decision 5 (AGP 9.3.3, targetSdk 36, JDK Temurin 21). The rest of those ADRs stands.
- **Related:** OQ-13 (resolved) · RISK-17 (PostgreSQL recovery) · phase P02 (T01, T07, T11) · [planning/15 §1.2, §9](../../planning/15-team-workflow-and-ai-agent-operations.md) · `renovate.json`

## Context

Until now each toolchain was pinned once, at the version that was current when its phase started, and major bumps waited for an explicit decision (OQ-13 held NestJS at 11.x; ADR-0001 pinned Node 22, pnpm 10 and Python 3.12; ADR-0003 pinned PostgreSQL 17; ADR-0004 pinned JDK 21 and AGP 9.3.3). By 2026-09-26 every one of those lines had a newer stable release, and the gap only grows: each skipped major makes the next jump larger and moves the repo further from the versions that current documentation, security fixes and Renovate PRs target. No user data or production database exists yet, so a major bump now costs a local volume and a CI run, not a migration. On 2026-09-26 the owner asked for every tool and dependency to be on its latest **stable** release, continuously.

## Options considered

| Option                                                                                          | Pros                                                                                                                     | Cons                                                                                                                                         | Evidence (primary source + as-of date)                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A (chosen): **track the latest stable release**, bounded by published compatibility ranges      | Security fixes and docs match what we run; small, frequent bumps instead of rare large ones; Renovate enforces it weekly | More frequent bump PRs; a bump can surface a new deprecation that warnings-as-errors turns into a failure, which then needs a held pin       | Upgrade run 2026-09-26: every lane green on the new pins except the hold listed below (official release notes and compatibility tables) |
| B: pin at phase start, bump majors only at a phase boundary or on a security finding            | Fewer PRs; each major bump is a planned event                                                                            | Drift accumulates (four runtime majors behind by 2026-09-26); security fixes may land only on newer lines; larger, riskier jumps             | OQ-13 (NestJS 12 released, deferred to P03–P14)                                                                                          |
| C: always take the newest release, including Current / pre-LTS lines (Node 26, TypeScript 7, …) | Newest features first                                                                                                    | Non-LTS runtimes change under us; peer ranges (typescript-eslint) and plugin ranges (AGP ↔ Gradle) break the build; no stable support window | Node release schedule: 26 is Current until its LTS on 2026-10-28; typescript-eslint peer range `<6.1.0` (2026-09-26)                     |

## Decision

Every tool, runtime and dependency tracks its **latest stable release**; "stable" means GA (no RC, beta or preview), and for runtimes with an LTS scheme it means the newest **LTS** line (Node Active LTS, Temurin LTS). A newer release is held back only when a published compatibility range or a warnings-as-errors gate rejects it; each hold names the blocker and is revisited when the blocker ships a fix.

Concrete pins adopted on 2026-09-26 (exact values live in `mise.toml`, the package manifests, `apps/android/gradle/libs.versions.toml`, the Swift manifests and `docker-compose.yml`, not here):

1. **Node.js 22 → 24** (Active LTS). Node 26 is Current until it becomes LTS on 2026-10-28; the LTS rule moves the pin then, through Renovate.
2. **pnpm 10 → 12.** pnpm 12 reads its settings only from `pnpm-workspace.yaml`, so `overrides` and the build-script allowlist (`allowBuilds`, replacing `onlyBuiltDependencies`) moved there from `package.json#pnpm`.
3. **Python 3.12 → 3.14** for the workers (`requires-python`, Docker base images, the generated models regenerated for 3.14); uv 0.12.19.
4. **JDK Temurin 21 → 25 (LTS).** JDK 25 is the newest LTS that AGP 9.4.1, Gradle 9.8.0, Kotlin 2.4.20 and Robolectric all accept.
5. **Android:** AGP 9.3.3 → 9.4.1, **targetSdk 36 → 37** (compileSdk 37 unchanged), Kotlin 2.4.20 unchanged, **Gradle 9.7.1 → 9.8.0** (AGP 9.4.1 emits `Configuration.setVisible` deprecation problems on 9.8.0; they are not errors). The build-logic uses `org.jetbrains.kotlin.jvm` 2.4.20 + `java-gradle-plugin` + `sam-with-receiver` instead of `kotlin-dsl`, which removes Gradle's embedded kotlin-gradle-plugin (2.4.x < 2.4.20, GHSA-r937-wjx7-w2jp / CVE-2026-53914) from the build-logic classpath; Gradle 9.8.0 alone would not have cleared it (it embeds Kotlin 2.4.10).
6. **PostgreSQL 17 → 18** (`pgvector/pgvector:pg18`) for local compose, Testcontainers and the planned staging/production servers; the migration test asserts major 18.
7. **API:** NestJS 11.2.3 → 12.1.0, Fastify 5.12.1 → 5.12.5, `@types/node` 24. The `@nestjs/platform-fastify>fastify` pnpm override is removed, because NestJS 12.1.0 resolves a patched Fastify itself.
8. **iOS:** `swift-tools-version` 6.2 → 6.4, swift-collections 1.7.1; Xcode 27.0 is already the newest stable.
9. **CI:** the portability macOS runner moves `macos-15` → `macos-26`; all GitHub Actions are already on their latest releases.
10. **Renovate** keeps the repo there: minor/patch updates for npm, Python (pep621/uv) and GitHub Actions automerge after full CI is green; runtimes (node, pnpm, python, java), other `mise.toml` pins, Android (Gradle, AGP, wrapper) and SwiftPM stay manual PRs, reviewed against this ADR.

**Held back on 2026-09-26** (a named exception, not a policy change):

- **TypeScript stays 6.0.3** (7.x exists): typescript-eslint's peer range is `<6.1.0`.

## Rationale

A over B: the drift B produces is exactly what OQ-13 recorded, and every deferred major becomes a larger combined change later. A over C: C ignores the compatibility ranges the build actually enforces. JDK 26 exists, but JDK 25 is the newest **LTS** and the newest JDK inside the AGP/Gradle/Kotlin/Robolectric ranges. Node 26 is not LTS yet. TypeScript 7 fails the build today (typescript-eslint peer range). The upgrade was verified by the lanes the upgrade agents ran on 2026-09-26; the iOS simulator build and the macOS portability job still need a Mac or CI run to confirm (see `planning/PROGRESS.md`).

## Consequences and revisit triggers

- Positive: the repo runs the versions that current docs and advisories target; OQ-13 is closed; bumps stay small and weekly.
- **PostgreSQL 18 needs a new data volume.** A PG18 server cannot open a PG17 data directory, and the PG18 image keeps data under `/var/lib/postgresql/18/docker` (`PGDATA`) with the volume declared at `/var/lib/postgresql`; a mount at the old `/var/lib/postgresql/data` path makes the entrypoint refuse to start. Local compose therefore mounts a new named volume at `/var/lib/postgresql`; the old local volume holds synthetic data only and can be removed.
- **Production major upgrades need `pg_upgrade` with matching data-checksum settings.** PostgreSQL 18's `initdb` enables data checksums by default, and `pg_upgrade` requires old and new clusters to match. No production cluster exists yet, so this is a runbook note for the first 18 → 19 upgrade (and for any cluster restored from a pre-18 backup).
- **Robolectric on JDK 25** needs `--enable-native-access=ALL-UNNAMED` in the test JVM arguments (set in the Android build-logic conventions).
- Negative/accepted debt: more frequent version PRs; one named hold (TypeScript 7) to watch; CI service images move to pg18 only once the human applies the pending workflow patch; `apps/android/gradle/verification-metadata.xml` still lists pre-upgrade AGP entries until pruned.
- **Revisit when:** Node 26 becomes Active LTS (2026-10-28) → move the Node pin; typescript-eslint widens its peer range to TypeScript 7 → lift the TS hold; a stable release breaks a gate that cannot be fixed within one PR → record a new hold here via a DEC amendment. Reversing the policy itself requires a new ADR and DEC entry.
