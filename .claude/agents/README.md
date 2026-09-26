# Project subagents (`.claude/agents/`)

One Claude Code subagent per area of the AI Stylist monorepo. Each runs in its own context with a
plain tool list, preloads the `agent-operating-contract` skill plus the skills it owns, and carries
two per-agent hooks: a write-set guard and a Bash allowlist. `CLAUDE.md` always applies on top.

The authoritative write set of each agent is its own `<ownership>` section, mirrored in its
`guard-agent-write-set.sh` args. The table below is a summary and never overrides either. The
workflow, search-before-write procedure, base check, stop rules and the report format live once, in
`.agents/skills/agent-operating-contract/SKILL.md`.

## Agents

| Agent | Primary area (summary; `<ownership>` is authoritative) | Preloaded skills (besides the contract) | Color | Verify with |
| --- | --- | --- | --- | --- |
| [`ios-engineer`](ios-engineer.md) | `apps/ios/**`, `tools/codegen/gen-swift.sh` | `ios-feature` | blue | `just ios-check`, `just test ios`; macOS: `just ios-build`, `just ios-test`, `just ios-e2e` |
| [`android-engineer`](android-engineer.md) | `apps/android/**`, `tools/codegen/gen-kotlin.sh` | `android-feature` | green | `just android-check`, `just test android`; emulator: `just android-e2e` |
| [`api-engineer`](api-engineer.md) | nine API modules (identity, profile, avatar, closet, media, billing, notifications, admin, assistant), the composition root, `apps/api/tests/http.test.ts`, `packages/test-support/**` | `backend-module`, `entitlements-billing`, `notifications-delivery`, `admin-moderation`, `assistant-chat`, `data-lifecycle` | cyan | `just test <module>`, `just test api`, `just test-regression`, `just lint`, `just typecheck`, `just arch-check` |
| [`platform-engineer`](platform-engineer.md) | `apps/api/src/platform/**`, `apps/api/src/jobs/**`, `packages/db/**`, `apps/api/tests/migrations/**`, `packages/seed-data/**`, `docker-compose.yml`; OTel and performance work | `backend-module`, `db-migration`, `data-lifecycle`, `media-ml-pipeline`, `observability-analytics`, `performance-profiling` | orange | `just test platform`, `just test api`, `just db-reset --yes`, `just db-rollback && just db-migrate`, `just arch-check` |
| [`contracts-engineer`](contracts-engineer.md) | `packages/contracts/**`, `packages/shared-kernel/**` (sources); every generated tree via `just generate` — single-writer | `api-contract-change` | purple | `just generate && just generate --check`, `just lint`, `just typecheck`, `just test`, `just arch-check` |
| [`ml-engineer`](ml-engineer.md) | `workers/**` except `workers/ml/generated/**`; `tools/codegen/gen-python.sh` | `media-ml-pipeline` | pink | `just test workers`, `just lint`, `just typecheck`, `just generate --check`, `just ml-eval` |
| [`recommendation-engineer`](recommendation-engineer.md) | `apps/api/src/modules/{recommendation,outfit,context,fashion-intel}/**` | `backend-module`, `recommendation-rules`, `fashion-intel-ingestion` | yellow | `just test recommendation`, `just rec-replay`, `just rec-golden-update`, `just arch-check` |
| [`tooling-engineer`](tooling-engineer.md) | `scripts/**` except `scripts/hooks/**`; `tools/**` except the three per-platform gen scripts; `justfile`, `mise.toml`, root configs, `.env.example`, `docs/security/**`; proposes `.github/workflows/**` diffs | `tooling-ci` | red | `just lint --fixtures`, `just arch-check --fixtures`, `just docs-check --fixtures`, `just ci-parity --core` |
| [`test-engineer`](test-engineer.md) | `e2e/**`; `apps/api/tests/**` except `http.test.ts` and `migrations/**`; conditionally a module's `tests/**` | `testing-regression`, `e2e-device-testing` | yellow | `just test-regression`, `just test`, `just ios-e2e`, `just android-e2e` |
| [`docs-maintainer`](docs-maintainer.md) | `docs/modules/**`, `docs/adr/README.md` (index), root `PROGRESS.md`, the `planning/PROGRESS.md` table + handoff log, phase-file task-state columns | `docs-maintenance` | cyan | `just docs-check` |
| [`architecture-reviewer`](architecture-reviewer.md) | nothing (read-only) — boundaries, duplication, source of truth, parity | `architecture-review` | purple | `just arch-check`, `just lint`, `just typecheck`, `just generate --check`, `just docs-check` |
| [`security-privacy-reviewer`](security-privacy-reviewer.md) | nothing (read-only) — security and privacy findings | `security-privacy-review` | red | `just security-scan`, `just lint`, `just docs-check` |
| [`release-manager`](release-manager.md) | nothing (read-only) — GO/NO-GO evidence, never ships | `release-readiness` | orange | `just ci-parity`, `just security-scan`, `just generate --check`, `gh run list` |

