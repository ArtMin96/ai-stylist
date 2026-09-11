# PROGRESS — Durable Status Ledger

**Purpose:** The single source of truth for project status across work sessions. Every session (human or AI agent) reads this file first and updates it before ending. Phase definitions: [SPINE §5](SPINE.md) and `phases/`. Templates: [templates/session-handoff.md](templates/session-handoff.md).

---

## Status vocabulary (exact — no other values allowed)

| Status | Definition |
|---|---|
| `NOT_STARTED` | No work begun beyond planning. No code, no branches. |
| `IN_PROGRESS` | Work begun. The phase file's task list reflects per-task state; a session-handoff entry exists for the latest session. |
| `BLOCKED` | Cannot proceed. The blocker (dependency, decision, external event) MUST be named in the Notes column with a link to the owning item (RISK-NN / OQ-NN / phase ID). |
| `DONE` | All phase acceptance criteria met with evidence; Definition of Done commands pass; docs and this ledger updated. Self-assessed by the implementing session. |
| `ACCEPTED` | A *different* session or the product owner has verified the phase's demo script and evidence after `DONE`. Only `ACCEPTED` phases may be depended on by later phases. |

Rules:
- Status may only move forward (`NOT_STARTED → IN_PROGRESS → DONE → ACCEPTED`), except any status may move to `BLOCKED` and back to `IN_PROGRESS`, and `ACCEPTED` may regress to `IN_PROGRESS` only with a decision-log entry (DEC-NN) explaining why.
- Never mark `DONE` because code exists. `DONE` requires tests, evidence, documentation, and the working vertical demo defined in the phase file (brief §10).
- A phase with unmet hard dependencies (SPINE §5 table) cannot leave `NOT_STARTED`.

## Phase status

| Phase | Name | Status | Notes |
|---|---|---|---|
| — | Planning package | `ACCEPTED` | This `planning/` directory; ratified 2026-08-24; **prices re-verified and pricing model re-baselined 2026-09-09** (r6, DEC-34/35) |
| P00 | Product validation and decisions | `NOT_STARTED` | |
| P01 | 3D and capture prototype gate | `NOT_STARTED` | Go/no-go gate — see RISK-01 |
| P02 | Repo foundations and CI | `IN_PROGRESS` | Started 2026-09-09 **ahead of P00** for the no-P00-dependency subset (DEC-36). Done: T01, T03, T04, T05, T06, T10, T11, T16; partial: T02 (clean-VM check), T07 (Neon envs), T12 (license gate + SBOM). Cloud-touching tasks (T07 Neon, T08, T09, T13, T14/T15) wait for P00 / OQ-07 and vendor accounts. `just ci-parity` green 2026-09-10 |
| P03 | Identity, consent, onboarding | `NOT_STARTED` | |
| P04 | Parametric avatar v1 | `NOT_STARTED` | |
| P05 | Selfie face personalization | `NOT_STARTED` | |
| P06 | Closet capture pipeline | `NOT_STARTED` | |
| P07 | Closet organization and sync | `NOT_STARTED` | |
| P08 | Context providers | `NOT_STARTED` | |
| P09 | Recommendation engine v1 | `NOT_STARTED` | |
| P10 | Outfit on avatar | `NOT_STARTED` | |
| P11 | Generative try-on and views | `NOT_STARTED` | Eval + cost gate — see RISK-02 |
| P12 | Fashion intelligence | `NOT_STARTED` | Sourcing spike first — see RISK-03 |
| P13 | Monetization and entitlements | `NOT_STARTED` | Store-compliance review — see RISK-04 |
| P14 | Hardening and launch | `NOT_STARTED` | |
| P15 | Post-launch learning | `NOT_STARTED` | |

## ➡️ Next session starts here

**First command, always:** `just bootstrap && just doctor && just ci-parity` — must be green before any other work (last green: 2026-09-10 on the implementing machine; CI has not yet run on GitHub).

Then pick one:

1. **Start P00 — Product validation and decisions** (still the formal gate; P02 was started ahead of it under DEC-36). Read [SPINE.md](SPINE.md) → [00-product-vision-and-scope.md](00-product-vision-and-scope.md) → `phases/P00-product-validation-and-decisions.md` → [16](16-risks-open-questions-and-decision-log.md); set P00 `IN_PROGRESS`; P00 has no code deliverables — outputs are ratified ADRs, measurable definitions, legal/privacy discovery notes, and resolution or scheduling of OQ-03 (age policy) and OQ-07 (data residency).
2. **Continue P02 with P02-T08** (outbox relay + Trigger.dev + worker round-trip; `phases/P02-repo-foundations-and-ci.md` §12). T08, T09 (Grafana Cloud/PostHog) and T13 (R2 buckets) each need a vendor account before they can be finished; the local/offline part of T08 (relay, idempotency/retry/DLQ tests against Testcontainers) can start without one.

