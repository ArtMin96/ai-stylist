# Maestro E2E flows

Documented exception to the test-placement rule: Maestro YAML flows live here, not in a `tests/`
directory (planning/04 §4.3, CLAUDE.md layout). One flow set is shared by the native iOS and Android
apps. Flows take the app id from the `APP_ID` variable (`appId: ${APP_ID}`), because each build
flavour has its own id: `app.aistylist.mobile.dev` (dev), `app.aistylist.mobile.preview` (preview),
`app.aistylist.mobile` (prod). The recipes target the dev build, the installable one on both platforms.

- `smoke.yaml` — launch, assert the "AI Stylist" header and the consent toggle are visible.

Run:

- iOS (macOS): `just ios-e2e` builds the Dev configuration for the simulator, installs it and runs the flow.
- Android: start an emulator (or connect a device; needs `adb` from the SDK, see [apps/android/README.md](../apps/android/README.md)), then `just android-e2e` installs the debug build and runs the flow.
- By hand: `maestro test -e APP_ID=app.aistylist.mobile.dev e2e/smoke.yaml`.

Both need the Maestro CLI (`mise install maestro`, pinned in `mise.toml`; it runs on the mise JDK 25). CI does not run
these flows yet: the `maestro` job in `.github/workflows/nightly.yml` is a placeholder until an emulator/simulator lane
exists. Do not claim a flow passed without that transcript.
