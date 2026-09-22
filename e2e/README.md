# Maestro E2E flows

Documented exception to the test-placement rule: Maestro YAML flows live here, not in a `tests/`
directory (planning/04 §4.3, CLAUDE.md layout). One flow set is shared by the native iOS and Android
apps; both use the app id `app.aistylist.mobile`.

- `smoke.yaml` — launch, assert the "AI Stylist" header and the consent toggle are visible.

Running requires an installed build on a simulator, emulator or device plus the Maestro CLI:
`maestro test e2e/smoke.yaml`. Do not claim it passed without that transcript.