**Human-only steps outstanding** (agents stop at config + `.env.example` keys):
- Create vendor accounts and record regions per OQ-07: Neon, Cloudflare R2, Railway, Trigger.dev, Grafana Cloud, PostHog, Expo/EAS, Apple Developer, Google Play.
- Enable GitHub branch protection on `main` (required checks = the `pr-gate` workflow jobs) and confirm the workflows run green on GitHub (none has run remotely yet).
- Replace the placeholder handles in `CODEOWNERS` with real GitHub handles.
- Authorise the one-line `CLAUDE.md` fix: the mobile composition root is `apps/mobile/src/app/_layout.tsx` (expo-router mandates the name), not `_root.tsx`.
- Doc-15 file-size threshold (NFR-TEAM-050): already recorded in [15 §7](15-team-workflow-and-ai-agent-operations.md) and DEC-40 — nothing to do.

Before ending the session, follow the session-handoff rules below.

## Session-handoff rules

Every work session MUST, before ending:

1. **Update the phase table** above (status + notes, including any new blocker with its RISK/OQ link).
2. **Append a handoff entry** to the log below using [templates/session-handoff.md](templates/session-handoff.md) — newest entry first. Keep entries short; link to phase files and PRs instead of restating them.
3. **Update the "Next session starts here" section** so it points to the exact next action (phase, task ID, and any command to run first). It must never be stale.
4. **Record new decisions/risks/questions** in [16-risks-open-questions-and-decision-log.md](16-risks-open-questions-and-decision-log.md) — never only in this file or in chat.
5. **Leave the repository buildable**, or state precisely what is broken, the failing command, and the observed error in the handoff entry.

Log hygiene: when this log exceeds ~30 entries, move the oldest entries to `planning/handoff-archive.md` (create it on first archive); never delete them.

## Session handoff log

*(newest first)*

### 2026-09-11 — P02 sops + age repository hardening

- **Phase / tasks worked:** P02 — T02/T12 secrets boundary follow-up on `fix/repo-sops-age-hardening`.
- **Done this session:** plaintext files under `secrets/` are ignored while `README.md` and `*.enc.yaml` remain committable; the existing sync/edit contract has synthetic shell regression coverage; Docker-less test runs retain that coverage; CI age-key cleanup and troubleshooting docs are accurate. No recipients, identities, or encrypted environment files were created.
- **Regression evidence:** before the fixes, the suite reported `FAIL plaintext secrets ignored; encrypted files and README committable`; the review follow-up reported `FAIL SKIP_DOCKER_TESTS=1 just test omitted the secrets suite` after all non-Docker suites passed.
- **Repository state:** buildable ✅ — `just test secrets`, `SKIP_DOCKER_TESTS=1 just test`, `just test`, `just lint`, `just arch-check`, `just security-scan`, and `just ci-parity` green locally on 2026-09-11.
- **Not done / next action:** independent review, then commit/push/open the PR; no git history or remote configuration was changed in this session.

### 2026-09-11 — P02 hardening: first CI run, clean-VM proof, security gate, secrets, macOS (PR #1)

