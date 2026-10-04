# PROGRESS — Root Pointer

The canonical, durable status ledger is **[`planning/PROGRESS.md`](planning/PROGRESS.md)**: phase status table, exact status vocabulary (`NOT_STARTED → IN_PROGRESS → DONE → ACCEPTED`, plus `BLOCKED`), transition rules, and the session-handoff log (newest first). Every session reads it first and updates it before ending, per `CLAUDE.md` (Session workflow, Completion checklist, Handoff protocol).

This root file exists so that `PROGRESS.md` resolves at the repository root as the operating contract expects; it never duplicates the ledger.

## Current phase

- **P02 — Repo foundations and CI:** `IN_PROGRESS`, started 2026-09-09 (ahead of P00 for the no-dependency subset, DEC-36). Task list, per-task state and acceptance criteria: [`planning/phases/P02-repo-foundations-and-ci.md`](planning/phases/P02-repo-foundations-and-ci.md) §12 and §19.
- **Last green:** `main` @ `0e8d140`, 2026-10-03, in CI: after PR #12 merged, the `ios`, `android` and `pr-gate` push runs and a manually started `nightly` all finished `success`; the nightly's vulnerability scan printed "No issues found" (3 filtered), ending four failed nightlies (2026-09-30 to 2026-10-03). Before the merge all 18 PR checks passed on PR #12's last commit `aed0eb7`. Earlier: all 18 CI checks on PR #12 @ `fd036b8` (2026-09-27), incl. `just ci-parity`, the macOS simulator build/test and the Android APK builds; `just ci-parity` locally on Linux 2026-09-26 on `fix/ci-main-red` (PR #10, merged); all 18 CI checks on PR #7 (`chore/native-followups` @ `6f1670a`, 2026-09-24), including the macOS simulator build/test and the Android APK builds, with `just ci-parity` locally on Linux the same day. **Not covered by that green:** `main` @ `27337d4` (PR #13) and branch `claude/project-next-steps-r6nu70` (2026-10-04; local gates without Docker, osv-scanner or macOS); no full local gate was run on 2026-10-03 or 2026-10-04, and `just security-scan`, and therefore `just ci-parity`, cannot pass on a machine whose gitignored `.env` holds real keys (gitleaks reports them; CI is unaffected); nothing from 2026-10-03 or 2026-10-04 has been run on macOS (see the 2026-10-03 handoff entry).
- **Latest handoff:** [`planning/PROGRESS.md`](planning/PROGRESS.md) → "Session handoff log" → entry dated 2026-10-04 ("Reviews of the PR #13 platform passes and their fixes; P02-T13 R2 adapter; repo-split audit"). PR #13 (the AI-17 follow-ups) merged to `main` as `27337d4`. Branch `claude/project-next-steps-r6nu70` adds the review fixes for the platform redaction passes and the worker, and the P02-T13 R2 adapter with its security suite (P02-T13 `PARTIAL`; Linear AI-21 In Progress). The repo-split readiness plan is in `.claude/plans/2026-10-04-repo-split-readiness-proposal.md`. Next action: CI on that branch's PR, owner review, the owner's R2 steps (bucket, token, live-suite run, WAF), the ADR-0008/0009 decisions before P03's first table, then P02-T18 (AI-26) and AI-28 on the Mac.

## How to update status

1. Change the phase row in `planning/PROGRESS.md` (status vocabulary and forward-only rule live there).
2. Append a handoff entry to the log in `planning/PROGRESS.md` using [`templates/session-handoff.md`](templates/session-handoff.md).
3. Keep the "Current phase" line above in sync when a phase changes status.
