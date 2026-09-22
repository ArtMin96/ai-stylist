# PROGRESS — Root Pointer

The canonical, durable status ledger is **[`planning/PROGRESS.md`](planning/PROGRESS.md)**: phase status table, exact status vocabulary (`NOT_STARTED → IN_PROGRESS → DONE → ACCEPTED`, plus `BLOCKED`), transition rules, and the session-handoff log (newest first). Every session reads it first and updates it before ending, per `CLAUDE.md` (Session workflow, Completion checklist, Handoff protocol).

This root file exists so that `PROGRESS.md` resolves at the repository root as the operating contract expects; it never duplicates the ledger.

## Current phase

- **P02 — Repo foundations and CI:** `IN_PROGRESS`, started 2026-09-09 (ahead of P00 for the no-dependency subset, DEC-36). Task list, per-task state and acceptance criteria: [`planning/phases/P02-repo-foundations-and-ci.md`](planning/phases/P02-repo-foundations-and-ci.md) §12 and §19.
- **Last green:** `just ci-parity`, 2026-09-13 (locally, branch `chore/agent-setup`), before the native migration. Verification of the 2026-09-22 native migration (`chore/native-foundations`) is pending final verification.
- **Latest handoff:** [`planning/PROGRESS.md`](planning/PROGRESS.md) → "Session handoff log" → entry dated 2026-09-22 ("Native migration: React Native + Expo replaced by SwiftUI + Compose", [ADR-0004](docs/adr/0004-native-ios-and-android-clients.md)). Next action: on the team's Mac, `just ios-doctor && just ios-check`; then `just ci-parity` on the merged branch and open the PR.

## How to update status

1. Change the phase row in `planning/PROGRESS.md` (status vocabulary and forward-only rule live there).
2. Append a handoff entry to the log in `planning/PROGRESS.md` using [`templates/session-handoff.md`](templates/session-handoff.md).
3. Keep the "Current phase" line above in sync when a phase changes status.
