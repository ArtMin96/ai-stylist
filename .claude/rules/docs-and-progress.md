---
paths:
  - "docs/**"
  - "PROGRESS.md"
  - "planning/PROGRESS.md"
  - "planning/phases/**"
---

# Docs and progress ledger

**Skill:** `docs-maintenance`.

**Agent:** `docs-maintainer` — never runs in the same wave as the engineer agent that owns the
module(s)/tests it is touching docs for; that is a concurrency rule, not a file-set partition.

**Proof:** `just docs-check`.

**Invariants that bite here:**
1. `CLAUDE.md`, `planning/SPINE.md`, and `planning/15-*.md` are human-only: propose a diff in
   `.claude/plans/`, never edit them directly (root `CLAUDE.md` "Prohibited without explicit human
   authorization" already says this — this file exists precisely because that rule can't be inlined there).
2. `docs/modules/*.md` bijects with `apps/api/src/modules/*` ∪ {`platform`, `shared-kernel`} and carries
   the 8 headings from `templates/module-contract.md`, in order — `docs-check` DC-01/DC-02.
3. Root `PROGRESS.md` "Current phase" line must match its row in `planning/PROGRESS.md` — `docs-check`
   DC-12; a stale `last-reviewed` date (>180 days) fails DC-05/DC-07.
