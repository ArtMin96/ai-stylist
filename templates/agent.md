# Agent template

> Copy the fenced block below to `.claude/agents/<agent-name>.md`, fill every `<placeholder>`, and delete
> every guidance comment (`#` lines in the frontmatter, `<!-- -->` in the body). The house standard is binding: `.claude/rules/agent-authoring.md` states it
> and `just docs-check` (DC-07) enforces the checkable parts. Keep the body to area facts only: the
> generic workflow, base-commit check, search-before-write procedure, common stop rules and the report
> format live once in the `agent-operating-contract` skill
> (`.agents/skills/agent-operating-contract/SKILL.md`), which every agent preloads. Never copy them in.
> After writing the file, add the agent's row to `.claude/agents/README.md` and run `just docs-check`.

````markdown
---
# House-standard keys only: name, description, tools, skills, color, hooks. Never set `isolation:`: the
# lead passes `isolation: "worktree"` per invocation when two write agents run in the same wave.

# Equals the file name `.claude/agents/<name>.md`; lowercase and hyphens.
name: <agent-name>

# At most 1024 characters, one paragraph, three parts:
#  1. What it implements, naming the owned paths (e.g. "under apps/ios/** and tools/codegen/gen-swift.sh").
#  2. Trigger phrases a router matches: technology names, SPINE module names, task nouns, paths.
#  3. "NOT for <adjacent task> (<other-agent>)" for every nearest neighbour, so delegation never has to
#     pick between two plausible agents.
description: Implements <area work> under <owned paths>. Use for "<trigger>", "<trigger>", "<trigger>", or any path under <owned path>. NOT for <adjacent task> (<other-agent>) or <adjacent task> (<other-agent>).

# Plain tool names only. A `Bash(just:*)`-style specifier in `tools` does NOT restrict Bash (probed
# 2026-09-25); the Bash hook below does. Write agents use exactly this line. Engineers that must read
# current docs for fast-moving APIs (ios, android, api, platform, ml, contracts) add `WebFetch, WebSearch`.
# Read-only reviewers drop `Edit, Write` and the write-set hook.
tools: Read, Grep, Glob, Edit, Write, Bash, Skill, ToolSearch

# The FULL SKILL.md of each listed skill is injected at startup. Always `agent-operating-contract`, plus
# every skill whose `metadata.owner-agent` names this agent. A listed skill must not set
# `disable-model-invocation: true`, because such a skill cannot be preloaded.
skills:
  - agent-operating-contract
  - <area-skill>

# One of: red, blue, green, yellow, purple, orange, pink, cyan (teal, indigo, gray and magenta are
# invalid). Pick a color that no agent able to run in the same wave already uses; check the roster in
# `.claude/agents/README.md`.
color: <color>

hooks:
  PreToolUse:
    # Only when `tools` has Edit or Write. `args` are the write set: `**` = any depth, `*` = any
    # characters including `/`, a leading `!` excludes. A path outside the checkout is allowed only
    # under the session scratchpad. Never list `.claude/**`, `.agents/**`, `scripts/hooks/**` or
    # `templates/**`: that enforcement layer belongs to the main session.
    - matcher: 'Edit|Write|NotebookEdit'
      hooks:
        - type: command
          command: '${CLAUDE_PROJECT_DIR}/scripts/hooks/guard-agent-write-set.sh'
          args: ['<glob>', '<glob>', '!<excluded glob>']
    # Only when `tools` has Bash. `args` are glob patterns for the simple commands this agent may run on
    # top of the built-in read-only baseline (ls, cat, rg, git status/diff/log/show, find, …). List one
    # `just <recipe>*` pattern per recipe in the Verification block below. Never: `just generate`
    # without `--check` (contracts-engineer only), write-mode `just format`, or any git write command.
    - matcher: 'Bash'
      hooks:
        - type: command
          command: '${CLAUDE_PROJECT_DIR}/scripts/hooks/guard-agent-bash.sh'
          args: ['just <recipe>*', 'just <recipe> --check*']
---

You are <one sentence: the role, the stack, and "one scoped task inside this write set; everything else
is handed back">.

<context>
<!-- Only what an agent cannot infer and what root `CLAUDE.md` and `.claude/rules/<area>.md` do not
already say: the stack and pinned versions, the area's module boundaries, and each invariant with the
mechanism that enforces it (depcruise rule id, `just <area>-check-banned` rule, path-guard pattern) or
"(reviewer-checked)", so an agent that doubts a rule knows where to verify it. -->
<Stack line.>
<Invariant — enforcement.>
</context>

<ownership>
<!-- Mirror the write-set hook `args` exactly; a mismatch is a defect. -->
Write set: <path>, <path>.
Shared, wave-serialized (never in the same wave as the other owner): <e.g. `docs/modules/<name>.md` with
docs-maintainer> | none.
Never write: <path> (<owning agent>); <path> (<owning agent>); `.claude/**`, `.agents/**`,
`scripts/hooks/**`, `templates/**` (main session); `CLAUDE.md`, `planning/**` (human; the change goes in
the report).
</ownership>

<instructions>
<!-- Area steps only; the `agent-operating-contract` workflow runs around them. -->
1. Copy the structure from: <exact sibling file per kind of change, e.g. view model, screen, service,
   test, fake>. Name real files that exist today; never "the closest existing file".
2. <Area step that a generic workflow would get wrong, with the reason in one clause.>
3. Verify with the `## Verification` block in <output_format>.
</instructions>

<constraints>
- <Area rule> because <the one clause that makes it necessary> — <enforcement or "(reviewer-checked)">.
- Stop and hand back (do not guess): <condition> → <agent or human that takes over>; <condition> →
  <agent or human>.
</constraints>

<examples>
<example>
<input><A realistic task a lead would hand this agent, naming real files or modules in this repo.></input>
<output><Which files it touched, which Verification commands it ran and their decisive output lines, then
the `agent-operating-contract` report with this agent's name, Base and Worktree filled in.></output>
</example>
</examples>

<output_format>

## Verification

```bash
<exact command>                      # one command per concern
<exact command>                      # only when <condition>
```

Report: the `agent-operating-contract` format. Self-review items: <area checklist item>; <item>.
Parity block: yes (client features on both apps) | no.
</output_format>

Last reviewed: <YYYY-MM-DD>
````

## House-style constraints this template establishes

What `just docs-check` DC-07 checks for every `.claude/agents/*.md`:

- `name`, `description` (at most 1024 characters), a `Last reviewed: YYYY-MM-DD` line no older than 180
  days, and a row in `.claude/agents/README.md`.
- `color` is one of the eight valid values; `tools` contains no `(`.
- Edit or Write in `tools` ⇒ the `guard-agent-write-set.sh` hook is present; Bash in `tools` ⇒ the
  `guard-agent-bash.sh` hook is present.
- Every `skills:` entry exists under `.agents/skills/`, and `agent-operating-contract` is listed.

Reviewer-checked, because no gate can check them: the write-set args equal `<ownership>`, the Bash
patterns cover exactly the Verification block, colors differ within a wave, step 1 names real sibling
files, and nothing from `agent-operating-contract` is copied into the body. Bump `Last reviewed` only
after re-checking the whole file against the code.
