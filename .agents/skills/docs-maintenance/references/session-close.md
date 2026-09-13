# Session close — end-of-session procedure

Last reviewed: 2026-09-13

Run this whenever a session is ending, before clearing the session or context compaction, or when asked to
"wrap up", "handoff", or "log progress". `CLAUDE.md`'s Session workflow step 6 and Completion
checklist require every one of these; this file is the concrete sequence that satisfies them
without re-reading either doc from scratch each time. `docs-check` DC-12 only checks that the
pointer line matches the table row — it cannot check whether a handoff entry exists at all, so
skipping step 2 below leaves a silent gap no gate catches.

## The four steps, in order

1. **Update the phase table row** in `planning/PROGRESS.md`'s "Phase status" table: the `Status`
   column (only forward per the status-vocabulary rules there, `NOT_STARTED → IN_PROGRESS → DONE →
ACCEPTED`, or any status to `BLOCKED` and back) and the `Notes` column — a new blocker needs its
   `RISK-NN`/`OQ-NN` link inline, not a bare "blocked" word.
2. **Append a handoff entry** to the "Session handoff log" in `planning/PROGRESS.md`, newest first,
   using the exact section order in `templates/session-handoff.md` (phase/tasks worked, status
   changes, done this session, not done/in flight, repository state, new decisions/risks/questions,
   surprises/gotchas, next session starts). Link PRs/commits and phase files instead of restating
   them — the log gets long; a session that pastes its own diff into it makes the next session's
   orientation read slower, not faster.
3. **Sync the root pointer**, `PROGRESS.md` at the repo root: its "Current phase" line must restate
   the phase name and status word from the table row in step 1 (this is what `docs-check` DC-12
   checks), and "Latest handoff" must point at the entry from step 2. Do not paraphrase the status
   word — `IN_PROGRESS` in the table and "in progress" in the pointer is exactly the drift DC-12
   exists to catch.
4. **Leave the repository buildable, or say precisely what is broken.** The handoff entry's
   "Repository state" line needs the actual last-green command and, if red, the failing command
   plus its real error output — never "should be fine" or a paraphrase of an error you did not see.

## Phase-file task-state columns

When a task's state changed (e.g. `NOT_STARTED → IN_PROGRESS`, or `IN_PROGRESS → DONE`), update
that task's row in the current phase file's `## 12. Ordered tasks` (or equivalent numbered section)
table — the "State" column — in the same session. A task marked done in
`planning/PROGRESS.md`'s prose but not in the phase file's own table is the kind of drift this
skill exists to prevent, not just PROGRESS.md-level drift.

## What this is not

This is not the `just ci-parity` run itself — that is the owning engineer's job before requesting
review. This procedure records the _result_ of that run (green, or the exact red command and
error) in the handoff entry; it never re-runs the test suite on the maintainer's behalf.
