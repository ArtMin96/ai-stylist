---
name: agent-operating-contract
description: The operating contract every project agent in .claude/agents/ preloads — the start-of-task checks (base commit, worktree, write set), the search-before-write procedure with exact rg commands, what may run in a git worktree versus the main checkout, the common stop conditions, and the one canonical hand-back report (DONE, PARTIAL or BLOCKED). Use at the start of every delegated task, before the first edit, when a needed file is outside your write set, when a check cannot run, and when writing the final report. Not for launching or integrating agents — the lead runs `cross-platform-feature`; not for area rules such as module layering or platform strictness — use the area skill (`ios-feature`, `backend-module`, …); not for closing a session in the main checkout — use `docs-maintenance`.
user-invocable: false
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: android-engineer,api-engineer,architecture-reviewer,contracts-engineer,docs-maintainer,ios-engineer,ml-engineer,platform-engineer,recommendation-engineer,release-manager,security-privacy-reviewer,test-engineer,tooling-engineer
---

# Agent Operating Contract

Every project agent preloads this file. Your agent body adds the area part: owned paths, invariants,
the sibling files to copy, the area Verification block and area stop conditions. For area specifics
the agent body wins; for the protocol below (base check, write set, git, report) this file wins.

## Trigger

- You are a project agent (`.claude/agents/<name>.md`) starting, pausing or finishing a task the
  lead delegated to you.
- Before your first edit; before running a check inside a git worktree; when a file you need is
  outside your write set; when a check cannot run; when you write the final report.
- Not this skill: launching lanes, committing, or integrating worktrees (the lead's
  `cross-platform-feature`); area rules (your area skill, named in your agent body).

## Required reading

1. Root `CLAUDE.md`: source-of-truth priority, architectural invariants, search before write,
   testing, security and honesty rules.
2. Your agent file `.claude/agents/<name>.md`: `<ownership>` (your write set), `<constraints>`
   (the items your `Self-review:` answers) and `<output_format>` (your Verification block, Parity
   yes/no).
3. The lead's brief: `Base:` SHA, scope, acceptance criteria and, for a client feature, the parity
   table. The brief is the only parity source.
4. `PROGRESS.md` and the task's row in the current phase file under `planning/phases/`.
5. `docs/modules/<name>.md` for every module in scope.

## Workflow

1. **Orient.** Run these first, read-only:

   ```bash
   git log -1 --format='%H %s'      # must equal the brief's Base
   git rev-parse --show-toplevel    # a path under .claude/worktrees/ means you run in a worktree
   git status --porcelain           # start state: paths already dirty are not yours
   test -d node_modules && echo node_modules-present
   ```

   The brief names a Base and the first line differs → stop BLOCKED before any edit:
   `Base mismatch: brief <sha>, checkout <sha>`. Worktrees hold only committed state, so a wrong
   base means you would build on stale code.

2. **Restate** scope, non-goals and acceptance criteria in three lines. Unclear, or in conflict with
   `planning/SPINE.md`, the decision log or the module contract → BLOCKED with the exact question.
3. **Write set.** Edit only paths in your `<ownership>`. The per-agent write-set hook denies every
   other Edit/Write; never work around it through Bash. A needed change elsewhere goes under
   `Noticed but not touched:` (it does not block you) or `Blockers:` (it does), with the exact
   change and its owner.
4. **Search before write** (root `CLAUDE.md`, mandatory before adding any function, type, screen,
   service, mapper, validator, schema, constant, fixture or job):
   1. Write the behaviour in one sentence, not a name.
   2. Search by words and synonyms in your area:

      ```bash
      rg -n -i '<term>|<synonym>|<synonym>' apps/api/src packages/shared-kernel/src packages/test-support/src packages/contracts/openapi   # API
      rg -n -i '<term>|<synonym>' apps/ios/Packages packages/contracts/gen/swift-client/Sources        # iOS
      rg -n -i '<term>|<synonym>' apps/android packages/contracts/gen/kotlin-client                    # Android
      rg -n -i '<term>|<synonym>' workers packages/contracts/events                                    # workers
      rg -n -i '<term>|<synonym>' justfile scripts tools .github                                       # tooling
      ```

   3. Search by structure: `rg -n 'export (async )?(function|const|class|interface|type) \w*<Noun>' apps packages`,
      `rg -n '(func|struct|class|protocol|actor|enum) \w*<Noun>' apps/ios`,
      `rg -n '(fun|class|interface|object) \w*<Noun>' apps/android`.
   4. Check the published surfaces: `apps/api/src/modules/<name>/index.ts` of every neighbour,
      `rg -n 'operationId:' packages/contracts/openapi/modules`,
      `jq -r '.events[].name' packages/contracts/events/analytics/events.json`,
      `jq -r '.codes | keys[]' packages/shared-kernel/registry/reason-codes.json`,
      `jq -r '.entitlements | keys[]' packages/shared-kernel/registry/entitlements.json`.
   5. Read every candidate in full. Reuse or extend it; write new code only with a reason per
      candidate. Record the result in `Reuse check:`. Copy-and-diverge is forbidden.
   6. Copy the structure of the sibling file your agent body names and record it in
      `Sibling copied:`.
5. **Implement** the smallest coherent change. Tests go where your agent body says (the owning
   tests directory or the documented native exception). A bug fix is test-first: write the
   test, run it and keep the failing line, fix, rerun and keep the passing line. Never skip,
   delete or weaken a test, lint rule or gate.
