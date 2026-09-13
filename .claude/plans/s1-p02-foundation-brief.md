# P02 Foundation Brief

> Amended 2026-09-13: service consolidation per ADR-0003 ([r7](../../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)) — pg-boss replaces Trigger.dev, owned server + Coolify replaces Railway, self-managed PostgreSQL replaces Neon, R2 delivery model fixed.

Sources (`planning/`): P02 phase file, docs 04/05/06/11/13/14/15/16, SPINE, r1, CLAUDE.md. Citations use doc number + §. Repo root today holds only `.claude/`, `planning/`, one prompt file, `solo.yml`.

## 1. Decided stack

| Concern | Choice | Version / policy | Source |
|---|---|---|---|
| Package manager | pnpm | 10.x; exact in root `packageManager`; frozen lockfile; build-script allowlist | 15 §1.2, §9 |
| Monorepo tool | pnpm workspaces + Turborepo (`turbo.json`, remote cache) | latest stable | 05 §5.8, 04 §6 |
| Node | 22.x active LTS, exact patch in `mise.toml`, matches EAS image | 22.x | 15 §1.2 |
| TypeScript | workspace TS (editor uses workspace version) | latest stable | 15 §1.5 |
| Lint / format | ESLint + `eslint-plugin-boundaries`, Prettier; Ruff (lint+format) for Python | latest stable | 15 §5, 04 §4.3 |
| Tests: API/packages | Vitest, fast-check, Testcontainers (Postgres+pgvector) | latest stable | 13 §3 |
| Tests: mobile | Jest + RN Testing Library, MSW; Maestro E2E in `apps/mobile/e2e/` | latest stable | 13 §2–3 |
| Tests: workers | pytest, hypothesis, Schemathesis | latest stable | 13 §3 |
| API | NestJS on Fastify adapter; `@nestjs/swagger` | latest stable | 05 §5.1 |
| Mobile | React Native + Expo prebuild/dev-client, New Architecture | Expo SDK 55+ | 05 §2 |
| 3D | Filament via `react-native-filament`; boundary dir only, empty in P02 | RNF 1.11.0 / Filament 1.76.0 at decision time | 05 §3, §9 |
| ORM/migrations | Drizzle + drizzle-kit; expand–contract | latest stable | 05 §5.3, 06 §7 |
| DB | Self-managed PostgreSQL 17 + pgvector (Docker `pgvector/pgvector:pg17` on the owned host; staging/prod), pgBackRest PITR to an encrypted R2 bucket, PgBouncer; ephemeral/Testcontainers DBs replace branch-per-PR; local Docker pgvector on the same major | 17 | 05 §5.3, 15 §1.4, ADR-0003 |
| Hosting | Owned server + Docker + Coolify (staging/prod; API, jobs, workers, PostgreSQL on a private Docker network); provider + topology per OQ-07/OQ-14 | — | ADR-0003 |
| Queue/jobs | pg-boss v12 on the app PostgreSQL + Postgres outbox; jobs in `apps/api/src/jobs/`; self-hosted Trigger.dev only if the T08 acceptance suite proves pg-boss insufficient | 12 | 05 §5.4, 04 §9, ADR-0003 |
| Python | 3.12.x via mise; `uv` + committed `uv.lock`; Pyright/BasedPyright | 3.12.x | 15 §1.2, §1.5, §9 |
| Contracts | OpenAPI 3.1 YAML per module → `openapi.bundle.json`; `@hey-api/openapi-ts`; `datamodel-code-generator`; `json-schema-to-typescript`; spectral; oasdiff | generators pinned via mise | 06 §1, §9 |
| CI | GitHub Actions calling `just` only; Linux runners except iOS lane | — | DEC-32, 15 §5.1 |
| iOS lane | EAS free tier AND GHA macOS M-series run ~2 weeks; ADR-P02 decides (OQ-04); TestFlight upload from Linux via App Store Connect API | UNDECIDED until T15 | 05 §7.2, r1 §6 |
| Secrets/env | sops + age (`secrets/<env>.enc.yaml`, `.sops.yaml`); direnv `.envrc` → gitignored `.env`; `just secrets-sync` | — | 15 §6 |
| Observability | pino (API), structlog (workers), OTel → Grafana Cloud free tier or separate-node self-hosted stack (ADR-OBS-01 chooses); PostHog behind consent stub (off) | latest stable | 14 §1–2, P02 §11 |
| Commits / hooks | Conventional Commits + commit-lint; gitleaks pre-commit; manager `prek`/husky UNDECIDED | — | 15 §4, §7 |
| Boundary tool | eslint-plugin-boundaries (`just lint`) + dependency-cruiser `tools/depcruise/rules.cjs` (`just arch-check`) | latest stable | 04 §4.3 |
| Pinning | `mise.toml`: node, pnpm, java Temurin 17, just 1.x, python, watchman; bumps only via Renovate | — | 15 §1.2, §9 |
| Supply chain | Renovate, osv-scanner (high+ blocks), pnpm audit, gitleaks, syft SBOM, license gate (no GPL/AGPL) | — | 15 §9 |

