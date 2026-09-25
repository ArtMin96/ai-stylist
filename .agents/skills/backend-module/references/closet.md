# `closet` — module reference

Last reviewed: 2026-09-13

## Contract summary

Item catalog, taxonomy, attributes, availability/laundry state, collections, and wear history. Full contract:
[`docs/modules/closet.md`](../../../../docs/modules/closet.md).

## Invariants that bite

- Taxonomy is single-sourced here (CLAUDE.md, Single source of truth); mobile, workers, and tests import or regenerate it, never copy it.
- No business rule lives in a controller, schema file, job handler, provider wrapper, or component; adapters translate, this module decides.
- This module writes only the tables it owns; cross-module behaviour goes through the owning module's public API or an event.

## Key files

- `apps/api/src/modules/closet/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/closet/internal/README.md` — placeholder; `apps/api/src/modules/<name>/internal/schema.ts` does not exist yet (P06 creates it via `db-migration`).
- `apps/api/src/modules/closet/tests/` — this module's test suite.

## Owned data

None yet. Planned per SPINE §3: `items`, `categories` (taxonomy), `item_states`, `wear_events`, defined in `apps/api/src/modules/<name>/internal/schema.ts` once P06 lands them.

## Events

None yet.

## Allowed / forbidden edges

Allowed: public APIs of `profile` and `media`; `packages/shared-kernel`. Consumed by `outfit`, `recommendation`, `fashion-intel`, `admin`, `assistant`. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); any edge outside the doc 04 §4.1 graph (`allowed-edges-only`).

## Test command

```bash
just test closet
```

## Phase tasks that touch this module

Status: skeleton (P02), no domain-phase task has touched it yet. `planning/phases/P06-closet-capture-pipeline.md` §6 brings the module live (items, taxonomy registry consumption, item-attribute rows, draft→confirmed lifecycle, dedup, correction semantics); `planning/phases/P07-closet-organization-and-sync.md` §6 follows with the availability-state machine, `wear_events`, tags/collections, and search indexing. Check both files' §12/§19 for the current task list.

## Escalate when

- A taxonomy field needs to vary per user rather than being declared once here — that contradicts the module's Extension points note and is a data-model decision, raise it before writing the migration.
- The change is really about wiring a vision/embedding provider for item attributes — that is `media-ml-pipeline`'s territory (the provider adapter lives in `platform`, `closet` only consumes the result as data).