Colors repeat only between agents that never run in the same wave: the parallel lane (ios, android,
api) is blue / green / cyan; reviewers, docs-maintainer and test-engineer run after or between
engineer waves.

The `cross-platform-feature` skill has no agent: the main (lead) session runs it, because only the
main session has the Agent tool.

### Owned by no agent (human or the main session only)

`CLAUDE.md`, `README.md`, `CODEOWNERS`, `.envrc`, `solo.yml`, `AI-STYLIST-FABLE-PROMPT.md`;
`planning/**` except docs-maintainer's carve-outs above; ADR bodies `docs/adr/NNNN-*.md`,
`docs/SERVICES-SETUP.md`, `docs/DEVELOPING-ON-MACOS.md`; `templates/**`; `prototype/**`;
`secrets/**`, `.sops.yaml`, `.spectral.yaml`; the enforcement layer — `.claude/**` (agents, rules,
skill symlinks, `.claude/settings.json`, the untracked settings.local.json, plans), `.agents/**`,
`scripts/hooks/**` — except NEW `.claude/plans/<yyyy-mm-dd>-<slug>-proposal.md` files, which
tooling-engineer and docs-maintainer may create; `.github/workflows/**` and `.github/actions/**`
(tooling-engineer proposes the diff, a human applies it); `pnpm-lock.yaml` and `workers/uv.lock`
(single-writer, changed only by the owning command when the task grants a dependency change).

### Documented overlaps

1. `docs/modules/**`: docs-maintainer and each module's engineer (api, platform, recommendation,
   contracts) — shared, wave-serialized, never in the same wave.
2. `apps/api/src/modules/<name>/tests/**`: test-engineer and that module's engineer — test-engineer
   writes only when the dispatch prompt says the engineer is not running this wave.
3. Generated trees (`packages/contracts/gen/**`, `packages/shared-kernel/src/gen/**`,
   `workers/ml/generated/**`): written only by `just generate`, which contracts-engineer (or the
   lead) runs. The ios, android and ml engineers own their gen scripts but never run `just generate`
   without `--check`, so their write sets stay disjoint in a parallel wave.
4. New `.claude/plans/` proposal files: tooling-engineer and docs-maintainer, distinct slugs.

## Cross-seam sequences (producer before consumer)

- Endpoint or event: `contracts-engineer` → `api-engineer` / `ios-engineer` / `android-engineer` / `ml-engineer`.
- Client feature on both platforms: the main session runs `cross-platform-feature` (parallel model below).
- Table change: the module's engineer edits `apps/api/src/modules/<name>/internal/schema.ts` →
  `platform-engineer` generates the migration, down file and migration test → the module's engineer
  writes the repository code. Today the first domain table and the first module repository are
  stops for the lead: re-exporting a module's internal/schema.ts from
  `packages/db/src/schema/index.ts` breaks `public-api-only-external`, and modules may not import
  `packages/db` (`composition-root-only`).
- New port: the module's engineer declares it in the module `index.ts` (or `contracts-engineer` in
  `packages/shared-kernel` when two modules share it) → `api-engineer` adds the fake in
  `packages/test-support/src/`, copying `packages/test-support/src/clock.ts` → `platform-engineer`
  implements the adapter → `api-engineer` binds it in `apps/api/src/app.module.ts`. The existing
  `apps/api/src/platform/ports/*.port.ts` layout is P02-interim; do not copy its placement. Modules
  cannot import the platform `Clock`: a module that needs one asks contracts-engineer for a
  shared-kernel `Clock`, never a local copy.
