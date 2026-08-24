# P## — <Phase name>

> File name: `phases/P##-<slug>.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); write "None" explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P## — <name>
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** <…>
- **User-visible outcome:** <what a user can do after this phase that they could not before>
- **Why now:** <why this phase occurs at this point in the sequence>

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-XXX-NNN | | AC-1 |

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): <P## …> (per SPINE §5)
- External blockers: <OQ-NN / RISK-NN / vendor accounts / legal review>

## 4. In scope / out of scope

**In scope:** <…>
**Out of scope / non-goals for this phase:** <…deferred to P##; link, don't duplicate>

## 5. Product/UX behavior

Cover every state: **empty · loading · partial · failure · retry · recovery · offline · accessibility**.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| | | | | | |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); update each touched module's contract file.

| Module | Change | Contract update needed? |
|---|---|---|
| | | |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`): <…>
- Event schemas added/changed: <…>
- DB migrations (Drizzle): <forward + rollback plan>
- Generated clients to regenerate: <…>

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | |
| Backend | |
| Workers (ML/media) | |
| Data / migrations | |
| Infrastructure | |
| 3D / assets | |
| Admin / internal tools | |

## 9. AI vs deterministic decisions

For each AI use in this phase: classification (per brief §3.1), why deterministic code is insufficient, contract, fallback, cost budget — or link to the owning row in [10-ai-usage-cost-and-evaluation.md](../10-ai-usage-cost-and-evaluation.md).

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| | | | | |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11](../11-security-privacy-and-compliance.md)): <…>
- Consent required / consent UI changes: <…>
- Retention, deletion, and export impact: <…>
- Threat/abuse cases added to the threat model: <…>

## 11. Observability and analytics added in this phase

- Logs/metrics/traces for what this phase introduces: <…>
- Product analytics events (taxonomy per [14](../14-observability-operations-and-analytics.md)): <…>
- Alerts/dashboards/runbook entries: <…>

## 12. Ordered tasks

Small enough for one AI-assisted session each. Task IDs `P##-T##` are referenced by handoff entries.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P##-T01 | | — | 1 |

## 13. Parallelization

- Can run in parallel: <task groups + why they don't collide (disjoint files/modules)>
- Must be serial: <…>

## 14. Test-first plan (by module and level)

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| | | | | | |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | | |
| Cost | | |
| AI quality | | |
| Reliability | | |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): <…>
- Migration/backward-compatibility plan: <…>
- Rollback plan: <exact steps to revert safely>

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); add phase-local ones there, not here.

- Risks in play: <RISK-NN …>
- **Stop/kill criteria for this phase:** <objective condition → action>

## 18. Demo script

Exact steps proving the vertical slice end-to-end on a real device/environment. <numbered steps>

## 19. Acceptance criteria

Objectively verifiable statements — no "works well".

- AC-1: <…>
- AC-2: <…>

## 20. Definition of done

Exact commands and evidence required:

```bash
just test <scope>      # all pass, no skips
just lint typecheck    # clean
just arch-check        # module boundaries hold
# + phase-specific: device test run, eval suite, migration up/down, etc.
```

Evidence to attach/link: <screenshots, metric readouts, eval reports — never fabricated>.

## 21. Documentation and PROGRESS.md updates

- Docs to update: <module contracts, owning planning docs, runbooks>
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence.

## 22. Handoff note

Where exactly the next session starts (phase, task ID, first command). Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](session-handoff.md).
