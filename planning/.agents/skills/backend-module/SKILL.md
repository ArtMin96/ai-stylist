---
name: backend-module
description: Create or change a NestJS domain module in apps/api/src/modules/ — services, application logic, ports, module-owned data access, events. Use for server-side domain work that does not primarily change the DB schema (db-migration), the API contract (api-contract-change), or recommendation rules (recommendation-rules).
---

# Backend Domain-Module Changes

## Trigger

- Adding/changing behavior inside one of the SPINE §3 modules: application services, domain rules, ports, repositories, module events, outbox usage.
- Wiring a new port implementation in `platform`.

**Not this skill (do those first, then return):** schema/migration changes (`db-migration`), endpoint shape changes (`api-contract-change`), recommendation engine rules (`recommendation-rules`), billing/entitlements (`entitlements-billing`), Trigger.dev/ML pipelines (`media-ml-pipeline`).

## Required reading

1. The module's contract in `docs/modules/<name>.md`: public interface, owned data, invariants, events, allowed + forbidden dependencies, extension points.
2. Current phase file for what this module delivers now.
3. `planning/04-architecture.md` (composition roots, transaction boundaries, event/outbox rules) and `planning/03-domain-model-and-glossary.md` for terminology.

## Workflow

1. Restate scope + acceptance criteria; name the single module owning the change. If the behavior seems to belong to two modules, stop — that's a contract question, not a coding decision.
2. Semantic reuse check (CLAUDE.md): existing services/mappers/validators in this module and `shared-kernel` first.
3. Implement inside module internals; export through `index.ts` only what the contract declares public. Controllers stay thin: parse/validate via contract types → call application service → map result. No business rules in controllers, ORM models, or job handlers.
4. Cross-module needs go through the other module's public API or an event — never its tables or internals. New cross-module dependency = update both module contracts in the same PR and confirm `arch-check` allows the direction.
5. Provider access only via ports; new external capability = port interface in the module + implementation in `platform` + fake for tests.
6. Reliable async side effects use the outbox/event pattern (doc 06): idempotency key, retry policy, dead-letter path — no fire-and-forget writes.
7. Tests in `apps/api/src/modules/<name>/tests/`: unit tests for domain rules (no framework), integration tests against real disposable Postgres for repositories, contract-fake tests for ports. Regression-fails-first for bug fixes.

## Validation

```bash
just test <module>              # scoped, must include new tests
just lint && just typecheck
just arch-check                 # dependency direction + public-API-only imports
just ci-parity                  # before PR
```

## Output

- PR scoped to the module (plus `platform`/contract files if the workflow required them), with test evidence and updated module contract doc when the public surface or invariants changed.
- `PROGRESS.md` updated.

## Stop / escalate

- Change requires widening a forbidden dependency or weakening `arch-check` rules → stop; ADR territory.
- You need a schema or endpoint change mid-task → pause, run the corresponding skill as its own step, then continue.
- An invariant in the module contract conflicts with the task → stop and surface the conflict; never quietly violate the contract.
