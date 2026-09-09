---
name: release-readiness
description: Verify and prepare promotion of a build through release channels — internal → beta (TestFlight / Play internal) → staged production. Use when preparing a release, cutting a beta, checking store readiness, or evaluating/halting a staged rollout. The ship action itself is human.
---

# Release Readiness

## Trigger

- A release or promotion is requested for either platform, or a scheduled beta is due.
- A staged rollout needs a promote/halt input.
- Pre-submission store check (P14 onward).
- This skill verifies and prepares; store submission and rollout promotion are human acts (doc 15 §12.6; CLAUDE.md "Prohibited without explicit human authorization").

## Required reading

1. `planning/15-team-workflow-and-ai-agent-operations.md` §3 (iOS lanes), §10 (channels, crash gate, OTA limits).
2. `planning/13-testing-quality-and-performance.md` — release-gate tiers and thresholds; `.github/workflows/` pre-release tier (skeleton in P02).
3. `docs/adr/0002-ios-build-lane.md` (ADR-P02) — which iOS lane is live; OPEN until T15 (planning/16 OQ-04).
4. Current phase file Definition of Done and `PROGRESS.md` for open blockers.

## Workflow

1. Identify the candidate: commit SHA, version + build number per platform, channel target, diff since the last release in that channel.
2. Gate checklist, each with real output: full CI green on the SHA (`ci-parity` equivalence plus the nightly tier where doc 13 requires it); no open release blockers, no quarantined test past its deadline, no expired flag shipping (expired-flag lint); pending migrations applied to staging with rollback proven (`db-migration` evidence); `just generate --check` clean, no breaking contract without its deprecation plan; OTA legality — EAS Update only for JS/assets, any native change forces a store build; store metadata and privacy declarations current, IAP config matches doc 12; crash reporting symbolicated on the new version, dashboards/alerts ready (doc 14); rollback plan written per risky change.
3. Build via the lanes: `just mobile-android-build --cloud` (Linux CI, signed AAB) and `just mobile-ios-build --profile <preview|prod>` (remote lane only — no local iOS build exists on Linux); TestFlight upload runs from the Linux runner via App Store Connect API.
4. Beta soak per doc 13 before production candidature.
5. Staged rollout: recommend the initial percentage, define halt criteria in writing before promotion, monitor crash-free sessions against the doc 13 gate.

## Validation commands

```bash
just ci-parity                        # on the release SHA
just security-scan                    # no new high+ findings ship; SBOM produced
just mobile-android-build --cloud
just mobile-ios-build --profile prod  # attach build ids/links; cloud lane per ADR-P02
```

## Output

- Release-readiness report in the release issue/PR: checklist with per-item evidence links, artifact ids, known risks, rollback plan, and a clear GO / NO-GO (with blockers). `PROGRESS.md` updated with release state.

Done checklist: every gate has evidence or a named blocker · both platform artifacts from one commit · rollback plan written · human sign-off requested, not assumed.

## Stop / escalation

- Any gate fails → NO-GO with the specific blocker; never argue a gate down. Exceptions are a human decision recorded in the release issue.
- Crash gate trips during rollout → recommend immediate halt; fix-forward vs rollback is a human call; hand the fix to `testing-regression`.
- Store rejection or policy question → doc 16 register + human; no guessed resubmission.

## Overlap

Adjacent: `db-migration` (staging apply evidence), `security-privacy-review` (privacy declarations), `entitlements-billing` (IAP config), `mobile-feature` / `native-3d-assets` (OTA legality of their changes), `performance-profiling` (device-matrix perf gate), `testing-regression` (post-halt fixes).
