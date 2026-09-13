# `outfit` — module reference

Last reviewed: 2026-09-13

## Contract summary

Garment representation levels (G0–G4), outfit composition, and saved outfits. Full contract:
[`docs/modules/outfit.md`](../../../../docs/modules/outfit.md).

## Invariants that bite

- Exposes item/composition **types** to `recommendation` only — no presentation or 3D/asset types cross that edge (doc 04 §4.2 rule 2). Adding a richer type to that export is a contract change, not a convenience.
- This module writes only the tables it owns; cross-module behaviour goes through `closet`'s public API, never its tables.
- New garment representation levels extend the G-ladder (SPINE §4) and `shared-kernel` capability codes, not a parallel model.

## Key files

- `apps/api/src/modules/outfit/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/outfit/internal/README.md` — placeholder; `apps/api/src/modules/<name>/internal/schema.ts` does not exist yet (P06 creates the first table via `db-migration`).
- `apps/api/src/modules/outfit/tests/` — this module's test suite.

## Owned data

None yet. Planned per SPINE §3: `outfits`, `outfit_items`, `garment_representations`, defined in `apps/api/src/modules/<name>/internal/schema.ts` once P06/P10 land them.

## Events

None yet.

## Allowed / forbidden edges

Allowed: public API of `closet`; `packages/shared-kernel`. Consumed by `recommendation` for item/composition types only. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); any edge outside the doc 04 §4.1 graph (`allowed-edges-only`); presentation or 3D/asset types on the `recommendation` edge (doc 04 §4.2 rule 2).

## Test command

```bash
just test outfit
```

## Phase tasks that touch this module

Status: skeleton (P02), no domain-phase task has touched it yet. A schema-only `OutfitPresentation` contract stub is ratified in `planning/phases/P04-parametric-avatar-v1.md` §6; `garment_representations` (with a G-level field) is added in `planning/phases/P06-closet-capture-pipeline.md` §6; the full `OutfitPresentation` assembly service (slot mapping, representation resolution, `fallbackChain`, compare-view) lands in `planning/phases/P10-outfit-on-avatar.md` §6. Check that file's §12/§19 for the current task list.

## Escalate when

- `recommendation` asks for anything beyond item/composition types (presentation shape, 3D/asset data) on this edge — that is forbidden by doc 04 §4.2 rule 2, stop rather than widen the export.
- The task is actually about composing the outfit scene on Filament (avatar + pose + presentation panel) — that crosses into `native-3d-assets`, which owns everything behind the render boundary.
