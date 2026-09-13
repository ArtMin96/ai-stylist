# SKILL.md template

> Copy this file to `.agents/skills/<skill-name>/SKILL.md`, then symlink it from
> `.claude/skills/<skill-name>` (`ln -s ../../.agents/skills/<skill-name>
.claude/skills/<skill-name>`) — see CLAUDE.md's repository layout note on the
> `.agents/skills/` + `.claude/skills/` pair. Every `<placeholder>` below is followed
> by what a good value looks like, with a real example already in this repo. Delete
> this header and the guidance paragraphs under each heading before shipping —
> `docs-check` DC-05 requires the six section headings below plus `## Overlap` to
> all be present.

---

````markdown
---
# `name` MUST equal the skill's directory name (`.agents/skills/<name>/SKILL.md`).
# Lowercase, hyphenated, matches the roster names agreed in the plan that created
# this skill. Real example: `backend-module` (existing) or `docs-maintenance` (new,
# from the s3 plan's roster).
name: <skill-name>

# `description` is the ONLY trigger mechanism: Claude reads name + description
# before ever opening this file, and decides whether to consult it from that alone.
# One paragraph doing three things:
#  1. Lead with the action, not "helps with" — what does invoking this skill make
#     an agent do.
#  2. Give concrete trigger phrases a user would actually type: real file paths,
#     command names, SPINE module names — not abstract nouns like "backend work".
#  3. Close with at least one `Not for <adjacent task> — use \`<other-skill>\`
#     instead.` clause that resolves the nearest overlap, so two skills never
#     silently compete for the same task (this is what `docs-check` DC-05 checks
#     for: a negative-trigger clause must be present).
# Make it "a little bit pushy" per skill-creator — agents under-trigger skills by
# default, so a description that undersells relevance gets skipped even when it
# would have helped.
# Hard rule (checked by DC-05): len(name) + len(description) <= 1536 chars.
#
# Real example — existing skill `backend-module`, name+description = 14 + 338 = 352
# chars:
#   description: Create or change a NestJS domain module under
#     apps/api/src/modules/ — application services, domain rules, ports,
#     module-owned repositories, events, outbox usage — or add a port adapter in
#     apps/api/src/platform/. Use for server-side domain work whose primary change
#     is not the DB schema, the API contract, recommendation rules, or billing.
#
# Real example — a NEW skill from the s3 roster, `docs-maintenance`, name+description
# = 16 + 561 = 577 chars:
#   description: Keep PROGRESS.md, module contracts (docs/modules/*.md), the ADR
#     index, and the skills/agents README coverage tables in sync with the code and
#     with each other — module-contract bijection, last-reviewed dates, broken
#     repo-path references, ADR file-to-index sync. Use when asked to update
#     PROGRESS.md, refresh a module contract after a public interface changed, fix
#     ADR index drift, or resolve a `just docs-check` failure. Not for writing the
#     code behind a doc change — use the owning module's skill (e.g.
#     `backend-module`) first, then this skill for the doc sync.
description: <what it does, leading with the action> Use when <concrete trigger phrases: real paths, commands, module names>. Not for <adjacent task> — use `<other-skill>` instead.

metadata:
  # Comma-separated SPINE module names (`planning/SPINE.md` §3) this skill is the
  # coverage-table owner for — this is what `docs-check` DC-08 cross-checks against
  # the module → owner table in `.agents/skills/README.md`. Empty string if the
  # skill is cross-cutting and owns no module directly.
  # Real example (`backend-module`, per the s3 plan's module → owner table, owns
  # 8 of the 15 SPINE modules — everything without its own dedicated skill):
  #   modules: "identity,profile,avatar,closet,media,outfit,context,platform"
  # Real example (`architecture-review`, cross-cutting, owns none):
  #   modules: ""
  modules: "<comma list or empty>"
  # ISO date this file was last checked against the current code and phase file.
  # `docs-check` DC-05 fails any date older than 180 days. Real example: "2026-09-13".
  last-reviewed: "<YYYY-MM-DD>"
  # The single agent (`.claude/agents/<name>.md`) that primarily executes tasks
  # under this skill — feeds the module → owner coverage table. Real example:
  # "api-engineer" for `backend-module`; "recommendation-engineer" for
  # `recommendation-rules`.
  owner-agent: "<agent-name>"
---

# <Skill Title>

## Trigger

<The concrete situations that mean "read this file": task types, file globs, a
"do first, then return to X" note for adjacent skills. Keep this consistent with
`description` — this section is read _after_ triggering, so it can go into more
detail than the 1536-char budget allows.
Real example (`backend-module`): "Adding or changing behaviour inside one of the
13 domain modules (`identity`, `profile`, …). Adding a port implementation in
`apps/api/src/platform/` and binding it at the composition root. Do first, then
return: `api-contract-change` (endpoint shapes), `db-migration` (tables),
`recommendation-rules`, `entitlements-billing`, `media-ml-pipeline` (pipeline
steps).">

