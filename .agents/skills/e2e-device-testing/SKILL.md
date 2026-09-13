---
name: e2e-device-testing
description: Write, run, and extend Maestro E2E flows in apps/mobile/e2e/, drive iOS/Android device-lane and nightly device-farm runs, review and accept golden/visual-regression baselines with `just golden-accept`, and scope k6 load profiles against the doc 13 §12.3 budgets. Use whenever a task mentions Maestro, a new `.yaml` E2E flow alongside smoke.yaml, an onboarding/capture/offline/two-device-convergence journey test, a device tier or device-farm run, a screenshot-diff or golden-render baseline, or a k6/load-test profile (steady, morning-spike, onboarding-burst, webhook-storm). Not for unit, integration, or bug-fix regression tests — use `testing-regression`; not for a 3D frame-time, app-size, or API-latency performance budget — use `performance-profiling`.

metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: test-engineer
---

# E2E and Device Testing

## Trigger

- Adding or changing a Maestro flow in `apps/mobile/e2e/` (onboarding, capture, offline/kill-resume,
  two-device convergence, export/deletion, purchase/restore, degraded-provider journeys).
- A golden/visual-regression diff needs review, or a baseline needs an explicit `just golden-accept`.
- Scoping or reporting a k6 load profile (steady, morning-spike, onboarding-burst, webhook-storm)
  against the doc 13 §12.2 budgets.
- Reporting which device tier (low/mid/high) or CI lane (PR-smoke subset, nightly full matrix,
  pre-release device-matrix) a piece of evidence came from.
- Not this skill: a unit/integration test or a bug-fix regression test — `testing-regression`. A
  3D frame-time, app-size, or API-latency budget investigation — `performance-profiling` (this
  skill produces the device transcript; that skill judges the budget).

## Required reading

1. `apps/mobile/e2e/README.md` — the documented test-placement exception (Maestro flows live here,
   not under a tests/ directory), the `maestro test` invocation, and the standing fact that this
   suite is **not runnable on the P02 Linux dev box** (no Android SDK/emulator) — nightly CI runs it
   on an emulator and device farm.
2. `apps/mobile/e2e/smoke.yaml` — the existing flow's shape (`appId`, `launchApp`, an `assertVisible`
   chain) and its header-comment style (what it proves, how to run it, its known limitation). Every
   new flow extends this vocabulary rather than inventing a second style.
3. `planning/13-testing-quality-and-performance.md` §6 (golden/visual regression: the fixed render
   matrix, SSIM/pixelmatch diffing, baselines updated only via an explicit `just golden-accept`
   naming the visual change), §7 (Maestro journey list, the device-tier table, the device-farm
   runner, the automated a11y checks), §12.3 (k6 tooling and the four load profiles), and §13 (which
   CI tier — PR-smoke subset, nightly full matrix, pre-release device-matrix — runs which suite).
4. The phase file's §12 E2E/device row for the journey in scope: `planning/phases/P03-identity-consent-onboarding.md`
   (P03-T15: onboarding + export/deletion Maestro, nightly wiring), `planning/phases/P04-parametric-avatar-v1.md`
   (P04-T13: the golden/visual-regression harness itself), `planning/phases/P06-closet-capture-pipeline.md`
   and `planning/phases/P07-closet-organization-and-sync.md` (Maestro offline/kill-resume, two-device
   convergence, the k6 sync-load profile), `planning/phases/P10-outfit-on-avatar.md` (P10-T09: the
   outfit-on-avatar golden matrix).
5. `justfile`'s `golden-accept` recipe — currently a stub (`NOT IMPLEMENTED (P02 T10)`); there is no
   `just` recipe that runs the golden-diff harness itself yet either. Say so plainly rather than
   claiming a run that a stub cannot produce.

## Workflow

1. Restate which journey, device lane, golden surface, or k6 profile the task targets, and name the
   phase §12 row it maps to — a Maestro flow or golden matrix that cites no phase row is probably out
   of scope for this pass.
