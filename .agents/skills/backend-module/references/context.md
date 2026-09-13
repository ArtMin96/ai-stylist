# `context` — module reference

Last reviewed: 2026-09-13

## Contract summary

Context-provider ports (weather, holiday, occasion; future calendar) and context facts with freshness, confidence, and consent. Full contract:
[`docs/modules/context.md`](../../../../docs/modules/context.md).

## Invariants that bite

- Never imports Open-Meteo or any other provider client directly; unknown context is reported explicitly (a missing-data note or lowered confidence), never invented (doc 09).
- `collect()` orchestration must never throw and must be side-effect free (doc 09 §2.2) — a provider failure becomes a `MissingFact`, not an exception that breaks the caller.
- Precise location is sensitive per doc 11; consent scope is carried on the fact by construction, not bolted on afterward.

## Key files

- `apps/api/src/modules/context/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/context/internal/README.md` — placeholder; `apps/api/src/modules/<name>/internal/schema.ts` does not exist yet (P08 creates it via `db-migration`).
- `apps/api/src/modules/context/tests/` — this module's test suite.

## Owned data

None yet. Planned per SPINE §3: `context_facts` (cached), defined in `apps/api/src/modules/<name>/internal/schema.ts` once P08 lands it.

## Events

None yet.

## Allowed / forbidden edges

Allowed: `packages/shared-kernel` only; providers (Open-Meteo for weather, the embedded `date-holidays` library for holidays, DEC-45) sit behind ports implemented in `platform`. Consumed by `recommendation`, `assistant`. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); any edge outside the doc 04 §4.1 graph (`allowed-edges-only`).

## Test command

```bash
just test context
```

## Phase tasks that touch this module

Status: skeleton (P02), no domain-phase task has touched it yet. `planning/phases/P08-context-providers.md` §6 brings the module live: the `ContextProvider` port + registry, `collect()` orchestration, the `context_facts` cache, freshness derivation, override handling, `MissingFact` semantics, and `ContextSnapshot` assembly for P09 to consume. Check that file's §12/§19 for the current task list.

## Escalate when

- A provider call (Open-Meteo, holidays, geocoding) would import an SDK or HTTP client directly inside this module instead of through a `platform`-implemented port — stop, that violates `domain-no-provider-sdk`.
- A gap in context data is about to be filled with a guessed value instead of a `MissingFact`/lowered confidence — stop, doc 09 forbids inventing context.
