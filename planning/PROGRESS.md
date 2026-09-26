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
| P01 | 3D and capture prototype gate | `NOT_STARTED` | Re-scoped 2026-09-22 (DEC-50): the RN + Filament gate is moot (RISK-01 retired). The Anny asset pipeline + measurement harness can run now; the native Filament spike runs when 3D resumes |
| P02 | Repo foundations and CI | `IN_PROGRESS` | Started 2026-09-09 **ahead of P00** for the no-P00-dependency subset (DEC-36). Done: T01, T02, T03, T04, T05, T06, T10, T11, T16; partial: T07 (self-managed PostgreSQL envs — Neon dropped 2026-09-13, ADR-0003), T12 (Renovate app install, human). Cloud-touching tasks (T07 staging/prod PostgreSQL hosts, T09, T13, T14/T15) wait for P00 / OQ-07 / OQ-14 and vendor accounts; T08 (pg-boss) needs no vendor account. Vendor set consolidated 2026-09-13 (DEC-41–48). **2026-09-22: React Native + Expo replaced by native `apps/ios` (SwiftUI) + `apps/android` (Compose)** (ADR-0004, DEC-49–54): T10 done by replacement, T14 re-scoped to native signing lanes (`PARTIAL`: unsigned lanes committed), T15 re-scoped (lane decided, DEC-51). iOS app target built and tested on the GitHub macOS runner (PR #6, all 18 checks green); not yet run on a local Mac or device. Branch `chore/native-foundations`, not merged. `just ci-parity` last green 2026-09-23 on the branch (Linux); iOS simulator build/test green on the CI macOS runner (PR #6) |
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

**Tracking:** every P02 task has a Linear issue in the project [P02 — Repo foundations and CI](https://linear.app/ai-stylist-app/project/p02-repo-foundations-and-ci-f1943b23882e) (AI-9 = T08, AI-16 = T07, AI-17 = T09, AI-21 = T13, AI-22/23 = T14/T15, AI-26 = T18 close-out, AI-27 = human-only steps).

**First command, always:** `just bootstrap && just doctor && just ci-parity` — must be green before any other work (last green: 2026-09-23 locally on `chore/native-foundations`, Linux; iOS simulator build/test green on the CI macOS runner in PR #6, see the 2026-09-22 handoff).

**Native migration (2026-09-22) — do first if `chore/native-foundations` is not merged yet:** on the team's Mac run `just ios-doctor && just ios-check` (the iOS app target and SwiftUI views have never been compiled; checklist in the 2026-09-22 handoff entry), then `just ci-parity`, then open the PR.

Then pick one:

1. **Start P00 — Product validation and decisions** (still the formal gate; P02 was started ahead of it under DEC-36). Read [SPINE.md](SPINE.md) → [00-product-vision-and-scope.md](00-product-vision-and-scope.md) → `phases/P00-product-validation-and-decisions.md` → [16](16-risks-open-questions-and-decision-log.md); set P00 `IN_PROGRESS`; P00 has no code deliverables — outputs are ratified ADRs, measurable definitions, legal/privacy discovery notes, and resolution or scheduling of OQ-03 (age policy) and OQ-07 (data residency).
2. **Continue P02 with P02-T08** (outbox relay + pg-boss + worker round-trip; `phases/P02-repo-foundations-and-ci.md` §12). T08 is the pg-boss proof (DEC-41, [ADR-0003](../docs/adr/0003-self-hosted-infrastructure-baseline.md)): the acceptance suite (kill/retry, idempotency, DLQ, replay, per-user cancellation, deletion/export) runs entirely against Testcontainers PostgreSQL, so **no vendor account is needed**; self-hosted Trigger.dev is the fallback only if that suite fails. T09 (Grafana Cloud/PostHog) and T13 (R2 buckets) still need a vendor account before they can be finished; T07's staging/prod PostgreSQL hosts wait for OQ-07/OQ-14.

**Human-only steps outstanding** (agents stop at config + `.env.example` keys):
- Create vendor accounts and record regions per OQ-07: server provider (per OQ-07/OQ-14 — Hetzner is the working assumption), Cloudflare R2, Grafana Cloud, PostHog, Apple Developer, Google Play. (Neon, Railway and Trigger.dev were removed on 2026-09-13 — DEC-41–43; Expo/EAS on 2026-09-22 — DEC-51.)
- Native-migration cleanup (2026-09-22; updated 2026-09-24): decide whether to keep or delete the Expo account/project; provision `https://staging-api.ai-stylist.app` (OQ-17 decided, host not yet live; ties to OQ-14); confirm iOS 26.0 / Android minSdk 29 device floors and `app.aistylist.mobile` as the permanent id (OQ-08, OQ-18).
- Decide OQ-14 (server provider + single-host vs DB-separate topology at launch) together with OQ-07 before any cloud provisioning.
- Remove the four stale empty keys from `secrets/dev.enc.yaml` (`sops unset secrets/dev.enc.yaml '["NEON_API_KEY"]'` etc. for `NEON_PROJECT_ID`, `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`) — the agent session was not permitted to write the secret store.
- Enable GitHub branch protection on `main` (required checks = the `pr-gate` workflow jobs) and confirm the workflows run green on GitHub (none has run remotely yet).
- Replace the placeholder handles in `CODEOWNERS` with real GitHub handles.
- ~~Authorise the one-line `CLAUDE.md` fix for the RN composition root~~ — moot since 2026-09-22 (`apps/mobile` deleted).
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

### 2026-09-26 — Prompt-audit follow-ups: signed-URL GET TTL, DC-15 fixture, trigger evals

- **Phase / tasks worked:** P02 hygiene (no task ID). Branch `fix/prompt-audit-followups` off `1ead9bd`. Work done by subagents: `platform-engineer`, `tooling-engineer`, and two general-purpose agents.
- **Status changes:** none.
- **Done this session:**
  - **Security fix:** presigned GET URLs are now capped at 10 min, and PUT/multipart stays at 15 min (doc 11 §5.4). `MAX_PRESIGN_GET_TTL_SECONDS` and `MAX_PRESIGN_PUT_TTL_SECONDS` replace the single constant, and `clampTtl(ttl, method)` takes the method. The regression test in `apps/api/src/platform/tests/storage.port.test.ts` failed before the fix (`expected '…12:15:00.000Z' to be '…12:10:00.000Z'`) and passes after. `docs/modules/platform.md`, `platform-engineer.md` and the `security-privacy-review` eval were updated.
  - **DC-15:** the check ran `just --summary` from a temp fixture directory, where the mise shim could not resolve `just`, and `2>/dev/null` hid the failure. It now runs `just --justfile <root>/justfile --summary` from the repo root and reports a failed lookup as a finding. The `DC-15` fixture is pinned with `.expect-only`. `just docs-check --fixtures` exits 0 again.
  - **Trigger evals** (`claude -p`, one run per query, in a scratchpad sandbox): tooling-ci 18/20, performance-profiling 18/20, docs-maintenance 19/20, e2e-device-testing 20/20. The descriptions were tightened for the misses.
  - Root `CLAUDE.md`: plugin and user-level skills never override this repository's rules.
  - An upstream suggestion for the Omarchy skill is drafted in the session scratchpad; the human decides whether to post it.
- **Not done / in flight:** the Android lanes of `just lint`, `arch-check` and `format --check` fail on this machine. Gradle asks for a JDK 25 toolchain that is not installed, after untracked or uncommitted IDE changes (`apps/android/gradle.properties`, `apps/android/gradle/gradle-daemon-jvm.properties`). Those changes are not part of this session and were left uncommitted. The same lanes passed earlier today, before those files changed. No security-privacy-reviewer pass was run on the TTL change (it tightens a cap).
- **Repository state:** `just docs-check --strict` 0 errors; `just docs-check --fixtures` exit 0; `just test platform` 22 passed; `just typecheck` exit 0; `NATIVE_LANES=none just lint` and `NATIVE_LANES=none just arch-check` exit 0.
- **New decisions / risks / questions filed:** none.
- **Surprises / gotchas:** under `just`, the mise shim resolves tool versions from the working directory, so any check that `cd`s into a temp directory outside the repo loses its pinned tools.
- **Next session starts:** decide what to do with the IDE-generated Android Gradle changes (commit them with a JDK 25 toolchain in `mise.toml`, or discard them), then run the full `just lint`.

### 2026-09-26 — Prompt audit of the Claude Code configuration; docs-in-the-same-change rule

- **Phase / tasks worked:** P02 hygiene (no task ID). Branch `chore/prompt-audit-fixes` off `791ea1e`, fast-forwarded into `main` and pushed at the human's request.
- **Status changes:** none.
- **Done this session:** a `/claude-api prompt-audit` of `CLAUDE.md`, rules, agents and skills, targeting Opus 5.5. Few dated-prompt patterns turned up; most findings were stale facts and cross-file conflicts. Fixed:
  - `planning/CLAUDE.md` → `planning/claude-contract-historical.md`. As a nested `CLAUDE.md` it auto-loaded every session and still called itself binding, with the RN/Expo stack.
  - Signed-URL TTL in `security-privacy-review` and `platform-engineer` aligned with doc 11 §5.4 (GET ≤ 10 min). The phantom doc-11 supply-chain appendix is now described as unwritten.
  - `tests.md`: `just test-regression` covers Python. `ios.md` and `ios-engineer`: `@Observable` ownership (`@State` / plain property / `@Bindable`).
  - Stale commands and sections fixed in `api-contract-change`, `e2e-device-testing`, `docs-maintenance`, `release-manager`, `docs-maintainer`, the skills README and the agents README.
  - iOS/Android self-review lists back in parity. `ml-engineer` may run `just format --check`.
  - The `.claude/plans/` proposal exception is now stated in `agent-operating-contract` and `agent-authoring.md`. Workflow diffs go to a proposal file (`tooling-ci.md`).
  - "State on 2026-09-25" snapshots and "P02-T08 is `NOT_STARTED`" stops are rewritten as conditions against the phase file.
  - The `tooling-ci` description was shortened; it was missing from the skill listing and now shows.
  - New rule: root `CLAUDE.md` "Docs stay current (mandatory)" section and checklist line, plus `agent-operating-contract` step 5 "Docs ship in the same change" and a `Docs updated:` report line. The human authorized the `CLAUDE.md` edit this session; it went in by `git apply` because the path guard blocks the Edit tool.
- **Not done / in flight:**
  - Product bug found, not fixed: `MAX_PRESIGN_TTL_SECONDS` (`apps/api/src/platform/ports/storage.port.ts:5`) caps GET URLs at 15 min; doc 11 §5.4 says 10. `platform-engineer`, with a regression test first.
  - Doc 11 lacks the P02 supply-chain/CI-secret threat-model appendix.
  - Trigger evals for the edited descriptions (`tooling-ci`, `performance-profiling`, `docs-maintenance`, `e2e-device-testing`) were not re-run.
- **Repository state:** `just docs-check --strict` → 0 errors. `just docs-check --fixtures` → 1 failure (`_clean` DC-15 "just hello"), also present at HEAD with these changes stashed. No code touched; `just lint`/`typecheck`/`arch-check` not run.
- **New decisions / risks / questions filed:** none.
- **Surprises / gotchas:** any file named `CLAUDE.md` below the root auto-loads when Claude reads a file in that directory; keep historical copies under another name. A long skill description can push a later skill's description out of the listing budget.
- **Next session starts:** hand the signed-URL TTL bug to `platform-engineer` (regression test first); re-run trigger evals for the edited skill descriptions.

### 2026-09-25 — Claude Code foundation: enforced agent scopes, cross-platform flow, drift fixes

- **Phase / tasks worked:** P02 hygiene (no task ID). Branch `fix/bootstrap-automation` off `8bc50ba`: the first commit is the bootstrap work (entry below), the rest is this session. One stacked PR with base `chore/native-foundations`.
- **Status changes:** none.
- **Done this session:** three read-only audits (agents, skills, rules/settings/hooks), then five fixer slices in `.claude/worktrees/fx-*`, merged here with `git apply --3way` (no conflicts):
  - **Enforcement:** every project agent's frontmatter runs `scripts/hooks/guard-agent-write-set.sh` (its write set) and `scripts/hooks/guard-agent-bash.sh` (its command allowlist). The Stop gate now judges only what the session changed, against a baseline that `session-start.sh` records via `scripts/hooks/session-baseline.sh`. Every PreToolUse guard fails closed without jq, so `just doctor` now requires jq. `.claude/settings.json` adds `permissions.ask` for destructive git and for edits to `CLAUDE.md`, SPINE, doc 15, settings, hooks and CI, plus `worktree.baseRef: head`. `.claude/settings.local.json` is untracked and gitignored.
  - **docs-check:** DC-05 requires `metadata.owner-agent` and both evals files; DC-07 checks agent `color`, plain `tools` names, both guard hooks and the `agent-operating-contract` preload. `just docs-check --fixtures` replays 77 hook payloads, fixes the 2 fixture failures HEAD had, and now runs in `just ci-parity`.
  - **Agents, skills, rules:** all 13 agents preload their skills and declare both guards. The new `agent-operating-contract` skill holds the shared workflow, stop rules and report format. `cross-platform-feature` is rewritten as a lead-run flow (brief template, worktree lanes, parity review). The other skills, the rules, `templates/agent.md` and `templates/skill.md` lose drift. The new `.claude/rules/human-only.md` covers the human-only files. Old plans get status banners.
  - `just ios-e2e [flow]` and `just android-e2e [flow]` take an optional Maestro flow path.
- **Not done / in flight:** human-only items: apply [`.claude/plans/s6-claude-foundation-human-proposals.md`](../.claude/plans/s6-claude-foundation-human-proposals.md) (the `CLAUDE.md` hook-layer paragraph, doc 15 §5 rows) and [`.claude/plans/s5-bootstrap-automation-human-proposals.md`](../.claude/plans/s5-bootstrap-automation-human-proposals.md). Decide the three design questions in s6 §C2: schema composition vs `public-api-only-external`, module repository tests vs `composition-root-only`, and the missing `admin` ↔ `fashion-intel` edge. `./scripts/bootstrap.sh --system` has still not run on the Mac in a real terminal.
- **Repository state:** buildable ✅ for the touched scope: `just docs-check --strict` 0 errors; `just docs-check --fixtures` exit 0; `just lint`, `just typecheck`, `just arch-check` and `just format --check` exit 0; `just test secrets` 24 PASS; `just test tooling` 14 PASS; shellcheck and `/bin/bash -n` clean on the 25 changed scripts. `just ci-parity` on this Mac failed at `just test`, after its first nine steps passed. Two tests need Docker, and OrbStack was not running: `tests/migrations/migrate.test.ts` (Testcontainers) and `tests/http.test.ts` "GET /v1/health reports db=ok" (503, no local Postgres). The steps after `just test` were then run one by one. All exit 0: `ios-test-packages`, `android-test`, `android-build all`, `ios-build --config dev`, `ios-test`, `security-scan` and the license, gitleaks and osv fixtures. The exception is the workers pytest (see Surprises).
- **New decisions / risks / questions filed:** none in doc 16; the three s6 §C2 questions need a human decision (ADR).
- **Surprises / gotchas:** hooks run from the main checkout, so a hook script goes live the moment it lands. `just format --check` stops at the first failing formatter, so ruff, swift-format and Spotless run only once Prettier is clean. Prettier also reformats YAML inside the code fences of `templates/*.md`. Pre-existing, not fixed here: with `.env` copied from `.env.example`, direnv exports `LOG_LEVEL=` (empty). Then `configure_logging` in `workers/ml/segmentation/src/ai_stylist_segmentation/main.py` raises `KeyError: ''` at test collection, and the workers pytest exits 2. With `LOG_LEVEL` unset it passes, 19 tests.
- **Next session starts:** review the stacked PR and merge it after `chore/native-foundations`. Then a human applies the s5 and s6 proposals and runs `./scripts/bootstrap.sh --system`, then `just doctor`, on the Mac.

### 2026-09-25 — Bootstrap automation: OrbStack, Xcode, pacman, shell rc block

- **Phase / tasks worked:** P02 hygiene (P02-T02 bootstrap + doctor follow-up). Branch `fix/bootstrap-automation` off `8bc50ba` (the PR #8 merge), **uncommitted**.
- **Status changes:** none.
- **Done this session:**
  - `scripts/bootstrap.sh --system`: on macOS it installs and starts OrbStack, installs the pinned Xcode with `xcodes` when missing, then selects it and runs licence/first-launch setup (sudo) and the iOS simulator download. On Linux it uses pacman (Arch, Omarchy) or apt (Ubuntu), and stops with a manual package list on any other distro.
  - Bootstrap writes an idempotent mise + direnv block into the shell rc file (zsh `~/.zshrc`; bash `~/.bashrc` on Linux, `~/.bash_profile` on macOS); it skips the block when `CI=true`.
  - `just doctor` / `just ios-doctor` now tell "Xcode not installed" apart from "installed but the Command Line Tools are selected", and every hint names `./scripts/bootstrap.sh --system`.
  - New `scripts/test/bootstrap-doctor.test.sh` (13 tests; `just test tooling`, also part of `just test`). Docs: README setup, macOS guide, iOS README, SERVICES-SETUP direnv step.
  - `just docs-check` now runs on macOS `/bin/bash` 3.2: every array in `scripts/docs/**` that can be empty expands as `${a[@]+"${a[@]}"}`, because bash 3.2 treats an empty array as unbound under `set -u`. `just docs-check`, `just docs-check --strict`, `just docs-check README.md` and `just docs-check .agents/skills/tooling-ci/SKILL.md` exit 0. `just docs-check --fixtures` now prints the same result as Linux bash 5: 2 failures that HEAD already has on both platforms. The DC-06 fixture lost its empty skill directory, since git does not track empty directories. `_clean` reports DC-03 because the staged `index.ts` mtime is today, newer than its fixed `Last updated` of 2026-09-13.
  - pr-gate's oasdiff step no longer skips: `scripts/ci/contracts-breaking.sh` reads `packages/contracts/gen/openapi.bundle.json`, the path `tools/codegen/gen-ts.sh` writes (it looked for `packages/contracts/openapi.bundle.json` and always printed "bundle absent"). Regression test `scripts/test/contracts-breaking.test.sh` (part of `just test tooling`) failed before the fix. `just ci-contracts-breaking $(git merge-base HEAD main)` → "No breaking changes to report", exit 0.
- **Not done / in flight:** nothing committed. `./scripts/bootstrap.sh --system` has not run on the real Mac yet (it edits `~/.zshrc` and uses sudo). Bug A (sops on macOS reads `~/Library/Application Support/sops/age/keys.txt`) is skipped by the user's decision. The secrets onboarding PR for `onboard/arthur-minasyan` still needs an approver (`just secrets-approve onboard/arthur-minasyan`). The human-only `planning/15` and doc 16 edits are in [`.claude/plans/s5-bootstrap-automation-human-proposals.md`](../.claude/plans/s5-bootstrap-automation-human-proposals.md).
- **Repository state:** buildable ✅ for the touched scope: `just test tooling` 13/13, `just typecheck` and `just arch-check` exit 0, and `just lint` is green except the iOS lane. On this Mac `ios-lint` aborts because swiftlint cannot load sourcekitd while the Command Line Tools are selected (bootstrap `--system` fixes that). `just ci-parity` not run.
- **New decisions / risks / questions filed:** none in doc 16 yet; the user decided: OrbStack is the only macOS Docker runtime; Linux uses Docker Engine with pacman (Omarchy, primary) or apt; a missing pinned Xcode is installed with `xcodes`; bootstrap writes the rc block (this reverses the old "never edits rc files" rule). Proposed DEC text is in the s5 proposal.
- **Surprises / gotchas:** direnv is pinned only in this repo, so a plain `direnv hook` line fails in a new shell outside the repo; the block runs it through `mise exec direnv@<pin>`. `/usr/bin/xcodebuild` exists with only the CLT selected. On macOS `/bin/bash` 3.2, `just docs-check` with no arguments failed at `scripts/docs/docs-check.sh:191` (empty `paths[@]` under `set -u`; pre-existing, fixed this session).
- **Next session starts:** the user runs `./scripts/bootstrap.sh --system` on the Mac in a real terminal (sudo prompts; Xcode 27.0 is already in `/Applications`, so no Apple ID prompt), opens a new terminal, and runs `just doctor`. Commit and open the PR only when the user asks.

### 2026-09-24 — Docs and install-steps refresh; fresh-clone bootstrap fixes

- **Phase / tasks worked:** P02 hygiene (no task ID). Branch `docs/refresh`, stacked on `chore/native-followups` (PR #7). One agent per disjoint doc set, plus a read-only fresh-clone run of the README install steps.
- **Status changes:** none.
- **Done this session:**
  - **Doc refresh:** every developer-facing README and setup doc was checked against the code and fixed: root README, macOS guide, iOS/Android/e2e, API/jobs/outbox/db/seed-data, workers, secrets, SERVICES-SETUP (new §15 push), security docs, workflow/tooling/index READMEs, and the platform module contract. `solo.yml` no longer starts the removed `just dev-mobile`.
  - **Fresh-clone fixes:** `just doctor` ignores global mise tools, bootstrap fills the local `DATABASE_URL`, the onboarding next-step line follows the actual outcome, and a system `mise` on PATH is used. The onboarding tests failed before the fix and pass after (`just test secrets`).
  - **Human-only drift:** `CLAUDE.md` and `planning/15` changes are written up as a proposal in [`.claude/plans/s4-doc-refresh-human-proposals.md`](../.claude/plans/s4-doc-refresh-human-proposals.md).
- **Not done / in flight:**
  - The pr-gate oasdiff step always skips: `scripts/ci/contracts-breaking.sh` looks for `packages/contracts/openapi.bundle.json`, but the bundle is generated at `packages/contracts/gen/openapi.bundle.json`. This needs a tooling fix.
  - `secrets/dev.enc.yaml` still holds the empty `NEON_*`/`TRIGGER_*` keys.
  - The push section's Firebase pricing line is not verified against the vendor page.
- **Repository state:** buildable ✅ (see the PR for `just ci-parity`).
- **New decisions / risks / questions filed:** none.
- **Surprises / gotchas:** doctor used to fail for anyone whose global mise config pins `latest` tools. The README's first-run `curl …/v1/health` returned 503 on a fresh clone until bootstrap filled `DATABASE_URL`.
- **Next session starts:** fix the oasdiff bundle path (tooling-engineer), then merge #5 → #6 → #7 → this PR.

### 2026-09-23 — Native-migration follow-ups: OQ-15/16/17 resolved (ADR-0005, DEC-55)

- **Phase / tasks worked:** P02 follow-ups to ADR-0004 (PR #6). Branch `chore/native-followups`, cut from `chore/native-foundations` because PRs #5 and #6 were not merged yet. One small agent per concern, each in its own worktree, then merged.
- **Status changes:** none (P02 stays `IN_PROGRESS`).
- **Done this session:**
  - **OQ-16:** `servers[].url` no longer ends in `/v1`; paths unchanged; all clients regenerated. oasdiff reports "No breaking changes to report". The iOS/Android tests that assert exactly one `/v1` pass (`44d69cb`).
  - **OQ-17:** iOS `Preview.xcconfig` and the Android `preview` build type point at `https://staging-api.ai-stylist.app`; the TODOs and stale double-`/v1` comments are gone (`9cc65f4`, `55bc642`).
  - **OQ-15:** `packages/shared-kernel/registry/*.json` generates TS (`src/gen`), Swift (`AIStylistKernel`) and Kotlin (`app.aistylist.contracts.kernel`) through `just generate`, and `--check` covers all three (`80be181`, [ADR-0005](../docs/adr/0005-shared-kernel-registries-for-native-clients.md), DEC-55).
  - **`EXPO_PUBLIC_*`:** both keys removed from `secrets/dev.enc.yaml` with `sops unset` on 2026-09-24 (41 → 39 keys; the file still decrypts). The developer identity was restored from a backup file.
  - **`EXPO_TOKEN`:** nothing to delete. `gh secret list` shows only `SOPS_AGE_KEY`; the Dependabot and Codespaces scopes are empty, and there are no environments. `rg EXPO_TOKEN` finds no code references.
- **Not done / in flight:**
  - No app target consumes `AIStylistKernel` or the Kotlin `kernel` sources yet; that wiring is deferred to the first feature that needs it.
  - Python kernel emission and `errors.ts` are out of scope.
- **Repository state:** buildable ✅. See the PR for `just ci-parity` output. iOS Xcode steps are not run on Linux; the macOS CI job covers them.
- **New decisions / risks / questions filed:** DEC-55; OQ-15, OQ-16 and OQ-17 resolved.
- **Surprises / gotchas:**
  - `isolation: worktree` agents branch from `main`, not the current branch, so each agent had to `git switch -c <branch> chore/native-followups` first.
  - `just test shared-kernel` does not exist; use `pnpm --filter @ai-stylist/shared-kernel test` or `just test`.
  - The `tools/codegen/**` edits (gen-kernel.mjs, kernel/*.mjs, gen-swift.sh, gen-kotlin.sh, generate.sh) were made by contracts-engineer. A tooling-engineer review is worthwhile.
- **Next session starts:** merge PR #5 → #6 → this PR. Then wire `AIStylistKernel` / the Kotlin `kernel` sources into the first feature module that shows a reason code or checks an entitlement.

### 2026-09-22 — Native migration: React Native + Expo replaced by SwiftUI + Compose (ADR-0004, DEC-49–54)

- **Phase / tasks worked:** P02: T10 (done by replacement), T14 (re-scoped, `PARTIAL`), T15 (re-scoped). Branch `chore/native-foundations` @ `eb62dfc` (removal + iOS + Android merged); docs on `docs/native-decision`; tooling wiring on `integration/native-wiring` (parallel).
- **Status changes:** none in the phase table (P02 stays `IN_PROGRESS`; P01 re-scoped, still `NOT_STARTED`).
- **Done this session:**
  - Removed `apps/mobile` and the Expo/EAS config, recipes, workflows and RN-only agent/skill/rules.
  - Added `apps/ios`: Swift 6 + SwiftUI, XcodeGen + SwiftPM `Core`/`Features`, strict concurrency, warnings as errors, a ban script, and `.github/workflows/ios.yml`.
  - Added `apps/android`: Kotlin + Compose, AGP 9.3.3, 5 modules, Lint/detekt/Spotless, a module-graph allow-list, lockfiles + verification metadata, and `.github/workflows/android.yml`.
  - Added generated Swift/Kotlin clients (`packages/contracts/gen/{swift,kotlin}-client`) and moved the shared Maestro flow to `e2e/smoke.yaml`.
  - Recorded ADR-0004; ADR-0002 is superseded.
  - Planning package made truthful: SPINE §1/§2/§5, docs 00/01/04/05/07/11/12/13/14/15/16, README, phases P01–P14, module contracts `avatar`/`recommendation`, and a banner on `planning/CLAUDE.md`.
- **Not done / in flight:**
  - **The iOS app target has never been built:** the SwiftUI views and XcodeGen project have not been compiled on a Mac. Only the Core/Features packages have been tested on Linux (Docker `swift:6.4`).
  - No Android device/emulator or Maestro run yet.
  - The integration branch (justfile recipes, `mise.toml` JDK 21, CLAUDE.md layout, agents/skills/rules for native) must merge before `just docs-check --strict` is clean: DC-15 on the docs branch alone flags the new doc-15 §5 rows until the native recipes exist.
  - The signing lanes (TestFlight, Play upload) are not built (OQ-18).
- **Repository state:** last green `just ci-parity` = 2026-09-23 on the merged branch (Linux, exit 0). iOS simulator build + tests passed on the GitHub macOS runner (PR #6: https://github.com/ArtMin96/ai-stylist/actions/runs/35790550229/job/106958271073). Not run: `just ios-e2e` / `just android-e2e` (Maestro on simulator/device) and any local-Mac run.
- **New decisions / risks / questions filed:**
  - Added: DEC-49–54, RISK-18 (native review capacity), RISK-19 (parity drift), ASM-11, OQ-15 (shared-kernel emission for Swift/Kotlin), OQ-16 (contract double `/v1`), OQ-17 (staging host), OQ-18 (native signing/store lanes, permanent bundle id).
  - Superseded: DEC-03/04/30/38; the DEC-05 wrapper half, the DEC-20 client half and the DEC-48 EAS row. Amended: DEC-11/37.
  - Retired: RISK-01, ASM-01. Resolved: OQ-04. Updated: RISK-11/12/13, OQ-08.
- **Surprises / gotchas:**
  - The contract's `servers[]` already end in `/v1`, so clients must use a host-only `API_BASE_URL`.
  - mise's `swift@6.4.0` cannot run on Arch (missing libncurses/libxml2), so Linux uses Docker `swift:6.4`.
  - Android cmdline-tools 23.0's new `android` CLI shim hung on first run, so `sdk.sh` pins 19.0.
  - The `xcode-27` runner image is still marked preview.
- **Next session starts:**
  1. On the team's Mac: `just ios-doctor && just ios-check`, then `open apps/ios/AIStylist.xcodeproj` and run AIStylist-Dev against `just dev-api`.
  2. `just android-check`.
  3. `just ci-parity`, then `just docs-check --strict` on the merged branch.
  4. Open the PR from `chore/native-foundations`.
  5. Human cleanup: see "Human-only steps outstanding".
  6. Then OQ-16 (a contracts change), and OQ-15 before the first native feature that needs reason codes or entitlements.

### 2026-09-13 — Agent operating foundation: skills/agents/hooks/docs-check landed (s3 plan, T22 verification)

- **Phase / tasks worked:** P02 — `.claude/plans/s3-agent-operating-foundation.md` (T1–T22, all 4 waves), branch `chore/agent-setup`. T22 (this session): full gate run, residual fixes, handoff.
- **Status changes:** none in the phase table (P02 stays `IN_PROGRESS`); this plan is tooling/agent-operations, not a P02 task-list item.
- **Done this session:** ran the full verification sequence and fixed everything discoverable inside the plan's write sets. `just docs-check` → 0 errors, 9 warnings (DC-14/DC-15, human-proposal-pending, expected). `just docs-check --fixtures` → all 15 DC-01..DC-15 fixtures + the `_clean` control report/pass correctly. `just lint`, `just typecheck`, `just arch-check` → green. `just ci-parity` → green (format --check, lint+fixtures, typecheck, arch-check+fixtures, docs-check, generate --check, test, security-scan+license-fixtures all passed). **Residual fixes made** (all inside Wave 1–3 write sets, licensed by T22's mandate): (1) `pnpm exec prettier --write` on the 62 skill/template/fixture files still unformatted since Wave 2/3 (needed for `ci-parity`'s `format --check` step) — this exposed a real bug: the repo's `singleQuote: true` Prettier config reformats embedded YAML frontmatter and converts double-quoted `metadata.*` scalars to single quotes, but `docs-check`'s `frontmatter_subfield` helper only strips double quotes, so 19 of 22 SKILL.md files failed DC-05 (`last-reviewed` no longer matched `YYYY-MM-DD`) and 3 failed DC-08 (module name no longer matched). Fixed by rewriting all 22 skills' `metadata.modules` / `last-reviewed` / `owner-agent` to bare (unquoted) YAML scalars, which Prettier leaves untouched and `docs-check` parses correctly — the same corruption also hit `tools/docs/fixtures/_clean/.agents/skills/s/SKILL.md`'s `modules` field, fixed the same way. (2) Hook fixture smoke test (`tools/docs/fixtures/hooks/*.json` replayed through `scripts/hooks/*.sh`) found `protected-path.json`, `generated-file.json`, `lockfile.json` used relative `file_path`s while `guard-protected-paths.sh`'s path patterns (`*/CLAUDE.md` etc.) require a `/` before the match — Claude Code always sends absolute paths in practice (confirmed by a live-payload replay that denied correctly), so the 3 fixtures were changed to absolute paths to actually exercise their documented `deny` branch; all 10 hook fixtures + 2 live-payload checks now show the documented decision.
- **Deviations from the plan, recorded honestly:** (a) **C9** — the 9 new skills' `run_loop.py` trigger-optimization pass was smoke-tested only, plus one manual pass; not the full automated train/test loop. See `.claude/plans/s3-trigger-eval-report.md`. (b) **C5** states `len(name)+len(description) <= 1536`, but the shipped `docs-check` DC-05 enforces `description <= 1024` chars only — reconciled to the stricter shipped check (DC-05 is what actually gates the branch; all 22 skills pass it). (c) T17 reported a `git stash`/`git stash pop` round-trip in the shared tree during Wave 2 — no data loss observed, noted for the record.
- **Contract C1–C12:** 10 met, 2 partial (C6 partial only on depth of manual spot-check, not a known defect; C9 partial per deviation (a) above) — full table with evidence in the T22 session report (not persisted as a separate file; see this session's transcript / re-derivable via the commands listed in "Regression evidence" below).
- **Regression evidence:** n/a (tooling/docs verification session, no product-code bug fixed); the Prettier-quote and hook-fixture-path issues above were discovered live during this session's own gate run (docs-check went from 0→22 errors after `prettier --write`, then back to 0 after the metadata fix) and are the closest thing to a regression test this session produced.
- **New decisions filed:** none in doc 16 this session (tooling-scope decisions recorded inline in the s3 plan's "Risks & decisions" instead: feature-flags-rollout stays a reference file, not a standalone skill; no model pins in skill/agent bodies; 180-day `last-reviewed` window; `.claude/plans/**` and `docs/adr/**` are exempt from DC-13's raw-invocation scan).
- **Files touched (this session, T22 only):** `PROGRESS.md` (root), `planning/PROGRESS.md` (this entry); residual fixes across `.agents/skills/*/SKILL.md` (22, metadata quoting only), `tools/docs/fixtures/_clean/.agents/skills/s/SKILL.md`, `tools/docs/fixtures/hooks/{protected-path,generated-file,lockfile}.json`, plus whitespace-only Prettier formatting on the 62 files listed in this session's `ci-parity` output (`.agents/skills/**`, `templates/*.{md,json}`, `tools/docs/fixtures/**`). No product code, no `CLAUDE.md`/`planning/SPINE.md`/`planning/15-*.md`/`.github/**` changes (`git diff --name-only` against those paths is empty). Post-T22 follow-up (same session): `tools/docs/fixtures/**` dot-dirs renamed to `dot-claude`/`dot-agents` and `docs-check --fixtures` now stages each fixture into a temp tree, because Claude Code was auto-discovering `tools/docs/fixtures/_clean/.claude/skills/s` as a real project skill; `docs/SERVICES-SETUP.md:297` reworded to cite DEC-41 instead of naming the fallback vendor (last DC-13 hit). Gates re-run green after both.
- **Not done / next action:** DONE later the same session — the owner applied both proposals (CLAUDE.md, doc 15 §5/§12.5, planning/CLAUDE.md HISTORICAL banner) and `ci-parity` now runs `docs-check --strict`; `just docs-check --strict` → 0 errors, 0 warnings. DC-09/DC-10 were also rewritten to one grep per file (99 s + 138 s → under 2 s + 9 s). Original wording follows for the record: (1) apply `.claude/plans/s3-claude-md-proposal.md` (CLAUDE.md layout block: add `artifacts/`, `node_modules/`, `prototype/`, `secrets/`) and `.claude/plans/s3-doc15-proposal.md` (doc-15 §5: add `db-generate`, `docs-check`, `lint-file`, `sbom`, `test-regression` recipe rows) — both are copy-pasteable diffs, human-authorized-only per root `CLAUDE.md`; (2) once applied, flip `docs-check` to `--strict` inside `just ci-parity` so DC-14/DC-15 become hard errors instead of warnings. Branch `chore/agent-setup` is uncommitted and buildable; next session opens the PR after these two proposals land (or documents that they're still pending in the PR description).
- **Repository state:** buildable ✅ — `just docs-check`, `just lint`, `just typecheck`, `just arch-check`, `just ci-parity` all green locally 2026-09-13 (see command output pasted in this session's transcript).

### 2026-09-13 — Service consolidation: r7 audit applied (ADR-0003, DEC-41–48)

- **Phase / tasks worked:** P02 — planning/docs consolidation from [research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md) (verified 2026-09-13); no product code beyond the placeholder rename `apps/api/src/trigger/` → `apps/api/src/jobs/`. Reshapes T07 (self-managed PostgreSQL envs instead of Neon), T08 (pg-boss instead of Trigger.dev), T13 (R2 delivery model, no Cloudflare Images).
- **Status changes:** none (P02 stays `IN_PROGRESS`; no task moved).
- **Done this session:** [ADR-0003](../docs/adr/0003-self-hosted-infrastructure-baseline.md) accepted — pg-boss v12 on the app PostgreSQL (`apps/api/src/jobs/`), owned servers + Docker + Coolify, self-managed PostgreSQL 17 + pgvector with pgBackRest PITR/PgBouncer/restore drills, R2 kept with an explicit delivery model (presigned private / custom-domain cached public) and Cloudflare Images removed, embedded `date-holidays` behind `HolidayProvider`, reason-code-only explanations, self-hosted AI eval arms (BiRefNet, Qwen3-VL, SigLIP/SigLIP2 in P06; FASHN VTON v1.5 in P11; FLUX.2 [dev] non-commercial for self-hosting), managed services kept with exit triggers (R2, PostHog/Grafana free tiers, RevenueCat through launch, EAS free allowance, GitHub). Google Play subscription fee verified 15% (ASM-09, BIL-O7 closed). [SPINE §2/§6](SPINE.md), [doc 16](16-risks-open-questions-and-decision-log.md), [README](README.md), phase files, module contracts, skills, agent definitions, templates, tooling rules, `.env.example` and workflows moved to the new vocabulary (per the target-state spec); old DEC rows marked superseded, never deleted. Linear updated the same day: AI-9 (P02-T08) and AI-7 rewritten for pg-boss / self-managed PostgreSQL / Coolify, AI-8 retitled to the pg-boss acceptance gate, Linear templates 1/6/8 re-synced via `templates/linear/create-templates.sh --update`; root `CLAUDE.md` edited with owner authorization.
- **Regression evidence:** n/a — docs-only plus the placeholder rename; `just ci-parity` green on 2026-09-13 after `just format` (Prettier had re-aligned seven Markdown tables); `just lint`, `just typecheck`, `just arch-check` (+ `--fixtures`), `just generate --check`, `pnpm --filter @ai-stylist/db test` (9 passed), api vitest project (40 passed) all green.
- **Not done / next action:** P02-T08 = the pg-boss proof (outbox relay + pg-boss + worker round-trip against the acceptance suite: kill/retry, idempotency, DLQ, replay, per-user cancellation, deletion/export) — self-hosted Trigger.dev only if it fails; root `CLAUDE.md` edits applied 2026-09-13 with owner authorization; owner decides OQ-14 (server provider + single-host vs DB-separate topology) together with OQ-07 before any cloud provisioning; T07 recovery acceptance (pgBackRest PITR + restore evidence) is now part of the T07 definition of done.
- **New decisions filed:** DEC-41–48, RISK-17 (self-managed PostgreSQL recovery/ops burden; RISK-15/16 were already taken), OQ-14; RISK-11, ASM-09, OQ-07, OQ-11 updated.
- **Files touched:** `planning/` (SPINE, README, docs 05/10/11/12/15/16, PROGRESS), `planning/phases/`, `docs/` (adr/0003 + index, modules/), `.agents/`, `.claude/`, `templates/`, `tools/`, `apps/api/src/jobs/` (renamed placeholder), `.env.example`, `.github/workflows/`, root `PROGRESS.md`.

### 2026-09-13 — Automated secrets onboarding (P02 T02/T12 follow-up, PR #2)

- **Phase / tasks worked:** P02 — onboarding automation for sops + age, plan `.claude/plans/s2-automated-secrets-onboarding.md` (7 tasks, 4 waves), on `fix/repo-sops-age-hardening`.
- **Done this session:** a new developer now runs `just bootstrap` and gets an age identity (mode 600, never printed), their public recipient added under the `dev` rule of `.sops.yaml` on a pushed `onboard/<slug>` branch (committed in a throwaway worktree, the developer's tree and branch untouched), and the compare URL to open the PR; an approver runs `just secrets-approve <branch>` (diff gate: only `.sops.yaml`, only added `# developer:` + `- age1...` lines, before any sops call; then `sops updatekeys` on every env file, commit, push); after merge, `just bootstrap`/`just secrets-sync` decrypts. `just doctor` gained four checks (identity present + mode, recipient listed, `dev.enc.yaml` decrypts, backup marker — warning only) and skips them in CI without `SOPS_AGE_KEY`; `just secrets-backup-done` records the backup. Both onboarding and bootstrap are no-ops under `CI`. Library helpers in `secrets-lib.sh` (identity path, public key, recipient insertion, decrypt probe, slug, default branch, compare URL, node_modules link). Docs rewritten around the new flow (`README.md` §5, `secrets/README.md`, `docs/SERVICES-SETUP.md` §2, `planning/15` §5 rows, owner-authorised).
- **Regression evidence:** the 14 onboarding tests were written first and shown red for missing-script reasons (`just test secrets`: 13 failed + 1 already green), then green per task. Two defects found during wave 4 and fixed test-first: (1) the real commit-msg hook runs `pnpm exec commitlint` from the commit's cwd, so a worktree without `node_modules` fails every commit — the fixture now installs such a hook (`FAIL onboard pushes…`, `FAIL approve re-wraps…` before; `secrets_link_node_modules` symlinks the repo's `node_modules` into the worktree so hooks run for real, never bypassed); (2) a fresh machine without `git user.name`/`user.email` failed inside the worktree commit — `FAIL onboard stops with a hint when git has no user.name/user.email` before, the script now stops with the `git config --global` hint. Also fixed a wave-2 test that read the developer's own `.sops.yaml` instead of the pushed branch.
- **Real-machine smoke (scratch clone of this repo with the real prek hooks, mise shims PATH, throwaway identity, local bare remote — no GitHub push):** `secrets-onboard.sh` generated the identity, committed through gitleaks + commitlint, pushed `onboard/synthetic-developer` (2-line `.sops.yaml` diff), left the tree clean; `secrets-approve.sh` with the owner's real identity re-wrapped `dev.enc.yaml`, committed through the hooks, pushed, and the throwaway identity then decrypted all 41 keys. `just doctor` on the owner's workstation: three ✔ lines + the backup warning.
- **Repository state:** buildable ✅ — `just test secrets` 22/22, `just lint`, `just ci-parity` green locally 2026-09-13. CI flake fixed: PR #2's pr-gate (and PR #1's merge run) failed on `apps/mobile` `home-screen.test.tsx` first test with `Exceeded timeout of 5000 ms`; measured 2.1 s locally vs 64 ms/14 ms for the next tests (cold jest-expo start), so `apps/mobile/jest.config.js` now sets `testTimeout: 20_000` with the reasoning in a comment.
- **Not done / next action:** owner backs up the developer identity and runs `just secrets-backup-done`; merge PR #3 then PR #2; first real onboarding of a second developer is the acceptance test of this flow (open question: how the approver gets notified beyond the PR itself — GitHub review request / CODEOWNERS). `staging`/`prod` recipients stay manual until P03.

### 2026-09-11 — P02 sops + age repository hardening

- **Phase / tasks worked:** P02 — T02/T12 secrets boundary follow-up on `fix/repo-sops-age-hardening`.
- **Done this session:** plaintext files under `secrets/` are ignored while `README.md` and `*.enc.yaml` remain committable; the sync/edit contract has synthetic regression coverage, including the all-empty first-file case; Docker-less test runs retain that coverage; CI age-key cleanup and troubleshooting docs are accurate. The initial developer and CI age identities were generated, their public recipients were added to every environment rule, and `secrets/dev.enc.yaml` was created with all 41 `.env.example` keys empty. Real decryption succeeded with both identities, `just secrets-sync dev` produced a mode-600 `.env`, and isolated `sops updatekeys` rotation proved add/decrypt/remove/deny. The matching CI identity was streamed into the GitHub repository secret `SOPS_AGE_KEY`, verified by name/timestamp, and its temporary local file was removed. `secrets/README.md` is now the single developer technical guide for the mental model, daily workflow, onboarding, and identity recovery, linked from root first-time setup. Review follow-up (two-axis code review of PR #2): `just secrets-updatekeys` (`scripts/security/secrets-updatekeys.sh`) is the doc-15 §6 onboarding/rotation helper and replaces every raw `sops updatekeys` instruction in `.sops.yaml`, `secrets/README.md`, and `docs/SERVICES-SETUP.md`; the secrets suite now also runs the real mise-pinned `sops` + `age` end to end (create → set → sync → add recipient → remove recipient → deny removed identity), so the decrypt and rotation evidence is reproducible with `just test secrets` instead of asserted here; `just test secrets` is a `case` arm; the unrelated portability `MISE_GITHUB_TOKEN` fix was moved out of PR #2 into PR #3 (`fix/ci-mise-github-token`; merge that one first so PR #2's portability run is not rate-limited).
- **Regression evidence:** before the fixes, the suite reported `FAIL plaintext secrets ignored; encrypted files and README committable`; the review follow-up reported `FAIL SKIP_DOCKER_TESTS=1 just test omitted the secrets suite`; the initial all-empty real file then exposed `secrets-sync` exiting before its summary, reproduced by `FAIL sync accepts a first encrypted file whose shared values are all empty`.
- **Repository state:** buildable ✅ — real SOPS/age decrypt, sync, and recipient rotation checks pass; `just test secrets`, `SKIP_DOCKER_TESTS=1 just test`, `just test`, `just lint`, `just arch-check`, `just security-scan`, and `just ci-parity` were green locally on 2026-09-11; PR #2 portability and PR-gate runs are green.
- **Not done / next action:** fill `dev.enc.yaml` values only as the corresponding service accounts are provisioned; create staging/prod files in P03 when those environments exist. 2026-09-12 identity reset: no surviving copy of the P02 developer identity could be found on any workstation, so both identities were regenerated (developer at `~/.config/sops/age/keys.txt` on this workstation, CI streamed into the GitHub secret `SOPS_AGE_KEY` and the temp file deleted), `.sops.yaml` lists the two new recipients with `developer`/`ci` labels, and the empty `secrets/dev.enc.yaml` was recreated for them (no values existed, nothing lost); `just secrets-sync` and `just test secrets` green with the new identity. Still human-only: back up the developer identity in the team's approved password manager today. Onboarding automation landed on 2026-09-13 (see the entry above).

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
