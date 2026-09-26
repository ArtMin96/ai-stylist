---
paths:
  - ".agents/**"
  - ".claude/agents/**"
  - ".claude/rules/**"
  - ".claude/skills/**"
  - ".claude/settings.json"
  - ".claude/settings.local.json"
  - "scripts/hooks/**"
  - "templates/agent.md"
  - "templates/skill.md"
  - "templates/skill-evals.json"
  - "templates/skill-trigger-evals.json"
---

# Enforcement layer: skills, agents, rules, hooks, settings

**Skill:** `anthropic-skills:skill-creator` for any `.agents/skills/**` change, starting from
`templates/skill.md`. For `.claude/agents/**`, copy `templates/agent.md`; no agent-authoring skill is
installed.

**Agent:** none. This layer belongs to the main session working with the human; no project agent's
write set includes `.claude/**`, `.agents/**`, `scripts/hooks/**` or `templates/**`, except that
`tooling-engineer` and `docs-maintainer` may create a new `.claude/plans/<yyyy-mm-dd>-<slug>-proposal.md`
(`human-only.md`). A project agent that needs a change here reports the exact text under "Noticed but not
touched".

**Proof:** `just docs-check` as a full run (about 10 s; DC-06 symlinks and DC-08 coverage run only
unscoped). For `.claude/settings.json` or `scripts/hooks/**`, also run `just lint-file <path>` and
`just docs-check --fixtures`, which replays the hook fixtures in `tools/docs/fixtures/hooks/`.

**Invariants that bite here:**
1. Agent frontmatter: `name`; a `description` of at most 1024 chars with purpose, trigger phrases,
   owned paths and a "NOT for … (`<agent>`)" clause; `tools` as plain names, never `Bash(...)`
   specifiers (they do not restrict Bash); `skills:` lists `agent-operating-contract` plus every skill
   whose `metadata.owner-agent` names the agent; `color` is one of red, blue, green, yellow, purple,
   orange, pink, cyan and differs from every other agent in the same wave; no `isolation:` key (the
   lead passes `isolation: "worktree"` per invocation) — `docs-check` DC-07.
2. `tools` with Edit or Write ⇒ a PreToolUse `Edit|Write|NotebookEdit` hook running
   `scripts/hooks/guard-agent-write-set.sh` with the agent's write-set globs. `tools` with Bash ⇒ a
   `Bash` hook running `scripts/hooks/guard-agent-bash.sh` with its allowed command patterns. Read-only
   reviewers get no Edit/Write. The globs never reach this layer; the patterns never allow a git write
   command or `just generate` without `--check` (only `contracts-engineer` may) — `docs-check` DC-07
   checks the hooks exist; the argument lists are reviewer-checked.
3. Agent body, in order: `<context>`, `<ownership>`, `<instructions>` (step 1 names the exact sibling
   files to copy), `<constraints>` ending "Stop and hand back (do not guess): …", `<examples>`,
   `<output_format>` (a `## Verification` bash block plus a pointer to the `agent-operating-contract`
   report), then `Last reviewed: YYYY-MM-DD`. The generic workflow, search-before-write procedure and
   report format live once in the `agent-operating-contract` skill; bodies reference them, never copy
   them — `docs-check` DC-07 checks the review date; the rest is reviewer-checked.
4. Skills: the seven headings of `templates/skill.md`, fewer than 500 lines, `metadata.last-reviewed`,
   `metadata.owner-agent` naming existing agents (comma list) or `main-session`, a description that
   leads with the key use case and has a "Not for" clause, an
   `.agents/skills/<name>/evals/evals.json` + `.agents/skills/<name>/evals/trigger-evals.json` pair,
   and a `.claude/skills/<name>` symlink — `docs-check` DC-05, DC-06.
5. A skill listed in an agent's `skills:` never sets `disable-model-invocation: true`, because such a
   skill cannot be preloaded (reviewer-checked).
6. Every backticked repo path in `.agents/skills/**`, `.claude/agents/**` and `.claude/rules/**`
   resolves, every `just <recipe>` exists, and no raw package-manager or build-tool invocation appears —
   `docs-check` DC-09, DC-10, DC-11.
7. Rules: `paths:` is the only frontmatter key; the body has `# <Area>`, **Skill:**, **Agent:**,
   **Proof:** and numbered invariants, each ending in its enforcement mechanism or "(reviewer-checked)".
   No two rules name different owners for one file; check each glob with
   `git ls-files ':(glob)<glob>'` (reviewer-checked).
8. Edits to `.claude/settings.json` and `scripts/hooks/**` prompt the human — `permissions.ask` in
   `.claude/settings.json`. The personal settings.local.json is never committed — `.gitignore`.