## 2. Repository layout

```
CLAUDE.md PROGRESS.md CODEOWNERS        moved from planning/, paths activated, real handles (T16)
justfile mise.toml package.json pnpm-workspace.yaml turbo.json renovate.json .editorconfig .gitattributes(LFS)
.envrc .env.example .sops.yaml secrets/{dev,staging,prod}.enc.yaml
.github/workflows/  pr-gate, affected, nightly, pre-release, ios-eas, ios-gha-macos, android — all invoke `just`
.agents/skills/<13 areas>/SKILL.md      required (NFR-TEAM-100), six sections each
apps/mobile/                Expo SDK 55 prebuild, placeholder screen, eas.json; src/app/_root.tsx composition root
apps/mobile/src/render/     Filament boundary, README only, lint-restricted (§8 #1); src/{features,data,lib}/ README; e2e/ Maestro
apps/api/src/main.ts app.module.ts      Nest/Fastify root; GET /v1/health, /v1/version; dev-only POST /v1/dev/demo-events
apps/api/src/modules/<name>/{index.ts,internal/,tests/}  13 dirs: identity profile avatar closet media outfit context
                            recommendation fashion-intel billing notifications admin assistant (empty index.ts + smoke test)
apps/api/src/platform/      StorageProvider(R2), outbox relay, logger, OTel init, PostHog server, resilience utils
apps/api/src/jobs/index.ts  demo job;  apps/api/tests/migrations/  fwd/rollback tests
workers/ml/segmentation/    FastAPI echo stub, Dockerfile, main.py, tests/, pyproject+uv.lock;  workers/ml/generated/
packages/contracts/{openapi,events,gen/ts-client,gen/events-ts}/  health/version, RFC 9457, envelope.json, demo event, analytics schema
packages/shared-kernel/     ULID prefixes, units, envelope type, error/reason/entitlement registries, tests/
packages/db/                drizzle-kit config + migrations 0001_platform_outbox, 0002_platform_idempotency_keys (§8 #2)
packages/seed-data/ packages/test-support/   synthetic factories; shared builders/fakes
assets/3d/  tools/depcruise/rules.cjs  tools/codegen/  scripts/{bootstrap,doctor}.sh
docs/adr/ (ADR-P02, ADR-OBS-01, P00 set)  docs/modules/<15>.md  templates/ (issue, PR, adr, handoff, module-contract, phase)
```

Templates: `adr.md` = Status/Date/Deciders/DEC link/Related + Context/Options/Decision/Rationale/Consequences. `module-contract.md` = Public interface, Owned data, Invariants, Events, Dependencies, Forbidden deps, Tests, Extension points. `session-handoff.md` = 8 bullets appended to PROGRESS.md log.

## 3. `just` recipe catalog

Dashes only; `*` = in `ci-parity`; long recipes call `scripts/*.sh`; destructive ones need `--yes` (15 §5).

