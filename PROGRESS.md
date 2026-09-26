# PROGRESS — Root Pointer

The canonical, durable status ledger is **[`planning/PROGRESS.md`](planning/PROGRESS.md)**: phase status table, exact status vocabulary (`NOT_STARTED → IN_PROGRESS → DONE → ACCEPTED`, plus `BLOCKED`), transition rules, and the session-handoff log (newest first). Every session reads it first and updates it before ending, per `CLAUDE.md` (Session workflow, Completion checklist, Handoff protocol).

This root file exists so that `PROGRESS.md` resolves at the repository root as the operating contract expects; it never duplicates the ledger.

## Current phase

- **P02 — Repo foundations and CI:** `IN_PROGRESS`, started 2026-09-09 (ahead of P00 for the no-dependency subset, DEC-36). Task list, per-task state and acceptance criteria: [`planning/phases/P02-repo-foundations-and-ci.md`](planning/phases/P02-repo-foundations-and-ci.md) §12 and §19.
- **Last green:** all 18 CI checks on PR #7 (`chore/native-followups` @ `6f1670a`, 2026-09-24), including the macOS simulator build/test and the Android APK builds; `just ci-parity` locally on Linux the same day.
- **Latest handoff:** [`planning/PROGRESS.md`](planning/PROGRESS.md) → "Session handoff log" → entry dated 2026-09-26 ("Latest-stable upgrade of the whole repo"; branch `fix/prompt-audit-followups`, ADR-0006 / DEC-56). Next action: a human applies the guarded-docs patch (SPINE, doc 15, CI pg18 images), then `just ci-parity` and a CI run to confirm the macOS/iOS lanes.

## How to update status

1. Change the phase row in `planning/PROGRESS.md` (status vocabulary and forward-only rule live there).
2. Append a handoff entry to the log in `planning/PROGRESS.md` using [`templates/session-handoff.md`](templates/session-handoff.md).
3. Keep the "Current phase" line above in sync when a phase changes status.