- **Phase / tasks worked:** P02 — T02 (close), T11 (first run), T12 (close), plus macOS portability (not a P02 task; DEC pending).
- **Status changes:** none in the table. Branch `chore/foundation-hardening`, PR #1, commits `795b633`, `b419c54`; pr-gate green 3×, `portability` green on `macos-15` (4 min) and `ubuntu-latest` (3 min).
- **Done this session:** T02 — `bootstrap.sh`/`doctor.sh` verified on a fresh `ubuntu:24.04` container (11 min to green) and on a real macOS runner; fixes: udev dir absent, `$USER` unset in non-login shells, doctor without system python3, pnpm store landing inside the repo when the checkout is on another filesystem (`.npmrc store-dir`, ignores, doctor check). T12 — `security-scan` now runs the SPDX license gate (`tools/security/license-policy.json`, deny GPL/AGPL/SSPL for prod deps, dev-only = warn, 62-day exceptions; fixture-proven) and writes a syft SBOM to `artifacts/sbom/`. `just secrets-sync` / `secrets-edit` implemented on sops+age (refuse staging/prod outside CI; actionable errors). macOS: scripts bash-3.2 clean, GNU-isms removed, Homebrew path in `--system`, per-runtime Docker hints, `dev-mobile --ios`, local `expo run:ios`, `SKIP_DOCKER_TESTS=1`, shellcheck in `just lint`, `.github/workflows/portability.yml` (weekly + dispatch + tooling-path PRs), `docs/DEVELOPING-ON-MACOS.md`, `docs/SERVICES-SETUP.md` (every vendor account, verified 2026-09-10), `.github/pull_request_template.md`. `CLAUDE.md` layout block no longer names composition-root files (authorised by the product owner).
- **Not done / in flight:** T07 Neon envs, T08, T09, T13, T14, T15, T17, T18 unchanged. Human-only: merge PR #1, age key (`docs/SERVICES-SETUP.md` §2), branch protection, CODEOWNERS handles, Renovate app, vendor accounts (Neon, Railway, Expo/EAS first).
- **Repository state:** buildable ✅ — `just ci-parity` green locally and on both runners, 2026-09-11.
- **New decisions / risks / questions filed:** none filed yet; candidate DEC: "tooling must stay portable to macOS (bash 3.2, no GNU-only flags), proven weekly by `portability.yml`" — add when PR #1 merges.
- **Surprises / gotchas:** pnpm silently uses `<repo>/.pnpm-store` when `$HOME` is on a different filesystem; `workflow_dispatch` only works once the workflow file exists on the default branch (the PR `paths` trigger covered the first run); macOS runner minutes bill 10× on this private repo, hence weekly + tooling-path triggers only; Expo SDK 57 still needs CocoaPods (doctor warns on macOS).
- **Files touched (by directory):** `scripts/`, `scripts/security/`, `tools/security/`, `tools/depcruise/*.sh`, `tools/eslint/*.sh`, `justfile`, `mise.toml` (shellcheck), `.npmrc`, `.prettierignore`, `.gitignore`, `.sops.yaml`, `secrets/README.md`, `.github/workflows/portability.yml`, `.github/pull_request_template.md`, `README.md`, `CLAUDE.md`, `docs/{SERVICES-SETUP,DEVELOPING-ON-MACOS}.md`, `docs/security/`, `planning/PROGRESS.md` (this entry).
- **Next session starts:** merge PR #1, then the human-only list above; then P00 or P02-T08 per "Next session starts here".

### 2026-09-10 — P02 repo foundations, first implementation session (2026-09-09 → 2026-09-10)