| Recipe | Runs / behavior | Flags |
|---|---|---|
| `bootstrap` | `scripts/bootstrap.sh`: apt → mise install → pnpm install (frozen) → Android SDK/udev → Docker/direnv checks → git hooks → `.env` scaffold (15 §4) | idempotent |
| `doctor` | `scripts/doctor.sh`: pins, adb, Docker, Postgres, direnv, `.env` keys, `generate --check`, hooks, disk; hint per failure | read-only |
| `dev-api` / `dev-mobile` / `dev-workers` | compose pgvector + Nest watch / Expo dev client / workers + pg-boss job process | `--android` |
| `test [module]` * | one module's `tests/` or full suite via turbo | module |
| `lint` * | ESLint (boundaries, no-skip, forbidden-field, a11y, no-utils, test-placement, expired-flag, file-size) + Ruff | — |
| `typecheck` * | `tsc --noEmit` per workspace + Pyright | — |
| `format` * | Prettier + Ruff format | `--check` (CI) |
| `arch-check` * | `depcruise --config tools/depcruise/rules.cjs` | — |
| `generate` * | bundle OpenAPI → hey-api → json-schema-to-typescript → datamodel-code-generator; `--check` diffs committed output | `--check` |
| `db-migrate` / `db-rollback` / `db-reset` / `db-seed` | drizzle-kit apply / roll back last (expand–contract aware) / local-only drop+recreate+seed (refuses non-local URL) / synthetic seed | env; `--yes`; `--accounts` |
| `mobile-ios-build` / `mobile-android-build` | trigger cloud lane per ADR-P02 / Gradle APK+AAB | `--profile dev\|preview\|prod`; `--cloud` |
| `assets-validate` | glTF validity, KTX2, budgets, manifest schema, morph names (adopt P01 tooling) | — |
| `ml-eval`, `golden-accept`, `rec-replay <id>`, `rec-golden-update` | stubs in P02 (must exist for `just --list`, AC-1) | — |
| `security-scan` * | gitleaks + osv-scanner + pnpm audit + license check (+ syft SBOM, T12) | — |
| `secrets-sync` | sops decrypt dev → `.env` | — |
| `ci-parity` | format --check, lint, typecheck, arch-check, generate --check, test, security-scan | — |

## 4. CI tiers

| Tier | Trigger | Runs | Required |
|---|---|---|---|
| PR fast gate | every PR | `ci-parity` set + spectral, oasdiff, gitleaks, clone check, `.env.example` key check, analytics-schema check | Required; < 10 min (`ci.pr_gate_duration`) |
| Affected-module | PR touching matched paths | Testcontainers integration (outbox suite), migration fwd/rollback on a scratch DB restored from the staging backup, golden smoke, simulation subset | Yes when triggered; < 25 min |
| Nightly | schedule | full integration + sec suite, history gitleaks, osv, Maestro emulator/device farm, ML eval stub, load smoke, quarantine lane, expired-flag report | Non-blocking |
| Pre-release | release branch | nightly + device-matrix perf, store size gate, a11y checklist, restore-drill, release checklist | Skeleton only in P02 |

Mobile lanes (T14): Android build+sign on Linux runners. iOS: EAS and GHA macOS both run ~2 weeks, loser deactivated in T15; TestFlight upload on a Linux runner. **Linux can:** all lint/test/arch/contract jobs, Android build+sign, IPA upload, Docker workers. **Linux cannot:** build/sign an IPA, compile Metal, run the iOS Simulator, submit to App Store (Xcode 26+ mandatory since 2026-04-28; 05 §7.1). iOS smoke = CI-built dev-client on physical iPhones only.

## 5. Architecture boundary rules

From 04 §4.2–4.4, SPINE §3, P02 §4. Each rule has a failing fixture (AC-3); no warning tier; exceptions need an ADR.

