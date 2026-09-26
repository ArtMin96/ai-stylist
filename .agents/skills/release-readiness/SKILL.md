---
name: release-readiness
description: Verify and prepare promotion of the native iOS and Android builds through release channels — internal → beta (TestFlight / Play internal testing) → staged production. Use when preparing a release, cutting a beta, checking store readiness, or evaluating/halting a staged rollout. Not for implementing the fix behind a blocked gate — hand back to the owning engineer skill; not for signing, uploading, store submission or rollout promotion — those are human-only (this skill, and the `release-manager` agent that runs it, only ever recommends GO/NO-GO).
metadata:
  modules:
  last-reviewed: 2026-09-26
  owner-agent: release-manager
---

# Release Readiness

## Trigger

- A release or promotion is requested for either platform, or a scheduled beta is due.
- A staged rollout needs a promote/halt input.
- Pre-submission store check (P14 onward).
- This skill verifies and prepares; signing, upload, store submission and rollout promotion are
  human acts (doc 15 §12.6; CLAUDE.md "Prohibited without explicit human authorization").

## Required reading

1. `planning/15-team-workflow-and-ai-agent-operations.md` §3 (build lanes) and §10 (channels, crash
   gate). There is no over-the-air update channel for the native apps: every change, including a
   copy fix, ships as a new store build.
2. `planning/13-testing-quality-and-performance.md` (release-gate tiers and thresholds) and
   `.github/workflows/pre-release.yml` (tier-4 skeleton; the device-matrix, store-size, a11y and
   restore-drill checks land in P14).
3. `docs/adr/0004-native-ios-and-android-clients.md` and the rest of the ADR index in
   `docs/adr/README.md` (build and signing lanes).
4. `.github/workflows/ios.yml` and `.github/workflows/android.yml`: the per-platform CI evidence
   (unsigned simulator build + tests; debug/preview/unsigned-release APKs + tests).
5. `.agents/skills/release-readiness/references/feature-flags-rollout.md`: flag
   owner/expiry/removal-issue checklist, kill switches, staged percentages, shadow mode.
6. Current phase file Definition of Done and `PROGRESS.md` for open blockers.

## Workflow

1. Identify the candidate: commit SHA, version + build number per platform (iOS
   `CFBundleShortVersionString`/`CFBundleVersion`, Android `versionName`/`versionCode`), channel
   target, and the diff since the last release in that channel. Both platforms build from one commit.
2. Gate checklist, each item with real output: `just ci-parity` green on the SHA plus green `ios`
   and `android` workflow runs; the nightly tier where doc 13 requires it; no open release blocker,
   no quarantined test past its deadline; flags per the reference (owner, expiry, removal issue).
   Flag expiry has no automated report yet (the nightly `expired-flags` job is a placeholder,
   P02-T09): record it as `unverified: needs a human PostHog check`, which is a NO-GO until a human
   confirms; pending migrations applied to staging with rollback proven (`db-migration` evidence);
   `just generate --check` clean and no breaking contract without its deprecation plan (older app
   versions stay in the field for weeks: the API must keep serving them); store metadata, privacy
   manifest (`apps/ios/App/PrivacyInfo.xcprivacy`) and Play data-safety answers current (a
   `security-privacy-review` item 10 verdict on the release diff); IAP
   config matches doc 12; crash reporting symbolicated (dSYMs / R8 mapping) and dashboards ready
   (doc 14); rollback plan per risky change.
3. Build evidence from the lanes that exist today: `just ios-build --config prod` (unsigned) and
   `just android-build release` (unsigned). iOS builds only on the GitHub macOS runner
   (`.github/workflows/ios.yml`) or a Mac, never on Linux. Signing and upload are future work: an
   App Store Connect API key (TestFlight) and a Play service account (internal/closed track), both
   read from CI secrets, in a lane a human sets up. Store submission stays human-only even then. No
   `just` recipe signs or uploads today; never invent one or run a store tool.
4. Beta soak duration is **OPEN**: neither `planning/13-testing-quality-and-performance.md` nor
   `planning/16-risks-open-questions-and-decision-log.md` states a length (doc 13's P14-T16 row
   marks it "+ soak time" with no number). Do not invent one: check `PROGRESS.md` and the phase file
   for a human-set date for this release; if none exists, stop and ask, and report it as a
   decision-log entry for a human to record rather than assuming a default.
5. Staged rollout is the store's own mechanism (Play staged %, App Store phased release — doc 15
   §10), a different lever from the PostHog flag percentages in the flags reference. No doc states
   a fixed store percentage schedule, so recommend the initial percentage and each step explicitly
   in the release issue, define halt criteria in writing before promotion, and monitor crash-free
   sessions per platform against the gate in `planning/phases/P14-hardening-and-launch.md`
   (≥ 99.5 % hypothesis, ratified at P14; doc 13 carries no crash-free number yet).

## Validation commands

```bash
just ci-parity                        # on the release SHA (native lanes included; Xcode steps skip on Linux)
just security-scan                    # no new high+ findings ship; SBOM produced
just ios-check                        # iOS lint/format/bans/tests (+ build/simulator tests on macOS)
just android-check                    # Android gate incl. the unsigned release APK
just ios-build --config prod          # macOS runner (ios.yml) or a Mac only: unsigned Prod build
just android-build release            # unsigned release APK (R8 mapping for symbolication)
```

## Output

The `agent-operating-contract` reviewer variant: the header with the verdict word, the `Agent:`
line, these sections, then its last three lines (`Suggested PROGRESS.md line:` carries the release
state):

```
## Release readiness of <candidate> — GO | NO-GO
Agent: release-manager · Base: <sha> · Worktree: main checkout · Branch: <name>
Candidate: <sha> · iOS <CFBundleShortVersionString>(<CFBundleVersion>) · Android <versionName>(<versionCode>) · channel <target>
### Gate checklist
- <gate> — <evidence: command → result | workflow run id | unverified: <why>> — pass | fail
### Known risks and rollback plan
- <risk> — rollback: <…>
### Human-only steps requested
- <signing | upload | submission | rollout promotion> — who: <human>
```

Done checklist: every gate has evidence or a named blocker · both platform artifacts from one commit
· rollback plan written · human sign-off and the human-only upload/promotion steps requested, not
assumed.

## Stop / escalation

- Any gate fails → NO-GO with the specific blocker; never argue a gate down. Exceptions are a human
  decision recorded in the release issue.
- Crash gate trips during rollout → recommend immediate halt; fix-forward vs rollback is a human
  call; hand the fix to `testing-regression`.
- Store rejection or policy question → doc 16 register + human; no guessed resubmission.
- Signing identity, API key or keystore needed → human-only (secrets and store accounts).

## Overlap

Adjacent: `db-migration` (staging apply evidence), `security-privacy-review` (item 10: privacy
manifest and data-safety declarations), `entitlements-billing` (IAP config), `ios-feature` /
`android-feature` (the changes being shipped), `e2e-device-testing` (device and Maestro evidence),
`performance-profiling` (device-matrix perf gate), `observability-analytics` (the crash-free and
error-budget dashboards), `testing-regression` (post-halt fixes). This skill owns no path; the
`release-manager` agent recommends GO/NO-GO and a human executes every release action.