6. **Run the right checks for where you are.**
   - Main checkout (`node_modules` present): your agent body's Verification block, in full.
   - Worktree: only recipes that need no `node_modules`: `just ios-check` and `just test ios`, or
     `just android-check` and `just test android`. Put `just generate --check`, `just lint`,
     `just typecheck`, `just arch-check`, `just docs-check` and `just ci-parity` under `Not run:`
     with the reason `worktree; the lead runs it after integration`.
   - A command your Bash hook denies, or a toolchain you lack (no Mac for `just ios-build`, no
     emulator for `just android-e2e`, no Docker for Testcontainers) → `Not run: <command> — <reason>`.
     Never report a result you did not see.
7. **Git is read-only for you:** `git status`, `git diff`, `git log`, `git show`, `git rev-parse`,
   `git ls-files`, `git blame`. Never `git add`, `commit`, `stash`, `switch`, `checkout`, `merge`,
   `rebase`, `reset`, `push`, `worktree` or `gh` writes. The lead integrates and commits; list files
   that must land in one commit (lockfile + manifest, contract source + generated output) under
   `Must be committed together:`.
8. **Parallel lanes.** Never read another lane's sources for parity (in a worktree the other
   platform is the pre-feature base). Build to the brief; report every deviation under
   `Parity: Intended differences`.
9. **Self-review:** walk every item of your agent body's `<constraints>` section and write one
   finding per item under `Self-review:` (`<item> → ok | <what you found and did>`). An item you
   could not check says why. Then write the report (Output).

## Validation commands

```bash
git log -1 --format='%H %s'      # first command; equals the brief's Base
git diff HEAD --stat             # source of the Changed: list
git status --porcelain           # last command; untracked files belong in Changed: too, and every path is in your write set
# then your agent body's Verification block exactly as written (worktree: native recipes only, step 6)
```

## Output

The final message is this report, with every line present (`none` when empty). Paste real output
in `Verification:`; a paraphrase is not evidence.

```
## <task> — DONE | PARTIAL | BLOCKED
Agent: <name> · Base: <sha> · Worktree: <path | main checkout> · Branch: <name>
Changed: <path — one line each>
Must be committed together: <paths | none>
Verification:
  <exact command> → <exit code, test counts, or the decisive output line>
Not run: <command — reason> | none
Reuse check: <search terms + dirs → candidates → reused <x> | new because <y>>
Sibling copied: <path | n/a>
Regression test failed-then-passed: <yes — failing line before, passing after | n/a>
Self-review: <each area checklist item → finding>
Parity: <omit unless a client feature; identical block on iOS and Android>
  States: <state> ← <trigger>            (one per line, brief order)
  Strings: "<literal>"
  Ids: <accessibilityIdentifier == testTag>
  Analytics events: <events.json name>
  Client operations: <generated operationId>
  Failure → state: <error/status> → <state>
  Intended differences: none | <item — reason>
Suggested PROGRESS.md line: <one line | none>
Noticed but not touched: <path — what — owner> | none
Blockers: <what — who unblocks> | none
```

- DONE: every acceptance criterion met and every command in your Verification block ran green
  (or is under `Not run:` only because it is the lead's worktree gate).
- PARTIAL: some criteria met; the rest is named under `Not run:` or `Blockers:`.
- BLOCKED: you stopped at a stop condition before finishing; `Blockers:` says who unblocks it.
- Reviewers (`architecture-reviewer`, `security-privacy-reviewer`, `release-manager`) use the same
  header line with their verdict word in place of `DONE | PARTIAL | BLOCKED`
  (`## <task> — APPROVE | CHANGES REQUESTED`, or `## <task> — GO | NO-GO`; `BLOCKED` when the
  review could not finish), then the same `Agent:` line, then the verdict sections of their skill,
  then the last three lines (`Suggested PROGRESS.md line:`, `Noticed but not touched:`,
  `Blockers:`).

## Stop / escalation

Stop and report BLOCKED (or PARTIAL for work already done) instead of guessing when:

- The checkout is not the brief's Base, or you were told to work in a worktree and
  `git rev-parse --show-toplevel` is the main checkout → the lead relaunches.
- The task needs a file outside your write set → its owner (named in `.claude/agents/README.md`),
  sequenced by the lead.
- An endpoint, event, field, reason code, entitlement or unit is missing → `contracts-engineer`
  (`api-contract-change`). A table or migration → `platform-engineer` (`db-migration`).
- A fix would need a weaker rule, test, threshold, lint baseline, `@Suppress`, skip or retry →
  never; report the failing output.
- A dependency or version bump the task does not grant, a lockfile change, or `just generate`
  without `--check` when your agent body does not grant it → the lead decides.
- A human-only action: secrets, store or CI required-check changes, push, PR, merge, or edits to
  `CLAUDE.md`, `planning/SPINE.md`, `planning/15-team-workflow-and-ai-agent-operations.md`,
  `.claude/**`, `.agents/**`, `scripts/hooks/**` or `templates/**`.
- Sensitive data (measurements, face data, photos, precise location, wardrobe history, tokens)
  would enter a log, fixture, prompt, test or report → stop; `security-privacy-review`.
- A new AI or provider call is needed → the doc-10 entry and a human decision come first.
- The same check fails twice after a fix attempt and the cause is outside your area → report both
  outputs.

## Overlap

Adjacent: `cross-platform-feature` (the lead's orchestration that writes the brief and Base this
skill checks, launches the lanes and integrates them), every area skill (`ios-feature`,
`android-feature`, `backend-module`, `api-contract-change`, … — area rules and Verification blocks),
`architecture-review` / `security-privacy-review` / `release-readiness` (the verdict sections a
reviewer adds to this header), `docs-maintenance` (applies each report's `Suggested PROGRESS.md
line`). This skill owns no repository path; it defines the protocol every agent follows.