| Rule | From | Forbidden to |
|---|---|---|
| public-api-only | any file outside `modules/<X>/` | `modules/<X>/internal/**` |
| no-cycles | any | edge closing a cycle; graph must equal 04 §4.1 DAG |
| allowed-edges-only | domain modules | any module edge absent from 04 §4.1 |
| recommendation-not-renderer | `modules/recommendation/**` | `modules/avatar/**`, `apps/mobile/src/render/**`, 3D/asset types; `→ outfit` only for item/composition types |
| assistant-app-services-only | `modules/assistant/**` | any `internal/**`, Drizzle schema, `platform` |
| domain-no-provider-sdk | `modules/**` | `pg-boss`, aws-sdk/R2, RevenueCat, fal.ai, Open-Meteo, FCM, PostHog SDKs |
| platform-leaf | `apps/api/src/platform/**` | anything but `packages/shared-kernel` + provider SDKs |
| modules-not-platform | `modules/**` | `apps/api/src/platform/**` (ports bound at composition roots only) |
| shared-kernel-pure | `packages/shared-kernel/**` | any workspace pkg, framework, I/O |
| no-utils-dirs | anywhere | creating `utils/`, `helpers/`, `common/` |
| prototype-unimportable | any | `prototype/**` |
| render-boundary | `apps/mobile/**` except designated 3D screens | `apps/mobile/src/render/**`, Filament types |
| mobile/workers-not-server | `apps/mobile/**`, `workers/**` | anything but `packages/contracts`, `packages/shared-kernel` |
| composition-root-only | all but `main.ts`/`app.module.ts`, `jobs/index.ts`, `_root.tsx`, worker `main.py` | constructing adapters |
| test-placement (lint) | `*.test.ts` outside `tests/` (exceptions: `apps/mobile/e2e/`, `apps/api/tests/migrations/`) | fails |
| no-skip (lint) | `it.skip`/`xit`/`pytest.mark.skip` without issue ID | fails |

ESLint element types: `module`, `module-internal`, `shared-kernel`, `platform`, `composition-root`, `job-handler`, `contracts`.

## 6. Security/privacy foundations required in P02

- Logger allowlist serialization + forbidden-key denylist (11 §8 list); lint banning `console.*` and raw `req.body`; canary test with planted markers.
- sops+age with dev pubkeys + one CI key; GitHub secrets hold only CI age key, signing creds, deploy tokens; `.env.example` exhaustive, zero values, CI-checked ⊇ config schema; repo grep for key patterns clean.
- gitleaks (pre-commit, PR, nightly history), osv-scanner, pnpm audit, syft SBOM, license gate, Renovate, frozen lockfiles, pnpm build-script allowlist.
- `StorageProvider` port + R2 adapter: presigned PUT/GET, TTL ≤ 15 min, content-type/size/namespace constraints, `*.sec.test.ts` (expired, foreign namespace, wrong content-type).
- Cloudflare WAF before API; rate-limit middleware skeleton; per-env creds/buckets; iOS signing creds scoped to macOS lane.
- PostHog consent stub default off, zero events; analytics taxonomy schema + unknown-event CI rejection; flag registry with owner/expiry + expired-flag lint.
- Threat-model appendix to doc 11: supply chain, CI secret exfiltration, same-day leaked-secret rotation.

## 7. P02 task list and acceptance criteria

