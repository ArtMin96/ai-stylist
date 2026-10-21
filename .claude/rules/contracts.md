---
paths:
  - "packages/contracts/**"
  - "packages/shared-kernel/**"
  - "workers/ml/generated/**"
---

# API/event contracts and shared-kernel

**Skill:** `api-contract-change`.
Line-level quality: `code-quality` with `.agents/skills/code-quality/references/typescript.md` only (its
language lock: never apply another language's idioms here).

**Agent:** `contracts-engineer` (single-writer). The generated trees `packages/contracts/gen/**`,
`packages/shared-kernel/src/gen/**` and `workers/ml/generated/**` are rewritten only by `just generate`.

**Proof:** `just generate && just generate --check`; then `just test <module>` for each consuming API
module, `just test` (the package tests have no scoped route), and
`just lint && just typecheck && just arch-check`. The pr-gate also runs spectral, oasdiff (`--fail-on WARN`) and the event-schema breaking check
(`packages/contracts/scripts/events-breaking.mjs`) through `scripts/ci/contracts-spectral.sh` and
`scripts/ci/contracts-breaking.sh`.

**Invariants that bite here:**
1. Single-writer (root `CLAUDE.md` "Parallel sessions"): no other session edits `packages/contracts/` or
   `packages/shared-kernel/` at the same time, and a contract lands before its consumers. The dispatch
   prompt must state it (reviewer-checked).
2. `packages/shared-kernel/src/` imports nothing but its own files, its `registry/*.json` data and
   `ulid`: no I/O, no framework — depcruise `shared-kernel-pure` (`just arch-check`).
3. Generated output is never hand-edited: change the YAML/JSON source, then run `just generate` — the
   PreToolUse path guard `scripts/hooks/guard-protected-paths.sh` denies `packages/contracts/gen/`,
   `packages/shared-kernel/src/gen/` and `workers/ml/generated/`; `just generate --check` catches drift.
4. Reason codes, entitlement names and units live in `packages/shared-kernel/registry/*.json` (ADR-0005).
   Swift consumes the generated `AIStylistKernel`, Kotlin `app.aistylist.contracts.kernel`; nobody copies
   a constant — `just generate --check` for the generated side; copies are reviewer-checked. The
   forbidden-log-keys, log-redaction, correlation, owners, feature-flags, error-codes,
   measurement-definitions and starting-shapes registries there are imported as JSON in TS (no
   generated TS); the last three are client-facing and owe Swift and Kotlin output (invariant 6); `just generate` emits forbidden-log-keys, its examples,
   log-redaction and correlation (with the envelope's `correlationId` rule) for Python as
   `ai_stylist_generated.kernel` (DEC-59). All are validated by `packages/contracts/tests/kernel-registries.test.ts` (`just test`).
5. Analytics event names live in `packages/contracts/events/analytics/events.json`. Android uses the
   generated `AnalyticsTaxonomy`; the hand-written iOS names equal it byte for byte (reviewer-checked).
6. Every value a native app reads reaches TypeScript, Swift and Kotlin through `just generate`. That
   covers registries, enums, error codes, id kinds and bounds. Each one is either a kernel registry that
   `tools/codegen/gen-kernel.mjs` emits for all three (`NATIVE_REGISTRIES`), or an OpenAPI enum or
   schema that lands in the generated `swift-client` and `kotlin-client`. A TS-only home (a JSON import,
   a hand-written `as const` list, `errors.ts`) is for server-only and worker-only values. A
   client-facing value without native output is not done. Its emitter change (`tools/codegen/kernel/`,
   owner `tooling-engineer`) lands in the same PR stack, before any native consumer. An OpenAPI enum
   that mirrors a kernel list has a contract test that pins the two value for value
   (`just generate --check` for the output; the rest reviewer-checked).
