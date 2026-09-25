# module-reference.md template

> Copy this file to `<owning-skill>/references/<module-name>.md` (e.g.
> `.agents/skills/backend-module/references/closet.md`), one per SPINE module the
> skill covers via `metadata.modules`. This is per-module _implementation_ detail an
> agent needs while working in the module — it links to, and never duplicates,
> `docs/modules/<module-name>.md` (CLAUDE.md single source of truth: the module
> contract is the module's source of truth, this file is a pointer plus the facts
> that save a re-read). Target 40–70 lines; if a module needs more, that is a signal
> the module contract itself is missing detail — fix that instead of growing this
> file. Every placeholder below is followed by a real, filled example drawn from
> `docs/modules/closet.md`.

---

````markdown
# `<module-name>` — module reference

Last reviewed: <YYYY-MM-DD>

## Contract summary

One or two sentences pulled from `docs/modules/<module-name>.md`'s "Responsibility"
line, plus the link — never copy the full contract here, link it.
Real example (`closet`): "Item catalog, taxonomy, attributes, availability/laundry
state, collections, and wear history. Full contract:
[`docs/modules/closet.md`](../../../docs/modules/closet.md)."

## Invariants that bite

The 2–4 invariants from the module contract that implementers actually trip over —
not a copy of the full "Invariants" table, the ones worth a second read while coding.
Real example (`closet`): "No business rule lives in a controller, Drizzle schema
file, pg-boss job handler, provider wrapper, or React component (doc 04 §4.2 rule
9); adapters translate, this module decides. This module writes only the tables it
owns (doc 04 §4.2 rule 8); cross-module behaviour goes through public application
services or events."

## Key files

The handful of paths an agent opens first — not a directory tree.
Worked example, built from `docs/modules/closet.md`'s real facts (`closet`):

- `apps/api/src/modules/closet/index.ts` — public API, empty until the first export lands (per the contract's Public interface table)
- `apps/api/src/modules/closet/internal/schema.ts` — owned tables, once they exist
- `apps/api/src/modules/closet/tests/` — this module's test suite (per the contract's Tests section)

## Owned data

Tables/stores this module alone writes, one line each, matching the contract's
"Owned data" table — say "none yet" rather than inventing tables ahead of the phase
that adds them.
Real example (`closet`, P02 skeleton): "None yet. Planned per SPINE §3: `items`,
`categories` (taxonomy), `item_states`, `wear_events`. Table definitions, when
they exist, live in `apps/api/src/modules/closet/internal/schema.ts` and are
composed from `packages/db/` (ADR-0001 §3)."

## Events

Published and consumed events this module has _today_ — write "none yet" rather
than a speculative list; a skill's Workflow step already says where new events get
declared (`packages/contracts`).
Worked example (`closet`, P02 skeleton — its "Events" table has no rows yet):
"none yet."

## Allowed / forbidden edges

The module edges from `planning/04-architecture.md` §4.1 that matter here, plus the
one-line reason a forbidden edge is forbidden (name the `arch-check` rule id).
Worked example, condensed from `docs/modules/closet.md`'s "Dependencies
(allowed)" and "Forbidden dependencies" sections (`closet`): "Allowed: public
APIs of `profile` and `media`; `packages/shared-kernel`. Consumed by `outfit`,
`recommendation`, `fashion-intel`, `admin`, `assistant`. Forbidden: any other
module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only
(`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`)."

## Test command

```bash
just test <module-name>
```

## Phase tasks that touch this module

The current phase's task ids that read/write this module, from
`planning/phases/P<NN>-*.md` §12/§19 (task list and acceptance criteria), so an
agent knows what else is in flight here — update this line each phase, do not
leave a stale task id.
Worked example (`closet` today, per its contract's own "Status" line): "P02 —
skeleton only, no domain-phase task has touched this module yet; check
`planning/phases/P02-repo-foundations-and-ci.md` §12/§19 for the current task
list before assuming that still holds."

## Escalate when

The specific conditions that mean stop and hand back, each naming who to hand back
to — copy the register of the owning skill's "Stop / escalation" section, scoped to
this module, not a generic "ask for help".
Worked example, built from `docs/modules/closet.md`'s "Extension points" note
that "attribute kinds are declared once here and surfaced via
`packages/contracts`" (`closet`): "A taxonomy field needs to vary per user
rather than being declared once here — that contradicts the module's Extension
points note and is a data-model decision, not an implementation detail: raise it
before writing the migration."
````
