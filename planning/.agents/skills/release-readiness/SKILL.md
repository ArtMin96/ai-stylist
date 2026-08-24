---
name: release-readiness
description: Verify and execute promotion of a build through release channels — internal → beta (TestFlight / Play internal) → staged production rollout. Use when preparing a release, cutting a beta, checking store readiness, or evaluating/halting a staged rollout.
---

# Release Readiness

## Trigger

- A release/promotion is requested for either platform, or a scheduled beta is due.
- A staged rollout is in progress and needs a promote/halt decision input.
- Pre-submission store-readiness check (P14 onward).

**This skill verifies and prepares; the final "ship" action (store submission, rollout promotion) is a human act** (doc 15 §12.6) — the skill delivers the evidence for it.

## Required reading

1. `planning/15-team-workflow-and-ai-agent-operations.md` §10 (channels, crash gates, OTA limits) and §3 (iOS lanes).
2. `planning/13-testing-quality-and-performance.md` — release-gate test tiers and thresholds.
3. Current phase file's Definition of Done + `PROGRESS.md` for open blockers.

## Workflow

1. Identify the exact candidate: commit SHA, version + build number (both platforms), channel target, and diff summary since the last release in this channel.
2. **Gate checklist** — verify each with real output, none skipped:
   - Full CI green on the release SHA (`just ci-parity` equivalence), including nightly-tier suites required for release per doc 13 (device tests, ML evals, 3D validation).
   - No open release-blocker issues; no quarantined test past its deadline; no expired feature flag shipping.
   - Migrations: pending migrations applied to staging successfully; rollback proven (`db-migration` skill evidence linked).
   - Contracts: `just generate --check` clean; no breaking contract change without its versioning/deprecation plan shipped.
   - **OTA legality:** if shipping via EAS Update, confirm the diff is JS/assets only — any native module, permission, or config change forces a full store build.
   - Store metadata: version notes, privacy declarations (data-collection changes since last release?), screenshots current where UI changed; entitlement/IAP product config matches doc 12.
   - Observability ready: crash reporting on the new version, dashboards/alerts for new features (doc 14), crash-gate thresholds configured.
   - Rollback plan written: for each risky change — flag off? OTA revert? store rollback? migration contract deferred?
3. Build: `just mobile-android-build --cloud` and `just mobile-ios-build --profile <preview|prod>`; confirm signing lane (doc 15 §3) succeeds; TestFlight/Play-internal upload via CI lane.
4. Beta soak per doc 13 (duration + crash-free threshold) before production candidature.
5. Staged rollout: recommend initial %; monitor crash-free sessions + key health metrics against the doc-13 crash gate; prepare halt criteria in writing before promotion starts.

## Validation

```bash
just ci-parity                          # on the release SHA
just mobile-android-build --cloud
just mobile-ios-build --profile prod    # cloud lane; attach build ids/links
just security-scan                      # no new high+ findings ship
```

## Output

- A release-readiness report in the release issue/PR: checklist with per-item evidence links, build artifacts/ids, known-risks list, rollback plan, and a clear **GO / NO-GO (with blockers)** recommendation. `PROGRESS.md` updated with the release state.

## Stop / escalate

- Any gate fails → NO-GO with the specific blocker; never argue a gate down. Gate exceptions are a human decision recorded in the release issue.
- Crash gate trips during rollout → recommend immediate halt, notify, switch to `testing-regression` for the fix; fix-forward vs rollback is a human call.
- Store rejection or policy question → doc-16 register + human; do not resubmit with guessed changes.
