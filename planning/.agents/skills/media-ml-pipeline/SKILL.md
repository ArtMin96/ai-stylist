---
name: media-ml-pipeline
description: Build or change asset-processing and AI pipelines — pg-boss jobs in apps/api/src/jobs/, Python FastAPI ML workers, segmentation/classification/embedding/try-on steps, provider integrations (fal.ai etc.), caching and lineage — and run model evaluations. Use for anything in the media module's pipeline, workers/, or AI provider calls.
---

# Media / ML Pipeline Development

## Trigger

- Changes to the media processing state machine, pg-boss jobs, Python worker endpoints, model/provider calls (background removal, classification, embeddings, G2 try-on, missing-view synthesis), derived-asset generation, or their caching/lineage.

**Not this skill:** which model/provider to adopt (ADR + `planning/10` decision first); on-device ML in the app (`mobile-feature`); 3D asset formats (`native-3d-assets`).

## Required reading

1. `planning/07-3d-avatar-and-garment-pipeline.md` — pipeline stages, states, lineage/provenance rules.
2. `planning/10-ai-usage-cost-and-evaluation.md` — the AI-use classification for this step, cost budget, caching policy, fallback behavior, eval requirements, data policy (no provider training; approved-provider list).
3. The worker JSON schema versions in `packages/contracts` (worker request/response shapes are versioned contracts, doc 06).

## Workflow

1. Restate: pipeline stage(s) touched, cost per invocation, expected volume, and the deterministic alternative considered (deterministic-before-AI — if code/CV/query can do it reliably, no model call).
2. Semantic reuse: an equivalent derivation may already exist. Check the derivations/lineage model and existing tasks before adding a step that recomputes anything.
3. Implement to the pipeline invariants:
   - **Idempotent jobs** keyed on input content hash + step version; re-running never duplicates derived assets or spend.
   - **Cache before call:** hash inputs, look up existing derivative, store results with lineage (source asset, model+version, params, cost, confidence); invalidate only affected derivatives on upgrades.
   - **Provenance:** every generated view/asset is marked generated, with confidence; a user's real photo is never overwritten (SPINE §4).
   - **Failure paths:** retries with backoff/jitter, bounded attempts, dead-letter state, and a user-visible failed/retry state — no silently stuck items. Quarantine path for moderation/malware flags.
   - **Privacy:** EXIF stripped at ingest; face/body media only to providers on the doc-10/11 approved list; nothing sensitive in logs or job payload dumps.
4. Job ↔ Python boundary: versioned JSON schemas both sides (Pydantic mirror of the contract); bump schema version on shape change, keep the previous version accepted during rollout.
5. Model/prompt changes are versioned; record model id + version + params in lineage so outputs are reproducible and eval deltas attributable.
6. Tests: state-machine transition tests + idempotency/retry/cancellation tests in `media/tests/`; worker unit tests in `workers/<service>/tests/`; contract tests against schema fixtures. Eval before merge for quality-affecting changes.

## Validation

```bash
just test media && just test workers
just ml-eval --suite <segmentation|classification|tryon|embeddings>   # golden datasets, doc-10 metrics
just lint && just typecheck && just generate --check
just dev-workers                          # run pipeline locally end to end on seed images; report actual outcome
```

Report eval metrics + estimated cost delta per 1k items (before → after, real numbers).

## Stop / escalate

- Eval below the doc-10 quality threshold, or cost/item above budget → stop; ship behind the gate is a human decision.
- A step needs a provider not on the approved privacy list → stop; doc 11 review first.
- Reprocessing would destroy user corrections → stop; corrections always survive model upgrades (doc 07); design the merge path with a human.
