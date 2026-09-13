# Project subagents (`.claude/agents/`)

Project-level Claude Code subagents for the AI Stylist monorepo, one per area of the codebase.
Each runs in an isolated context with a restricted tool set, owns a disjoint write set, and hands
back anything outside it. `CLAUDE.md` always applies on top; the agent files only restate the rules
that bite in their area.

## Agents

| Agent | Owns (exclusive write set) | Must not touch | Verify with |
| --- | --- | --- | --- |
| `mobile-engineer` | `apps/mobile/**` except `src/render/**` | `src/render/**`, contracts, shared-kernel, `apps/api`, `workers`, lockfiles | `pnpm --filter @ai-stylist/mobile test`, `just lint`, `just typecheck`, `just arch-check`, `npx expo-doctor` |
| `api-engineer` | `apps/api/src/modules/{identity,profile,avatar,closet,media,billing,notifications,admin,assistant}/**`, `apps/api/src/{app.module,main,config}.ts`, `apps/api/src/dev/**`, `apps/api/tests/http.test.ts`, `apps/api/{package.json,tsconfig*.json,vitest.config.ts,eslint.config.mjs,README.md}`, `packages/test-support/**`, `docs/modules/<those>.md` | engine modules, `platform/**`, `jobs/**`, `packages/db`, contracts, shared-kernel | `just test <module>`, `just test api`, `just lint`, `just typecheck`, `just arch-check` |
| `platform-engineer` | `apps/api/src/platform/**`, `apps/api/src/jobs/**`, `packages/db/**`, `apps/api/tests/migrations/**`, `packages/seed-data/**`, `docker-compose.yml`, `docs/modules/platform.md` | `modules/**` (incl. `internal/schema.ts`), `app.module.ts`/`main.ts`, `packages/test-support`, contracts, shared-kernel | `just test platform`, `just test api`, `just db-reset --yes && just db-migrate && just db-seed`, `just db-rollback --yes && just db-migrate`, `just lint`, `just typecheck`, `just arch-check` |
| `contracts-engineer` | `packages/contracts/**`, `packages/shared-kernel/**`, `workers/ml/generated/**` (via `just generate` only), `docs/modules/shared-kernel.md` | everything else; **single-writer: never in parallel** | `just generate && just generate --check`, `pnpm --filter @ai-stylist/contracts lint` (spectral + oasdiff), `just typecheck`, `just test <consumers>`, `just lint`, `just arch-check` |
| `ml-engineer` | `workers/**` except `ml/generated/**`, `tools/codegen/gen-python.sh` | `workers/ml/generated`, `uv.lock` (unless granted), contracts, `apps/**`, other `tools/**` | `uv run --project workers pytest workers -q`, ruff, basedpyright, `just lint`, `just typecheck`, `just generate --check`, `just ml-eval` (stub) |
| `recommendation-engineer` | `apps/api/src/modules/{recommendation,outfit,context,fashion-intel}/**`, `docs/modules/<those>.md` | other modules, `platform/**`, `packages/db`, shared-kernel (reason-code registry), contracts | `just test recommendation` (+ `outfit`/`context`/`fashion-intel`), `just rec-replay <id>` (stub), `just lint`, `just typecheck`, `just arch-check` |
| `tooling-engineer` | `scripts/**`, `tools/**` except `tools/codegen/gen-python.sh`, `justfile`, `mise.toml`, `.github/**`, `.npmrc`, `.prettierignore`, `.prettierrc`, `.editorconfig`, `.pre-commit-config.yaml`, `.gitleaks.toml`, `.env.example` (keys only), root `eslint.config.mjs`, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `renovate.json`, `osv-scanner.toml`, `commitlint.config.mjs`, `docs/security/**` | product code, `CLAUDE.md`, `planning/**`; never weaken a gate | `just lint --fixtures`, `just arch-check --fixtures`, `shellcheck`, `actionlint`, `just doctor`, `just ci-parity` |
| `security-privacy-reviewer` | nothing (read-only) | edits of any kind | `just security-scan`, `just lint`, `git diff` |
| `architecture-reviewer` | nothing (read-only) | edits of any kind | `just arch-check`, `just lint`, `just typecheck`, `just generate --check`, `git diff` |

