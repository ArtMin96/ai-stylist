---
name: e2e-device-testing
description: Write, run, and extend the shared Maestro E2E flows in e2e/ for the native iOS and Android apps, drive simulator/emulator/device-lane and nightly device-farm runs, review and accept golden/visual-regression baselines with `just golden-accept`, and scope k6 load profiles against the doc 13 §12.3 budgets. Use whenever a task mentions Maestro, a new `.yaml` flow alongside e2e/smoke.yaml, `just ios-e2e` / `just android-e2e`, an onboarding/capture/offline/two-device-convergence journey test, a device tier or device-farm run, a screenshot-diff or golden baseline, or a k6/load-test profile (steady, morning-spike, onboarding-burst, webhook-storm). Not for unit, integration, or bug-fix regression tests — use `testing-regression`; not for a frame-time, app-size, or API-latency performance budget — use `performance-profiling`.
metadata:
  modules:
  last-reviewed: 2026-09-23
  owner-agent: test-engineer
---

# E2E and Device Testing

## Trigger

- Adding or changing a Maestro flow in `e2e/` (onboarding, capture, offline/kill-resume, two-device
  convergence, export/deletion, purchase/restore, degraded-provider journeys). One flow set serves
  both native apps.
- Running a flow: `just ios-e2e` (macOS, simulator) or `just android-e2e` (emulator or device).
- A golden/visual-regression diff needs review, or a baseline needs an explicit `just golden-accept`.
- Scoping or reporting a k6 load profile against the doc 13 §12.2 budgets.
- Reporting which device tier (low/mid/high) or CI lane a piece of evidence came from.
- Not this skill: a unit/integration or bug-fix regression test (`testing-regression`); a
  frame-time, app-size or API-latency budget (`performance-profiling`, which judges the transcript
  this skill produces); the screens and copy a flow asserts (`ios-feature` / `android-feature`).

## Required reading

1. `e2e/README.md`: the documented test-placement exception, the `APP_ID` variable (one flow, three
   app ids: `app.aistylist.mobile.dev`, `.preview`, and prod `app.aistylist.mobile`) and how to run.
2. `e2e/smoke.yaml`: the flow shape (`appId: ${APP_ID}`, `launchApp`, an `assertVisible` chain) and
   the header-comment style. New flows extend this vocabulary rather than inventing a second one.
3. `planning/13-testing-quality-and-performance.md` §6 (golden/visual regression: fixed render
   matrix, diffing, baselines only via an explicit `just golden-accept`), §7 (Maestro journeys,
   device tiers, device farm, automated a11y checks), §12.3 (k6 profiles), §13 (which CI tier runs
   which suite).
4. The phase file's E2E/device row for the journey in scope, e.g.
   `planning/phases/P03-identity-consent-onboarding.md` (onboarding + export/deletion flows) and
   `planning/phases/P07-closet-organization-and-sync.md` (offline/kill-resume, two-device
   convergence, sync load).
5. `justfile` recipes `ios-e2e`, `android-e2e` and `golden-accept` (the last is a stub:
   `NOT IMPLEMENTED (P02 T10)`); `.github/workflows/nightly.yml`'s `maestro` job is a placeholder.

## Workflow

1. Restate which journey, device lane, golden surface or k6 profile the task targets, and name the
   phase row it maps to.
2. New or changed flow: keep `appId: ${APP_ID}`, reuse the `smoke.yaml` step vocabulary, and assert
   on user-visible text or on ids both apps expose identically (iOS accessibility identifiers,
   Android test tags exported as resource ids). A flow that needs a platform-specific branch is a
   parity defect to raise with `cross-platform-feature`, not a fork of the flow. New flows go in
   `e2e/` and are not done until they pass on both platforms. Say in the header
   which steps are simulator/emulator-safe and which need a real device (camera, push).
3. Strings or ids a flow needs must already exist in both apps; if not, the owning feature skills
   add them first (`ios-feature`, `android-feature`).
4. Running: `just ios-e2e` builds the Dev configuration for the simulator on macOS and runs the flow
   with `APP_ID=app.aistylist.mobile.dev`; `just android-e2e` installs the debug build on a running
   emulator/device and runs it with the same id. Neither runs on a Linux box without an emulator.
5. Golden/visual regression: never hand-edit a baseline or threshold; inspect the diff, trace it to
   the intended change, then accept via `just golden-accept` naming that change in the PR.
6. Device or farm run: report the device tier and the CI lane the evidence came from; "passed on a
   device" without both is not verifiable.
7. k6: use the doc 13 §12.3 profile that matches the phase; pass means the §12.2 budgets hold with
   bounded queues and 429 backpressure. No `just` recipe wraps k6 yet (a tooling gap): report the
   raw output and the profile name, never an invented recipe or number.
8. When nothing can run here, say so and report exactly what was verified statically (YAML shape,
   strings present in both apps' sources). Never claim a transcript you did not see.

## Validation commands

```bash
just ios-e2e                          # macOS: Dev simulator build + the flow with APP_ID=app.aistylist.mobile.dev
just android-e2e                      # running emulator/device: installDebug + the flow with the same APP_ID
just format --check                   # prettier covers e2e/*.yaml and e2e/README.md
just golden-accept                    # STUB (P02 T10): review the diff, name the change, accept explicitly
just ci-parity                        # before the PR
```

## Output

- PR: the flow(s) touched (or the baseline accepted, or the k6 profile run) against its phase row;
  the platform, device tier and lane of every run; an explicit note for anything only verified
  statically.

Done checklist: flow uses `${APP_ID}` and the existing vocabulary · asserted strings/ids exist on
both platforms · golden accepts name the change · tier + lane stated for every device claim · no
fabricated transcript · `PROGRESS.md` line proposed.

## Stop / escalation

- No simulator, emulator or device available → report what was checked statically; hand the run to
  a Mac, an emulator host, or the future nightly lane.
- A flow passes on one platform and fails on the other → a parity defect: hand it to the owning
  feature skill, never weaken the assertion.
- A golden diff shows an unintended change → do not accept; the owning feature skill fixes it.
- A k6 run breaches a budget → `performance-profiling` with the raw numbers; never retune the
  profile or the budget to pass.

## Overlap

Adjacent: `testing-regression` (unit/integration and regression tests), `performance-profiling`
(judges budgets from this skill's transcripts), `ios-feature` / `android-feature` (own the screens,
copy and ids the flows assert), `cross-platform-feature` (parity between the two apps),
`release-readiness` (consumes nightly and pre-release device evidence as a gate).
