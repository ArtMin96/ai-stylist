# s3 — Agent Operating Foundation (skills, agents, rules, hooks, docs enforcement)

> Status: EXECUTED 2026-09-13 (commit 2592485; `planning/PROGRESS.md` handoff "2026-09-13 — Agent
> operating foundation"). The roster below is SUPERSEDED by ADR-0004 (native iOS and Android): the
> mobile-feature and native-3d-assets skills, the mobile-engineer and render-3d-engineer agents, the
> mobile.md and render-3d.md rules, the `mobile` test route and apps/mobile no longer exist. Current
> roster: `.agents/skills/README.md`, `.claude/agents/README.md`, `.claude/rules/`. The C1–C12 boxes
> were never ticked. Still open: the C4 hook-fixture proof (nothing ran `tools/docs/fixtures/hooks/`
> until the 2026-09-25 foundation fix wires it into `just docs-check --fixtures`) and C9's automated
> trigger scores (never produced). The meta-skills named below are not installed: use
> `anthropic-skills:skill-creator` for skills and `templates/agent.md` for agents. Do not re-execute.

**Scope:** full plan — 22 skills, 13 agents, 11 path-scoped rule files, 5 hooks, 5 new `just` recipes,
a `docs-check` gate, and two human-approval proposals. Multi-file, shared structure, parallelizable.

**Grounding (files actually read):**
`/tmp/.../scratchpad/research-best-practices.md` (official skills/agents/hooks/memory docs, 7-layer
strategy, anti-patterns) · `/tmp/.../scratchpad/audit-current-setup.md` (full, incl. §7 enforcement
gaps and §8 recommendations) · `CLAUDE.md` (root) · `.agents/skills/README.md` ·
`.agents/skills/backend-module/SKILL.md` · `.claude/agents/README.md` · `.claude/agents/api-engineer.md` ·
`planning/15-team-workflow-and-ai-agent-operations.md` §5 (canonical `just` catalog) · `justfile`
(lines 1–220, incl. `test`, `lint`, `ci-parity`, `db-*`) · `.github/workflows/pr-gate.yml` (job list) ·
`PROGRESS.md` · directory listings for `apps/api/src/{modules,platform,jobs,tests}`, `apps/mobile/src`,
`apps/mobile/e2e`, `workers/`, `docs/{modules,adr}`, `templates/`, `.claude/{agents,skills,plans}`,
`packages/db/package.json`.

**Meta-skills verified on disk (implementers must invoke them):**
- `Skill(skill-creator:skill-creator)` →
  `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator/SKILL.md`.
  Bundled scripts confirmed present: `scripts/{run_loop,run_eval,improve_description,aggregate_benchmark,quick_validate,package_skill}.py`,
  `eval-viewer/generate_review.py`, `assets/eval_review.html`, `agents/{grader,comparator,analyzer}.md`.
  Required: description is the *only* trigger mechanism and must be "a little bit pushy"; all
  when/when-not lives in `description`, not the body; SKILL.md < 500 lines; progressive disclosure via
  `references/`; `evals/evals.json` with 2–3 realistic task prompts; a separate 20-query trigger set
  (8–10 should-trigger, 8–10 genuinely tricky near-miss negatives) for
  `python -m scripts.run_loop --eval-set … --skill-path … --model <session model> --max-iterations 5`.
- `Skill(create-agents)` → `~/.claude/skills/create-agents/SKILL.md`. Required: `tools` is mandatory and
  minimal; `description` ≤ 1024 chars with specific trigger keywords and a NOT-for clause; body uses XML
  tags (`<context> <instructions> <constraints> <output_format> <examples>`); rules must be motivated;
  at least one worked example; allow `[NEEDS CLARIFICATION]`. Its `reference.md`/`templates.md`/`examples.md`
  are **absent** on this machine — do not cite them.

---

## Contract

Acceptance criteria — each is checkable by running a command or reading a named file.

- [ ] **C1** `just docs-check` exists, is shellcheck-clean, runs in CI via `just ci-parity`, and exits 0 on
      the finished branch. `just docs-check --fixtures` proves every check fails on its fixture.
- [ ] **C2** `just docs-check` fails (exit 1) if any of these are broken: module↔contract bijection, the 8
      module-contract headings, ADR file↔index sync, skills/agents README↔directory sync, root
      `PROGRESS.md` current-phase line vs `planning/PROGRESS.md` table, a `last-reviewed` date older than
      180 days, a backticked repo path that does not exist, a `just <recipe>` that is not in `just --summary`,
      or a raw `pnpm --filter` / `uv run` / `npx` / `drizzle-kit` / `eas ` invocation inside
      `.agents/skills/**`, `.claude/agents/**`, `.claude/rules/**`.
- [ ] **C3** Every broken reference in audit §3.1 is gone: `apps/api/src/jobs/index.ts` (2 skills),
      `apps/mobile/src/lib/README.md`, `assets/3d/**`, the two migration filenames, and "generate the
      migration with `just db-*`". Proof: `just docs-check` green + `git grep -n 'jobs/index.ts' .agents .claude`
      returns nothing.
- [ ] **C4** `.claude/settings.json` is committed and contains five working hooks whose scripts live in
      `scripts/hooks/*.sh`: PreToolUse path guard (generated files, `CLAUDE.md`, `planning/SPINE.md`,
      `planning/15-*.md`, lockfiles, `secrets/**`, `.github/workflows/**`, test files outside `tests/`),
      PreToolUse Bash guard, PostToolUse scoped lint, Stop PROGRESS gate, SessionStart orientation print.
      Proof: `bash scripts/hooks/<name>.sh < tools/docs/fixtures/hooks/<case>.json` returns the documented
      decision for each of the ≥10 fixture cases, and `just lint` (shellcheck) is green.
- [ ] **C5** 22 skills exist under `.agents/skills/<name>/SKILL.md`, each with the six NFR-TEAM-100
      sections + Overlap, each < 500 lines, each symlinked from `.claude/skills/<name>`, each with
      `metadata.last-reviewed`, each description containing concrete trigger phrases **and** at least one
      negative trigger ("Not for … — use `<other>` instead"), and `len(name)+len(description) <= 1536`.
- [ ] **C6** 13 agents exist under `.claude/agents/<name>.md`, each with `name`, a ≤1024-char `description`
      containing trigger phrases + a NOT-for clause, a minimal `tools` allowlist with no bare
      `Bash(pnpm:*)` / `Bash(uv:*)` / `Bash(docker compose:*)`, XML-tagged body sections, ≥1 worked
      example, and a `Last reviewed: YYYY-MM-DD` line.
- [ ] **C7** All 15 SPINE modules are covered: each module name resolves either to a
      `.agents/skills/*/references/<module>.md` file or to a skill whose frontmatter `metadata.modules`
      names it, **and** appears in exactly one row of the coverage table in `.agents/skills/README.md`
      naming an existing skill and an existing agent. Enforced by `docs-check` DC-08.
- [ ] **C8** Every skill directory has `evals/evals.json` (2–3 realistic task prompts with assertions) and
      `evals/trigger-evals.json` (20 queries, 8–10 `should_trigger: true`, 8–10 near-miss negatives).
- [ ] **C9** The 9 new skills have been through `scripts/run_loop.py`; the winning `best_description` is
      applied and the per-skill train/test trigger scores are recorded in the T21 report.
- [ ] **C10** `.claude/rules/*.md` carries every new rule that would otherwise need a `CLAUDE.md` edit, with
      `paths:` frontmatter, and duplicates nothing already in root `CLAUDE.md`.
- [ ] **C11** `.claude/plans/s3-claude-md-proposal.md` and `.claude/plans/s3-doc15-proposal.md` contain
      copy-pasteable diffs for the human; **no commit in this plan modifies `CLAUDE.md`, `planning/SPINE.md`,
      or `planning/15-*.md`.** Proof: `git diff --name-only main...HEAD` lists none of them.
- [ ] **C12** `just lint`, `just typecheck`, `just arch-check`, `just docs-check`, `just ci-parity` are green
      on the final branch, with real pasted output; `planning/PROGRESS.md` has a handoff entry and the root
      `PROGRESS.md` current-phase line matches it.

**Must not change:** root `CLAUDE.md`; `planning/SPINE.md`; `planning/15-*.md`; any planning doc prose;
`.github/workflows/**` (CI required checks are human-only — `docs-check` reaches CI through `ci-parity`,
which `pr-gate.yml` already calls); generated output (`packages/contracts/gen/**`, `workers/ml/generated/**`,
`packages/db/migrations/meta/**`); lockfiles; existing production TypeScript/Python behaviour; the six
NFR-TEAM-100 section names; the `.agents/skills/` + `.claude/skills/` symlink layout.

**Out of scope (do not gold-plate):** implementing `clone-check` (NFR-TEAM-040) or the `expired-flags`
nightly placeholder; real `CODEOWNERS` handles; branch protection; renaming `planning/CLAUDE.md`
(proposal only); a `feature-flags-rollout` standalone skill (reference file for now — see Open questions);
new CI jobs (`progress-ledger`, `contract-doc-sync`, `security-review-required`); MCP servers; filling in
`docs/modules/*.md` public-interface tables with real API surface (that is phase work).

---

## Risks & decisions

- **CLAUDE.md is human-only.** All new binding rules land in `.claude/rules/*.md` (path-scoped, loaded when
  an agent touches matching files) plus deterministic hooks. Rejected alternative: editing `CLAUDE.md`
  directly — explicitly prohibited, and the operating contract is the one file that must stay trustworthy.
- **`docs-check` is wired into `ci-parity` in Wave 1, so `just ci-parity` is expected RED between Wave 1 and
  Wave 4.** That is deliberate: Wave 1's `docs-check` output is the authoritative worklist for Wave 2, and a
  gate nobody can bypass is the point of the exercise. Do not open a PR before Wave 4 is green.
- **Two checks depend on human-approved edits** (`CLAUDE.md` layout block, doc 15 §5 catalog). They are
  WARN-only by default and become errors under `just docs-check --strict`, so the branch can be green before
  the human applies the proposals. The proposal files say to flip `--strict` on afterwards.
- **Audit correction:** `just mobile-ios-submit` is *not* called by CI — it appears only as a TODO comment in
  `.github/workflows/ios-eas.yml:81`. Do **not** add a recipe for it. `docs-check` DC-10 must ignore comment
  lines, or it will manufacture this bug.
- **`metadata` in frontmatter is documented for skills, not for agents.** Skills get
  `metadata: {modules, last-reviewed, owner-agent}`; agents get a plain `Last reviewed: YYYY-MM-DD` body line.
  Inventing an undocumented agent frontmatter key risks a parse warning on every session.
- **`docs-maintainer` and `test-engineer` overlap engineer agents in *repo* file terms** (module contracts,
  `tests/`). Resolved by a concurrency rule, not a partition: they never run in the same wave as the engineer
  agent that owns those modules. Stated in both agent bodies and `.claude/agents/README.md`.
- **Stop hook loop risk.** `session-close-check.sh` must read `stop_hook_active` from the hook payload and
  exit 0 when it is true, and honour `AGENT_SKIP_PROGRESS_GATE=1`. Verify the field name against
  https://code.claude.com/docs/en/hooks before wiring; if it is absent, use a run-once marker file under
  `.git/` instead. A Stop hook that blocks forever is worse than no gate.
- **PostToolUse lint must stay fast.** It calls a new `just lint-file <path>` (single-file dispatch), not
  `just lint` (whole-repo turbo). Exit 2 only on errors, never on warnings, with a 30 s timeout.
- **22 skills' metadata loads every session** (~100 tokens each ≈ 2.2 k). Accepted: that is the documented
  cost of progressive disclosure, and per-module detail sits in `references/` which loads only on demand.
- **`skills:` frontmatter preloading is now possible** (the `.claude/skills/` symlinks make skills
  discoverable), contradicting the "not auto-loaded" sentence in all nine agent bodies. Each agent task must
  delete that sentence; use `skills:` only after confirming it resolves for a symlinked project skill —
  otherwise keep the explicit "read `.agents/skills/<name>/SKILL.md` first" step.

---

## Roster settled here (Wave 2 tasks are told this; they never need to inspect each other)

**Skills (22).** Existing, rewritten: `api-contract-change`, `architecture-review`, `backend-module`,
`db-migration`, `entitlements-billing`, `media-ml-pipeline`, `mobile-feature`, `native-3d-assets`,
`performance-profiling`, `recommendation-rules`, `release-readiness`, `security-privacy-review`,
`testing-regression`. New (9): `docs-maintenance`, `data-lifecycle`, `observability-analytics`,
`tooling-ci`, `e2e-device-testing`, `notifications-delivery`, `admin-moderation`,
`fashion-intel-ingestion`, `assistant-chat`.

**Agents (13).** Existing, rewritten: `api-engineer`, `mobile-engineer`, `platform-engineer`,
`contracts-engineer`, `ml-engineer`, `recommendation-engineer`, `tooling-engineer`,
`security-privacy-reviewer`, `architecture-reviewer`. New (4): `render-3d-engineer`, `release-manager`,
`docs-maintainer`, `test-engineer`.

**Module → owner map (this is the coverage table T19 writes into `.agents/skills/README.md`):**

| Module | Skill | Where the module detail lives | Agent |
|---|---|---|---|
| identity | `backend-module` | `backend-module/references/identity.md` | `api-engineer` |
| profile | `backend-module` | `backend-module/references/profile.md` | `api-engineer` |
| avatar | `backend-module` (+ `native-3d-assets` for render) | `backend-module/references/avatar.md` | `api-engineer` / `render-3d-engineer` |
| closet | `backend-module` | `backend-module/references/closet.md` | `api-engineer` |
| media | `backend-module` (+ `media-ml-pipeline` for jobs) | `backend-module/references/media.md` | `api-engineer` / `platform-engineer` / `ml-engineer` |
| outfit | `backend-module` | `backend-module/references/outfit.md` | `recommendation-engineer` |
| context | `backend-module` | `backend-module/references/context.md` | `recommendation-engineer` |
| platform | `backend-module` | `backend-module/references/platform.md` | `platform-engineer` |
| shared-kernel | `api-contract-change` | `api-contract-change/references/shared-kernel.md` | `contracts-engineer` |
| recommendation | `recommendation-rules` | `recommendation-rules/references/recommendation.md` | `recommendation-engineer` |
| billing | `entitlements-billing` | `entitlements-billing/references/billing.md` | `api-engineer` |
| notifications | `notifications-delivery` | SKILL.md + `metadata.modules: "notifications"` | `api-engineer` |
| admin | `admin-moderation` | SKILL.md + `metadata.modules: "admin"` | `api-engineer` |
| fashion-intel | `fashion-intel-ingestion` | SKILL.md + `metadata.modules: "fashion-intel"` | `recommendation-engineer` |
| assistant | `assistant-chat` | SKILL.md + `metadata.modules: "assistant"` | `api-engineer` |

---

### Tasks

All tasks below use the repo task format (goal, exclusive write set, inputs, steps,
validation, wave). Everything inside a wave runs in parallel; waves run in order.

**Wave 1 — foundation (T1–T5 have disjoint write sets; safe to run concurrently)**

Nothing in Wave 2 may start before all five land: Wave 2 tasks call `just docs-check <path>` for
verification, use the templates from T5, and cite the rules from T4.

#### T1 — `just` recipes: `docs-check`, `db-generate`, `test-regression`, `lint-file`, scoped `test`

- **Wave:** 1
- **Owns (exclusive write):** `justfile`, `scripts/db/generate.sh`, `scripts/test/regression.sh`,
  `scripts/lint-file.sh`
- **May read:** `packages/db/package.json`, `packages/db/drizzle.config.ts`, `scripts/lib.sh`,
  `scripts/doctor.sh`, `planning/15-team-workflow-and-ai-agent-operations.md` §5, `.github/workflows/pr-gate.yml`
- **Do:**
  1. Add `docs-check *args:` → `scripts/docs/docs-check.sh "$@"` (script is T2's file; do not create it).
     Comment it exactly like the other gates, with the `*` prefix marking it part of `ci-parity`.
  2. Add `db-generate name:` → wraps `drizzle-kit generate` for `packages/db` (the package already exposes
     `migration:generate`). **Verify the current `drizzle-kit generate` flag for naming a migration against
     official Drizzle docs (context7) before writing it** — do not guess. The recipe must print a reminder
     that a matching `packages/db/migrations/down/<idx>.sql` is required by `just db-rollback`.
  3. Add `test-regression file:` → `scripts/test/regression.sh "$@"`. Script contract: run the named test at
     the merge-base in a throwaway `git worktree`, expect **failure**; run it at HEAD, expect **pass**;
     print both raw outputs; exit 1 if either expectation is violated. This makes CLAUDE.md's
     "regression test fails before the fix" structural instead of prose.
  4. Add `lint-file path:` → `scripts/lint-file.sh` dispatching by extension: `.ts/.tsx/.mjs/.cjs` →
     `pnpm exec eslint --max-warnings=0 <path>`; `.py` → `uv run --project workers ruff check <path>`;
     `.sh` → `shellcheck -s bash -x -P SCRIPTDIR <path>`; anything else → exit 0 silently. Used by the
     PostToolUse hook, so it must finish well under 30 s and print nothing when clean.
  5. Extend the existing `test module=''` case block with `mobile)` → the mobile workspace test command and
     `workers)` → the workers pytest command, so no skill or agent needs a raw `pnpm`/`uv` invocation.
  6. Extend the `shellcheck` line in `lint` with `scripts/docs/*.sh scripts/hooks/*.sh scripts/test/*.sh
     scripts/db/*.sh scripts/lint-file.sh`.
  7. Insert `just docs-check` into `ci-parity` immediately after `just arch-check --fixtures`.
- **Contract it establishes (Wave 2+ depend on exactly this):**
  `just docs-check [--strict] [--fixtures] [PATH...]` · `just db-generate <name>` ·
  `just test-regression <test-file>` · `just lint-file <path>` · `just test mobile` · `just test workers`.
  Every skill and agent written later cites these names verbatim.
- **Verify:** `just --summary | tr ' ' '\n' | grep -E '^(docs-check|db-generate|test-regression|lint-file)$'`
  → four lines. `just lint-file scripts/lint-file.sh` → exit 0. `just test-regression --help` → usage, exit 0.
  `bash -n scripts/**/*.sh`. (`just docs-check` itself is not runnable until T2 lands — expected.)

#### T2 — `scripts/docs/docs-check.sh` + fixtures (the enforcement engine)

- **Wave:** 1
- **Owns (exclusive write):** `scripts/docs/docs-check.sh`, `scripts/docs/lib/*.sh` (if split),
  `tools/docs/fixtures/**`, `tools/docs/planned-paths.txt`
- **May read:** `templates/module-contract.md`, `docs/modules/*.md`, `docs/adr/README.md`,
  `.agents/skills/**`, `.claude/agents/**`, `PROGRESS.md`, `planning/PROGRESS.md`, `justfile`,
  `tools/eslint/check-fixtures.sh` (fixture-runner house style), `scripts/lib.sh`
- **Do:** write a bash-3.2-clean, shellcheck-clean checker. Interface:
  `docs-check.sh [--strict] [--fixtures] [PATH...]`; exit 0 = pass (warnings allowed), 1 = error,
  2 = usage error. With `PATH...` only the file-scoped checks (DC-05, DC-07, DC-09, DC-10, DC-11) run, and
  only for those paths — this is what makes every Wave 2 task independently verifiable. Output one line per
  finding: `<LEVEL> <CHECK-ID> <file>:<line> <message>`.
  - **DC-01** `apps/api/src/modules/*` ∪ {`platform`,`shared-kernel`} ↔ `docs/modules/*.md` bijection.
  - **DC-02** every `docs/modules/*.md` has the 8 headings from `templates/module-contract.md`, in order.
  - **DC-03** every contract has `Status:` ∈ {skeleton, draft, ratified} and `Last updated: YYYY-MM-DD` not
    older than `git log -1 --format=%cs -- apps/api/src/modules/<m>/index.ts apps/api/src/modules/<m>/internal/schema.ts`.
  - **DC-04** `docs/adr/NNNN-*.md` ↔ rows in `docs/adr/README.md`, both directions.
  - **DC-05** each `.agents/skills/*/SKILL.md`: `name` == directory name; `description` present, 1–1024
    chars, `len(name)+len(description) <= 1536`, contains a negative-trigger marker (`Not for` / `NOT for`);
    `metadata.last-reviewed` present and ≤ 180 days old; the six section headings + `## Overlap`; ≤ 500 lines.
  - **DC-06** `.agents/skills/README.md` table rows ↔ skill directories; `.claude/skills/<name>` exists,
    is a symlink, and resolves.
  - **DC-07** each `.claude/agents/*.md`: `name`/`description`/`tools` present; description ≤ 1024;
    `Last reviewed:` line ≤ 180 days; no bare `Bash(pnpm:*)`, `Bash(uv:*)`, `Bash(docker compose:*)`;
    README rows ↔ files.
  - **DC-08** each of the 15 SPINE module names resolves to a `references/<module>.md` under some skill **or**
    a skill whose `metadata.modules` names it, and appears in exactly one coverage-table row in
    `.agents/skills/README.md` whose skill and agent both exist.
  - **DC-09** every backticked repo-relative path in `.agents/skills/**`, `.claude/agents/**`,
    `.claude/rules/**` exists, unless listed with a phase id in `tools/docs/planned-paths.txt`
    (seed it with `assets/3d/` → P04-T01, `apps/api/src/jobs/index.ts` → P02-T08).
  - **DC-10** every `just <recipe>` token in those files is in `just --summary`. **Skip lines whose first
    non-space character is `#`** — `just mobile-ios-submit` exists only as a TODO comment in
    `.github/workflows/ios-eas.yml` and must not be reported.
  - **DC-11** no `pnpm --filter`, `uv run`, `npx `, `drizzle-kit `, `eas ` in those files (a `just` recipe is
    the only sanctioned entry point, doc 15 §5).
  - **DC-12** root `PROGRESS.md` "Current phase" phase id + status == the matching row in
    `planning/PROGRESS.md`'s phase table.
  - **DC-13** banned stale vendor names (`Trigger.dev`, `Neon`, `Railway`) absent from `.agents/**`,
    `.claude/**`, `docs/**`, `justfile` (planning/ and the decision log are exempt — they record history).
  - **DC-14 (WARN unless `--strict`)** every path in the root `CLAUDE.md` layout block exists, and every
    non-dot top-level directory appears in that block.
  - **DC-15 (WARN unless `--strict`)** doc 15 §5 recipe table == `just --summary`.
  Add `--fixtures`: `tools/docs/fixtures/<check-id>/` each violating exactly one check; the runner asserts
  each fixture fails with its own id and that a clean fixture passes. Also create
  `tools/docs/fixtures/hooks/*.json` — ≥10 hook payload fixtures (protected path, generated file, lockfile,
  test file outside `tests/`, allowed path, `pnpm add`, `gh pr merge`, allowed bash, Stop with dirty source
  tree and no PROGRESS change, Stop with `stop_hook_active: true`) for T3 to test against.
- **Contract it establishes:** the CLI above, the finding format, the check ids DC-01…DC-15, and the
  fixture directory layout.
- **Verify:** `bash scripts/docs/docs-check.sh --fixtures` → every fixture fails on its own id, exit 0.
  `shellcheck -s bash -x -P SCRIPTDIR scripts/docs/*.sh` → clean. `bash scripts/docs/docs-check.sh` on the
  current tree → reports the known drift (jobs/index.ts, src/lib/README.md, assets/3d, migration filenames,
  missing six-section metadata, README gaps); save that output as the Wave 2 worklist.

#### T3 — `.claude/settings.json` + five hook scripts

- **Wave:** 1
- **Owns (exclusive write):** `.claude/settings.json`, `scripts/hooks/guard-protected-paths.sh`,
  `scripts/hooks/guard-bash.sh`, `scripts/hooks/post-edit-lint.sh`,
  `scripts/hooks/session-close-check.sh`, `scripts/hooks/session-start.sh`
- **May read:** `/tmp/.../scratchpad/research-best-practices.md` §5, audit §7, `.claude/settings.local.json`,
  `~/.claude/settings.json` (global hooks already exist — project hooks are additive, do not fight them),
  `scripts/lib.sh`, `PROGRESS.md`, `planning/PROGRESS.md`
- **Do:** **Confirm the hook event names, matcher syntax, JSON payload fields, and exit-code semantics
  against https://code.claude.com/docs/en/hooks before writing** (fetch it; do not rely on the research
  summary alone). Then:
  1. `guard-protected-paths.sh` — `PreToolUse`, matcher `Edit|Write|MultiEdit|NotebookEdit`. Deny with a
     reason naming the correct route when the target matches: `packages/contracts/gen/**`,
     `workers/ml/generated/**`, `packages/db/migrations/meta/**` (→ "run `just generate`, never hand-edit"),
     `CLAUDE.md`, `planning/SPINE.md`, `planning/15-*.md` (→ "human-authorized only; write a proposal under
     `.claude/plans/`"), `pnpm-lock.yaml`, `workers/uv.lock`, `secrets/**`, `.sops.yaml`,
     `.github/workflows/**`, and `*.test.ts|*.spec.ts|test_*.py` outside a `tests/` or `e2e/` directory
     (→ "tests live in the owning module's `tests/`"). Escape hatch: `AGENT_MAY_EDIT_POLICY=1`.
  2. `guard-bash.sh` — `PreToolUse`, matcher `Bash`. Deny `pnpm add|remove|update`, `uv add|remove`,
     `drizzle-kit push`, `gh pr merge`, `git push * --delete`, `git push * :*`, `eas submit`,
     `just secrets-sync staging|prod`, `gh api -X DELETE`. Each denial explains why and what to do instead.
  3. `post-edit-lint.sh` — `PostToolUse`, matcher `Edit|Write|MultiEdit`. Call `just lint-file <path>`
     (T1's recipe); on error, exit 2 with the lint output so the model fixes it immediately; on clean or
     unsupported extension, exit 0 silently. 30 s timeout. Additionally, when the edited path matches
     `apps/api/src/modules/*/index.ts`, `*/internal/schema.ts`, `packages/contracts/events/**`, or
     `packages/contracts/openapi/modules/*.yaml`, print (non-blocking) "`docs/modules/<m>.md` must change in
     this PR — run `just docs-check`".
  4. `session-close-check.sh` — `Stop`. If `git status --porcelain` shows changes under
     `apps/|packages/|workers/|tools/|scripts/|justfile` and neither `PROGRESS.md` nor
     `planning/PROGRESS.md` is modified, block once with the path to `templates/session-handoff.md`.
     **Guard against re-entry with the payload's `stop_hook_active` flag** and honour
     `AGENT_SKIP_PROGRESS_GATE=1`.
  5. `session-start.sh` — `SessionStart`. Print the root `PROGRESS.md` "Current phase" block, the newest
     handoff heading from `planning/PROGRESS.md`, `git status -sb`, and one line pointing at
     `.agents/skills/README.md` + `.claude/agents/README.md`. Read-only; never exits non-zero.
  6. `.claude/settings.json`: register the five hooks with `${CLAUDE_PROJECT_DIR}`-relative commands, and add
     a `permissions.deny` list mirroring the Bash guard (defence in depth — the guard covers piped/compound
     commands the permission matcher misses). Do not touch `.claude/settings.local.json`.
- **Contract it establishes:** hook script paths and their exit-code semantics; the
  `AGENT_MAY_EDIT_POLICY` / `AGENT_SKIP_PROGRESS_GATE` escape hatches that T4's rules and T20's proposal
  both document.
- **Verify:** for each fixture in `tools/docs/fixtures/hooks/*.json` (T2's file; if T2 has not landed yet,
  write the payloads inline in a scratch dir and hand the list to T2 in your report):
  `bash scripts/hooks/<script>.sh < <fixture>.json` → the documented decision, ≥10 cases. Then
  `shellcheck -s bash -x -P SCRIPTDIR scripts/hooks/*.sh` → clean, and
  `python3 -c 'import json;json.load(open(".claude/settings.json"))'` → no error.

#### T4 — `.claude/rules/*.md` path-scoped rules (where the new rules live, since CLAUDE.md is frozen)

- **Wave:** 1
- **Owns (exclusive write):** `.claude/rules/api-modules.md`, `.claude/rules/platform-jobs.md`,
  `.claude/rules/db-schema.md`, `.claude/rules/contracts.md`, `.claude/rules/mobile.md`,
  `.claude/rules/render-3d.md`, `.claude/rules/workers-python.md`, `.claude/rules/tests.md`,
  `.claude/rules/docs-and-progress.md`, `.claude/rules/agent-authoring.md`, `.claude/rules/tooling-ci.md`
- **May read:** root `CLAUDE.md`, `tools/depcruise/rules.cjs`, `tools/eslint/**`, audit §7,
  research doc §6 "Path-Scoped Rules"
- **Do:** each file gets `---\npaths:\n  - "<glob>"\n---` frontmatter and stays ≤ 60 lines. Content rule:
  **do not restate root `CLAUDE.md`** (duplication is a documented anti-pattern and a maintenance trap);
  each file answers only four questions for its paths — which skill to run, which agent owns the write set,
  the exact `just` command that proves the change, and the two or three invariants that actually bite here
  with the lint/arch rule that catches each. Globs:
  `api-modules.md` → `apps/api/src/modules/**` · `platform-jobs.md` → `apps/api/src/platform/**`,
  `apps/api/src/jobs/**` · `db-schema.md` → `**/internal/schema.ts`, `packages/db/**` ·
  `contracts.md` → `packages/contracts/**`, `packages/shared-kernel/**` · `mobile.md` →
  `apps/mobile/src/**` · `render-3d.md` → `apps/mobile/src/render/**`, `assets/3d/**` ·
  `workers-python.md` → `workers/**` · `tests.md` → `**/tests/**`, `apps/mobile/e2e/**` ·
  `docs-and-progress.md` → `docs/**`, `PROGRESS.md`, `planning/PROGRESS.md`, `planning/phases/**` ·
  `agent-authoring.md` → `.agents/skills/**`, `.claude/agents/**`, `.claude/rules/**`, `.claude/settings.json` ·
  `tooling-ci.md` → `justfile`, `scripts/**`, `tools/**`, `mise.toml`.
  `agent-authoring.md` additionally states the house standard every Wave 2 task follows: six sections +
  Overlap, description carries triggers and negatives, `Skill(skill-creator:skill-creator)` for skills,
  `Skill(create-agents)` for agents, evals required, `just docs-check <path>` before claiming done.
  `docs-and-progress.md` states the docs-maintainer concurrency rule and the "propose, never edit" rule for
  `CLAUDE.md` / SPINE / doc 15.
- **Verify:** `just docs-check .claude/rules` → exit 0 for DC-09/DC-10/DC-11 (no dead paths, no unknown
  `just` recipes, no raw tool invocations). `head -5` of each file shows valid `paths:` frontmatter.
  Every glob matches ≥1 existing file: `git ls-files | grep -E <glob-as-regex>` non-empty (except
  `assets/3d/**`, which is listed in `tools/docs/planned-paths.txt`).

#### T5 — authoring templates (the house style Wave 2 copies from)

- **Wave:** 1
- **Owns (exclusive write):** `templates/skill.md`, `templates/agent.md`, `templates/module-reference.md`,
  `templates/skill-evals.json`, `templates/skill-trigger-evals.json`
- **May read:** `.agents/skills/backend-module/SKILL.md` and `.agents/skills/security-privacy-review/SKILL.md`
  (graded A in the audit — the house style), `.claude/agents/api-engineer.md`, `templates/module-contract.md`,
  both meta-skill SKILL.md files, research doc §3, §4, §7
- **Do:**
  1. `templates/skill.md` — frontmatter block:
     `name` (== directory), `description` (what it does + concrete trigger phrases the user would actually
     type + at least one `Not for … — use \`<skill>\` instead`; "pushy" per skill-creator; keep
     `len(name)+len(description) <= 1536`), `metadata: {modules: "<comma list or empty>", last-reviewed:
     "<YYYY-MM-DD>", owner-agent: "<agent>"}`. Body: `## Trigger`, `## Required reading`, `## Workflow`,
     `## Validation commands`, `## Output`, `## Stop / escalation`, `## Overlap` — the six NFR-TEAM-100
     sections plus Overlap, unchanged. Annotate each slot with what good looks like: exact `just` commands
     only, no raw tool invocations, every referenced path must exist or be in
     `tools/docs/planned-paths.txt`, ≤ 500 lines, per-module detail goes to `references/<module>.md`.
  2. `templates/agent.md` — frontmatter `name`, `description` (≤1024, triggers + owned paths + NOT-for),
     `tools` (minimal; narrow Bash to the subcommands actually used, e.g.
     `Bash(just:*)` plus read-only git, never bare `Bash(pnpm:*)`), optional `model`, optional `color`.
     Body with XML tags: `<context>`, `<ownership>` (exclusive write set / never write),
     `<instructions>` (orient → restate → search before write → implement → verify),
     `<constraints>` (motivated, not ALL-CAPS), `<examples>` (≥1 worked example),
     `<output_format>` (the existing report block, which already includes
     "Suggested PROGRESS.md line"), and a final `Last reviewed: YYYY-MM-DD` line.
  3. `templates/module-reference.md` — headings, in order: `# <module> — module reference`,
     `Last reviewed:`, `## Contract summary` (link `docs/modules/<m>.md`), `## Invariants that bite`,
     `## Key files`, `## Owned data`, `## Events`, `## Allowed / forbidden edges`, `## Test command`
     (`just test <module>`), `## Phase tasks that touch this module`, `## Escalate when`. Target 40–70 lines.
  4. `templates/skill-evals.json` — the skill-creator `evals.json` shape (`skill_name`, `evals[]` with
     `id`, `prompt`, `expected_output`, `files`, `assertions`) with a filled AI-Stylist example.
  5. `templates/skill-trigger-evals.json` — 20-entry `[{"query": …, "should_trigger": bool}]` array with two
     worked examples showing what a *good* near-miss negative looks like (shares vocabulary, needs a
     different skill) versus a useless one.
- **Contract it establishes:** the exact frontmatter keys, section names, and eval file shapes that
  DC-05/DC-07/DC-08 enforce and that all 13 Wave 2 tasks copy.
- **Verify:** `just docs-check templates` → exit 0. `python3 -c "import json;[json.load(open(p)) for p in
  ['templates/skill-evals.json','templates/skill-trigger-evals.json']]"` → no error. Manually confirm
  `templates/skill.md`'s example frontmatter satisfies the 1536-char rule.

---

**Wave 2 — skills and agents (T6–T18: 13 tasks, disjoint write sets, safe to run concurrently)**

**Every Wave 2 task, without exception:**
1. Invoke `Skill(skill-creator:skill-creator)` before writing or rewriting any SKILL.md, and
   `Skill(create-agents)` before writing or rewriting any agent file. Follow their workflows (capture
   intent → draft → 2–3 realistic task prompts in `evals/evals.json` with assertions → 20-query
   `evals/trigger-evals.json`). Running the full eval subagent loop per skill is **not** required here —
   T21 runs the trigger-optimization loop centrally — but the eval files must be real and specific
   (file paths, module names, backstory), not placeholders.
2. Copy structure from `templates/skill.md` / `templates/agent.md` / `templates/module-reference.md` (T5).
3. Read `docs/modules/<module>.md`, the relevant `planning/phases/P*.md` §12 rows, and the current file you
   are rewriting. Preserve every accurate sentence; this is a sharpening pass, not a rewrite from zero.
4. Use **only** `just` commands in validation blocks, from the T1 contract:
   `just test <module>` · `just test mobile` · `just test workers` · `just test-regression <file>` ·
   `just lint` · `just typecheck` · `just arch-check` · `just generate --check` · `just db-generate <name>` ·
   `just db-migrate` · `just db-rollback` · `just docs-check` · `just assets-validate` · `just ml-eval` ·
   `just rec-replay <id>` · `just golden-accept` · `just security-scan` · `just ci-parity`.
   When a recipe is a known stub, say so in one clause and name the phase task that implements it.
5. Fix, do not propagate, the audit §3.1 broken references in any file you own.
6. Delete the stale sentence "skills live in `.agents/skills/`, not auto-loaded; read the file" from every
   agent you touch; replace with "Read `.agents/skills/<name>/SKILL.md` first" (or `skills:` frontmatter if
   you confirmed it resolves for symlinked project skills).
7. For every new skill, create the symlink: `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.
8. **Verify:** `just docs-check <every path you own>` → exit 0, plus the per-task check listed below.

#### T6 — `docs-maintenance` skill + `docs-maintainer` agent (the owner's central ask)

- **Wave:** 2 · **Depends on:** T1–T5
- **Owns:** `.agents/skills/docs-maintenance/SKILL.md`,
  `.agents/skills/docs-maintenance/references/session-close.md`,
  `.agents/skills/docs-maintenance/references/contract-sync.md`,
  `.agents/skills/docs-maintenance/evals/evals.json`,
  `.agents/skills/docs-maintenance/evals/trigger-evals.json`, `.claude/skills/docs-maintenance` (symlink),
  `.claude/agents/docs-maintainer.md`
- **May read:** T5 templates, `templates/session-handoff.md`, `templates/module-contract.md`,
  `docs/adr/README.md`, `PROGRESS.md`, `planning/PROGRESS.md`, audit §6
- **Given contract:** `just docs-check [--strict] [--fixtures] [PATH...]`; findings print as
  `<LEVEL> <CHECK-ID> <file>:<line> <message>`; check ids DC-01…DC-15 as defined in T2;
  `tools/docs/planned-paths.txt` holds legitimately-not-yet-existing paths.
- **Do:** the skill's workflow is: run `just docs-check` → group findings by check id → fix each with the
  owning template (module contract → `templates/module-contract.md`; handoff → `templates/session-handoff.md`;
  ADR index → add the row) → rerun until exit 0 → report what changed and what needs a human. Stop
  conditions: any finding whose fix requires editing `CLAUDE.md`, `planning/SPINE.md`, or `planning/15-*.md`
  → write a proposal under `.claude/plans/`, never edit. `references/session-close.md` holds the end-of-session
  procedure (phase table row, root pointer line, handoff entry, last green command).
  `references/contract-sync.md` holds the "public surface changed → contract section to update" mapping.
  The agent `docs-maintainer`: tools `Read, Grep, Glob, Edit, Write, Bash(just docs-check:*), Bash(just --summary:*),
  Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(rg:*), Bash(ls:*), Bash(cat:*)`; write set
  `docs/modules/**`, `docs/adr/README.md`, `PROGRESS.md`, `planning/PROGRESS.md`, phase-file §12 status
  columns; never `CLAUDE.md`/SPINE/doc 15/ADR bodies/source code. Body must state the concurrency rule:
  it never runs in the same wave as an engineer agent that owns a module contract it would touch.
- **Verify:** `just docs-check .agents/skills/docs-maintenance .claude/agents/docs-maintainer.md` → exit 0;
  `readlink .claude/skills/docs-maintenance` → `../../.agents/skills/docs-maintenance`.

#### T7 — `backend-module` skill + 8 module references

- **Wave:** 2 · **Depends on:** T1–T5
- **Owns:** `.agents/skills/backend-module/SKILL.md`,
  `.agents/skills/backend-module/references/{identity,profile,avatar,closet,media,outfit,context,platform}.md`,
  `.agents/skills/backend-module/evals/{evals.json,trigger-evals.json}`
- **May read:** `docs/modules/*.md`, `apps/api/src/modules/*/index.ts`, `planning/phases/P03,P04,P06,P07,P08,P10*.md`,
  `apps/api/src/jobs/README.md`, `tools/depcruise/rules.cjs`
- **Do:** rewrite the description to carry trigger phrases (module names, "application service", "port",
  "outbox", "NestJS") and negatives (recommendation/outfit/context/fashion-intel → `recommendation-rules`;
  schema → `db-migration`; endpoint shape → `api-contract-change`; billing → `entitlements-billing`;
  notifications/admin/assistant → their own skills). Add a Workflow step "read
  `references/<module>.md` for the module you are touching" before implementation. **Fix the broken
  `apps/api/src/jobs/index.ts` reference** — that file does not exist; point at `apps/api/src/jobs/README.md`
  and say the binding file arrives with P02-T08. Resolve the `internal/schema.ts` ownership conflict with
  `db-migration` in one sentence, worded identically in both skills: *the module owner edits
  `internal/schema.ts`; `platform-engineer` generates and tests the migration.* Then write the 8 references
  from `templates/module-reference.md`.
- **Verify:** `just docs-check .agents/skills/backend-module` → exit 0;
  `git grep -n 'jobs/index.ts' .agents/skills/backend-module` → no matches; `wc -l SKILL.md` < 500.

#### T8 — `api-contract-change` skill (+ shared-kernel, taxonomy refs) + `contracts-engineer` agent

- **Wave:** 2 · **Owns:** `.agents/skills/api-contract-change/SKILL.md`,
  `.agents/skills/api-contract-change/references/{shared-kernel.md,taxonomy-registry.md}`,
  `.agents/skills/api-contract-change/evals/{evals.json,trigger-evals.json}`,
  `.claude/agents/contracts-engineer.md`
- **May read:** `packages/contracts/**`, `packages/shared-kernel/src/*.ts`, `docs/modules/shared-kernel.md`,
  `.spectral.yaml`, `planning/phases/P06-*.md` T01 and `P07-*.md` T14 (taxonomy bump + backfill)
- **Do:** description gains "endpoint shape", "OpenAPI", "event schema", "spectral", "oasdiff",
  "shared enum", "reason code", "entitlement name", plus negatives (implementation behind an existing
  endpoint → `backend-module`; tables → `db-migration`). Replace "consumers updated in the same PR **when
  small**" with a concrete rule (same PR when the change is additive and the consumer diff is confined to
  generated types; otherwise a linked follow-up issue). Add an explicit `rg` command to the "search before
  write on the contract itself" step. `references/taxonomy-registry.md` documents the closet taxonomy bump
  procedure (registry → codegen → backfill → saved-filter survival) and states that `closet` owns the
  taxonomy per root `CLAUDE.md`. Narrow `contracts-engineer`'s `Bash(pnpm:*)` to the exact subcommands used.
- **Verify:** `just docs-check .agents/skills/api-contract-change .claude/agents/contracts-engineer.md` → 0.

#### T9 — `db-migration` skill + `platform-engineer` + `api-engineer` agents

- **Wave:** 2 · **Owns:** `.agents/skills/db-migration/SKILL.md`,
  `.agents/skills/db-migration/evals/{evals.json,trigger-evals.json}`,
  `.claude/agents/platform-engineer.md`, `.claude/agents/api-engineer.md`
- **May read:** `packages/db/**` (incl. actual migration filenames), `packages/db/README.md`,
  `apps/api/tests/migrations/`, `docs/modules/platform.md`
- **Given contract:** `just db-generate <name>` (T1) is the only sanctioned migration generator;
  `just test-regression <file>` exists; a matching `packages/db/migrations/down/<idx>.sql` is required.
- **Do:** replace "generate the migration with drizzle-kit via the `just db-*` recipes" with
  `just db-generate <name>` in both the skill and `platform-engineer`. **Fix the migration filenames** to the
  real ones (`0001_platform_outbox.sql`, `0002_platform_idempotency_keys.sql`). State the `internal/schema.ts`
  ownership sentence verbatim as in T7. Mark the "staging apply on a scratch database" step as OPEN with its
  decision-log pointer instead of an unverifiable claim. In both agents: narrow `Bash(pnpm:*)` /
  `Bash(docker compose:*)` (no `down -v`), remove the stale skills sentence, add a worked example, resolve
  `.env.example` ownership (tooling-engineer writes it; these agents *report* the key to add).
- **Verify:** `just docs-check .agents/skills/db-migration .claude/agents/platform-engineer.md
  .claude/agents/api-engineer.md` → 0; `git grep -n '0001_platform_outfit' .agents .claude` → no matches.

#### T10 — `media-ml-pipeline` + `observability-analytics` skills + `ml-engineer` agent

- **Wave:** 2 · **Owns:** `.agents/skills/media-ml-pipeline/SKILL.md`,
  `.agents/skills/media-ml-pipeline/evals/{evals.json,trigger-evals.json}`,
  `.agents/skills/observability-analytics/SKILL.md`,
  `.agents/skills/observability-analytics/evals/{evals.json,trigger-evals.json}`,
  `.claude/skills/observability-analytics` (symlink), `.claude/agents/ml-engineer.md`
- **May read:** `workers/**`, `apps/api/src/jobs/README.md`, `apps/api/src/platform/**`,
  `apps/mobile/src/lib/analytics/**`, `planning/14-*` (observability doc), phase §12 observability rows
  (they appear in 11 of 13 phases — that is why this skill exists)
- **Do:** `media-ml-pipeline`: fix both `jobs/index.ts` references, replace raw `uv run`/`pytest` with
  `just test workers`, add an orchestration note naming the three agents that split this seam
  (`api-engineer` module → `platform-engineer` job → `ml-engineer` worker) and the order.
  `observability-analytics` (new): OTel metrics/traces/spans, PostHog analytics taxonomy, Grafana
  dashboards, alerts, runbooks, spend alerts. Triggers: "metric", "dashboard", "alert", "runbook",
  "analytics event", "PostHog", "OTel", "trace", "SLO", "p95". Negatives: "slow, find out why" →
  `performance-profiling`; log redaction review → `security-privacy-review`. Be honest about which recipes
  are stubs today. `ml-engineer`: replace every raw `uv run …` with `just test workers` / `just lint` /
  `just typecheck`, narrow `Bash(uv:*)` so `uv add` is impossible, add a worked example.
- **Verify:** `just docs-check` on all four owned paths → 0; `git grep -n 'uv run' .claude/agents/ml-engineer.md
  .agents/skills/media-ml-pipeline` → no matches.

#### T11 — `recommendation-rules` + `entitlements-billing` skills (+ refs) + `recommendation-engineer` agent

- **Wave:** 2 · **Owns:** `.agents/skills/recommendation-rules/SKILL.md`,
  `.agents/skills/recommendation-rules/references/recommendation.md`,
  `.agents/skills/recommendation-rules/evals/{evals.json,trigger-evals.json}`,
  `.agents/skills/entitlements-billing/SKILL.md`,
  `.agents/skills/entitlements-billing/references/billing.md`,
  `.agents/skills/entitlements-billing/evals/{evals.json,trigger-evals.json}`,
  `.claude/agents/recommendation-engineer.md`
- **May read:** `docs/modules/{recommendation,outfit,context,billing}.md`, `planning/phases/P09-*.md`,
  `planning/phases/P13-*.md`, root `CLAUDE.md` (`recommendation` ⊥ renderer invariant)
- **Do:** both descriptions gain trigger phrases ("hard constraint", "scoring", "reason code", "replay",
  "tie-break" / "paywall", "RevenueCat webhook", "credits", "trial", "entitlement") and negatives
  (presentation/rendering → `native-3d-assets`; price experiments → out of scope for the skill).
  Replace `entitlements-billing`'s "sandbox-store E2E **where the phase requires it**" with the concrete
  phase task (`P13-T17`). Keep the `recommendation` ⊥ renderer invariant prominent. The two references carry
  module detail per `templates/module-reference.md`. Narrow the agent's `Bash(pnpm:*)`.
- **Verify:** `just docs-check` on all owned paths → 0.

#### T12 — `notifications-delivery` + `admin-moderation` skills (new, per-module)

- **Wave:** 2 · **Owns:** `.agents/skills/notifications-delivery/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/skills/notifications-delivery` (symlink),
  `.agents/skills/admin-moderation/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/skills/admin-moderation` (symlink)
- **May read:** `docs/modules/{notifications,admin}.md`, `planning/phases/P09-*.md` T16,
  `planning/phases/P06-*.md` T13, `planning/phases/P12-*.md` T04/T08, `planning/phases/P14-*.md` T12
- **Do:** `notifications-delivery` — push ports (FCM/APNs behind a port; the domain never imports the SDK),
  scheduling, quiet hours, opt-outs, delivery receipts, dedup/idempotency via the outbox.
  `metadata.modules: "notifications"`. `admin-moderation` — RBAC, audit log, moderation queues, admin CRUD
  surfaces, and the rule that admin actions on user content are logged and reversible.
  `metadata.modules: "admin"`. Both: negatives pointing back to `backend-module` for generic module work and
  to `security-privacy-review` for authorization changes; `just test notifications` / `just test admin`
  as the validation command.
- **Verify:** `just docs-check` on both skill dirs → 0; both symlinks resolve.

#### T13 — `assistant-chat` + `fashion-intel-ingestion` skills (new, per-module)

- **Wave:** 2 · **Owns:** `.agents/skills/assistant-chat/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/skills/assistant-chat` (symlink),
  `.agents/skills/fashion-intel-ingestion/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/skills/fashion-intel-ingestion` (symlink)
- **May read:** `docs/modules/{assistant,fashion-intel}.md`, `planning/phases/P15-*.md` T08–T12,
  `planning/phases/P12-*.md`, `tools/depcruise/rules.cjs` (`assistant-app-services-only` rule)
- **Do:** `assistant-chat` — the binding invariant from root `CLAUDE.md`: the assistant calls the *same*
  application services as every other client, no second recommendation engine, no direct table access; tool
  schemas live in `packages/contracts`. State clearly that this is P15 work and the module is a skeleton
  today. `fashion-intel-ingestion` — source register, ingestion jobs, LLM summarization behind a port (with
  the doc-10 justification requirement), freshness, moderation, feed personalization, trend port. Negatives:
  scoring/ranking of outfits → `recommendation-rules`; generic job plumbing → `media-ml-pipeline`.
- **Verify:** `just docs-check` on both skill dirs → 0; both symlinks resolve.

#### T14 — `data-lifecycle` + `tooling-ci` skills (new) + `tooling-engineer` agent

- **Wave:** 2 · **Owns:** `.agents/skills/data-lifecycle/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/skills/data-lifecycle` (symlink),
  `.agents/skills/tooling-ci/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/skills/tooling-ci` (symlink), `.claude/agents/tooling-engineer.md`
- **May read:** `planning/phases/P03-*.md` T05/T09/T10, `P05-*.md` T08, `P11-*.md`, `docs/modules/identity.md`,
  `justfile`, `.github/workflows/**`, `tools/**`, `scripts/**`
- **Do:** `data-lifecycle` — consent registry, deletion cascade across modules, export jobs, retention
  windows, purge verification; every workflow ends with "`security-privacy-review` before PR" because these
  are exactly the flows root `CLAUDE.md` marks mandatory-review. Triggers: "delete account", "deletion
  cascade", "export my data", "retention", "consent withdrawal", "purge", "GDPR". `tooling-ci` — the skill
  that has been missing behind `tooling-engineer`: `just` recipes, workflow YAML, fixtures, bootstrap/doctor,
  portability, gate duration. It must state that adding a recipe means updating the doc 15 §5 catalog
  (propose, do not edit) and that changing CI required checks is human-only. Rewrite `tooling-engineer` to
  read `tooling-ci` first, add a worked example, and keep its (already good) Bash restrictions.
- **Verify:** `just docs-check` on all owned paths → 0.

#### T15 — `mobile-feature` + `native-3d-assets` skills + `mobile-engineer` + `render-3d-engineer` agents

- **Wave:** 2 · **Owns:** `.agents/skills/mobile-feature/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.agents/skills/native-3d-assets/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/agents/mobile-engineer.md`, `.claude/agents/render-3d-engineer.md`,
  `apps/mobile/src/lib/README.md`
- **May read:** `apps/mobile/README.md`, `apps/mobile/src/{features,data,lib,render}/`, `apps/mobile/e2e/`,
  `docs/modules/avatar.md`, `planning/phases/P04-*.md`, `P05-*.md`, `P10-*.md`, `CODEOWNERS`
- **Given contract:** `just test mobile` exists (T1); `assets/3d/` is registered in
  `tools/docs/planned-paths.txt` as created by P04-T01, so referencing it is legal but must say so.
- **Do:** **Fix the missing `apps/mobile/src/lib/README.md`** by creating it (the directory exists and holds
  `analytics/`, `app-services.tsx`, `config.ts`, `tests/`; `features/` and `data/` already have one — follow
  their shape). Replace every raw `pnpm --filter @ai-stylist/mobile test` / `npx expo-doctor` with
  `just test mobile` / `just lint` / `just typecheck` in both the skill and `mobile-engineer`. Create
  `render-3d-engineer` (write set `apps/mobile/src/render/**`, designated 3D screens under
  `apps/mobile/src/features/avatar/**`, `assets/3d/**`, the 3D sections of `docs/modules/avatar.md`; tools
  include `Bash(just assets-validate:*)`), closing the hand-off hole where `mobile-engineer` hands
  `src/render/**` to nobody. Update `mobile-engineer`'s write set to exclude `src/render/**` **and**
  `apps/mobile/e2e/**` (now `test-engineer`, T16), and to name the two agents it hands off to.
- **Verify:** `just docs-check` on all owned paths → 0; `just test mobile` → runs (report the real result);
  `git grep -n 'pnpm --filter' .agents/skills/mobile-feature .claude/agents/mobile-engineer.md` → no matches.

#### T16 — `e2e-device-testing` skill (new) + `testing-regression` skill + `test-engineer` agent

- **Wave:** 2 · **Owns:** `.agents/skills/e2e-device-testing/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/skills/e2e-device-testing` (symlink),
  `.agents/skills/testing-regression/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/agents/test-engineer.md`
- **May read:** `apps/mobile/e2e/`, `apps/api/tests/`, `justfile` (`golden-accept`), phase rows P03-T15,
  P04-T13, P06/P07 Maestro suites, P10-T09
- **Given contract:** `just test-regression <test-file>` runs the test at the merge-base expecting failure,
  then at HEAD expecting pass, and exits 1 if either expectation is violated.
- **Do:** `e2e-device-testing` (new) — Maestro flows, device lanes, golden/visual regression
  (`just golden-accept`), k6 load profiles; triggers "Maestro", "E2E", "device run", "golden", "visual
  regression", "k6", "load test"; negatives: unit/integration coverage → `testing-regression`, frame-time
  budgets → `performance-profiling`. `testing-regression` — already graded A; the change is to wire
  `just test-regression <file>` into the workflow as the mechanical proof of fail-then-pass, and to give the
  vague "sweep sibling code for the same defect class" step a concrete method (`rg` for the same call shape,
  then LSP `findReferences` on the fixed symbol). `test-engineer` agent — write set
  `apps/mobile/e2e/**` and `apps/api/tests/**` except `http.test.ts` (api-engineer) and `tests/migrations/**`
  (platform-engineer); may write a module's `tests/**` only when the dispatching task names that module and
  no engineer agent is running on it — state this concurrency rule explicitly, with the reason (two agents in
  one working tree corrupt each other's edits).
- **Verify:** `just docs-check` on all owned paths → 0; symlink resolves.

#### T17 — `architecture-review` + `security-privacy-review` skills + their two reviewer agents

- **Wave:** 2 · **Owns:** `.agents/skills/architecture-review/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.agents/skills/security-privacy-review/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.claude/agents/architecture-reviewer.md`, `.claude/agents/security-privacy-reviewer.md`
- **May read:** `tools/depcruise/rules.cjs`, `tools/eslint/**`, audit §3.2/§3.3 rows for these four files
- **Do:** descriptions gain the phrases a user actually types ("review this diff", "is this duplicated",
  "did I break a boundary" / "does this leak PII", "is this webhook safe", "consent flow review") and
  negatives (fixing the finding → the owning engineer skill). Give `architecture-review` a concrete
  mechanism for "record each finding as a PR comment" (the report block) and for the LSP step. Keep the
  declared logging-check overlap between the two, worded identically in both Overlap sections. Add
  `just docs-check` to both reviewers' verification sets so doc drift is caught at review time. Consider
  `model: sonnet` for both (read-only, high volume) and say why in the file.
- **Verify:** `just docs-check` on all four owned paths → 0.

#### T18 — `performance-profiling` + `release-readiness` skills (+ flags ref) + `release-manager` agent

- **Wave:** 2 · **Owns:** `.agents/skills/performance-profiling/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.agents/skills/release-readiness/{SKILL.md,evals/evals.json,evals/trigger-evals.json}`,
  `.agents/skills/release-readiness/references/feature-flags-rollout.md`,
  `.claude/agents/release-manager.md`
- **May read:** `planning/13-*` (release channels), `planning/phases/P14-*.md`, `justfile` (`mobile-*-build`,
  `ci-parity`, `security-scan`), `.github/workflows/pre-release.yml`
- **Do:** `performance-profiling` — replace the tool name-drops ("React DevTools profiler, Perfetto") with
  the exact capture procedure per surface, keep the "≥5 runs, median + p95" rule, and state the
  no-measurement-no-claim rule as the stop condition. `release-readiness` — put a number on "beta soak"
  (take it from doc 13; if doc 13 does not state one, say OPEN and cite the decision log rather than
  inventing one). `references/feature-flags-rollout.md` — flags with owner + expiry + removal issue, kill
  switches, staged rollout percentages, shadow modes; note at the top that this becomes its own skill when
  the flag registry lands in P05-T10. `release-manager` agent — read-only plus
  `Bash(just ci-parity:*), Bash(just security-scan:*), Bash(just generate --check:*),
  Bash(just mobile-android-build:*), Bash(just mobile-ios-build:*), Bash(gh run list:*), Bash(gh run view:*),
  Bash(git log:*), Bash(git tag:*)`; output a GO/NO-GO report; **never** submits, never merges (both are
  human-only per root `CLAUDE.md`).
- **Verify:** `just docs-check` on all owned paths → 0.

---

**Wave 3 — rosters, proposals, trigger optimization (T19–T21: disjoint write sets, concurrent)**

#### T19 — `.agents/skills/README.md` + `.claude/agents/README.md` (single-writer, this task only)

- **Wave:** 3 · **Depends on:** T6–T18
- **Owns:** `.agents/skills/README.md`, `.claude/agents/README.md`
- **Do:** rebuild both indexes from what is actually on disk. Skills README: one row per skill (22) with
  "use when" text derived from the description, plus the **module coverage table** exactly as given in the
  Roster section of this plan (15 rows: module → skill → where detail lives → agent) — DC-08 checks it.
  Agents README: stop hand-copying each agent's write set (copy-and-diverge, which this repo forbids);
  replace the ownership table's "Owns" column with a link to each agent file and keep only the one-line
  scope + verify command. Add rows for `render-3d-engineer`, `release-manager`, `docs-maintainer`,
  `test-engineer`. Delete the stale "suggested change: symlink `.claude/skills/…`" note (the symlinks have
  existed since 2026-09-11). Add the cross-seam sequence "any diff → `architecture-reviewer`, then
  `docs-maintainer`", the `docs-maintainer`/`test-engineer` concurrency rule, and a pointer to
  `.claude/rules/` and `.claude/settings.json` as the enforcement layer.
- **Verify:** `just docs-check` (full run) → DC-06 and DC-08 pass; remaining findings, if any, are reported
  by check id for T22.

#### T20 — human-approval proposals (no repo file is modified)

- **Wave:** 3
- **Owns:** `.claude/plans/s3-claude-md-proposal.md`, `.claude/plans/s3-doc15-proposal.md`
- **May read:** root `CLAUDE.md`, `planning/15-*.md` §5 and §12, `planning/CLAUDE.md`, audit §8.5
- **Do:** `s3-claude-md-proposal.md` — exact before/after blocks for root `CLAUDE.md`: (1) add `.claude/agents/`,
  `.claude/skills/` (symlinks), `.claude/rules/`, `.claude/settings.json`, `templates/linear/`,
  `docs/security/`, `prototype/`, `secrets/` to the repository-layout block; (2) add `just docs-check` to
  Standard commands and to the completion checklist; (3) name `docs-maintenance` in "Close out" and
  `.claude/rules/` in the session workflow; (4) one line on the hook layer and the
  `AGENT_MAY_EDIT_POLICY` / `AGENT_SKIP_PROGRESS_GATE` escape hatches. `s3-doc15-proposal.md` — §5 catalog
  rows for `docs-check`, `db-generate`, `test-regression`, `lint-file`, `sbom`, `test mobile|workers`, and a
  §12.5 sentence adding `.claude/agents/`, `.claude/rules/`, and hooks to the reference setup. Also propose
  the `planning/CLAUDE.md` disposition (banner or rename) — it still names Trigger.dev and is auto-loaded
  for `planning/**` edits, so it silently contradicts the live contract. Each proposal ends with: "after
  applying, flip `just docs-check` to `--strict` in `ci-parity` so DC-14/DC-15 become errors."
- **Verify:** `git diff --name-only` contains neither `CLAUDE.md`, `planning/SPINE.md`, nor `planning/15-*.md`.
  Every before-block quoted in the proposals matches the current file byte-for-byte
  (`grep -F -f` round-trip).

#### T21 — skill-creator trigger-eval optimization for the 9 new skills

- **Wave:** 3 · **Depends on:** T6, T10, T12, T13, T14, T16
- **Owns (exclusive write):** the `description:` frontmatter line of
  `.agents/skills/{docs-maintenance,data-lifecycle,observability-analytics,tooling-ci,e2e-device-testing,
  notifications-delivery,admin-moderation,fashion-intel-ingestion,assistant-chat}/SKILL.md`
  and those nine `evals/trigger-evals.json` files. **Nothing else in those directories.**
- **Do:** invoke `Skill(skill-creator:skill-creator)` and follow its Description Optimization section.
  Review each 20-query trigger set first — the near-miss negatives are what make this worth running; if a
  negative is obviously irrelevant ("write a fibonacci function"), replace it with a real competitor query
  (e.g. for `observability-analytics`, a negative that should go to `performance-profiling`). Then, per skill:
  `python -m scripts.run_loop --eval-set <set> --skill-path .agents/skills/<name> --model claude-opus-5[1m] --max-iterations 5 --verbose`
  run from the skill-creator directory
  (`~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator`).
  Put every workspace under the session scratchpad, never in the repo. Apply `best_description` (selected on
  the held-out test split) and re-check the 1536-char name+description budget afterwards.
- **Verify:** `just docs-check <the nine SKILL.md paths>` → exit 0 (DC-05 re-validates length and the
  negative-trigger marker). Report per skill: baseline train/test trigger score → best score, and the
  applied description.

---

**Wave 4 — verification and handoff (T22 runs alone; it must observe the final state)**

#### T22 — full gate run, residual fixes, PROGRESS handoff

- **Wave:** 4 · **Depends on:** every prior task
- **Owns:** `PROGRESS.md`, `planning/PROGRESS.md`. **Residual-fix mandate:** may edit any file created or
  modified in Waves 1–3 *only* to fix a failure reported by `just docs-check` / `just lint` /
  `just typecheck` / `just arch-check`, and must enumerate every such edit in the report. No other task is
  running, so this cannot collide.
- **Do:**
  1. `just docs-check` → exit 0 (warnings from DC-14/DC-15 are expected until the human applies T20's
     proposals; list them).
  2. `just docs-check --fixtures` → every fixture fails on its own check id.
  3. `just lint`, `just typecheck`, `just arch-check` → green.
  4. Hook smoke test: replay every `tools/docs/fixtures/hooks/*.json` payload through its script and paste
     the decisions; then confirm live behaviour on one real case each — an attempted edit to
     `packages/contracts/gen/**` is denied, and a `Stop` with a dirty `apps/**` and untouched PROGRESS is
     blocked exactly once.
  5. `just ci-parity` → green. Paste real output. If red, report the precise failure; do not weaken a gate,
     do not remove `docs-check` from `ci-parity`.
  6. Append a handoff entry to `planning/PROGRESS.md` from `templates/session-handoff.md` (branch, last
     green command, done vs remaining, decisions, exact next action, files touched) and sync the root
     `PROGRESS.md` "Current phase"/"Last green" lines so DC-12 passes. Next action must name the two
     proposal files awaiting human approval.
- **Verify:** the five commands above, with pasted output, plus
  `git diff --name-only main...HEAD | grep -E '^(CLAUDE\.md|planning/SPINE\.md|planning/15-)'` → empty (C11).

---

## Collision check

Every file any task writes, exactly once. No file appears twice in the same wave.

| File / glob | Owned by | Wave |
|---|---|---|
| `justfile`, `scripts/db/generate.sh`, `scripts/test/regression.sh`, `scripts/lint-file.sh` | T1 | 1 |
| `scripts/docs/**`, `tools/docs/fixtures/**`, `tools/docs/planned-paths.txt` | T2 | 1 |
| `.claude/settings.json`, `scripts/hooks/*.sh` | T3 | 1 |
| `.claude/rules/*.md` (11 files) | T4 | 1 |
| `templates/{skill,agent,module-reference}.md`, `templates/skill-{evals,trigger-evals}.json` | T5 | 1 |
| `.agents/skills/docs-maintenance/**`, `.claude/skills/docs-maintenance`, `.claude/agents/docs-maintainer.md` | T6 | 2 |
| `.agents/skills/backend-module/**` (SKILL.md, 8 references, evals) | T7 | 2 |
| `.agents/skills/api-contract-change/**`, `.claude/agents/contracts-engineer.md` | T8 | 2 |
| `.agents/skills/db-migration/**`, `.claude/agents/platform-engineer.md`, `.claude/agents/api-engineer.md` | T9 | 2 |
| `.agents/skills/media-ml-pipeline/**`, `.agents/skills/observability-analytics/**`, `.claude/skills/observability-analytics`, `.claude/agents/ml-engineer.md` | T10 | 2 |
| `.agents/skills/recommendation-rules/**`, `.agents/skills/entitlements-billing/**`, `.claude/agents/recommendation-engineer.md` | T11 | 2 |
| `.agents/skills/notifications-delivery/**`, `.agents/skills/admin-moderation/**`, their two symlinks | T12 | 2 |
| `.agents/skills/assistant-chat/**`, `.agents/skills/fashion-intel-ingestion/**`, their two symlinks | T13 | 2 |
| `.agents/skills/data-lifecycle/**`, `.agents/skills/tooling-ci/**`, their two symlinks, `.claude/agents/tooling-engineer.md` | T14 | 2 |
| `.agents/skills/mobile-feature/**`, `.agents/skills/native-3d-assets/**`, `.claude/agents/mobile-engineer.md`, `.claude/agents/render-3d-engineer.md`, `apps/mobile/src/lib/README.md` | T15 | 2 |
| `.agents/skills/e2e-device-testing/**`, `.claude/skills/e2e-device-testing`, `.agents/skills/testing-regression/**`, `.claude/agents/test-engineer.md` | T16 | 2 |
| `.agents/skills/architecture-review/**`, `.agents/skills/security-privacy-review/**`, `.claude/agents/architecture-reviewer.md`, `.claude/agents/security-privacy-reviewer.md` | T17 | 2 |
| `.agents/skills/performance-profiling/**`, `.agents/skills/release-readiness/**`, `.claude/agents/release-manager.md` | T18 | 2 |
| `.agents/skills/README.md`, `.claude/agents/README.md` | T19 | 3 |
| `.claude/plans/s3-claude-md-proposal.md`, `.claude/plans/s3-doc15-proposal.md` | T20 | 3 |
| `description:` line + `evals/trigger-evals.json` of the 9 new skills | T21 | 3 |
| `PROGRESS.md`, `planning/PROGRESS.md` (+ enumerated residual fixes) | T22 | 4 |

Single-writer files, each owned by exactly one task: `justfile` → T1 · `.claude/settings.json` → T3 ·
`.agents/skills/README.md` → T19 · `.claude/agents/README.md` → T19 · `PROGRESS.md` /
`planning/PROGRESS.md` → T22. `mise.toml`, `.github/**`, `pnpm-lock.yaml`, `workers/uv.lock`, `CLAUDE.md`,
`planning/SPINE.md`, `planning/15-*.md` are owned by **no** task and must not be modified.

T21 writes only the `description:` line inside nine SKILL.md files created in Wave 2 — legal because those
tasks are complete and nothing else in Wave 3 touches those files. It is the only sanctioned partial-file
ownership in this plan.

---

## Open questions (decide before or during execution)

1. **`feature-flags-rollout`: reference file or its own skill?** Planned as
   `release-readiness/references/feature-flags-rollout.md` because the flag registry does not exist until
   P05-T10, and a skill whose validation commands do not run is exactly the vagueness this plan removes.
   Say the word and it becomes a 23rd skill in T18.
2. **`CODEOWNERS`** still has placeholder handles and a `/assets/3d/` path that does not exist. Left alone
   (`assets/3d/` is registered in `tools/docs/planned-paths.txt` instead). Real handles are a human step
   already tracked in `planning/PROGRESS.md`.
3. **`planning/CLAUDE.md`** is auto-loaded for any `planning/**` edit and still names Trigger.dev, giving
   those sessions a second, contradicting contract. Proposed in T20 (banner or rename); needs human
   authorization because it is workflow policy.
4. **Does `skills:` frontmatter preload symlinked project skills?** If yes, agent bodies can drop the
   "read the SKILL.md first" step. T9/T10/T14/T15/T17 should confirm once and report; if unconfirmed, keep
   the explicit read step (costs one tool call, never silently fails).
5. **`model:` pins.** Proposed `sonnet` for the two read-only reviewers and `docs-maintainer`. Not applied
   without your call, since it changes cost and quality for every review.
6. **180-day `last-reviewed` window** is my choice for DC-05/DC-07. Quarterly (90 days) is the alternative
   the research doc suggests; one line in `scripts/docs/docs-check.sh` either way.
