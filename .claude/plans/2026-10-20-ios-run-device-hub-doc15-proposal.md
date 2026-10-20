# Proposal: name Device Hub for `just ios-run` in `planning/15-team-workflow-and-ai-agent-operations.md` (human-authorized only)

> Status: PROPOSED on 2026-10-20 (branch `chore/ios-xcode-27-1`).

**Why:** Xcode 27 has no Simulator.app; Device Hub (`Contents/Applications/DeviceHub.app`) replaced it.
`apps/ios/scripts/xcode.sh run` now opens Device Hub after the install. Doc 15 §5 still says the
recipe opens Simulator.app. The path guard denies agent edits to doc 15.

**Diff:**

```diff
-| `just ios-run` | Dev simulator build, then boot an iPhone simulator, open Simulator.app, install and launch the app (macOS only) |
+| `just ios-run` | Dev simulator build, then boot an iPhone simulator, install the app, open Device Hub and launch the app (macOS only) |
```

Line 128; the wording matches the `justfile` recipe comment.
