Continue the guided capture camera work from where the last session stopped.

1. Orient: read `CLAUDE.md`, `PROGRESS.md` and the newest `2026-10-22 (capture-camera)` handoff entries in
   `planning/PROGRESS.md`, then the brief's §16 and §17. Work in `.claude/worktrees/capture-camera` on
   `feat/capture-camera` (PR #56). Pull the branch first (`git pull --ff-only`).
2. Check PR #56's CI with `git gh pr checks 56`. Fix every failing check at its root cause, with new
   commits, and push. Never weaken a gate.
3. Run the exit loop: `just capture-frames`, then `just capture-sim` twice in a row on a quiet machine.
   Exit criteria, on both platforms: every simulator-testable case passes; 0 misses; false locks ≤ 10 %;
   "Take photo anyway" at 10 s ± 0.5 s, and at once with the screen-reader flag; the back-photo step and
   the underwear opt-in appear in screenshots; every guidance state is shot in light and dark;
   `just ios-check` and `just android-check` pass. Fix failures in this order: wrong lock or unlock, then
   wrong hint, then the rest. A case that stays stuck after a real attempt goes in the scoreboard as
   BLOCKED with the reason.
4. Finish: update the handoff entry with the two run folders, the scoreboard summary, the real command
   outputs and the device-only list; commit and push; then confirm CI on PR #56 is green or report each
   remaining failure.
