# Maestro E2E flows

Documented exception to the test-placement rule: Maestro YAML flows live here, not in a `tests/`
directory (planning/04 §4.3, CLAUDE.md layout).

- `smoke.yaml` — launch, assert the "AI Stylist" header and the consent toggle are visible.

Running requires a built dev client on a connected Android device/emulator (or iOS device via the
CI lane) plus the Maestro CLI: `maestro test apps/mobile/e2e/smoke.yaml`. **Not runnable on the
P02 Linux dev box** (no Android SDK / emulator installed); the nightly CI tier (T11) runs it on an
emulator. Do not claim it passed without that transcript.
