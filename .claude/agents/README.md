# Project subagents (`.claude/agents/`)

Project-level Claude Code subagents for the AI Stylist monorepo, one per area of the codebase.
Each runs in an isolated context with a restricted tool set, owns a disjoint write set, and hands
back anything outside it. `CLAUDE.md` always applies on top; the agent files only restate the rules
that bite in their area. The exclusive write set and "never write" list for each agent live in that
agent's own `## Ownership` / `<ownership>` section — this table links to it rather than copying it,
so the two never drift apart (copy-and-diverge is forbidden repo-wide).

## Agents

| Agent | Owns | Scope | Verify with |
| --- | --- | --- | --- |
| [`mobile-engineer`](mobile-engineer.md) | `apps/mobile/**` except `src/render/**` and `e2e/**` | React Native / Expo screens, navigation, offline sync, data layer | `just test mobile`, `just lint`, `just typecheck`, `just arch-check`, `just generate --check` (if contracts touched) |
| [`api-engineer`](api-engineer.md) | `apps/api/src/modules/{identity,profile,avatar,closet,media,billing,notifications,admin,assistant}/**` + the API composition root | NestJS domain-module work and HTTP tests for those modules | `just test <module>`, `just test api`, `just lint`, `just typecheck`, `just arch-check` |
| [`platform-engineer`](platform-engineer.md) | `apps/api/src/platform/**`, `apps/api/src/jobs/**`, `packages/db/**`, `apps/api/tests/migrations/**`, `packages/seed-data/**`, `docker-compose.yml` | Port adapters, pg-boss jobs, Drizzle migrations + rollbacks, seed data | `just test platform`, `just test api`, `just db-reset --yes && just db-migrate && just db-seed`, `just db-rollback --yes && just db-migrate`, `just lint`, `just typecheck`, `just arch-check` |
| [`contracts-engineer`](contracts-engineer.md) | `packages/contracts/**`, `packages/shared-kernel/**`, `workers/ml/generated/**` (via `just generate` only) | OpenAPI 3.1 + event schemas, shared kernel, regenerating every consumer — single-writer | `just generate && just generate --check`, `just lint`, `just typecheck`, `just test`, `just test <each consuming module>`, `just arch-check` |
| [`ml-engineer`](ml-engineer.md) | `workers/**` except `ml/generated/**`, `tools/codegen/gen-python.sh` | Python FastAPI ML/media workers | `just test workers`, `just lint`, `just typecheck`, `just generate --check`, `just ml-eval` |
| [`recommendation-engineer`](recommendation-engineer.md) | `apps/api/src/modules/{recommendation,outfit,context,fashion-intel}/**` | Constraints, scoring, tie-breaks, reason-code emission, trend signals | `just test recommendation` (+ `outfit`/`context`/`fashion-intel` as touched), `just rec-replay <id>`, `just rec-golden-update`, `just lint`, `just typecheck`, `just arch-check` |
| [`tooling-engineer`](tooling-engineer.md) | `scripts/**`, `tools/**` except `tools/codegen/gen-python.sh`, `justfile`, `mise.toml`, `.github/**` | `just` recipes, CI workflows, depcruise/eslint/docs-check gates and fixtures | `just lint --fixtures`, `just arch-check --fixtures`, `just docs-check --fixtures`, `shellcheck`, `actionlint`, `just doctor`, `just ci-parity` |
| [`docs-maintainer`](docs-maintainer.md) | `docs/modules/**`, `docs/adr/README.md` (index rows only), root `PROGRESS.md`, `planning/PROGRESS.md`, phase-file task-state columns | Syncs docs with landed code; runs only after the change that made a doc stale has merged | `just docs-check` |
| [`test-engineer`](test-engineer.md) | `apps/api/tests/**` except `http.test.ts` and `migrations/**`; `e2e/**` (maintenance only); conditionally a module's own `tests/**` | Regression-first bug proof, flaky-test triage, cross-cutting suites — never a new Maestro flow | `just test-regression <file>`, `just test`, `just lint`, `just typecheck`, `just arch-check` |
| [`release-manager`](release-manager.md) | nothing (read-only) | Gathers release-channel promotion evidence, returns GO/NO-GO — never ships | `just ci-parity`, `just security-scan`, `just generate --check`, `gh run list`, `gh run view` |
| [`security-privacy-reviewer`](security-privacy-reviewer.md) | nothing (read-only) | Security/privacy review of a diff — findings only, never a fix | `just security-scan`, `just lint`, `just docs-check` |
| [`architecture-reviewer`](architecture-reviewer.md) | nothing (read-only) | Module-boundary, duplication, and source-of-truth review of a diff | `just arch-check`, `just lint`, `just typecheck`, `just generate --check`, `just docs-check` |

