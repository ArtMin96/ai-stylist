---
name: media-ml-pipeline
description: Build or change the asset-processing and AI pipeline — pg-boss job handlers under `apps/api/src/jobs/`, Python FastAPI workers under `workers/ml/<service>/`, segmentation/classification/embedding/try-on steps, provider calls (fal.ai etc.), derived-asset caching and lineage, idempotency/retry/DLQ behaviour, the Python codegen script `tools/codegen/gen-python.sh`, and model evals with `just ml-eval`. Use for "pg-boss job", "workers/ml", "segmentation", "classification", "embedding", "try-on", "fal.ai", "lineage", "provenance", "DLQ", "uv lockfile", or a pipeline eval. Not for choosing a model/provider in the first place (ADR + `planning/10-ai-usage-cost-and-evaluation.md`); not for the `media` module's state machine or public service — use `backend-module`; not for on-device ML — use `ios-feature` / `android-feature`; not for 3D asset formats (client-side 3D is deferred, no owner until it resumes).
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: ml-engineer,platform-engineer
---

# Media / ML Pipeline Development

## Trigger

- A pg-boss job handler, a `workers/ml/<service>/` endpoint, a provider call (fal.ai etc.), derived-asset generation, caching/lineage, an eval suite, the worker Docker image, or `tools/codegen/gen-python.sh`.
- Executing agents: `ml-engineer` owns `workers/**` (except the generated `workers/ml/generated/`) and `tools/codegen/gen-python.sh`; `platform-engineer` owns `apps/api/src/jobs/**` and the provider adapters in `apps/api/src/platform/`; the `media` module's state machine and public service belong to `api-engineer` under `backend-module`.
- State on 2026-09-25: the only worker is the segmentation echo stub; no job handler exists (P02-T08 `NOT_STARTED`, `apps/api/src/jobs/README.md`); `just ml-eval` is a stub that exits 2 (P02-T17).
- Not this skill: choosing a model/provider (ADR + doc 10 first); on-device ML (`ios-feature` / `android-feature`); 3D asset formats and render output; dashboards/alerts on pipeline metrics (`observability-analytics`).

## Required reading

1. `planning/10-ai-usage-cost-and-evaluation.md` — AI/non-AI table (§1), per-feature entries (§2.1–§2.5), cost guardrails (§6), approved providers; `planning/07-3d-avatar-and-garment-pipeline.md` — stages, states, lineage/provenance.
2. `docs/modules/media.md`; `planning/04-architecture.md` §9 (outbox → pg-boss: `singletonKey = event.id`, retry, DLQ).
3. `apps/api/src/jobs/README.md` and `apps/api/src/platform/outbox/README.md` — what exists today (placeholders), not what you assume.
4. `workers/README.md`, `workers/pyproject.toml` (uv workspace: members `ml/*`, one shared `workers/uv.lock`), `workers/ml/generated/README.md` (Pydantic models generated from `packages/contracts/events/*.json` by `tools/codegen/gen-python.sh`; never hand-edit).
5. `planning/11-security-privacy-and-compliance.md` §6 and §8 — data classes and log redaction; face/body media go only to approved providers.

## Workflow

1. Restate: stages touched, cost per invocation, expected volume, and the deterministic alternative considered. A new model call needs its doc 10 entry (schema, why not deterministic, cost/latency budget, cache key, fallback, eval) before code.
2. Search before write — an equivalent derivation, route, or schema may exist:

   ```bash
   git ls-files workers apps/api/src/jobs apps/api/src/platform
   rg -n -i '<step>|<provider>|lineage|provenance|confidence' workers/ml apps/api/src packages/contracts/events
   ```