Unowned by any agent (human or orchestrating session only): `CLAUDE.md`, `planning/**`
(including `planning/PROGRESS.md`), `README.md`, `PROGRESS.md`, `CODEOWNERS`, `docs/adr/**`,
`docs/SERVICES-SETUP.md`, `docs/DEVELOPING-ON-MACOS.md`, `templates/**`, `prototype/**` (unimportable spike),
`.agents/skills/**` (skills are edited by humans; agents read them), `pnpm-lock.yaml` / `workers/uv.lock` (single-writer;
an agent changes one only when its task explicitly grants it), `secrets/**`, `.sops.yaml`,
`.spectral.yaml`. Every write-agent reports a **suggested `PROGRESS.md` line** instead of editing the
ledger, so parallel agents never collide on it; the orchestrating session applies those lines.

Cross-seam sequences (producer before consumer):

- Endpoint or event: `contracts-engineer` → `api-engineer` / `mobile-engineer` / `ml-engineer`.
- Table change: module owner edits `internal/schema.ts` → `platform-engineer` generates the
  migration + down file + migration test → module owner writes the repository code.
- New port: module owner declares the port and asks `api-engineer` for the fake in
  `packages/test-support` → `platform-engineer` implements the adapter → `api-engineer` binds it in
  `app.module.ts`.
- Any diff: `architecture-reviewer`, plus `security-privacy-reviewer` for auth/consent/deletion/
  webhooks/uploads/logging/AI egress.

## When to use the global agents instead

`~/.claude/agents/` provides `planner`, `implementer`, and `researcher`; the project agents do not
duplicate them.

- **`planner`**: before any non-trivial change (3+ steps, several files, shared structure). It
  produces the contract and the wave-sequenced task list with exclusive file ownership; the project
  agents then execute the tasks whose files fall in their write set.
- **`researcher`**: open questions, library/API facts (Expo, Filament, Drizzle, pg-boss, Coolify,
  RevenueCat, store policy), "how is X wired". Read-and-report only.
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
- Project agents take precedence over `~/.claude/agents/` on a name collision; there is no
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
  section) works in a subagent `tools` field and is what `~/.claude/agents/implementer.md` uses, but
  it is not spelled out on the sub-agents page. These files use it (matching the existing global
  agents); the officially documented per-agent alternative is a `PreToolUse` hook with
  `matcher: "Bash"` that exits 2 on disallowed commands, and the project-wide alternative is a
  `permissions.allow` list in `.claude/settings.json`. If a future Claude Code version stops
  honouring patterns in `tools`, switch to the hook form.
- **`description` and automatic delegation:** the description is what the main conversation reads
  to decide whether to spawn the agent. Good ones state purpose and scope, name trigger phrases
  and owned paths, include "use proactively" for reviewers, and say when NOT to use the agent.
  The delegation message plus the agent body is all the agent sees.
- **Skills:** the `skills` field preloads skills discoverable from `~/.claude/skills/`,
  `.claude/skills/`, or plugins. This repo keeps skills in `.agents/skills/<area>/SKILL.md`, which
  is not a discoverable location, so `skills:` cannot preload them; each agent body instead says
  "Read `.agents/skills/<area>/SKILL.md` before starting". (Suggested change, outside this
  directory: symlink `.claude/skills/<name>` → `../../.agents/skills/<name>` to make them
  discoverable and preloadable.)
- **Context isolation:** a non-fork subagent starts with a fresh context: the agent body, the
  delegation prompt, every level of the CLAUDE.md hierarchy (built-in `Explore`/`Plan` skip it), a
  git status snapshot, preloaded skills, and the sibling roster. It does not see the parent
  conversation, files already read, or skills already invoked. The body must therefore name the
  files to read first and require the task restatement; CLAUDE.md rules arrive automatically, so
  the bodies restate only the rules that bite in the area.
- **Length and structure:** the docs suggest 1–5 concise paragraphs (role, scope, success
  criteria/output format, constraints). These files run 110–125 lines because each carries the
  area's commands, invariants, and stop conditions; keep them under ~140 lines and move anything
  larger into the skill files.
- **Model:** resolution order is per-invocation `model` → agent `model` field →
  `CLAUDE_CODE_SUBAGENT_MODEL` → the main conversation's model. `inherit` pins to the parent
  explicitly; omitting falls through. Pin `haiku` for cheap read-only work, `opus` for hard
  reasoning. These agents omit `model` so the session's choice applies; the reviewers are
  candidates for a cheaper pin once their output quality is known.
- **Invocation and precedence:** first-word match or `@agent-name` in the prompt,
  `claude --agent <name>` on the CLI, or the Agent tool. Project `.claude/agents/` beats
  `~/.claude/agents/` on a name collision.