Unowned by any agent (human or orchestrating session only): `CLAUDE.md`, `planning/**`
(including `planning/PROGRESS.md`'s policy content — `docs-maintainer` writes only its phase-status
table and handoff log), `README.md`, `PROGRESS.md`'s own convention, `CODEOWNERS`, any `docs/adr/NNNN-*.md`
ADR body, `docs/SERVICES-SETUP.md`, `docs/DEVELOPING-ON-MACOS.md`, `templates/**`, `prototype/**`
(unimportable spike), `.agents/skills/**` and `.claude/agents/**` (skill/agent authoring — humans, or
the task that explicitly owns those files), `pnpm-lock.yaml` / `workers/uv.lock` (single-writer; an
agent changes one only when its task explicitly grants it), `secrets/**`, `.sops.yaml`,
`.spectral.yaml`. Every write-agent reports a **suggested `PROGRESS.md` line** instead of editing the
ledger, so parallel agents never collide on it; the orchestrating session or `docs-maintainer` applies
those lines.

Cross-seam sequences (producer before consumer):

- Endpoint or event: `contracts-engineer` → `api-engineer` / `mobile-engineer` / `ml-engineer`.
- Table change: module owner edits `modules/<name>/internal/schema.ts` → `platform-engineer` generates the
  migration + down file + migration test → module owner writes the repository code.
- New port: module owner declares the port and asks `api-engineer` for the fake in
  `packages/test-support` → `platform-engineer` implements the adapter → `api-engineer` binds it in
  `app.module.ts`.
- Any diff: `architecture-reviewer`, then `docs-maintainer` (once the change has landed), plus
  `security-privacy-reviewer` for auth/consent/deletion/webhooks/uploads/logging/AI egress.
- Release candidate: every owning engineer's change lands and is reviewed first → `release-manager`
  gathers evidence and returns GO/NO-GO; it never writes code or ships.

**Concurrency rule:** `docs-maintainer` and `test-engineer` overlap engineer agents in *repo* file
terms (module contracts, a module's `tests/**`) but are resolved by a wave rule, not a file
partition — neither ever runs in the same wave as the engineer agent that owns the module(s) it
would touch. Stated in both agents' own files; restated here because it is easy to miss when reading
only this table.

## Enforcement layer

This roster and the invariants above are backed by two mechanical layers, not agent discipline
alone: path-scoped rules under `.claude/rules/*.md` (loaded automatically when an agent touches a
matching path — the binding rules that would otherwise need a `CLAUDE.md` edit) and the hooks
declared in `.claude/settings.json` (a `PreToolUse` path guard and Bash guard, a scoped
`PostToolUse` lint, and a `Stop` `PROGRESS.md` gate). An agent description or this README stating a
rule is a convenience for the model; the rule file and the hook are what actually stop a violation.

## When to use the global agents instead

~/.claude/agents/ provides `planner`, `implementer`, and `researcher`; the project agents do not
duplicate them.

- **`planner`**: before any non-trivial change (3+ steps, several files, shared structure). It
  produces the contract and the wave-sequenced task list with exclusive file ownership; the project
  agents then execute the tasks whose files fall in their write set.
- **`researcher`**: open questions, library/API facts (Drizzle, pg-boss, Coolify, RevenueCat,
  store policy), "how is X wired". Read-and-report only.
- **`implementer`**: a self-contained, already-understood change that does not fit one area
  cleanly, or a plan task whose write set spans areas (still disjoint from any running project
  agent). Prefer the area agent when the files fall in one area: it carries the area's invariants,
  commands, and stop conditions.

## How to invoke

- Explicitly: start the prompt with the agent name or `@agent-name`, e.g.
  `@api-engineer add the closet item list endpoint per contract X`, or via the Agent tool with
  `subagent_type: "api-engineer"`.
- Automatically: Claude delegates based on each agent's `description` (trigger phrases and owned
  paths are listed there). Read-only reviewers say "use proactively" so they are picked before PRs.
- Project agents take precedence over ~/.claude/agents/ on a name collision; there is no
  collision today.

## Parallel sessions (from `CLAUDE.md`)