| ID | Task | Dep |
|---|---|---|
| T01 | Scaffold: pnpm+Turborepo, mise.toml, justfile, layout, branch protection, commit hooks | — |
| T02 | `scripts/` bootstrap + doctor, `.env.example`, direnv; clean-VM verified | T01 |
| T03 | `shared-kernel` + tests | T01 |
| T04 | Contracts pipeline: OpenAPI scaffold, envelope/events, 4 generators, `generate --check`, spectral, oasdiff | T03 |
| T05 | API skeleton: Nest/Fastify, module dirs, composition root, health/version, rate-limit stub | T04 |
| T06 | Boundary rules → `arch-check` + failing fixtures | T05 |
| T07 | Drizzle, migrations 0001/0002, Testcontainers, `db-*`, self-managed PostgreSQL envs (pgBackRest PITR, PgBouncer, backup-age alert), seed-data | T05 |
| T08 | Outbox relay + pg-boss + worker round-trip; idempotency/retry/DLQ/replay/cancellation suite (the pg-boss gate; self-hosted Trigger.dev fallback only if it fails); resilience utils | T07 |
| T09 | Logging/redaction/lint/canary; OTel; Grafana (Cloud free tier or separate-node self-hosted, ADR-OBS-01 chooses) dashboard 1 + alerts; ADR-OBS-01 | T08 |
| T10 | Expo skeleton, generated client, PostHog + crash, Jest/RNTL + Maestro, render-boundary lint | T04 |
| T11 | Four GHA tiers calling `just`; remote cache; `ci.*` metrics | T05–T07 |
| T12 | Security lane → `security-scan` | T01 |
| T13 | Signed-URL skeleton + sec tests; R2 buckets; WAF | T05 |
| T14 | EAS (free allowance) + GHA macOS + Android lanes; TestFlight from Linux; `mobile-*-build` | T10 |
| T15 | ADR-P02 after ~2 weeks dual-lane data; DEC; deactivate loser | T14 |
| T16 | CLAUDE.md → root; 13 SKILL.md; templates; CODEOWNERS; PROGRESS.md | T01 |
| T17 | `assets/3d` schema, Git LFS, `assets-validate`, `ml-eval` stub | T04 (+P01) |
| T18 | Close-out: `ci-parity` green on 2 machines + CI; 15 contracts; A4 outcome | all |

Waves (P02 §13): W1 {T02,T03,T12,T16}; W2 after T04 {T05→T06,T10,T17}; W3 after T05/T07 {T08,T09,T13}; T14 with W3; T11 after T05/06/07. Single-writer: contracts, shared-kernel, lockfiles, mise.toml, justfile, CI workflows, CLAUDE.md.

Acceptance (P02 §19, condensed): **AC-1** clean-Ubuntu `bootstrap && doctor && ci-parity` exit 0 (transcript); `just --list` shows every 15 §5 recipe; PR gate < 10 min on ≥ 3 PRs. **AC-2** `generate --check` passes clean, fails after unregenerated spec edit; spectral + oasdiff in CI; all generated outputs consumed by compiling code. **AC-3** `arch-check` passes and fails on six fixtures (internal import, recommendation→avatar, provider SDK in domain, assistant→internal, `utils/` dir, `prototype/` import); 15 contract files. **AC-4** lint fails on stray `*.test.ts`, skip without issue ID, file-size fixture. **AC-5** duplicate idempotency key → one effect; failure → retries → DLQ + `queue.job.dlq` + alert; replay no second effect; migrate+rollback on a scratch DB restored from the staging backup. **AC-6** one trace API→outbox→task→worker, one correlation ID; canary green, forbidden-field lint red; dashboard 1; crashes symbolicated iOS+Android; unknown analytics event rejected; `demo-outbox-flow` rollback demoed. **AC-7** `security-scan` green; gitleaks blocks planted synthetic secret; SBOM; `.env.example` ⊇ config keys; repo grep clean; signed-URL sec suite green. **AC-8** ADR-P02 with two weeks of dual-lane data + DEC; TestFlight build from Linux step; signed AAB; both on physical devices from one commit. **AC-9** root CLAUDE.md has every NFR-TEAM-090 rule; ≥ 13 SKILL.md, six sections + overlap note; templates + CODEOWNERS + PROGRESS.md at root; clone check in CI.

Definition of done (P02 §20):
```bash
just ci-parity; just test; just lint && just typecheck && just arch-check
just generate --check; just security-scan
just db-migrate && just db-rollback   # scratch DB restored from the staging backup
just doctor                           # 2 dev machines + clean VM
# + TestFlight build id, Android AAB artifact, ADR-P02 merged
```

## 8. Conflicts, gaps, and Linux limitations

