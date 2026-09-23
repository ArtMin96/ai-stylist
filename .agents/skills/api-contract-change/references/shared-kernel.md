# `shared-kernel` — module reference

Last reviewed: 2026-09-23

## Contract summary

Pure types, constants, and registries shared by every module: ULID prefixes, units, the event
envelope type, and the error/reason-code/entitlement registries. Full contract:
[`docs/modules/shared-kernel.md`](../../../../docs/modules/shared-kernel.md).

## Invariants that bite

- `shared-kernel-pure`: the only dependency is `ulid`; no workspace package, no framework, no I/O.
  Every module and `platform` may import it, and it may import nothing back.
- To add a reason code, entitlement or unit: edit `registry/*.json`, run `just generate`, commit every output.
- Registries are append-only: add a reason code, entitlement name, unit, or ID prefix — never
  rename or reuse one (explanations come from the decision trace; a renamed code breaks history).
- Every export is a type, constant, registry entry, or pure function with a test; there is no
  integration tier because there is no I/O to integrate.

## Key files

- `packages/shared-kernel/src/index.ts` — the only public entry point; re-exports every file below in full.
- `packages/shared-kernel/src/ids.ts` — `ID_PREFIXES`, `newId`, `parseId`: prefixed ULIDs per aggregate kind.
- `packages/shared-kernel/src/units.ts` — canonical metric units, unit systems, measurement provenance, `convert`.
- `packages/shared-kernel/src/envelope.ts` — `EventEnvelope<T, P>`, the shape every outbox event and consumer shares.
- `packages/shared-kernel/src/errors.ts` — `ERROR_CODES`, `ProblemDetails`, `problem()`: the RFC 9457 shape the API returns.
- `packages/shared-kernel/registry/*.json` (+ `*.schema.json`) — the data source for reason codes, entitlements and units. `just generate` writes `src/gen/*.ts`, the Swift `AIStylistKernel` target and the Kotlin `app.aistylist.contracts.kernel` package from it (ADR-0005); never edit those outputs.
- `packages/shared-kernel/src/reason-codes.ts` — the recommendation reason-code registry types (data from `packages/shared-kernel/src/gen`).
- `packages/shared-kernel/src/entitlements.ts` — `ENTITLEMENTS`, `CREDIT_METERS`: names shared by billing, recommendation, and mobile.
- `packages/shared-kernel/tests/` — this package's test suite (single-writer, per `CLAUDE.md` "Parallel sessions").

## Owned data

None, ever (SPINE §3): types and constants only, no tables, no schema file.

## Events

None published or consumed directly — `envelope.ts` defines the shape every module's events use, it does not itself emit any.

## Allowed / forbidden edges

Allowed: nothing (`shared-kernel-pure`); every module and `platform` may import it; it may host
shared port interfaces, never their implementations. Forbidden: any edge that closes a cycle
(`no-cycles`); any workspace package, NestJS, Drizzle, Node I/O, or provider SDK
(`domain-no-provider-sdk`); creating `utils`, `helpers`, or `common` directories (`no-utils-dirs`).

## Test command

```bash
just test   # no scoped recipe for `shared-kernel`; the full turbo run covers packages/shared-kernel/tests/
```

## Phase tasks that touch this module

P02 — skeleton only. P02-T03 shipped the package (IDs/ULID prefixes, unit types + converters,
event envelope, error-code registry, reason-code/entitlement registry stubs) with tests; no
domain-phase task has extended a registry since. Check `planning/PROGRESS.md`'s "Current phase"
line before assuming that still holds.

## Escalate when

- A new registry value has no consumer yet and no doc 06/08 justification — adding speculative
  entries here is exactly the "copy-and-diverge" pattern `CLAUDE.md` forbids; stop and ask why it
  can't wait for the consumer.
- A change would give `shared-kernel` an I/O dependency or a workspace-package import — that
  breaks `shared-kernel-pure` for every consumer at once; stop, the capability belongs behind a
  port in the owning module or `platform` instead.