- **Phase / tasks worked:** P02 — P02-T01, T02, T03, T04, T05, T06, T07, T10, T11, T12, T16 (+ workers skeleton)
- **Status changes:** P02 `NOT_STARTED → IN_PROGRESS` (started ahead of P00 for the no-dependency subset, DEC-36). Branch: `main`, commit `5745cb8`.
- **Done this session:** T01 (pnpm workspaces + turbo, `mise.toml` pins, `justfile` with all 26 doc-15 recipes — `ml-eval`/`golden-accept`/`rec-*`/`assets-validate`/`secrets-sync` are stubs that exit 2; prek hooks gitleaks + commitlint; sops/age config without keys; `.env.example`); T03 shared-kernel (36 tests); T04 contracts pipeline (redocly, hey-api, json-schema-to-typescript, datamodel-code-generator, spectral, oasdiff; `just generate --check` proven to fail on a stale edit; 24 tests); T05 API skeleton (NestJS 11.2.3 / Fastify 5.12.1, 13 module dirs + platform ports, RFC 9457 filter, pino redaction + canary, rate limit; 41 tests); T06 arch-check (dependency-cruiser 19 rules + 6 failing fixtures; ESLint boundaries, test-placement, no-skip-without-issue, no-log-request-body, no-console, max-lines 400 warn + 4 fixtures); T10 mobile (Expo SDK 57.0.21 / RN 0.86.3 / React 19.2.3, expo-router, Jest 9 tests, expo-doctor 21/21, render-boundary lint — see `apps/mobile/README.md` "Toolchain facts"); T11 CI workflows (pr-gate, affected, nightly, pre-release, android, ios-eas, ios-gha-macos; all actionlint-clean, none has run on GitHub yet); T16 (root `CLAUDE.md`, CODEOWNERS with placeholder handles, templates, ADR-0001 accepted + ADR-0002 proposed, 15 module contracts, 13 skills); workers skeleton (uv workspace, FastAPI segmentation stub, structlog redaction + canary, no-skip pytest plugin, Dockerfile; 19 tests). Test counts: api 41, shared-kernel 36, contracts 24, db 9, mobile 9, seed-data 3, test-support 2, workers 19.
- **Not done / in flight:** T02 partial (bootstrap/doctor verified only on this machine, clean-VM run outstanding); T07 partial (Drizzle, migrations 0000 pgvector / 0001 outbox / 0002 idempotency with down files, Testcontainers migration test, `db-*` recipes done; Neon envs + PR branches not provisioned); T12 partial (`security-scan` = gitleaks + osv-scanner + pnpm audit; syft SBOM + license gate TODO; 3 osv ignores until 2026-11-10 in `docs/security/dependency-ignores.md`). Not started: T08, T09, T13, T14, T15, T17, T18. Human-only: vendor accounts, branch protection, real CODEOWNERS handles.
- **Repository state:** buildable ✅ — `just ci-parity` green end to end on 2026-09-10.
- **New decisions / risks / questions filed:** DEC-36 (P02 subset before P00), DEC-37 (tooling + layout tie-breaks → ADR-0001, prek), DEC-38 (Expo SDK 57 + isolated pnpm linker), DEC-39 (vulnerability-ignore policy, 2-month expiry), DEC-40 (file-size warn threshold 400); OQ-13 (NestJS 12 migration timing).
- **Surprises / gotchas:** Expo SDK 57 is current stable (brief said 55+) and removed `newArchEnabled` from `ExpoConfig`; `eslint-config-expo@57` and `eslint-plugin-react-native@5` crash on ESLint 10 and are not used; Metro needs a `.js→.ts` fallback for NodeNext specifiers in `packages/*`; watchman's prebuilt binary needs `/usr/local/lib`, so it moved to `bootstrap --system`; root `CLAUDE.md` still says `_root.tsx` for the mobile composition root but expo-router mandates `_layout.tsx` (needs human authorisation to edit); NestJS 12.0.1 exists but was not adopted (OQ-13).
- **Files touched (by directory):** root (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `justfile`, `mise.toml`, `.env.example`, `.sops.yaml`, `.envrc`, `osv-scanner.toml`, `CLAUDE.md`, `CODEOWNERS`, `PROGRESS.md`), `scripts/`, `tools/`, `apps/api/`, `apps/mobile/`, `workers/`, `packages/{contracts,shared-kernel,db,seed-data,test-support}/`, `.github/workflows/`, `.agents/skills/`, `docs/{adr,modules,security}/`, `templates/`, `planning/` (this file, 15 §7, 16, phases/P02 status + task states).
- **Next session starts:** see "Next session starts here" above — `just bootstrap && just doctor && just ci-parity`, then P00 or P02-T08.

### 2026-09-09 — Planning amendment: price verification & weighted credits (no code)

- **What:** Four research agents verified live prices for every paid service in the plan (fal.ai model pages, Gemini/Anthropic/OpenAI/Voyage/Cohere, Neon/Trigger.dev/Cloudflare/Railway/PostHog/RevenueCat/Expo/GitHub, Apple/Google fees, competitor App Store listings). Findings in [research/r6-pricing-verification-2026-09-09.md](research/r6-pricing-verification-2026-09-09.md).
- **Key finding:** purpose-built virtual try-on on fal.ai costs **$0.07–0.075/image** (FASHN, Kling), ~8× the Aug-2026 assumption; under the flat 200-credit Pro grant that was break-even monthly and −$6/mo on annual. Per-item processing (≈ $0.0021) and explanation costs verified as planned. Infra envelope is ≈ 2× r4's estimate ($60–70 launch, $370–450 at 5k MAU). Open-Meteo commercial is $29/mo, not $500.
- **Decisions logged:** DEC-34 (weighted credits: try-on 3 / missing view 1; grants 0/10/60/150, trial 15; top-up packs 30 for $4.99 and 100 for $12.99 as P13 stretch), DEC-35 (Essentials gains missing views; Voyage embeddings; Gemini 3.5 Flash default; price corrections). New OQ-11 (FLUX 2 try-on LoRA cost arm at P11), OQ-12 (Free cap 40 vs 100, weekly SKU), ASM-08/09, AIC-O5–O7, BIL-O7/O8.
- **Docs touched:** SPINE §2/§6, 00, 05 (§5–§9), 07 §4, 10 (§2–§3, §5, §6.1, §7), 12 (§1–§7, §8), 16, phases P00/P06/P11/P13, README; correction banners on r3/r4/r5.
- **Next:** unchanged — start P00. When P11 and P13 kick off, re-verify r6 prices first (AIC-O6).
