# ADR-0002 (ADR-P02) — iOS build lane: EAS Build vs GitHub Actions macOS

- **Status:** Proposed — no decision yet; this file frames the question and the evidence T15 must collect
- **Date:** 2026-09-09
- **Deciders:** product owner + implementing session (P02-T15), after ~2 weeks of dual-lane data from P02-T14
- **Decision-log entry:** none yet; resolves OQ-04 in [planning/16](../../planning/16-risks-open-questions-and-decision-log.md) and will extend DEC-30 when accepted
- **Related:** NFR-TEAM-* (iOS delivery), RISK-12 (lane fallback) · OQ-04 · A4 (pnpm × EAS assumption, doc 05 §8) · phase P02 (T14, T15) · AC-8

## Context

The team is Linux-only with no local Mac (doc 15 §3, research r1). Building and signing an IPA, compiling Metal shaders, running the iOS Simulator, and submitting to the App Store require macOS (Xcode 26+ mandatory since 2026-04-28). TestFlight upload does not: it runs from a Linux runner via the App Store Connect API. DEC-30 narrowed the choice to two cloud lanes and deferred the pick to a P02 ADR. Per P02-T14 both lanes are configured and run side by side for about two weeks; T15 writes the decision from that data and deactivates the loser's schedule while retaining its config as a fallback (RISK-12).

## Options considered

| Option                                    | Pros                                                                                   | Cons                                                                                               | Evidence (primary source + as-of date)                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A — EAS Build (free tier initially)       | Managed signing/credentials service; Expo-native prebuild path; no runner YAML         | Free-tier queue/quota limits; pnpm workspace support under EAS unproven (A4); vendor coupling      | r1 §6 (as of planning ratification 2026-08-24); to be re-verified in T14 |
| B — GitHub Actions macOS M-series runners | Same CI system as everything else (DEC-32); fastlane match for signing; no build quota | ~$0.12/min, estimated $30–50/mo at our cadence; signing assets must be managed by us in CI secrets | r1 §6, doc 15 §3 (cost figures are estimates, not measurements)          |

No option is chosen in this revision.

## Decision

OPEN — see planning/16 OQ-04. To be written by P02-T15.

## Evidence T15 must collect (from ~2 weeks of both lanes on the same commits)

For each lane, real numbers from CI logs and vendor dashboards; nothing estimated:

1. **Cost:** actual spend for the window (EAS plan usage/overage; GHA macOS minutes × rate), and the projected monthly cost at the P02 cadence (every merged `main` → `internal` channel, doc 15 §10).
2. **Reliability:** builds attempted, succeeded, failed by cause (infra vs our code), retry count; flake rate as a percentage.
3. **Latency:** queue wait and wall-clock build time, median and p95.
4. **pnpm × EAS outcome (A4):** whether the pnpm workspace + Expo prebuild builds under EAS without workarounds; if not, what the workaround costs. Record the outcome in T18 close-out regardless of the lane chosen.
5. **Signing and TestFlight:** that each lane produced a signed build that reached TestFlight via the Linux upload step and installed on a physical iPhone from the same commit as the Android AAB (AC-8).
6. **Operational fit:** `just mobile-ios-build --cloud eas|gha --profile <p>` triggers the lane; secrets stay scoped to the macOS lane (P02 §6); Renovate/pin compatibility with the EAS image vs the GHA runner image.

## Rationale

To be written with the decision. Must cite the measured table above; label any remaining estimate as such.

## Consequences and revisit triggers

- To be written with the decision. Expected: the losing lane's schedule is deactivated but its configuration is retained (RISK-12) so the choice is reversible within a sprint.
- **Revisit when (proposed):** monthly cost of the chosen lane exceeds the losing lane's measured cost by more than 2×; flake rate of the chosen lane exceeds the doc 13 CI reliability threshold for two consecutive weeks; the chosen vendor changes pricing tiers or drops support for the pinned Xcode/Expo SDK. Reversal requires a new DEC entry.