| # | Issue | Docs say | Recommended default |
|---|---|---|---|
| 1 | Renderer dir name | `src/render/` (CLAUDE.md, 15 §7, this prompt) vs `src/renderer/` (04 §4.3/§6, P02 §8) | `apps/mobile/src/render/`; fix 04/P02 refs in T16 PR |
| 2 | Drizzle location | CLAUDE.md `packages/db/`; 06 §1 schema per module `internal/schema.ts`; 04 §6 no `packages/db` | Schema per module (06 is canonical owner); `packages/db/` = drizzle-kit config + composed schema entry + `migrations/` |
| 3 | `platform` path / "15 modules" | SPINE §3: 15 names at `modules/<name>`; 04 §6: `apps/api/src/platform/`, `packages/shared-kernel` | 13 dirs under `modules/`; platform and shared-kernel per 04; 15 contract files |
| 4 | Bootstrap home | 15 §4/CLAUDE.md `scripts/`; 04 §6 `tools/bootstrap/` | `scripts/`; `tools/` keeps depcruise + codegen |
| 5 | `docs/` | 04 §6 `docs/ → planning/`; CLAUDE.md `docs/adr`, `docs/modules` | real `docs/adr/` + `docs/modules/`; `planning/` untouched |
| 6 | Pins vs machine | 15 §1.2: Node 22.x, pnpm 10.x, Python 3.12.x, Java 17; machine has node 26.3, pnpm 11.6, python 3.14, jdk 25; mise/direnv/sops absent | mise.toml per doc 15; bootstrap installs mise, direnv, sops, age; verify pins vs Expo SDK 55/EAS image at T01 |
| 7 | Hook manager | 15 §4 "`prek`/husky" | pick in T01 (prek listed first); must run gitleaks + commit-lint |
| 8 | File-size threshold | NFR-TEAM-050 says "in doc 15"; doc 15 has none | decide number in T06, write into doc 15; warn-only |
| 9 | P00 gate | P02 needs P00 `ACCEPTED`; PROGRESS.md: P00 `NOT_STARTED`; regions need P00 OQ-07 memo | T01–T06, T12, T16 need no P00; cloud resources (T07, T11, T13) wait for OQ-07 or use flagged provisional regions |
| 10 | iOS locally | no Xcode/Simulator/Metal/signing on Linux; ADR-P02 needs 2 weeks of both lanes + Apple/EAS accounts | T14/T15 CI-only and human-gated; `mobile-ios-build` only triggers remote |
| 11 | A4 pnpm × EAS | unproven; fallback Yarn workspaces (05 §8) | keep pnpm; test EAS hook first thing in T14; yarn not installed |
| 12 | ADR naming | templates `ADR-NNN`; 15 §8 `docs/adr/NNNN-slug.md`; P02 `ADR-P02`, `ADR-OBS-01` | `NNNN-slug.md`, label in title |
| 13 | `assets-validate` | adopts P01 tooling; P01 `NOT_STARTED` | ship manifest-schema + glTF validation; KTX2/budgets TODO with issue |
| 14 | Vendor accounts | GitHub org, server provider (OQ-07/OQ-14), Cloudflare (R2 + DNS/WAF only), PostHog, Grafana, Expo/EAS, Apple, Play (P02 §3) | human-only; agent work stops at config + `.env.example` keys |

## 9. Open questions I could not resolve from the docs

- Exact Node/Java pins compatible with Expo SDK 55 and the current EAS image (doc 15 pins dated Aug 2026).
- Hook manager (`prek` vs husky) and the clone-detection tool for NFR-TEAM-040 (none named).
- Numeric file-size threshold and exception syntax (NFR-TEAM-050).
- Real CODEOWNERS handles (`@dev-lead`, `@3d-owner`, `@ml-owner`, `@team` are placeholders).
- Server-provider/R2/PostHog regions pending the P00 OQ-07 memo (server provider + topology: OQ-14).
- Whether `packages/db` replaces per-module `internal/schema.ts` or only hosts drizzle-kit config (§8 #2).
