# SKILL.md template

> Copy the fenced block below to `.agents/skills/<skill-name>/SKILL.md`, then create the symlink
> `.claude/skills/<skill-name>` → `../../.agents/skills/<skill-name>` so Claude Code's skill loader finds
> it. Author it with `anthropic-skills:skill-creator`; the house standard is in
> `.claude/rules/agent-authoring.md`, and `just docs-check` (DC-05, DC-06) enforces the checkable parts.
> Fill every `<placeholder>`, delete every guidance comment (`#` lines in the frontmatter, `<!-- -->` in
> the body), add the skill's row to `.agents/skills/README.md`, and run `just docs-check`.
> A worked example of the finished shape: `.agents/skills/backend-module/SKILL.md` with its
> `.agents/skills/backend-module/evals/` pair.

````markdown
---
# Equals the directory name `.agents/skills/<name>/`; lowercase and hyphens.
name: <skill-name>

# The listing shows `description` (plus `when_to_use`, if set) truncated at 1,536 characters, and it is
# the only thing Claude reads before deciding to open this file. Put the key use case first:
#  1. Lead with the action the skill makes an agent do, not "helps with".
#  2. Name trigger phrases a user actually types: real paths, `just` recipes, SPINE module names.
#  3. End with "Not for <adjacent task> — use `<other-skill>` instead." for each nearest neighbour.
# DC-05: description at most 1024 characters, name + description at most 1536, a "Not for" marker.
description: <Action verb> <what> in <owned paths>. Use when <trigger phrases>. Not for <adjacent task> — use `<other-skill>` instead.

# Optional keys (official list: name, description, when_to_use, argument-hint, arguments,
# disable-model-invocation, user-invocable, allowed-tools, disallowed-tools, model, effort, context,
# agent, background, hooks, paths, shell, metadata, license, compatibility):
#   user-invocable: false            -> a background skill only Claude loads (e.g. agent-operating-contract)
#   argument-hint: "[feature description]"  -> a skill the user starts with an argument
#   disable-model-invocation: true   -> NEVER on a skill an agent lists in `skills:` (it cannot be preloaded)

metadata:
  # Values are unquoted scalars: `.prettierrc` has `singleQuote: true`, so `just format` would rewrite
  # "…" to '…', and a single-quoted date then fails DC-05 (docs-check strips only double quotes).
  # SPINE modules (planning/SPINE.md §3) this skill is the coverage owner for; empty when cross-cutting.
  # DC-08 cross-checks it against the module table in .agents/skills/README.md.
  modules: # empty, or a comma list such as closet,media
  # ISO date of the last full re-check against the code and the current phase file; DC-05 fails a date
  # older than 180 days. Bump it only after re-checking the whole file.
  last-reviewed: 2026-09-25
  # Agent(s) that execute this skill: comma list of `.claude/agents/<name>.md` names, or `main-session`
  # for a skill only the lead runs (e.g. cross-platform-feature). Every agent named here lists this skill
  # in its `skills:` frontmatter. docs-check validates that each name exists.
  owner-agent: ios-engineer # or a comma list, or main-session
---

# <Skill Title>

## Trigger

<!-- The concrete situations that mean "use this skill": task types, file globs, and a "do X first, then
return here" note for each adjacent skill. Consistent with `description`, but allowed more detail. -->

## Required reading

<!-- Numbered, in read order: the exact files and sections to read before acting. Every backticked path
must exist (DC-09) or be listed in `tools/docs/planned-paths.txt` with the phase task that creates it. -->

## Workflow

<!-- Numbered, imperative steps for this repo's real seams (module `internal/`, ports, the outbox, the
generated clients). Give the reason for any non-obvious step in one clause instead of a bare MUST. The
generic workflow (base check, orient, restate, search before write, verify, report) lives in the
`agent-operating-contract` skill: reference it, never copy it. -->

1. Copy the structure from: <exact sibling files that exist today, one per kind of change>.
2. <Area step.>

## Validation commands

<!-- One fenced bash block, one command per concern, conditional ones commented. Only recipes in
`just --summary` (DC-10), never a raw package-manager, script-runner or build-tool invocation (DC-11;
the banned list is in `scripts/docs/lib/checks-refs.sh`). -->

```bash
just <recipe> <args>
just <recipe>                          # only if <condition>
```

## Output

<!-- What the skill produces, plus the area's self-review checklist. An agent running this skill reports
in the `agent-operating-contract` format; list only the area items it self-certifies here. -->

Done checklist: <item> · <item> · <item>.

## Stop / escalation

<!-- Bulleted; each condition names the skill, agent or human that takes over. Never "ask for help". -->

- <Condition> → <who takes over and what they need>.

## Overlap

<!-- One paragraph: "Adjacent: `<skill>` (<the seam>) …" for every neighbour, which one wins on a shared
task, then "This skill owns <paths>." The modules named here match `metadata.modules`. -->
````

## House-style constraints this template establishes

What `just docs-check` checks for every skill:

- DC-05: `name` equals the directory; the description limits and "Not for" marker above;
  `metadata.last-reviewed` no older than 180 days; the seven headings `## Trigger`, `## Required reading`,
  `## Workflow`, `## Validation commands`, `## Output`, `## Stop / escalation`, `## Overlap`; fewer than
  500 lines (move per-module detail to `references/<module>.md`, shape `templates/module-reference.md`);
  `metadata.owner-agent` names existing agents or `main-session`; the
  `.agents/skills/<name>/evals/evals.json` and `.agents/skills/<name>/evals/trigger-evals.json` pair
  exists (shapes: `templates/skill-evals.json`, `templates/skill-trigger-evals.json`).
- DC-06: a row in `.agents/skills/README.md` and a resolving `.claude/skills/<name>` symlink; the symlink
  is the only copy, never a second physical file.
- DC-09, DC-10, DC-11: real paths, real recipes, no raw tool invocations.

Reviewer-checked: the Workflow names real sibling files, nothing from `agent-operating-contract` is
copied in, and every agent in `owner-agent` preloads the skill.
