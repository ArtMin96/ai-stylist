# `shared-kernel` — module reference

Last reviewed: 2026-10-21

## Contract summary

Pure types, constants, and registries shared by every module: ULID prefixes, units, the event
envelope type, and the error/reason-code/entitlement registries. Full contract:
[`docs/modules/shared-kernel.md`](../../../../docs/modules/shared-kernel.md).

## Invariants that bite

- `shared-kernel-pure`: the only dependency is `ulid`; no workspace package, no framework, no I/O.
  Every module and `platform` may import it, and it may import nothing back.
- To add a reason code, entitlement, entitlement level, unit, error code, measurement definition or starting shape: edit `registry/*.json`, run `just generate`, commit every output.
- A value a native app reads reaches TypeScript, Swift and Kotlin through `just generate`
  (`.claude/rules/contracts.md` invariant 6). The JSON-imported registries outside `NATIVE_REGISTRIES` and the TS-only files
  below (`errors.ts`, `ids.ts`, `envelope.ts`, hand-written `as const` lists) hold server-only and
  worker-only values. A client-facing value there needs its emitter change in the same PR stack.
- Registries are append-only: add a reason code, entitlement name, unit, or ID prefix — never
  rename or reuse one (explanations come from the decision trace; a renamed code breaks history).
- Every export is a type, constant, registry entry, or pure function with a test; there is no
  integration tier because there is no I/O to integrate.

## Key files

- `packages/shared-kernel/src/index.ts` — the only public entry point; re-exports every file below in full.
- `packages/shared-kernel/src/ids.ts` — `ID_PREFIXES`, `newId`, `parseId`: prefixed ULIDs per aggregate kind.
- `packages/shared-kernel/src/units.ts` — canonical metric units, unit systems, measurement provenance, `convert`.
- `packages/shared-kernel/src/envelope.ts` — `EventEnvelope<T, P>`, the shape every outbox event and consumer shares.
- `packages/shared-kernel/src/errors.ts` — `ERROR_CODES`, `ProblemDetails`, `problem()`: the RFC 9457 shape the API returns. `ERROR_CODES` and `ErrorCode` are read from `packages/shared-kernel/registry/error-codes.json`; a new code is an entry there. The apps tell codes apart, so `just generate` emits the registry as `ErrorCode` for Swift and Kotlin (`.claude/rules/contracts.md` invariant 6); `problem()` and the types stay TS-only (like `ids.ts` and `envelope.ts`).
- `packages/shared-kernel/registry/*.json` (+ `*.schema.json`) — the data source for reason codes, entitlements, units, error codes, measurement definitions and starting shapes. `just generate` writes `src/gen/*.ts` from the first three, and the Swift `AIStylistKernel` target and the Kotlin `app.aistylist.contracts.kernel` package from all six (ADR-0005); never edit those outputs. The `forbidden-log-keys`, `log-redaction`, `correlation`, `owners`, `feature-flags`, `error-codes`, `measurement-definitions` and `starting-shapes` registries are imported as JSON in TS (no generated TS; the files below import the JSON directly); `just generate` also emits `forbidden-log-keys` (+ examples), `log-redaction` and `correlation` (joined with the event envelope's `correlationId` rule) for Python as `ai_stylist_generated.kernel` (DEC-59), and `packages/contracts/tests/kernel-registries.test.ts` validates each against its schema.
- `packages/shared-kernel/src/forbidden-log-keys.ts` — `FORBIDDEN_LOG_KEYS`, the redaction denylist every logger applies and the forbidden-field lint reads (non-TS readers read the JSON).
- `packages/shared-kernel/src/correlation.ts` — `CORRELATION_ID_HEADER`, `CORRELATION_ID_KEY`: the names the correlation id travels under (header, log key and span attribute), and `CORRELATION_ID_EXAMPLES`, the ids every check of the envelope's `correlationId` rule is tested against. Validity itself is the envelope schema's, never restated here.
- `packages/shared-kernel/src/owners.ts` — `OWNERS_REGISTRY`: people and roles that own flags, dashboards, alerts and runbooks.
- `packages/shared-kernel/src/feature-flags.ts` — the flag registry types and the `FeatureFlags` port (the PostHog adapter lives in `platform`).
- `packages/shared-kernel/src/reason-codes.ts` — the recommendation reason-code registry types (data from `packages/shared-kernel/src/gen`).
- `packages/shared-kernel/src/entitlements.ts` — `ENTITLEMENTS`, `CREDIT_METERS`: names shared by billing, recommendation, and the native apps (through the generated Swift/Kotlin kernels, which no app target consumes yet — ADR-0005).
- `packages/shared-kernel/tests/` — this package's test suite (single-writer, per `CLAUDE.md` "Parallel sessions").

## Owned data

None, ever (SPINE §3): types and constants only, no tables, no schema file.

## Events

None published or consumed directly — `envelope.ts` defines the shape every module's events use, it does not itself emit any.

## Allowed / forbidden edges

Allowed: nothing (`shared-kernel-pure`); every module and `platform` may import it; it hosts a
port interface + token when two modules share it (e.g. a `Clock`, or the trend-relevance port that
`recommendation` and `fashion-intel` both need but cannot import from each other), never an
implementation. Forbidden: any edge that closes a cycle
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
