# Proposal — human-only edits from the 2026-09-25 Claude Code foundation fix

> Status: OPEN (2026-09-25). Apply only after the five foundation slices (enforcement, agents, two skill
> sets, rules) are integrated: the text below describes hooks, `permissions.ask` rules, a
> `worktree.baseRef` setting and recipe arguments those slices add.

Root `CLAUDE.md` and `planning/15-team-workflow-and-ai-agent-operations.md` are human-only (root
`CLAUDE.md`, "Prohibited without explicit human authorization"; `.claude/rules/human-only.md`). Apply
these diffs by hand, or authorize one session to apply exactly them. Every `-` line was checked
byte-for-byte with `grep -Fxq` against commit 8bc50ba; neither file differs from that commit in the
main checkout's working tree.

## A. Root `CLAUDE.md`

### A1. Repository layout, `scripts/hooks/` line

```diff
-scripts/hooks/          `.claude/settings.json` hook scripts (path guard, Bash guard, scoped lint, PROGRESS gate, orientation)
+scripts/hooks/          hook scripts: `.claude/settings.json` (path guard, Bash guard, scoped lint, PROGRESS gate, orientation) + per-agent write-set and Bash guards
```

DC-14 reads only the first token (`scripts/hooks/`), so the layout check is unaffected.

### A1b. Repository layout, `planning/` line (`CLAUDE.md:39`)

```diff
-planning/               SPINE, docs 00–16, phases/, templates/  (read-only context)
+planning/               SPINE, docs 00–16, phases/, templates/  (read-only context; docs-maintainer writes only the planning/PROGRESS.md phase-status table + handoff log and each phases/P*.md task-state column)
```

Why: `docs-maintainer`'s write set covers those two ledger parts, and `.claude/rules/human-only.md`
and `.claude/rules/docs-and-progress.md` state the same carve-out; the layout line said all of
`planning/` was read-only (audit-agents C11). DC-14 reads only the first token (`planning/`).

### A2. Session workflow, step 3 "Match a skill"

```diff
-3. **Match a skill:** if a skill in `.agents/skills/` covers the task type, follow its workflow; skills compose (e.g., contract change first, then module work). Path-scoped rules in `.claude/rules/` load automatically when you touch matching files — treat them as binding, not optional reading.
+3. **Match a skill:** if a skill in `.agents/skills/` covers the task type, follow its workflow; skills compose (e.g., contract change first, then module work). A feature on both native apps ("build/implement <feature> on iOS and Android") starts with `cross-platform-feature`, which only the main session runs: it writes the brief and launches the lanes. Every project agent preloads the `agent-operating-contract` skill (base-commit check, workflow, report format). Path-scoped rules in `.claude/rules/` load when you read a matching file — treat them as binding, not optional reading.
```

Why: the official rules docs say a path-scoped rule loads when Claude reads a matching file; "touch"
suggested edits only.

### A3. Hook-layer paragraph under "Session workflow"