## Required reading

<Numbered list, in read order, of the exact files/sections an agent must read
before acting. Every path must resolve in this repo, or be listed in
`tools/docs/planned-paths.txt` if a still-in-flight task in the same wave creates
it — `docs-check` DC-09 fails on a dead path.
Real example (`backend-module`):
"1. `docs/modules/<name>.md` — public interface, owned data, invariants,
allowed/forbidden dependencies, extension points. 2. `planning/phases/P<NN>-*.md` current phase file — what this module delivers
now; `PROGRESS.md`. 3. `planning/04-architecture.md` §4.2 (rules), §5 (composition roots), §9 (outbox
semantics); `planning/03-domain-model-and-glossary.md` for terms. 4. `apps/api/src/modules/<name>/index.ts` and neighbours' `index.ts` — what is
already public.">

## Workflow

<Numbered, imperative steps — the actual sequence of decisions and edits for this
repo's real seams (module `internal/`, ports, the outbox, etc.), not generic
project advice. Motivate a non-obvious rule instead of writing a bare "MUST" line
(skill-creator style: explain why, don't just command).
Real example, first two steps (`backend-module`):
"1. Restate scope, non-goals, acceptance criteria; name the single owning module.
Behaviour that seems to belong to two modules is a contract question — stop. 2. Search before write (CLAUDE.md): this module's internals, neighbours' public
APIs, `packages/shared-kernel/`, `packages/test-support/`.">

## Validation commands

Only real `just` recipes that appear in `just --summary` (`docs-check` DC-10
checks every `just <recipe>` token) — never a raw `pnpm --filter`, `uv run`,
`npx`, `drizzle-kit`, or `eas ` invocation (`docs-check` DC-11 bans exactly
these in `.agents/skills/**`). One fenced
`bash` block, one command per concern, commented where a command is conditional.
Real example (`backend-module`):

```bash
just test <module>
just lint && just typecheck && just arch-check
just generate --check                 # only if contracts were touched in a prior step
just ci-parity                        # before PR
```

## Output

<What the agent produces, plus the exact done-checklist it self-certifies against
before handing back — mirrors the report the calling agent emits.
Real example (`backend-module`):
"PR scoped to the module (plus `platform`/composition-root files when a port was
added), with real test output; `docs/modules/<name>.md` updated when the public
surface, invariants, events, or dependencies changed.
Done checklist: scoped tests green · `lint`/`typecheck`/`arch-check` green ·
nothing exported beyond the contract · no provider SDK or `platform` import in
`modules/**` · contract doc updated · `PROGRESS.md` updated.">

## Stop / escalation

<Bulleted, each condition tied to the skill or agent that takes over next — never
a vague "ask for help".
Real example (`backend-module`):
"- The task needs a forbidden edge or a weaker `arch-check` rule → ADR territory;
stop.

- A schema or endpoint change surfaces mid-task → pause, run `db-migration` /
  `api-contract-change` as their own step, then continue.
- An invariant in `docs/modules/<name>.md` conflicts with the task → surface the
  conflict; never violate the contract quietly.
- Auth, consent, deletion, or webhook code → `security-privacy-review` before
  PR.">

## Overlap

<One paragraph naming every adjacent skill, the seam that separates them, and
which one wins when a task could plausibly go to either — the module(s) named
here must match this skill's `metadata.modules` row in the module → owner
coverage table that `docs-check` DC-08 cross-checks.
Real example (`backend-module`):
"Adjacent: `api-contract-change` (wire shape first), `db-migration` (tables
first), `recommendation-rules` / `entitlements-billing` / `media-ml-pipeline`
(module-specific invariants take precedence inside those modules),
`architecture-review` (reviews the result). This skill owns `internal/`,
`index.ts`, ports, and `platform` adapters for all other modules.">
````

---

## House-style constraints this template establishes

Every skill built from it must satisfy these — `docs-check` enforces them downstream:

- `SKILL.md` body ≤ 500 lines. Per-module detail that would push it over goes to
  `references/<module>.md` (shape: `templates/module-reference.md`), never inline.
- `evals/evals.json` and `evals/trigger-evals.json` exist alongside `SKILL.md` —
  shapes: `templates/skill-evals.json`, `templates/skill-trigger-evals.json`.
- The directory is symlinked from `.claude/skills/<name>`; the symlink is the only
  copy — never a second physical file.
- Six sections plus Overlap, unchanged heading names — `docs-check` DC-05
  requires all seven headings present.