- Modules without a depcruise edge (for example `admin` and `fashion-intel`) talk through events only.
- Any diff: `architecture-reviewer`, plus `security-privacy-reviewer` for auth, consent, deletion,
  webhooks, uploads, logging or AI egress; then `docs-maintainer` once the change has landed.
- Release candidate: every owning engineer's change lands and is reviewed → `release-manager`
  returns GO/NO-GO; a human ships.

Every write agent reports a `Suggested PROGRESS.md line` instead of editing the ledger; the main
session or docs-maintainer applies it.

## Parallel work (two or more write agents in one wave)

1. `.claude/settings.json` sets `"worktree": {"baseRef": "head"}`, so worktrees branch from the
   lead's HEAD, not from `main`.
2. Write sets in one wave must be disjoint. Each native lane (ios-engineer, android-engineer) runs
   with the Agent parameter `isolation: "worktree"`. No agent file sets `isolation`.
3. The lead records `BASE=$(git rev-parse HEAD)` and puts `Base: <sha>` in every prompt. Worktrees
   hold only committed state (no uncommitted edits, no `node_modules`, no `.env`), so anything the
   lanes need (contract, generated clients) is committed first; the lead asks the human once for
   permission to commit on a local `feat/<slug>` branch.
4. The API lane (api-engineer) needs `node_modules`, so it runs in the lead's checkout while the
   native lanes run in worktrees; the lead edits nothing while lanes run.
5. Each agent's first command is `git log -1 --format='%H %s'`; a SHA other than the brief's Base
   is BLOCKED. Agents never read the other platform's sources for parity: the brief is the only
   parity source.
6. Worktree agents run only native recipes (`just ios-check`, `just test ios`,
   `just android-check`, `just test android`). After integration the lead runs
   `just generate --check`, `just lint`, `just arch-check`, `just docs-check` and `just ci-parity`
   in its own checkout.
7. Integration (lead): `git -C <wt> status --porcelain`; with commit permission, commit in the
   worktree branch and `git merge --no-ff` into `feat/<slug>`; without it,
   `git -C <wt> add -A && git -C <wt> diff --cached --binary <BASE> > <scratchpad>/<lane>.patch`
   then `git apply --3way <patch>`; then `git worktree remove <wt>`.
8. test-engineer extends the shared e2e flow once, after both apps render the brief's strings and ids.

## Enforcement layer

Agent text is guidance; these mechanisms stop a violation. None of them may be edited by a project
agent (see "Owned by no agent").

- Per-agent hooks (each agent's frontmatter, active only while that agent runs):
  - `scripts/hooks/guard-agent-write-set.sh GLOB...` on `Edit|Write|NotebookEdit`: the repo-relative
    path must match an include glob and no `!` exclude glob; outside any checkout only the session
    scratchpad is writable. Denies with the allowed globs and "report it for its owner".
  - `scripts/hooks/guard-agent-bash.sh PATTERN...` on `Bash`: splits the command on unquoted
    `&&`, `||`, `;`, `|`, `&` and newlines; denies command substitution, process substitution,
    output redirection (except to /dev/null and fd dups) and `find -exec`/`-delete`; every simple
    command must match a built-in read-only baseline (`ls`, `cat`, `rg`, `git status`, `git diff`,
    `git log`, `just --summary`, …) or one of the agent's patterns. No agent may run a git write
    command.
  - Both fail closed without `jq`.
- Project hooks in `.claude/settings.json`, which also fire for every subagent tool call:
  `scripts/hooks/guard-protected-paths.sh` (generated output, policy docs, single-writer files,
  `.github/workflows/**`, `.github/actions/**`), `scripts/hooks/guard-bash.sh` (lockfile commands,
  destructive git/gh, store uploads, secret sync to staging/prod), `scripts/hooks/post-edit-lint.sh`
  (`just lint-file` on the edited file), `scripts/hooks/session-close-check.sh` (PROGRESS gate) and
  `scripts/hooks/session-start.sh` (orientation).
- Permissions in `.claude/settings.json`: `deny` for PR merges, remote branch and repo deletion,
  store uploads, schema pushes that bypass migrations, lockfile-changing package commands and
  reading `.env`; `ask` (a human confirms, even in auto mode) for force-push, `reset --hard`, `branch -D`, `clean -f`,
  rebase, `commit --amend`, history rewrites, stash drops, and edits to `CLAUDE.md`,
  `planning/SPINE.md`, doc 15, `.claude/settings.json`, `scripts/hooks/**`, `.github/workflows/**`
  and `.github/actions/**`.
- Path-scoped rules in `.claude/rules/*.md` load when a matching file is read and name the owning
  skill, agent and proof for that path.
- `just docs-check` (DC-07) validates every agent file: description length, a valid `color`, a
  `tools` list without `(`, a write-set hook when `tools` has Edit or Write, a Bash hook when it has
  Bash, every `skills:` entry exists and includes `agent-operating-contract`, and a README row.

## When to use a built-in agent instead

- `Plan`: before a change that touches more than three files or two areas; it produces the wave
  plan with exclusive write sets, and the project agents execute tasks inside their write sets.
- `Explore`: read-only fan-out search ("how is X wired").
- `general-purpose`: a self-contained change whose write set spans areas; it must stay disjoint from
  every running project agent and has no per-agent guard.
- `claude-code-guide`: questions about Claude Code itself (hooks, settings, subagents).
- For review, prefer `architecture-reviewer` and `security-privacy-reviewer` over any user-level or
  plugin reviewer: they carry the repo invariants.

## How to invoke

- Explicitly: `@agent-name` at the start of the prompt, or the Agent tool with
  `subagent_type: "<name>"`; add `isolation: "worktree"` for a parallel native lane.
- Automatically: the main session delegates on each agent's `description` (trigger phrases, owned
  paths, NOT-for clause). Reviewers say "use proactively" so they are picked before PRs.
