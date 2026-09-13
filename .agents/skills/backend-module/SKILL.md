---
name: backend-module
description: Create or change a NestJS domain module under apps/api/src/modules/ — application services, domain rules, ports, module-owned repositories, events, outbox usage — or add a port adapter in apps/api/src/platform/. Use for server-side domain work whose primary change is not the DB schema, the API contract, recommendation rules, or billing.
---

# Backend Domain-Module Changes

## Trigger

- Adding or changing behaviour inside one of the 13 domain modules (`identity`, `profile`, `avatar`, `closet`, `media`, `outfit`, `context`, `recommendation`, `fashion-intel`, `billing`, `notifications`, `admin`, `assistant`).
- Adding a port implementation in `apps/api/src/platform/` and binding it at the composition root.
- Do first, then return: `api-contract-change` (endpoint shapes), `db-migration` (tables), `recommendation-rules`, `entitlements-billing`, `media-ml-pipeline` (pipeline steps).

## Required reading

1. `docs/modules/<name>.md` — public interface, owned data, invariants, allowed/forbidden dependencies, extension points.
2. `planning/phases/P<NN>-*.md` current phase file — what this module delivers now; `PROGRESS.md`.
3. `planning/04-architecture.md` §4.2 (rules), §5 (composition roots), §9 (outbox semantics); `planning/03-domain-model-and-glossary.md` for terms.
4. `apps/api/src/modules/<name>/index.ts` and neighbours' `index.ts` — what is already public.

## Workflow

1. Restate scope, non-goals, acceptance criteria; name the single owning module. Behaviour that seems to belong to two modules is a contract question — stop.
2. Search before write (CLAUDE.md): this module's internals, neighbours' public APIs, `packages/shared-kernel/`, `packages/test-support/`.
3. Implement in `internal/`; export through `index.ts` only what `docs/modules/<name>.md` declares public. Controllers and pg-boss job handlers stay thin: parse via contract types → call application service → map result. No business rules in controllers, schema files, job handlers, or provider wrappers.
4. Cross-module needs go through the other module's `index.ts` or an event, never its tables or `internal/**`. A new edge must exist in doc 04 §4.1; update both contract docs in the same PR.
5. External capability = port interface in the module (or `shared-kernel` if shared) + adapter in `apps/api/src/platform/` + fake in `packages/test-support/`; bind in `apps/api/src/main.ts` / `app.module.ts` (or `apps/api/src/jobs/index.ts`). Never import a provider SDK in `modules/**`.
6. Async side effects go through the Postgres outbox with an idempotency key, retry policy, and DLQ path — no fire-and-forget.
7. Logging via the `platform` logger only; no `console.*`, no raw `req.body`, no sensitive fields (measurements, photos, location, tokens).
8. Tests in `apps/api/src/modules/<name>/tests/`: unit for rules (no framework), Testcontainers Postgres for repositories, fakes for ports. Bug fix = regression test that fails first, with output pasted.

## Validation commands

```bash
just test <module>
just lint && just typecheck && just arch-check
just generate --check                 # only if contracts were touched in a prior step
just ci-parity                        # before PR
```

## Output

- PR scoped to the module (plus `platform`/composition-root files when a port was added), with real test output; `docs/modules/<name>.md` updated when the public surface, invariants, events, or dependencies changed.

Done checklist: scoped tests green · `lint`/`typecheck`/`arch-check` green · nothing exported beyond the contract · no provider SDK or `platform` import in `modules/**` · contract doc updated · `PROGRESS.md` updated.

## Stop / escalation

- The task needs a forbidden edge or a weaker `arch-check` rule → ADR territory; stop.
- A schema or endpoint change surfaces mid-task → pause, run `db-migration` / `api-contract-change` as their own step, then continue.
- An invariant in `docs/modules/<name>.md` conflicts with the task → surface the conflict; never violate the contract quietly.
- Auth, consent, deletion, or webhook code → `security-privacy-review` before PR.

## Overlap

Adjacent: `api-contract-change` (wire shape first), `db-migration` (tables first), `recommendation-rules` / `entitlements-billing` / `media-ml-pipeline` (module-specific invariants take precedence inside those modules), `architecture-review` (reviews the result). This skill owns `internal/`, `index.ts`, ports, and `platform` adapters for all other modules.
