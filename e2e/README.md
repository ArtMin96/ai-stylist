# Maestro E2E flows

Documented exception to the test-placement rule: Maestro YAML flows live here, not in a `tests/`
directory (planning/04 §4.3, CLAUDE.md layout). One flow set is shared by the native iOS and Android
apps. Flows take the app id from the `APP_ID` variable (`appId: ${APP_ID}`), because each build
flavour has its own id: `app.aistylist.mobile.dev` (dev), `app.aistylist.mobile.preview` (preview),
`app.aistylist.mobile` (prod). The recipes target the dev build, the installable one on both platforms.

- `smoke.yaml` — launch, assert the "AI Stylist" header and the consent toggle are visible.
- `capture/` — the guided capture camera (capture brief `.claude/plans/2026-10-22-capture-camera-brief.md`
  §12): `picker`, `guides`, `hints`, `shutter`, `anyway`, `screen-reader`, `back-photo`, `pair`,
  `underwear`, `batch`, `import`, `permission` and `background`, plus `capture/subflows/` they call. Each
  camera plays a frame set through the Dev build's harness (`launchApp: arguments: captureFrameSet`), so
  they run on a simulator or emulator with no camera. They assert test IDs and take a screenshot of
  every state; timing is judged by the harness sweep, not by these flows. `just capture-sim-ios`,
  `just capture-sim-android` and `just capture-sim` run them all in light and dark after the sweep and
  write `artifacts/capture-camera/runs/<yyyy-mm-dd-hhmm>/` (`tools/capture-frames/README.md` "Simulator
  runs"). Two platform branches only, both for system UI: the photo picker's cell
  (`subflows/pick-newest-photo.yaml`) and the iOS-only no-camera screen in `permission.yaml`.

Run:

- iOS (macOS): `just ios-e2e` builds the Dev configuration for the simulator, installs it and runs the flow.
- Android: have an emulator or device online (`just android-run` boots the AVD `aistylist-dev` when none is, creating it on first use; a phone needs USB debugging; see [apps/android/README.md](../apps/android/README.md)), then `just android-e2e` installs the debug build and runs the flow.
- By hand: `maestro test -e APP_ID=app.aistylist.mobile.dev e2e/smoke.yaml`. A capture flow needs the
  frames first (`just capture-frames`; Android also `apps/android/tools/capture-frames.sh push`).

Both need the Maestro CLI (`mise install maestro`, pinned in `mise.toml`; it runs on the mise JDK 25). CI does not run
these flows yet: the `maestro` job in `.github/workflows/nightly.yml` is a placeholder until an emulator/simulator lane
exists. Do not claim a flow passed without that transcript.
