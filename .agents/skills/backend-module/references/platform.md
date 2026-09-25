# `platform` — module reference

Last reviewed: 2026-09-25

## Contract summary

Infrastructure adapters that implement the ports declared by domain modules: storage (R2), durable jobs (pg-boss), outbox relay, logger, OTel init, PostHog server, resilience utilities, and provider SDK wrappers. Full contract:
[`docs/modules/platform.md`](../../../../docs/modules/platform.md).

## Invariants that bite

- Adapters translate only — no business rule lives in an adapter, task body, or provider wrapper (doc 04 §4.2 rule 9). If a "quick fix" here starts deciding something, it belongs in the domain module instead.
- This is the **only** place provider SDKs may be imported (`platform-leaf`, doc 04 §4.2 rule 5) — every other module reaches a provider only through a port `platform` implements.
- `apps/api/src/modules/**` is entirely off-limits to import from here, public API included (leaf-only) — `platform` is a leaf, domain modules depend on it via composition roots, never the reverse.

## Key files

- `apps/api/src/platform/index.ts` — public API: `PlatformModule.forRoot(bindings)` binds each port token to the adapter the composition root built; only composition roots import it.
- `apps/api/src/platform/ports/` — `clock.port.ts`, `health-probe.port.ts`, `storage.port.ts`: P02-interim platform ports. Copy their shape (type + `Symbol` token), not their placement: a new domain port is declared in the module's `index.ts` (or `packages/shared-kernel` when two modules share it), and its fake goes in `packages/test-support/src/`, not beside the port like `InMemoryStorageProvider`.
- `apps/api/src/platform/pg-health-probe.ts` — the adapter sibling (implements a port, never throws, no business rule).
- `apps/api/src/platform/version.controller.ts`, `apps/api/src/platform/health.controller.ts` — thin controller siblings.
- `apps/api/src/platform/problem.filter.ts` — RFC 9457 mapping for every thrown error.
- `apps/api/src/platform/logger.ts` — the only sanctioned logger; allowlist serialization + forbidden-key denylist (doc 11 §8).
- `apps/api/src/platform/outbox/README.md` — placeholder: the outbox relay is P02-T08 (`NOT_STARTED`).
- `apps/api/src/platform/tests/` — this module's tests (`*.test.ts` only inside a tests/ directory). pg-boss job-handler tests go in `apps/api/src/jobs/tests/<handler>.test.ts`, created with the first handler.

## Owned data

`platform_outbox` and `platform_idempotency_keys` (migrations `0001`/`0002`) — infrastructure tables, no domain data. No domain module reads them directly.

## Events

None yet.

## Allowed / forbidden edges

Allowed: `packages/shared-kernel` and provider SDKs only. Adapters are bound to ports at `apps/api/src/main.ts` / `app.module.ts` and, once P02-T08 lands it, the jobs composition root (see `apps/api/src/jobs/README.md`). Forbidden: `apps/api/src/modules/**` entirely (leaf-only); any edge that closes a cycle (`no-cycles`); creating utils/, helpers/, or common/ directories (`no-utils-dirs`); importing `prototype/**` (`prototype-unimportable`).

## Test command

```bash
just test platform
```

## Phase tasks that touch this module

Status: skeleton (P02). Unlike the other 7 modules this skill covers, `platform` work is spread across every domain phase rather than owned by one: `planning/phases/P03-identity-consent-onboarding.md` §6 (PostHog deletion adapter, export-archive builder, email stub), `planning/phases/P04-parametric-avatar-v1.md` §6 (R2 custom-domain avatar manifest delivery), `planning/phases/P06-closet-capture-pipeline.md` §6 (segmentation/attribute/embedding ports, R2 upload, pgvector), `planning/phases/P07-closet-organization-and-sync.md` §6 (sync cursors, delta feed, tombstone retention), `planning/phases/P08-context-providers.md` §6 (weather/holiday/geocoding adapters). Check the current phase file's §12/§19 before assuming a given adapter still holds.

## Escalate when

- A domain module wants to import a provider SDK directly instead of getting an adapter here — stop, that is `domain-no-provider-sdk`; add the port + adapter instead.
- A new adapter ships without a corresponding fake in `packages/test-support/src/` (`api-engineer` writes it, copying `packages/test-support/src/clock.ts`) — every domain module's tests that depend on the port lose their seam; report the fake you need before merging.
- The adapter needs pg-boss, the outbox relay, or R2 — P02-T08 and P02-T13 are `NOT_STARTED`; stop and sequence after them.