2. New or changed Maestro flow: read the neighbouring flows in `apps/mobile/e2e/` for the existing
   `appId` and step vocabulary (e.g. `smoke.yaml`'s `launchApp` / `assertVisible` chain); extend it,
   don't fork a second style. Note explicitly which steps are camera-mocked-in-emulator vs
   real-device-only, matching `smoke.yaml`'s header-comment convention.
3. Golden/visual regression: never hand-edit a baseline image or diff threshold. Inspect the diff,
   confirm the visual change is intentional (cite the PR/change that caused it), and only then accept
   via `just golden-accept` naming the change — an unreviewed baseline update silently hides a real
   rendering regression, which is exactly what doc 13 §6 exists to catch.
4. Device or device-farm run: report the actual device tier (§7's low/mid/high table) and the CI lane
   the evidence came from (PR-smoke 3-config subset, nightly full matrix, or pre-release device-matrix,
   per §13) — a claim of "it passed on device" without naming the tier and lane is not verifiable.
5. k6: use the profile named in doc 13 §12.3 that matches the phase's load characteristic (steady
   5k-user launch model, morning recommendation spike, onboarding capture burst, RevenueCat webhook
   storm). Pass means the §12.2 budgets hold with bounded queues and 429 backpressure, not raw
   throughput. No `just` recipe wraps k6 yet (a tooling-ci gap, not this skill's write set) — report
   the raw k6 output and the profile name rather than inventing a recipe or a number.
6. On the P02 Linux dev box, Maestro and the device-farm runner cannot execute locally. Say so, then
   either hand the flow to the nightly CI lane or report exactly what was verified statically (the
   flow YAML is well-formed, its `assertVisible` strings match the app's actual copy/labels). Never
   claim a device transcript you did not see.

## Validation commands

```bash
just test mobile                      # RNTL coverage still green before/after a flow touches app code
just lint && just typecheck && just arch-check
just assets-validate                  # only if the flow exercises new 3D assets/manifests (native-3d-assets owns the assets themselves)
just golden-accept                    # STUB (P02 T10): review the diff, name the visual change, accept explicitly — never a silent overwrite
just ci-parity                        # before PR
```

## Output

- PR: the flow file(s) touched (or the golden baseline accepted, or the k6 profile run) named
  against its phase §12 row; the device tier and CI lane the evidence came from; an explicit note
  when a step could only be verified statically because the dev box cannot run Maestro.

Done checklist: new/changed flow matches the existing `apps/mobile/e2e/` vocabulary · a golden accept
names the visual change in the PR · device tier + CI lane stated for every device claim · no fabricated
transcript · `PROGRESS.md` updated.

## Stop / escalation

- Cannot run Maestro or the device farm locally → hand off to the nightly CI lane, or report exactly
  what was checked statically; never claim a run that did not happen.
- A golden diff shows an unintended change → do not `golden-accept`; the render pipeline is
  `native-3d-assets`' territory, an app-code regression is the owning feature skill's.
- A k6 run breaches a §12.2 budget → `performance-profiling` territory: hand off the raw numbers,
  never silently retune the profile or the budget to make it pass.
- The flow needs app copy, a screen state, or a data fixture that doesn't exist yet → the owning
  feature skill (`mobile-feature`, `backend-module`, …) adds it first; this skill only asserts
  against what already exists.

## Overlap

Adjacent: `testing-regression` (unit/integration and bug-fix regression tests; this skill owns
Maestro/device/golden/k6 work only), `performance-profiling` (judges the frame-time/app-size/latency
budget; this skill supplies the device transcript it judges), `native-3d-assets` (owns the render
pipeline and asset manifests the golden matrix exercises, not the golden harness itself),
`release-readiness` (consumes this skill's nightly Maestro run and pre-release device-matrix evidence
as its own gate), `mobile-feature` (owns the screens and copy a Maestro flow asserts against).
