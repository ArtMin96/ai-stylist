# 15 — Team Workflow and AI-Agent Operations

**Owner of:** developer environment (Ubuntu), command catalog, secrets strategy, branching/review, ADR/DoR/DoD process, supply-chain policy, release channels, environment isolation, and the AI-agent operating procedures.
**Conforms to:** [SPINE.md](SPINE.md) §2 (stack), §3 (modules), §5 (phases). Evidence: [research/r1-linux-ios-build.md](research/r1-linux-ios-build.md), [research/r2-mobile-3d-stack.md](research/r2-mobile-3d-stack.md), [research/r4-backend-providers.md](research/r4-backend-providers.md).
**Related:** root operating contract [CLAUDE.md](CLAUDE.md) · skills in `.agents/skills/` · templates in `templates/` · migrations policy in [06-data-api-and-event-contracts.md](06-data-api-and-event-contracts.md) · CI tiers in [13-testing-quality-and-performance.md](13-testing-quality-and-performance.md).

Requirement IDs delivered: `REQ-TEAM-*` / `NFR-TEAM-*` (defined in [01-requirements-and-traceability.md](01-requirements-and-traceability.md)). Set up in phase **P02**; refined in every later phase.

---

## 1. Developer environment (Ubuntu Linux)

The team is 2–3 developers on Ubuntu workstations. Android + backend development is fully local; iOS builds are cloud-only (§3). Everything below is automated by `just bootstrap` (§4) — this section documents what the script does so it stays reviewable.

### 1.1 System packages (apt)

```
build-essential git curl unzip zip ca-certificates gnupg
libssl-dev pkg-config
direnv                      # per-directory env loading (secrets, §6)
adb                         # via google-android-platform-tools-installer or SDK cmdline-tools
```

### 1.2 Pinned toolchain via `mise`

`mise` (SPINE §2) is the single version manager. Versions are pinned in a committed `mise.toml` at repo root; `mise install` reproduces the exact toolchain. **No global installs of node/pnpm/java outside mise.** Pins (as of Aug 2026 — bump via Renovate PRs only, §9):

| Tool | Pin | Notes |
|---|---|---|
| Node.js | 22.x (active LTS) | Exact patch pinned in `mise.toml`; matches CI and EAS image |
| pnpm | 10.x | Workspace manager (SPINE §2); exact version also in `packageManager` field of root `package.json` |
| Java | Temurin 17 | Required by Android Gradle Plugin for RN/Expo SDK 55 |
| just | 1.x | Task runner |
| Python | 3.12.x | ML workers (`workers/`), uv for deps |
| watchman | latest stable | Metro file watching; installed via prebuilt binary (apt version is stale) |

### 1.3 Android tooling

- **Android Studio** (current stable) for SDK manager, emulator, and profiler — not required for day-to-day builds (Gradle CLI suffices).
- **SDK components** (installed by bootstrap via `sdkmanager`): platform-tools, latest stable platform (API level per Expo SDK 55 requirement), build-tools, NDK version pinned to the one `react-native-filament` requires, emulator + one x86_64 system image (mid-tier profile, e.g. Pixel 6a class).
- **Physical devices**: udev rules installed by bootstrap; verify with `adb devices`. Real-device testing is mandatory for camera + 3D work (r2) — the emulator is for UI iteration only.
- `ANDROID_HOME` and PATH entries are written to `~/.config/ai-stylist/env.sh` and sourced by direnv, not scattered in dotfiles.

### 1.4 Containers

