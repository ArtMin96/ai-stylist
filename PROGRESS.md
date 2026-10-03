# PROGRESS — Root Pointer

The canonical, durable status ledger is **[`planning/PROGRESS.md`](planning/PROGRESS.md)**: phase status table, exact status vocabulary (`NOT_STARTED → IN_PROGRESS → DONE → ACCEPTED`, plus `BLOCKED`), transition rules, and the session-handoff log (newest first). Every session reads it first and updates it before ending, per `CLAUDE.md` (Session workflow, Completion checklist, Handoff protocol).

This root file exists so that `PROGRESS.md` resolves at the repository root as the operating contract expects; it never duplicates the ledger.

## Current phase

- **P02 — Repo foundations and CI:** `IN_PROGRESS`, started 2026-09-09 (ahead of P00 for the no-dependency subset, DEC-36). Task list, per-task state and acceptance criteria: [`planning/phases/P02-repo-foundations-and-ci.md`](planning/phases/P02-repo-foundations-and-ci.md) §12 and §19.
- **Last green:** all 18 CI checks on PR #12 (`artmins96/ai-17-…` @ `fd036b8`, 2026-09-27), incl. `just ci-parity`, the macOS simulator build/test and the Android APK builds; before that `just ci-parity` locally on Linux 2026-09-26 on `fix/ci-main-red` (PR #10, merged); earlier all 18 CI checks on PR #7 (`chore/native-followups` @ `6f1670a`, 2026-09-24), including the macOS simulator build/test and the Android APK builds; `just ci-parity` locally on Linux the same day. **2026-10-03: no full gate was run**, so the 2026-09-27 result stands as history only. The vulnerability gate was red on `main` (`nightly` failing since 2026-09-30) and on this branch; it is fixed in this branch's working tree only (uncommitted, CI not run). Partial verification by the lead after the fix, not a green gate: `scripts/ci/osv-scan.sh` exit 0 ("No issues found", 3 filtered, 15 lockfiles covered) and `pnpm audit --audit-level=high` exit 0 ("1 ignored: 1 high"). `main` stays red until PR #12 merges. `just security-scan`, and therefore `just ci-parity`, still cannot pass on this Linux machine: the working-tree gitleaks step reports 5 findings, all in the gitignored `.env` (see the 2026-10-03 handoff entry).
- **Latest handoff:** [`planning/PROGRESS.md`](planning/PROGRESS.md) → "Session handoff log" → entry dated 2026-10-03 ("P02-T09 follow-ups (AI-17): AC-1 and AC-4 evidence, vulnerability-gate fix, logging and tracing hardening"; branch `artmins96/ai-17-p02-t09-wire-observability-redaction-lint-canary-otel`, PR #12 open with its head unchanged at `1655729`; P02-T09 `PARTIAL` with AC-6, AC-7 and the second half of AC-10 open; nothing from 2026-10-03 is committed, pushed or reviewed). Next action: the owner commits the vulnerability fix and the ledger to PR #12's branch and pushes, then confirms CI is green; commits the rest to a stacked branch; stores the keys with `just secrets-edit dev`; runs AC-6 on the Mac and an Android device; merges PR #12; then the `main` run links for AC-7 and the nightly link for AC-10 are collected and AI-17 is closed (details in that entry).

## How to update status

1. Change the phase row in `planning/PROGRESS.md` (status vocabulary and forward-only rule live there).
2. Append a handoff entry to the log in `planning/PROGRESS.md` using [`templates/session-handoff.md`](templates/session-handoff.md).
3. Keep the "Current phase" line above in sync when a phase changes status.
