# Skills index

One `SKILL.md` per task type required by NFR-TEAM-100 (`planning/01-requirements-and-traceability.md`; doc 15 §12 points here). Each file has the six required sections — Trigger, Required reading, Workflow, Validation commands, Output, Stop / escalation — plus an Overlap note naming adjacent skills. Skills compose: run the producer skill first (contract, migration), then the consumer. `CLAUDE.md` rules always apply on top.

| Skill                                                         | Use when                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`api-contract-change`](api-contract-change/SKILL.md)         | Any OpenAPI/event schema change in `packages/contracts` + regeneration         |
| [`architecture-review`](architecture-review/SKILL.md)         | Reviewing a diff for boundary violations, duplication, source-of-truth drift   |
| [`backend-module`](backend-module/SKILL.md)                   | Domain work inside `apps/api/src/modules/<name>/` or a `platform` adapter      |
| [`db-migration`](db-migration/SKILL.md)                       | Drizzle schema, migrations, backfills, rollbacks                               |
| [`entitlements-billing`](entitlements-billing/SKILL.md)       | Plans, entitlements, credits, RevenueCat webhooks, paywall gating              |
| [`media-ml-pipeline`](media-ml-pipeline/SKILL.md)             | pg-boss jobs, Python workers, AI provider calls, evals                         |
| [`mobile-feature`](mobile-feature/SKILL.md)                   | Screens, navigation, offline, native bridges outside the 3D boundary           |
| [`native-3d-assets`](native-3d-assets/SKILL.md)               | `apps/mobile/src/render/`, avatar/garment 3D, `assets/3d/`, device validation  |
| [`performance-profiling`](performance-profiling/SKILL.md)     | Budget investigations and verified perf claims                                 |
| [`recommendation-rules`](recommendation-rules/SKILL.md)       | Engine constraints, scoring, reason codes, evals, replay                       |
| [`release-readiness`](release-readiness/SKILL.md)             | Channel promotion evidence and GO/NO-GO                                        |
| [`security-privacy-review`](security-privacy-review/SKILL.md) | Review of auth, consent, sensitive data, webhooks, uploads, logging, AI egress |
| [`testing-regression`](testing-regression/SKILL.md)           | Bug fixes regression-first, coverage work, flaky tests                         |

Overlap review (AC-9): each skill's Overlap section names its neighbours and the seam; no two skills own the same file set. Where a task crosses seams, the order is contract → migration → module → UI → review → release.