- Every prompt to a write agent names the task, the acceptance criteria, `Base: <sha>`, and for a
  shared path the sentence "<owning engineer> is not running this wave".

## Conventions (verified 2026-09-25)

Sources: https://code.claude.com/docs/en/sub-agents.md, https://code.claude.com/docs/en/hooks.md,
https://code.claude.com/docs/en/skills.md, https://code.claude.com/docs/en/permissions.md,
https://code.claude.com/docs/en/worktrees.md, https://code.claude.com/docs/en/memory.md, and a
probe run in this repo on 2026-09-25.

- Frontmatter fields: `name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`,
  `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `omitClaudeMd`, `effort`,
  `isolation`, `color`, `initialPrompt`, `experimental`. `color` is one of red, blue, green, yellow,
  purple, orange, pink, cyan. These agents set only `name`, `description`, `tools`, `skills`,
  `color` and `hooks` (the house standard in `templates/agent.md`).
- `tools` takes plain tool names. A specifier such as `Bash(just:*)` in `tools` does not restrict
  Bash (probe: an agent limited that way ran `date` and `whoami`), so per-agent command limits live
  in the `guard-agent-bash.sh` hook. No agent has the `Agent` tool, so no subagent spawns another;
  only the main session orchestrates.
- `skills` is a YAML list; the full SKILL.md of each listed skill is injected at startup. The
  `.claude/skills/<name>` symlinks into `.agents/skills/` resolve for preloading. A skill with
  `disable-model-invocation: true` cannot be preloaded.
- Frontmatter `hooks` use the settings.json schema, apply only while the agent runs (`Stop` becomes
  `SubagentStop`), and run alongside the project hooks, whose input carries `agent_type` and
  `agent_id`. Command hooks use the exec form (`command` + `args`, no shell).
  `${CLAUDE_PROJECT_DIR}` is the main checkout even inside a worktree; the input `cwd` follows the
  agent, so the guards resolve paths from it.
- `isolation: "worktree"` creates `.claude/worktrees/<name>/` from `worktree.baseRef` (`head` here);
  the worktree holds only committed files, and its changes stay on disk until the lead integrates them.
- A subagent loads the `CLAUDE.md` hierarchy and `.claude/rules/` (path-scoped rules when it reads a
  matching file), its body, the delegation prompt and its preloaded skills. It does not see the
  parent conversation, so the prompt must carry the task, Base and wave facts.
- Permissions: deny beats ask beats allow; lists merge across user, project and local scopes; `ask`
  prompts even in auto mode; Bash rules match each subcommand of a compound command.
