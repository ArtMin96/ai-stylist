---
paths:
  - "packages/contracts/**"
  - "packages/shared-kernel/**"
---

# API/event contracts and shared-kernel

**Skill:** `api-contract-change`.

**Agent:** `contracts-engineer`.

**Proof:** `just generate && just generate --check`, then `just test <each consuming module>` and
`just typecheck` (the API and workers must still compile against the regenerated clients).

**Invariants that bite here:**
1. Single-writer path (root `CLAUDE.md` "Parallel sessions") — confirm no other session owns
   `packages/contracts` or `packages/shared-kernel` before editing; sequence, never parallelize.
2. `shared-kernel` imports nothing but `ulid` — no I/O, no framework — depcruise `shared-kernel-pure`
   (`just arch-check`).
3. `packages/contracts/gen/**` is generated output: edit the YAML/JSON source and run `just generate`, never
   hand-edit `gen/**` — `just generate --check` catches drift.