- **Docker Engine + Compose plugin** (docker.io or docker-ce). Used for: local Postgres (pgvector image, mirroring Neon's Postgres major version), Python ML workers, and any adapter integration-test dependencies.
- `just dev-api` brings up the compose stack automatically.

### 1.5 Editor / LSP

Any editor with these language servers is acceptable; VS Code settings are committed in `.vscode/` as the reference profile:

- TypeScript LSP (workspace TS version, not editor-bundled), ESLint + Prettier extensions using the repo config.
- Pyright/BasedPyright + Ruff for `workers/`.
- Drizzle/SQL: plain SQL highlighting is enough; schema is TypeScript.
- Recommended: a just-recipe runner extension and the EditorConfig plugin (`.editorconfig` committed).

Claude Code (§12) uses the same LSP servers for symbol navigation — keeping them healthy benefits both humans and agents.

## 2. New-developer day one

1. Clone repo → `just bootstrap` → follow its printed next steps (age key + sops re-encrypt PR, §6) → `just doctor` until green.
2. Pair on one tracer-bullet issue end to end (issue → branch → PR → review → merge) to absorb §7–§8.
3. Read [SPINE.md](SPINE.md), [CLAUDE.md](CLAUDE.md), the current phase file, and `PROGRESS.md` — the same orientation set the agents use (§12.1).

Target: first merged PR within day one; anything blocking that is a bootstrap bug — file it.

## 3. iOS on a Linux-only team (the macOS reality)

Per [research/r1](research/r1-linux-ios-build.md) and SPINE §2: **no local Mac, ever, and no pretending otherwise.** iOS simulator, Metal shader compilation, and App Store submission require macOS; we buy that as a service.

- **Builds + signing:** EAS Build **or** GitHub Actions macOS M-series runners (~$0.12/min; ~$30–50/mo at our cadence). The final choice is **ADR-gated in P02** (r1 §6). Until that ADR lands, planning documents must say "EAS-or-GHA-macOS", not assume one.
- **TestFlight upload:** App Store Connect API from a **Linux** runner (fastlane `upload_to_testflight` or `Apple-Actions/upload-testflight-build`) — works without macOS (r1 §3).
- **App Store submission:** macOS CI step (Xcode 26+ mandatory since 2026-04-28, r1 §2). Automated in the release lane, never manual.
- **Signing assets:** distribution certificate + provisioning profiles live in CI secret storage (§6); managed via EAS credentials service or fastlane match — per the P02 ADR. No developer ever holds signing keys locally.
- **Device testing:** the team owns 2–3 physical iPhones (low/mid/high tier per doc 13's device matrix). Install TestFlight builds; no local iOS simulator exists on Linux. For debugging native iOS issues beyond what logs provide: reproduce via CI build with verbose logging, or a rented remote Mac session (r1 Option B) as the escape hatch — do not buy hardware for a one-off.

Android has no such constraint: full build/sign/test cycle runs locally on Ubuntu and on Linux CI runners.

## 4. Bootstrap and doctor

Two commands stand between a fresh Ubuntu install and a working environment:

- **`just bootstrap`** — idempotent, re-runnable, fails fast with actionable errors (brief §5.4). Steps: check Ubuntu version → apt packages → install mise + `mise install` (all pins) → corepack/pnpm → `pnpm install` → Android cmdline-tools + `sdkmanager` components + udev rules → Docker group membership check → direnv hook check → git hooks (`prek`/husky: gitleaks, commit-lint) → `.env` scaffold from `.env.example` → prints next steps (secrets bootstrap §6, `just doctor`).
- **`just doctor`** — read-only environment verifier, also the first thing to run when anything is weird. Checks: tool versions vs `mise.toml` pins, `adb devices`, Docker daemon reachable, Postgres container healthy, direnv active, `.env` has all keys from `.env.example`, contracts generation up to date (`just generate --check`), git hooks installed, disk space for asset caches. Exit non-zero with a fix hint per failing check.

Both scripts live in `scripts/` as readable, commented bash (or TS via `zx` if branching grows) — no thousand-character one-liners (brief §5.4).

## 5. Standard command catalog (`just` recipes)

`just` is the single entry point; raw `pnpm`/`gradle`/`drizzle-kit` invocations in docs, CI, and agent instructions are a smell. Recipe names use dashes (just does not allow `:` in recipe names). CI runs **the same recipes** (§5.1). Canonical catalog — every planning doc and skill references exactly these names:

| Recipe | Does |
|---|---|
| `just bootstrap` | Full environment setup (§4), idempotent |
| `just doctor` | Environment + repo health check (§4) |
| `just dev-api` | Compose stack (Postgres+pgvector) + NestJS API in watch mode |
| `just dev-mobile` | Expo dev client (Metro); `--android` targets connected device/emulator |
| `just dev-workers` | Python ML workers + Trigger.dev dev server locally |
| `just test <module>` | Scoped: one module's `tests/` dir (e.g. `just test recommendation`) |
| `just test` | Full suite (all modules + packages), as CI PR gate runs it |
| `just lint` | ESLint (incl. boundary rules) + Ruff for workers |
| `just typecheck` | `tsc --noEmit` across workspace + Pyright for workers |
| `just format` | Prettier + Ruff format, write mode; `--check` in CI |
| `just arch-check` | dependency-cruiser: module dependency rules, public-API-only imports (SPINE §3) |
| `just generate` | OpenAPI contract → TS client + types; event schema types; `--check` fails on stale output |
| `just db-migrate` | Apply pending drizzle-kit migrations to the target env (default: local) |
| `just db-rollback` | Roll back last migration per doc 06 policy (expand/contract aware) |
| `just db-reset` | Drop + recreate + migrate + seed **local** DB only (refuses non-local `DATABASE_URL`) |
| `just db-seed` | Load privacy-safe seed data (§11) into local/staging |
| `just mobile-ios-build` | Trigger cloud iOS build (EAS or GHA lane per P02 ADR); `--profile dev\|preview\|prod` |
| `just mobile-android-build` | Local release/debug APK+AAB via Gradle; `--cloud` for CI parity build |
| `just assets-validate` | 3D asset gate: glTF 2.0 validity, KTX2 encoding, poly/texture budgets, manifest schema, morph-target names (doc 07) |
| `just ml-eval` | Run versioned eval suites for classification/segmentation/try-on against golden datasets (doc 10) |
| `just security-scan` | gitleaks + osv-scanner + npm/pnpm audit + license check (§9) |
| `just ci-parity` | Run the exact PR-gate sequence locally: format-check, lint, typecheck, arch-check, generate --check, test, security-scan |
| `just golden-accept` | Accept updated golden/visual-regression baselines as a reviewed commit (doc 13 §6) |
| `just rec-replay <id>` | Re-run a stored recommendation from its snapshots and diff against the stored result (doc 09 §9) |
| `just rec-golden-update` | Regenerate recommendation golden fixtures for review (doc 09 §13.3) |
| `just secrets-sync` | Decrypt sops dev secrets into the gitignored `.env` (§6) |
| `just secrets-edit <env>` | Edit `secrets/<env>.enc.yaml` through sops; first run creates it from the `.env.example` key list (§6) |
| `just secrets-updatekeys [env ...]` | Re-wrap `secrets/*.enc.yaml` for the recipient list in `.sops.yaml` after adding or removing a key (§6 onboarding/rotation) |

Rules: recipes fail fast; long recipes call `scripts/*.sh`, not inline blobs; every recipe prints what it will do against which environment before touching anything non-local; destructive recipes (`db-reset`, `db-rollback`) require `--yes` or interactive confirm.

### 5.1 CI parity

GitHub Actions jobs invoke `just` recipes, never re-implement them in YAML. If CI is green and `just ci-parity` fails locally (or vice versa), that is a P1 tooling bug. Nightly lanes (device tests, ML evals, full 3D validation) also map to catalog recipes so they can be reproduced on a workstation.

## 6. Secrets strategy

**Decision: `sops` + `age` (chosen over 1Password CLI).** Rationale: free, offline, no vendor account coupling for a 2–3 person team, diffs are reviewable (encrypted values, plaintext keys), and CI decryption needs only one age key. Revisit via ADR if the team adopts 1Password org-wide.

- `.env.example` — committed, exhaustive, **zero real values**; every key has a comment (what it is, where to get it, which envs need it). CI checks `.env.example` keys ⊇ keys referenced in config schema.
- `secrets/<env>.enc.yaml` — sops-encrypted per environment (`dev`, `staging`, `prod`), committed. Each developer's age public key + one CI key in `.sops.yaml`. Onboarding = add pubkey, `just secrets-updatekeys`, PR.
- **direnv** — `.envrc` (committed) loads `.env` (gitignored, generated from decrypted dev secrets via `just secrets-sync`) so shells and `just` recipes see config without manual exporting.
- **CI:** GitHub encrypted secrets hold only: the CI age private key, store signing credentials (§3), and deploy tokens for Railway/Trigger.dev/Neon/R2. Everything else flows from sops files.
- **Prod values:** live in sops `prod` file + the platform's own secret store (Railway variables) — sops file is the source of truth; a sync script pushes, never hand-edited in dashboards.
- Rotation: any secret that ever appears in plaintext in a terminal shared with an AI agent, a log, or a screenshot is rotated same-day (see [11-security-privacy-and-compliance.md](11-security-privacy-and-compliance.md)).
- Enforcement: gitleaks pre-commit hook + CI (§9) blocks accidental plaintext secrets.

## 7. Branching, commits, and review

Sized for 2–3 people shipping tracer bullets, not a 50-person org.

- **Trunk-based.** `main` is always releasable (or explicitly red with a pinned issue). Short-lived branches: `feat/<module>-<slug>`, `fix/…`, `chore/…`, `spike/…`; target lifetime < 2 days, hard ceiling 5.
- **Small tracer-bullet PRs.** Prefer a thin end-to-end slice (contract → module → UI stub → test) over a wide horizontal layer. Guideline: < ~400 changed lines excluding generated files and lockfiles; larger PRs need a stated reason in the description.
- **File-size review threshold (NFR-TEAM-050, DEC-40):** production source files stay under **400 lines**; ESLint `max-lines` reports it as a **warning only** (tests and generated files exempt) and reviewers enforce it. An exception needs a one-line justification in the file or PR, or an ADR for a standing one; never split coherent code merely to satisfy the count.
- **Conventional Commits**, enforced by commit-lint hook: `feat(closet): …`, `fix(recommendation): …`, `chore(ci): …`. Scope = SPINE module name or `repo|ci|mobile|contracts|workers`. Breaking contract changes: `!` + `BREAKING CHANGE:` footer.
- **PR template:** [templates/pull-request.md](templates/pull-request.md) — summary, linked issue, scope/non-goals, evidence (test output, screenshots/recordings for UI, perf numbers for perf PRs), checklist (scoped checks run, contracts regenerated, PROGRESS.md updated if session-ending).
- **Review model:** every PR gets one human review; author merges after green CI + approval. Exceptions (docs-only, dependency bumps with green CI) may self-merge with post-hoc review noted in the PR. AI-authored PRs are **never** self-merged — a human reviews every agent PR.
- **Review SLA:** first response < 4 working hours; unblocking a red `main` preempts feature work. With 2–3 people, unreviewed-PR pileup is the top workflow risk — WIP limit of 2 open PRs per person.
- **CODEOWNERS** (by SPINE §3 module; with a small team this routes review, it doesn't gate):

```
/apps/api/src/modules/recommendation/  @dev-lead
/apps/api/src/modules/billing/         @dev-lead
/packages/contracts/                   @dev-lead        # any contract change gets the most senior eyes
/apps/mobile/src/render/               @3d-owner        # Filament boundary
/workers/                              @ml-owner
/planning/ /docs/adr/                  @dev-lead
*                                      @team            # default: anyone reviews
```

(Placeholder handles; assign real ones in P02.)

## 8. Decisions, readiness, and done

- **ADRs:** [templates/adr.md](templates/adr.md) → `docs/adr/NNNN-slug.md`. Required for: new dependency/provider, contract-shape changes, anything overriding SPINE (which also needs a decision-log entry in [16-risks-open-questions-and-decision-log.md](16-risks-open-questions-and-decision-log.md)), security-relevant design. The decision log in doc 16 indexes ADRs; agents must check it before reopening settled questions.
- **Definition of Ready** (issue may be picked up): written against [templates/issue.md](templates/issue.md) with scope, **non-goals**, dependencies, acceptance criteria (objectively checkable), test plan, observability additions, rollout + rollback notes; requirement IDs linked; no unresolved blocking dependency.
- **Definition of Done** (issue/PR may close): acceptance criteria demonstrably met (evidence in PR); tests in owning module's `tests/` pass, including a regression test that failed first for bug fixes; scoped checks + `just ci-parity` green; contracts/docs/PROGRESS.md updated; observability shipped with the feature (doc 14); flags/entitlement seams wired where the phase requires; no new TODOs without linked issues.

## 9. Dependency, vulnerability, and supply-chain policy

- **Renovate** (app, not cron scripts): weekly batched minor/patch PRs, immediate PRs for security advisories, majors one-per-PR with changelog link. `mise.toml` pins and GitHub Actions versions included. Automerge only for dev-dependency patches with green full CI.
- **Vulnerability scanning:** `osv-scanner` (covers npm + PyPI + GitHub Actions) in CI on every PR + nightly; `pnpm audit` as secondary. Failing severity threshold: high+ blocks merge; mediums get an issue with owner + deadline.
- **Secret scanning:** `gitleaks` in pre-commit **and** CI (history-aware on nightly). A leaked secret = rotate same day (§6) + incident note.
- **License / SBOM:** `syft` generates SBOM per release artifact (kept with release); license-checker gate denies GPL/AGPL in shipped mobile/backend bundles (Apache-2.0 Anny model is fine — attribution tracked in doc 07). Legal-flagged licenses go to the doc 16 legal-review register.
- **Supply chain:** committed lockfiles required (`pnpm-lock.yaml`, `uv.lock`); frozen-lockfile installs in CI; no `postinstall` scripts from new deps without review (`pnpm` config restricts build scripts to an allowlist); provenance/signature verification enabled where the registry provides it; new runtime dependency = ADR-lite justification in the PR description (what it replaces, why not stdlib/existing dep — the semantic-reuse rule applies to dependencies too).

## 10. Migrations, flags, and release channels

- **DB migrations:** policy owned by [06-data-api-and-event-contracts.md](06-data-api-and-event-contracts.md). Operationally here: drizzle-kit migrations are committed files, reviewed like code; expand→migrate→contract for anything touching live data; `just db-rollback` must be proven against staging before the corresponding deploy; destructive migrations need explicit human authorization (never agent-initiated — see CLAUDE.md).
- **Feature flags:** PostHog flags (SPINE §2). Every flag has: owner, creation date, expiry date, removal issue. Flags are for **rollout control**; paid capability gating uses **entitlements** (server-side, doc 12) — never a UI-only flag. Flag review monthly; expired flags fail a lint check.
- **Release channels:** `internal` (team devices; every merged `main`, auto) → `beta` (TestFlight + Play internal/closed testing; weekly-ish) → `production` **staged rollout** (Play staged %; iOS phased release) → full. **Crash gate:** promotion halts automatically if crash-free sessions drop below the doc 13 threshold (PostHog/Sentry signal); rollback = halt rollout + fix-forward or store rollback.
- **OTA limits (store policy, r2):** EAS Update may ship JS + assets only — no native module, permission, or native-config changes OTA. Any native change ⇒ full store build through channels. Release-readiness skill enforces the check.

## 11. Environments, data isolation, and seed data

- **Environments:** `local` (docker Postgres, fake providers by default) → `staging` (Neon branch/project, R2 staging bucket, sandbox RevenueCat, test store products) → `production`. Separate credentials, buckets, API keys per env — no shared resources, no prod credentials on workstations (§6).
- **Neon branching** gives cheap per-PR/preview databases for migration testing.
- **Privacy-safe seed data:** synthetic only. Generated personas (fake measurements within realistic bounds), CC0/owned garment photo fixtures, synthetic weather/holiday fixtures. **Never copy production user data anywhere**, including "anonymized" — body measurements and photos are sensitive (doc 11). Seeds live in `packages/seed-data` with factories reused by module tests (brief §5.4 fixtures rule).
- **Test accounts:** documented set in sops (`staging` file): one per tier (Free/Essentials/Plus/Pro), one mid-trial, one expired-trial, one deletion-requested; store sandbox tester accounts for IAP flows. Reset script: `just db-seed --accounts` (staging only).

## 12. AI-agent operations

The binding rules live in [CLAUDE.md](CLAUDE.md) (moves to repo root in P02); task-type procedures live in `.agents/skills/`. This section is the human-facing operating model.

### 12.1 Session workflow (every agent session)

1. **Orient:** read `PROGRESS.md`, the current phase file (`phases/P<NN>-….md`), and the module contract(s) for the modules in scope. Check the decision log (doc 16) for anything touching the task.
2. **Restate:** scope, non-goals, and acceptance criteria in the agent's own words *before* editing. Mismatch with the issue ⇒ ask, don't guess.
3. **Search before write** (§12.2).
4. **Implement** the smallest coherent change; match the relevant skill's workflow.
5. **Verify:** scoped checks (`just test <module>`, `just lint`, `just typecheck`, `just arch-check`, `just generate --check` when contracts touched) and paste real output as evidence.
6. **Close out:** update `PROGRESS.md` (status vocabulary defined there) + any owning doc changed by the work; write a handoff note ([templates/session-handoff.md](templates/session-handoff.md)) if the task continues; leave the repo buildable or report the precise failure with evidence.

### 12.2 Semantic reuse check (brief §5.3 — mandatory before adding anything)

Before adding a function, hook, component, service, mapper, validator, schema, constant, fixture, or job:

1. **Describe** the intended behavior in one sentence (not the intended name).
2. **Search by behavior and structure:** ripgrep for domain terms and synonyms; LSP workspace-symbol + references for related types; inspect the owning module's public API (`index.ts`) and its neighbors; check `shared-kernel` for constants/units/reason codes; check `packages/contracts` for schemas. A name-only grep is insufficient.
3. **Read the complete candidates** — not just signatures.
4. **Reuse or extend** the canonical implementation when it fits.
5. If new code is genuinely needed, **state in the PR why each candidate does not fit**.
6. Run `just arch-check` + lint (duplication rules) before completion.

Copy-and-diverge is banned; speculative generic abstraction is equally banned. One requirement, one obvious place to change.

### 12.3 Parallel agents

- Parallel sessions must own **disjoint file sets**, agreed before launch (natural seams: one module per agent; contracts change is its own task that others depend on).
- Use **git worktrees** for parallel work on one machine (`git worktree add ../app-<task> <branch>`) — one checkout per agent; never two agents in one working tree.
- Shared files (`packages/contracts`, `shared-kernel`, lockfiles, `mise.toml`, CI config) are single-writer: sequence those tasks, don't parallelize them.
- Merge order: contracts/schema producers land before consumers rebase.

### 12.4 Session handoff

Any session ending with work in flight writes [templates/session-handoff.md](templates/session-handoff.md): exact state (branch, last green command, failing command + output if red), what was done vs. remaining acceptance criteria, decisions made (with ADR links if durable), the next session's first action, and files touched. `PROGRESS.md` links the handoff. "It's basically done" is not a handoff.

### 12.5 Recommended tooling (recommendations, not requirements)

- **Claude Code** with this repo's `CLAUDE.md` + `.agents/skills/` is the reference setup; any agent tooling must obey the same contract.
- **MCP servers worth adding:** `context7` (current library docs — Expo/Filament/Drizzle/Trigger.dev move fast; CLAUDE.md requires consulting current docs) and a read-only **Postgres MCP** pointed at local/staging for schema inspection during migration work. Evaluate others via ADR; each MCP server is an attack/typo surface, keep the list short.
- **Model tiers for cost:** cheap/fast models for mechanical work (renames, fixture generation, applying a settled pattern across files, commit messages); top-tier models for architecture, recommendation-engine rules, security-sensitive code, and anything touching contracts. Batch mechanical tasks per §12.3 fan-out. Track agent spend the same way we track provider AI spend (doc 10): it is a real unit cost.

### 12.6 Human responsibilities that never delegate to agents

Merging to `main`, approving destructive DB/cloud/git operations, rotating secrets, store submissions, changing this workflow doc or CLAUDE.md, and accepting a phase's Definition of Done.