Parallel agent sessions must own **disjoint file sets**, agreed before launch; use one git worktree
per session, never two agents in one working tree. `packages/contracts`, `shared-kernel`, lockfiles,
`mise.toml`, CI config, and `CLAUDE.md` are **single-writer**: sequence those changes, never
parallelize them. Producers land before consumers: contract/schema work merges first; dependent
sessions rebase on it. The ownership table above is the disjoint-set agreement; the sequences above
are the producer order.

## Conventions

Answers from the `claude-code-guide` agent (2026-09-11), citing
https://code.claude.com/docs/en/sub-agents.md, https://code.claude.com/docs/en/permissions.md,
https://code.claude.com/docs/en/skills.md, https://code.claude.com/docs/en/agent-view.md, and
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md.

- **Frontmatter fields:** `name` (required; lowercase, hyphens, no colons), `description`
  (required; delegation trigger text, kept short: all non-built-in descriptions share a 15k-token
  budget), `tools` (allowlist; comma-separated string or YAML list), `disallowedTools` (denylist,
  applied first), `model` (`sonnet` | `opus` | `haiku` | `fable` | full id | `inherit`; omit to fall
  through), `permissionMode` (`default` | `acceptEdits` | `auto` | `dontAsk` | `bypassPermissions` |
  `plan` | `manual`), `maxTurns`, `skills` (preloaded skill content), `mcpServers`, `hooks`
  (per-agent lifecycle hooks), `memory` (`user` | `project` | `local`), `background`, `effort`,
  `isolation: worktree`, `color`, `initialPrompt`, `experimental`.
- **Restricting Bash:** the sub-agents page documents only exact tool names, `mcp__<server>`
  patterns, and `Agent(type)`; the permission-rule syntax `Bash(just:*)` (permissions page, "Bash"
  section) works in a subagent `tools` field and is what ~/.claude/agents/implementer.md uses, but
  it is not spelled out on the sub-agents page. These files use it (matching the existing global
  agents); the officially documented per-agent alternative is a `PreToolUse` hook with
  `matcher: "Bash"` that exits 2 on disallowed commands, and the project-wide alternative is a
  `permissions.allow` list in `.claude/settings.json`. If a future Claude Code version stops
  honouring patterns in `tools`, switch to the hook form.
- **`description` and automatic delegation:** the description is what the main conversation reads
  to decide whether to spawn the agent. Good ones state purpose and scope, name trigger phrases
  and owned paths, include "use proactively" for reviewers, and say when NOT to use the agent.
  The delegation message plus the agent body is all the agent sees.
- **Skills:** each agent body says "Read `.agents/skills/<area>/SKILL.md` before starting" rather
  than relying on the `skills:` frontmatter field, even though `.claude/skills/<name>` symlinks
  (present since 2026-09-11) make every skill discoverable — the field has not yet been confirmed
  to resolve a symlinked project skill for preloading, so the explicit read step stays authoritative
  until that is verified.
- **Context isolation:** a non-fork subagent starts with a fresh context: the agent body, the
  delegation prompt, every level of the CLAUDE.md hierarchy (built-in `Explore`/`Plan` skip it), a
  git status snapshot, preloaded skills, and the sibling roster. It does not see the parent
  conversation, files already read, or skills already invoked. The body must therefore name the
  files to read first and require the task restatement; CLAUDE.md rules arrive automatically, so
  the bodies restate only the rules that bite in the area.
- **Length and structure:** the docs suggest 1–5 concise paragraphs (role, scope, success
  criteria/output format, constraints). These files run 110–140 lines because each carries the
  area's commands, invariants, and stop conditions; keep them under ~140 lines and move anything
  larger into the skill files.
- **Model:** resolution order is per-invocation `model` → agent `model` field →
  `CLAUDE_CODE_SUBAGENT_MODEL` → the main conversation's model. `inherit` pins to the parent
  explicitly; omitting falls through. Pin `haiku` for cheap read-only work, `opus` for hard
  reasoning. Most of these agents omit `model` so the session's choice applies; `docs-maintainer`,
  `ml-engineer`, `release-manager`, `test-engineer`, and `tooling-engineer` pin `inherit` explicitly.
- **Invocation and precedence:** first-word match or `@agent-name` in the prompt,
  `claude --agent <name>` on the CLI, or the Agent tool. Project `.claude/agents/` beats
  ~/.claude/agents/ on a name collision.
