# `media` — module reference

Last reviewed: 2026-09-13

## Contract summary

Upload, the asset-pipeline state machine, derived assets, lineage, and provenance. Full contract:
[`docs/modules/media.md`](../../../../docs/modules/media.md).

## Invariants that bite

- Never calls pg-boss, R2, or fal.ai SDKs directly; async side effects and provider calls go through ports implemented in `platform` plus the Postgres outbox (doc 04 §9).
- A real user photo is never replaced by a generated one; every generated asset carries a provenance marker and a confidence value (CLAUDE.md).
- Photos and face-derived data are sensitive per doc 11 — the same logging/fixture/prompt restrictions as measurements apply here.

## Key files

- `apps/api/src/modules/media/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/media/internal/README.md` — placeholder; `apps/api/src/modules/<name>/internal/schema.ts` does not exist yet (P06 creates it via `db-migration`).
- `apps/api/src/modules/media/tests/` — this module's test suite.

## Owned data

None yet. Planned per SPINE §3: `media_assets`, `derivations`, `processing_jobs` metadata, defined in `apps/api/src/modules/<name>/internal/schema.ts` once P06 lands them.

## Events

None yet.

## Allowed / forbidden edges

Allowed: `packages/shared-kernel` only; storage and job execution go through ports (`StorageProvider`, outbox) implemented in `platform`. Consumed by `closet`, `admin`. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); any edge outside the doc 04 §4.1 graph (`allowed-edges-only`).

## Test command

```bash
just test media
```

## Phase tasks that touch this module

Status: skeleton (P02), no domain-phase task has touched it yet. `planning/phases/P06-closet-capture-pipeline.md` §6 brings the module live: the pipeline state machine (doc 07 §8.1), `media_assets` + `derivations` + lineage, upload sessions (signed URLs), EXIF strip, quarantine states, reprocessing rules. Minor follow-on touches land in P04 (avatar asset kind) and P10 (outfit-presentation derivatives). Check `planning/phases/P06-closet-capture-pipeline.md` §12/§19 for the current task list.

## Escalate when

- The actual pipeline step logic (segmentation, classification, embedding, try-on calls) is what's being built — that is `media-ml-pipeline`'s territory; this module only owns the state machine, lineage, and the ports those steps are called through.
- Anything would let a generated asset stand in for a real user photo without a provenance marker — stop, that is an honesty-invariant violation.
