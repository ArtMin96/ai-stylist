---
name: e2e-device-testing
description: Write, run, and extend the shared Maestro E2E flows in e2e/ for the native iOS and Android apps, drive simulator/emulator/device-lane and nightly device-farm runs, review golden/visual-regression baselines, and scope k6 load profiles (doc 13 §12.3) against the §12.2 budgets. Use whenever a task mentions Maestro, a new `.yaml` flow alongside e2e/smoke.yaml, `just ios-e2e` / `just android-e2e`, an onboarding/capture/offline/two-device-convergence journey test, a device tier or device-farm run, a screenshot-diff or golden baseline, or a k6/load-test profile (steady, morning-spike, onboarding-burst, webhook-storm). Not for unit, integration, or bug-fix regression tests — use `testing-regression`; not for a frame-time, app-size, or API-latency performance budget — use `performance-profiling`; not for the screens, copy or ids a flow asserts — use `ios-feature` / `android-feature`.
metadata:
  modules:
  last-reviewed: 2026-09-26
  owner-agent: test-engineer
---

# E2E and Device Testing

## Trigger

- Adding or changing a Maestro flow in `e2e/` (onboarding, capture, offline/kill-resume, two-device
  convergence, export/deletion, purchase/restore, degraded-provider journeys). One flow set serves
  both native apps.
- Running a flow: `just ios-e2e` (macOS, simulator) or `just android-e2e` (emulator or device).
- A golden/visual-regression diff needs review, or someone asks to accept a baseline.
- Scoping or reporting a k6 load profile against the doc 13 §12.2 budgets.
- Reporting which device tier (low/mid/high) or CI lane a piece of evidence came from.
- Executed by `test-engineer`, which owns all of `e2e/**` (new and changed flows) and may run the
  e2e recipes. In a two-platform feature the lead launches it once, after both apps render the
  brief's strings and ids (`cross-platform-feature` step 10).
- Not this skill: a unit/integration or bug-fix regression test (`testing-regression`); a
  frame-time, app-size or API-latency budget (`performance-profiling`, which judges the transcript
  this skill produces); the screens and copy a flow asserts (`ios-feature` / `android-feature`).

## Required reading

1. `e2e/README.md`: the documented test-placement exception, the `APP_ID` variable (one flow, three
   app ids: `app.aistylist.mobile.dev`, `.preview`, and prod `app.aistylist.mobile`) and how to run.
2. `e2e/smoke.yaml`: the flow shape (`appId: ${APP_ID}`, `launchApp`, an `assertVisible` chain) and
   the header-comment style. New flows extend this vocabulary rather than inventing a second one.
3. `planning/13-testing-quality-and-performance.md` §6 (golden/visual regression), §7 (Maestro
   journeys, device tiers, device farm, automated a11y checks), §12.3 (k6 profiles), §13 (which CI
   tier runs which suite).
4. The phase file's E2E/device row for the journey in scope, e.g.
   `planning/phases/P03-identity-consent-onboarding.md` (onboarding + export/deletion flows) and
   `planning/phases/P07-closet-organization-and-sync.md` (offline/kill-resume, two-device
   convergence, sync load).
5. In a two-platform feature: the lead's brief (strings, ids and states the flow asserts).
6. `justfile` recipes `ios-e2e`, `android-e2e` and `golden-accept`. `golden-accept` is a stub with no
   owning task; doc 13 §6 has nothing to golden-test until 3D resumes. `.github/workflows/nightly.yml`'s `maestro` job is a placeholder:
   no CI workflow runs Maestro.

## Workflow

1. Restate which journey, device lane, golden surface or k6 profile the task targets, and name the
   phase row it maps to.
2. New or changed flow: keep `appId: ${APP_ID}`, reuse the `e2e/smoke.yaml` step vocabulary and
   header style, and assert on user-visible text or on ids both apps expose identically (iOS
   accessibility identifiers, Android test tags exported as resource ids). Take the strings and ids
   from the brief or both apps' sources:
   `rg -n -F '<string or id>' apps/ios/Packages apps/android` must hit both apps. A flow that needs
   a platform-specific branch is a parity defect for the lead (`cross-platform-feature`), not a
   fork of the flow. Say in the header which steps are simulator/emulator-safe and which need a
   real device (camera, push).
3. Strings or ids a flow needs must already exist in both apps; if one is missing, stop and hand it
   to the owning feature lane (`ios-engineer` / `android-engineer`).
4. Running: `just ios-e2e e2e/<flow>.yaml` builds the Dev configuration for the simulator on macOS
   and runs the flow with `APP_ID=app.aistylist.mobile.dev`; `just android-e2e e2e/<flow>.yaml`
   installs the debug build on a running emulator/device and runs it with the same id. Without an
   argument both run `e2e/smoke.yaml`. Neither runs on a Linux box without an emulator.
5. Golden/visual regression: never hand-edit a baseline or threshold. Inspect the diff and trace it
   to the intended change. `just golden-accept` only prints NOT IMPLEMENTED, so report baseline
   acceptance as unavailable and never claim an accept.
6. Device or farm run: report the device tier and the CI lane the evidence came from; "passed on a
   device" without both is not verifiable.
7. k6: use the doc 13 §12.3 profile that matches the phase; pass means the §12.2 budgets hold with
   bounded queues and 429 backpressure. No `just` recipe wraps k6 yet (a `tooling-ci` gap): report
   the raw output and the profile name, never an invented recipe or number.
8. When nothing can run here, say so and report exactly what was verified statically (YAML shape,
   strings and ids present in both apps' sources). Never claim a transcript you did not see.

## Validation commands

```bash
just ios-e2e e2e/<flow>.yaml          # macOS: Dev simulator build + the flow with APP_ID=app.aistylist.mobile.dev
just android-e2e e2e/<flow>.yaml      # running emulator/device: installDebug + the flow with the same APP_ID
just format --check                   # prettier covers e2e/*.yaml and e2e/README.md (main checkout; needs node_modules)
just ci-parity                        # the lead, before the PR
```

## Output

The `agent-operating-contract` report: the flow(s) touched (or the k6 profile run) against its
phase row; the platform, device tier and lane of every run; each recipe not run under `Not run:`
with its reason; anything verified only statically named as such.

Done checklist: flow uses `${APP_ID}` and the existing vocabulary · asserted strings/ids exist on
both platforms · no baseline accepted or edited · tier + lane stated for every device claim · no
fabricated transcript · `Suggested PROGRESS.md line` given.

## Stop / escalation

- No simulator, emulator or device available → report what was checked statically; hand the run to
  a Mac, an emulator host, or the future nightly lane.
- A flow passes on one platform and fails on the other → a parity defect: hand it to the lead and
  the owning feature lane, never weaken the assertion.
- A golden diff needs accepting → unavailable (`just golden-accept` is a stub); an unintended diff
  goes to the owning feature lane.
- A k6 run breaches a budget → `performance-profiling` with the raw numbers; never retune the
  profile or the budget to pass.
- A recipe needs a new argument or a CI lane → `tooling-engineer` (`tooling-ci`); workflow files
  are human-applied.

## Overlap

Adjacent: `testing-regression` (unit/integration and regression tests), `performance-profiling`
(judges budgets from this skill's transcripts), `ios-feature` / `android-feature` (own the screens,
copy and ids the flows assert), `cross-platform-feature` (the lead's brief and the one-time e2e
step), `tooling-ci` (the e2e recipes and CI lanes), `release-readiness` (consumes nightly and
pre-release device evidence as a gate). This skill owns `e2e/**`.