```diff
-Five deterministic hooks in `.claude/settings.json` (scripts in `scripts/hooks/`) back parts of this
-workflow: a path guard on protected files, a Bash-command guard, scoped post-edit lint, a PROGRESS-ledger
-gate on session stop, and an orientation print on session start. Two escape hatches exist for
-human-authorized exceptions: `AGENT_MAY_EDIT_POLICY=1` bypasses the path guard for a sanctioned policy
-edit; `AGENT_SKIP_PROGRESS_GATE=1` bypasses the stop gate for a session intentionally left mid-work.
+`scripts/hooks/` holds seven hook scripts and one helper. Five deterministic hooks in
+`.claude/settings.json` back parts of this workflow: a path guard on protected files, a Bash-command
+guard, scoped post-edit lint, a PROGRESS-ledger gate on session stop, and an orientation print on
+session start. The stop gate compares the watched paths (`apps packages workers tools scripts justfile
+e2e docs .claude .agents .github mise.toml docker-compose.yml CLAUDE.md`) with a per-session baseline
+that the session-start hook records through the `session-baseline.sh` helper: committed work still
+counts, and a file that was already dirty at session start counts only if it changes again. In a linked
+worktree the stop gate also accepts a final message that contains `Suggested PROGRESS.md line:`. Every
+project agent adds the other two hooks in its own frontmatter: `guard-agent-write-set.sh` denies an
+Edit/Write outside the agent's write
+set, and `guard-agent-bash.sh` denies a Bash command outside a read-only baseline plus the agent's allowed
+recipes. A `Bash(...)` pattern in an agent's `tools` does not restrict Bash; these hooks do.
+`permissions.ask` rules in `.claude/settings.json` prompt the human before destructive git (force or
+mirror push, `reset --hard`, `branch -D`, `clean -f`, history rewrite, `rebase`, `commit --amend`,
+`checkout --`, `stash drop`/`clear`, `worktree remove --force`) and before any edit to this file,
+`planning/SPINE.md`, `planning/15-*.md`, `.claude/settings.json`, `scripts/hooks/**`,
+`.github/workflows/**` or `.github/actions/**`; approving that prompt is the explicit authorization.
+`"worktree": {"baseRef": "head"}` in the same file makes every agent worktree branch from the current
+HEAD instead of `main`. Two escape hatches exist for human-authorized exceptions:
+`AGENT_MAY_EDIT_POLICY=1` bypasses the path guard for a sanctioned policy edit;
+`AGENT_SKIP_PROGRESS_GATE=1` bypasses the stop gate for a session intentionally left mid-work.
```

Check before applying: `jq '.permissions.ask, .worktree' .claude/settings.json` lists these rules and
`{"baseRef":"head"}`, and `ls scripts/hooks/` shows eight files: the five hooks, both
`guard-agent-*.sh` scripts and `session-baseline.sh`. Drop any clause whose mechanism did not land.

### A4. "Parallel sessions"

```diff
 - Parallel agent sessions must own **disjoint file sets**, agreed before launch; use one git worktree per session — never two agents in one working tree.
+- When two write agents run in one wave, the lead launches each native lane with the Agent tool's per-invocation `isolation: "worktree"` (agent frontmatter never sets `isolation:`). A worktree holds only committed state (no `node_modules/`, no `.env`), so the lead first commits what the lanes need (brief, contract, generated clients) on a local `feat/<slug>` branch, after asking the human once, records `BASE=$(git rev-parse HEAD)`, and puts `Base: <sha>` in every prompt. An agent whose `git log -1 --format='%H %s'` is not that base stops BLOCKED.
+- The API lane needs `node_modules/`, so it runs in the lead's checkout; the lead edits nothing while lanes run. Worktree lanes run only native recipes (`just ios-check`, `just test ios`, `just android-check`, `just test android`); after integrating the lanes the lead runs `just generate --check`, `just lint`, `just arch-check`, `just docs-check` and `just ci-parity` in its own checkout.
 - `packages/contracts`, `shared-kernel`, lockfiles, `mise.toml`, CI config, and this file are single-writer: sequence those changes, never parallelize them.
-- Producers land before consumers: contract/schema PRs merge first; dependent sessions rebase on them.
+- Producers land before consumers: a contract or schema change is committed (or merged) before any dependent lane launches; dependent sessions rebase on it.
```

Why: `isolation: "worktree"` branches from committed state only, so an uncommitted contract is invisible
to the lanes; the old wording assumed a merged PR before every parallel wave.

## B. `planning/15-team-workflow-and-ai-agent-operations.md`

### B1. §5 recipe catalog, `ios-e2e` and `android-e2e` rows (the recipes gain an optional `flow` argument)

```diff
-| `just ios-e2e` | Dev simulator build + the shared Maestro flow `e2e/smoke.yaml` with `APP_ID=app.aistylist.mobile.dev` (macOS only) |
+| `just ios-e2e [flow]` | Dev simulator build + one shared Maestro flow (default `e2e/smoke.yaml`; pass another `e2e/*.yaml` as `flow`) with `APP_ID=app.aistylist.mobile.dev` (macOS only) |
```

```diff
-| `just android-e2e` | Install the debug build on a running emulator/device + the Maestro flow `e2e/smoke.yaml` with `APP_ID=app.aistylist.mobile.dev` |
+| `just android-e2e [flow]` | Install the debug build on a running emulator/device + one Maestro flow (default `e2e/smoke.yaml`; pass another `e2e/*.yaml` as `flow`) with `APP_ID=app.aistylist.mobile.dev` |
```

DC-15 takes the first word after `just ` in the first cell, so both rows still match `just --summary`.
Check before applying: `just --show ios-e2e` and `just --show android-e2e` show the `flow` parameter.

### B1b. §5 recipe catalog, `ci-parity` row (it now also runs `just docs-check --fixtures`)

```diff
-| `just ci-parity` | Run the exact PR-gate sequence locally: format-check, lint, typecheck, arch-check, docs-check, generate --check, test, security-scan, including the native lanes (`NATIVE_LANES`, default `ios android`; a missing native toolchain is a loud SKIP locally and a failure in CI; Xcode-only steps skip on Linux); `--core` = what the pr-gate parity job runs (the native lanes run in `ios.yml` / `android.yml`) |
+| `just ci-parity` | Run the exact PR-gate sequence locally: format-check, lint, typecheck, arch-check, docs-check (`--strict`, then `--fixtures`, which includes the hook-fixture replay), generate --check, test, security-scan, including the native lanes (`NATIVE_LANES`, default `ios android`; a missing native toolchain is a loud SKIP locally and a failure in CI; Xcode-only steps skip on Linux); `--core` = what the pr-gate parity job runs (the native lanes run in `ios.yml` / `android.yml`) |
```

Check before applying: `just --show ci-parity` lists `just docs-check --fixtures` right after
`just docs-check --strict`.

### B2. §12.3 "Parallel agents" (recommended; it contradicts A4 today)

```diff
-- Use **git worktrees** for parallel work on one machine (`git worktree add ../app-<task> <branch>`) — one checkout per agent; never two agents in one working tree.
+- Use **git worktrees** for parallel work on one machine: the lead launches each parallel write agent with the Agent tool's `isolation: "worktree"` (it creates `.claude/worktrees/<name>/` from the current HEAD) — one checkout per agent; never two agents in one working tree. Commit what the agents need before launch; worktrees see only committed state.
```

```diff
-- Merge order: contracts/schema producers land before consumers rebase.
+- Merge order: contracts/schema producers are committed (or merged) before consumers launch or rebase.
```

## C. Other human-only items still open

- `.claude/plans/s4-doc-refresh-human-proposals.md`: items 1–3 and 5 are not applied (see its status
  banner).
- The s5 bootstrap proposal (s5-bootstrap-automation-human-proposals.md) is committed on
  `fix/bootstrap-automation`. The 2026-09-25 enforcement audit reports none of its items 1–5 applied.
  Add a `> Status:` banner when it is applied.
- `.claude/plans/s2-automated-secrets-onboarding.md`: its five open questions are not tracked in the
  decision log or an issue.
- Done on `fix/bootstrap-automation`: `.claude/settings.local.json` is untracked (`git rm --cached`)
  and ignored by the enforcement slice's `.gitignore` line; the file stays on disk.

### C1. `planning/phases/P12-fashion-intelligence.md:66` names the removed `ExplanationPort`

DEC-46 (`planning/16-risks-open-questions-and-decision-log.md:132`) removed LLM explanation polish, and
`planning/phases/P09-recommendation-engine-v1.md:97` already says "no `ExplanationPort`". The P12
`platform` row still routes trend summarization through it. Doc 10 §2.8
(`planning/10-ai-usage-cost-and-evaluation.md:157`) is the summarization entry. Under the port rule of
this fix, the module that needs the capability declares the port in its `index.ts`.

```diff
-| `platform` | Content-source fetch adapters behind a `ContentSourcePort` (one adapter per licensed source/API); summarization via existing `ExplanationPort`-family LLM port | Yes — port additions |
+| `platform` | Content-source fetch adapters behind a `ContentSourcePort` (one adapter per licensed source/API); an LLM summarization adapter for the summarization port that `fashion-intel` declares in its `index.ts` (doc 10 §2.8; `ExplanationPort` was removed by DEC-46) | Yes — port additions |
```

Related, no diff proposed: `planning/10-ai-usage-cost-and-evaluation.md:48` still lists `ExplanationPort`
among its example ports and says each port lives "in `platform`".

### C2. Open design questions: the arch rules and the planned design conflict

The skills stop on each of these until a human decides (an ADR, or a rule change with an ADR).

- **(a) Schema composition vs `public-api-only-external`.** ADR-0001 Decision item 3
  (`docs/adr/0001-monorepo-tooling-and-toolchain-pins.md:29`) puts per-module tables in
  `apps/api/src/modules/<name>/internal/schema.ts`, "composed from `packages/db/`".
  `packages/db/src/schema/index.ts:1-3` plans to re-export them. Depcruise `public-api-only-external`
  (`tools/depcruise/rules.cjs:85`) forbids anything outside `apps/api/src/modules/` from importing a
  module's `internal/**`. The first module table therefore fails `just arch-check`. Options: re-export the
  schema through the module's `index.ts`, add a narrow rule exception for `packages/db/src/schema/`, or
  move the table definitions.
- **(b) No sanctioned place for a module's Postgres-backed repository tests.** Depcruise
  `composition-root-only` (`tools/depcruise/rules.cjs:185`) lets only the composition roots,
  `apps/api/src/platform/`, `apps/api/src/dev/`, `packages/db/`, `apps/api/tests/` and the seed CLI import
  `packages/db`. A module test in `apps/api/src/modules/<name>/tests/` can start a container through
  `packages/test-support/src/postgres.ts` (it imports only `@testcontainers/postgresql`). It cannot import
  the `packages/db` client or migrations. `apps/api/tests/` is allowed, but test-engineer owns it and root
  `CLAUDE.md` puts module tests in the module's own tests directory. pg-boss job-handler tests are
  unaffected: `apps/api/src/jobs/` is a composition root, so `apps/api/src/jobs/tests/` may import
  `packages/db`.
- **(c) No `admin` ↔ `fashion-intel` edge.** `ALLOWED_EDGES` gives `admin` only media, closet, billing
  and identity (`tools/depcruise/rules.cjs:45`), and `fashion-intel` only profile and closet (`:55`).
  P12-T04 "admin CRUD" for the source register and P12-T08 "quarantine wiring into `admin` queue"
  (`planning/phases/P12-fashion-intelligence.md:126`, `:130`) therefore go through events via the outbox,
  unless an ADR adds the edge (doc 04 §4.1 and `ALLOWED_EDGES` together).
