# Proposal: name Xcode 27.1 in `planning/15-team-workflow-and-ai-agent-operations.md` (human-authorized only)

> Status: PROPOSED on 2026-10-20 (branch `chore/ios-xcode-27-1`).

**Why:** the Xcode pin in `apps/ios/.xcode-version` moved from 27.0 to 27.1 on 2026-10-20 (DEC-54
amendment). Doc 15 still names 27.0. The path guard denies agent edits to doc 15.

**Diff:**

```diff
-Not in mise: **Xcode 27.0** (pinned by `apps/ios/.xcode-version`, checked by `just ios-doctor`; it provides Swift 6.4 on macOS); ...
+Not in mise: **Xcode 27.1** (pinned by `apps/ios/.xcode-version`, checked by `just ios-doctor`; it provides Swift 6.4 on macOS); ...
```

Line 40; only the version number changes.
