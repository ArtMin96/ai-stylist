---
paths:
  - "packages/contracts/**"
  - "packages/shared-kernel/**"
  - "workers/ml/generated/**"
---

# API/event contracts and shared-kernel

**Skill:** `api-contract-change`.

**Agent:** `contracts-engineer` (single-writer). The generated trees `packages/contracts/gen/**`,
`packages/shared-kernel/src/gen/**` and `workers/ml/generated/**` are rewritten only by `just generate`.

**Proof:** `just generate && just generate --check`; then `just test <module>` for each consuming API
module, `just test` (the package tests have no scoped route), and
`just lint && just typecheck && just arch-check`. The pr-gate also runs spectral and oasdiff through
`scripts/ci/contracts-spectral.sh` and `scripts/ci/contracts-breaking.sh`.

**Invariants that bite here:**
1. Single-writer (root `CLAUDE.md` "Parallel sessions"): no other session edits `packages/contracts/` or
   `packages/shared-kernel/` at the same time, and a contract lands before its consumers. The dispatch
   prompt must state it (reviewer-checked).
2. `packages/shared-kernel/src/` imports nothing but `ulid`: no I/O, no framework — depcruise
   `shared-kernel-pure` (`just arch-check`).
3. Generated output is never hand-edited: change the YAML/JSON source, then run `just generate` — the
   PreToolUse path guard `scripts/hooks/guard-protected-paths.sh` denies `packages/contracts/gen/`,
   `packages/shared-kernel/src/gen/` and `workers/ml/generated/`; `just generate --check` catches drift.
4. Reason codes, entitlement names and units live in `packages/shared-kernel/registry/*.json` (ADR-0005).
   Swift consumes the generated `AIStylistKernel`, Kotlin `app.aistylist.contracts.kernel`; nobody copies
   a constant — `just generate --check` for the generated side; copies are reviewer-checked.
5. Analytics event names live in `packages/contracts/events/analytics/events.json`. Android uses the
   generated `AnalyticsTaxonomy`; the hand-written iOS names equal it byte for byte (reviewer-checked).