3. Copy the structure from (worker side, all exist):

   | New thing                                                             | Copy from                                                                                                                                       |
   | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
   | Service package (workspace member, depends on `ai-stylist-generated`) | `workers/ml/segmentation/pyproject.toml`; add it to `workers/pyproject.toml` `[tool.uv.sources]`                                                |
   | App factory + access log                                              | `workers/ml/segmentation/src/ai_stylist_segmentation/app.py`                                                                                    |
   | Composition root + structlog redaction denylist                       | `workers/ml/segmentation/src/ai_stylist_segmentation/main.py`                                                                                   |
   | Thin routes with a provenance marker                                  | `workers/ml/segmentation/src/ai_stylist_segmentation/routes.py`                                                                                 |
   | Request/response models                                               | `workers/ml/segmentation/src/ai_stylist_segmentation/schemas.py`                                                                                |
   | Tests (httpx ASGI client, hypothesis, redaction)                      | `workers/ml/segmentation/tests/test_segment.py`, `workers/ml/segmentation/tests/test_redaction.py`, `workers/ml/segmentation/tests/conftest.py` |
   | Image                                                                 | `workers/ml/segmentation/Dockerfile` (built from the workspace root)                                                                            |

   API side: no job handler exists to copy. Provider adapters copy `apps/api/src/platform/pg-health-probe.ts` (implements a port declared by the module); job-handler tests go in `apps/api/src/jobs/tests/<handler>.test.ts`.

4. Invariants: jobs idempotent on input hash + step version; cache before call and store lineage (source asset, model + version, params, cost, confidence); provenance marker + confidence on every generated asset; a real photo is never overwritten; bounded retries with backoff, a DLQ state, and a user-visible failed/retry state; EXIF stripped at ingest; face/body media only to approved providers; no sensitive data in logs or payload dumps.
5. Job handlers are thin: they import public module APIs only and bind provider clients; provider SDKs stay in `apps/api/src/platform/` or the worker, never in `modules/**`.
6. API ↔ worker boundary: versioned JSON schemas in `packages/contracts/events/` (via `api-contract-change`), regenerated into `workers/ml/generated/` by `just generate`; bump on shape change and accept the previous version during rollout.
7. Model and prompt changes are versioned and recorded in lineage. A dependency change updates `workers/pyproject.toml` or the service `pyproject.toml` and the single workspace lock `workers/uv.lock` (single-writer lockfile) in the same change.

## Validation commands

```bash
just test workers                    # the workers/ uv workspace pytest suite (all services)
just test media                      # when the media module's state machine changed (backend-module work)
just ml-eval                         # stub (exit 2, P02-T17): report "Not run: stub", never a metric
just lint && just typecheck          # Ruff + basedpyright for workers; eslint/tsc for apps/api
just generate --check                # after an event schema or gen-python.sh change
just arch-check
just ci-parity                       # before PR
```

`just dev-workers` starts a long-running dev server (uvicorn on :8001); it is not a check — do not run it as one. Report eval metrics and estimated cost delta per 1k items as before → after real numbers only.

## Output

- PR with pipeline diff, lineage/version notes, eval output or the stub statement, cost delta, and the doc 10 entry for any new AI call. Report in the `agent-operating-contract` format.

Done checklist: idempotency + retry tests green · provenance fields set · provider on the approved list · no sensitive data in logs/fixtures · `workers/uv.lock` updated if deps changed · generated models regenerated, not edited · `PROGRESS.md` line suggested.

## Stop / escalation

- A job handler, retry/DLQ behaviour, or worker dispatch needs pg-boss or the outbox relay → P02-T08 is `NOT_STARTED`; stop at the worker side and name T08.
- A model call without a doc 10 entry, an eval below threshold, or cost above budget → stop; shipping behind a gate is a human decision.
- A provider not on the doc 10/11 approved list → stop; `security-privacy-review` first.
- Reprocessing would destroy user corrections → stop; corrections survive model upgrades (doc 07).
- The task needs the `media` module's service, a job handler, and a worker changed at once → one agent per file set in this order: `api-engineer` (media module) → `platform-engineer` (handler) → `ml-engineer` (worker); never write another agent's files.
- `just generate` output in `workers/ml/generated/` looks wrong → fix `tools/codegen/gen-python.sh` (this skill) and regenerate; never edit the output.

## Overlap

Adjacent: `backend-module` (the `media` module's state machine and public service), `api-contract-change` (worker request/response and event schemas), `fashion-intel-ingestion` (fashion-intel-specific pipeline stages that reuse this plumbing), `data-lifecycle` (job cancellation on consent withdrawal or deletion), `performance-profiling` (job throughput budgets), `observability-analytics` (dashboards and alerts on `queue.depth`, `pipeline.stage.duration`, DLQ counts), `security-privacy-review` (provider egress, uploads). This skill owns `workers/**` except `workers/ml/generated/`, `tools/codegen/gen-python.sh`, and `apps/api/src/jobs/**`. Pipeline provider adapters are `platform` files (owned by `backend-module`) that must also meet this skill's invariants.
