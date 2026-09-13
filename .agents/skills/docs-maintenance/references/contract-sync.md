# Contract sync — public surface changed → contract section to update

Last reviewed: 2026-09-13

`docs/modules/<name>.md` is the module's source of truth (`CLAUDE.md`, "Single source of truth");
code that contradicts it is wrong until a `DEC-NN` entry says otherwise. That only holds if the
contract actually gets updated in the same change as the code — this table is the mapping from
"what changed" to "which of the 8 `templates/module-contract.md` headings to touch", so a sync
never turns into a full rewrite of a contract that is mostly still accurate. `docs-check` DC-01/
DC-02 enforce that the 8 headings exist, in order; DC-03 enforces that `**Last updated:**` is not
older than the module's `apps/api/src/modules/<name>/index.ts` /
`apps/api/src/modules/<name>/internal/schema.ts` — neither check reads whether the table
_rows_ inside a heading are actually right, so getting the content right here is on the agent, not
the gate.

## The mapping

| What changed in the code                                                                         | Contract section to update                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A new export added to (or removed from) `index.ts`                                               | **Public interface** — add/remove the row (Export, Kind, Purpose); never leave a removed export's row behind                                                                               |
| A new `pgTable(` in `apps/api/src/modules/<name>/internal/schema.ts`, or a column/table renamed  | **Owned data** — the table row (name, contents, sensitivity class per `planning/11-security-privacy-and-compliance.md`)                                                                    |
| A new invariant enforced in code, or one relaxed                                                 | **Invariants** — the numbered statement; every invariant needs at least one test, so name the test file in the same PR description even though this section doesn't hold test paths itself |
| A new event published or consumed (`packages/contracts` event schema referenced from the module) | **Events** — the matching published/consumed table row, payload schema owner stays `packages/contracts`                                                                                    |
| A new allowed dependency (another module's `index.ts`, a `shared-kernel` export, a port)         | **Dependencies (allowed)**                                                                                                                                                                 |
| A dependency that must never exist (a provider SDK import, another module's `internal/**`)       | **Forbidden dependencies** — name the `arch-check` rule id that would catch a violation (e.g. `public-api-only`, `domain-no-provider-sdk`) so a reader can verify the rule still holds     |
| A test suite added/moved, or a fixture/builder package changed                                   | **Tests** — location and required levels, per `apps/api/src/modules/<name>/tests/`                                                                                                         |
| A new extension point (a registered provider kind, a pluggable strategy)                         | **Extension points**                                                                                                                                                                       |

## Two fields every sync touches

- **Status** (`skeleton` \| `draft` \| `ratified`, per `docs-check` DC-03's allowed values) — bump
  only when the module actually crosses that line (a skeleton with its first real export becomes
  `draft`; `ratified` is a deliberate call, not automatic).
- **Last updated** — set to the date of the sync, but only after the section content above is
  actually correct; bumping the date without changing content just to silence DC-03 defeats the
  check.

## What never changes here

The module's **Responsibility** one-liner and **Owner** line change rarely and are a product/
architecture decision, not a mechanical sync — if a code change seems to need a different
responsibility statement, that is a contract question for the owning engineer to raise, not
something to infer from a diff.
