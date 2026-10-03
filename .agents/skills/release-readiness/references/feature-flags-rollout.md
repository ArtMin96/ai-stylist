# Feature flags and staged rollout — reference

> This is a reference file inside `release-readiness`, not a standalone skill. The flag registry
> exists since P02-T09 (`packages/shared-kernel/registry/feature-flags.json`, one dev-only
> flag); the s3 plan's dedicated `feature-flags-rollout` skill waits for the first product flags
> and kill-switch wiring (`planning/phases/P05-selfie-face-personalization.md` P05-T10, regional
> gating for A2). Until then this file is the flag operating procedure `release-readiness` and
> every engineer skill point to.

Last reviewed: 2026-09-27

## Source of truth

The binding policy is `planning/14-observability-operations-and-analytics.md` §11 (PostHog flags).
This file restates it as an operating checklist for release and rollout work. If the two ever
disagree, doc 14 wins — flag the conflict, do not silently follow whichever reads easier here.

## Every flag declares, at creation

Owner, purpose, expiry, rollout plan and the safe off state are fields of the flag's entry in
`packages/shared-kernel/registry/feature-flags.json` (owner = a person id from
`packages/shared-kernel/registry/owners.json`); `just observability-sync` then creates the flag in
PostHog, off. How to add and retire a flag: `docs/observability/posthog.md`.

- **Owner** — a person, not a team; someone who can answer for the flag at 2am.
- **Purpose** — one sentence. A flag with no clear purpose is a code smell wearing a rollout tool's
  clothes.
- **Expiry date** — ≤ 90 days for a rollout/experiment flag. A flag with no natural expiry is not a
  rollout flag at all — reclassify it as a kill switch (below) or as config/an entitlement instead
  of leaving it open-ended.
- **Rollout plan** — default staged sequence **internal → 5% → 25% → 100%**, with a named metric
  guardrail per stage (doc 14 §11). Skipping straight to 100% needs a stated reason.
- **Rollback** — the flag's "off" state must always be safe. If turning a flag off would break
  something, that is the defect to fix before the flag ships, not an acceptable rollback plan.
- **Removal issue** — a tracked issue to delete the flag and its dead branch once it reaches 100%
  and its expiry passes. A flag has not really shipped until its removal issue exists.

## Flags are not entitlements

Paid capability gating goes through the server-side entitlements table (`entitlements-billing`
skill, doc 12), never a flag. A flag on a premium feature sits _behind_ the entitlement check, never
instead of it — mixing the two means a flag flip could grant paid capability for free, which is a
billing bug, not a rollout bug.

## Kill-switch flags

Kill switches (per AI task, per provider, per pipeline) are **permanent operational flags**, exempt
from the 90-day expiry, and listed in runbook 10 (doc 14 §8, "AI cost runaway"). Verify the kill
switch actually works before relying on it in an incident — a fallback path that was wired but never
exercised is an untested code path wearing a safety label.

## Shadow mode

Before a scoring, ranking, or generation change goes live behind a rollout percentage, run it in
shadow mode where the surface allows: compute the new result alongside the current one, log both,
ship nothing user-visible, and compare before spending any rollout percentage on it. This is the
cheapest gate in the whole ladder — skipping it because "the rollout percentage is low anyway"
defeats the point, since even 5% of production traffic is real users on a change nobody has
verified end to end yet.

## Expired and stale flags

Doc 14 §11 calls for a CI report that fails on expired flags; more than 30 days overdue is a defect
with an owner. `just flags-report` is that report: one row per registry flag with its owner,
`expiresAt` and days left or overdue, exit 1 when a rollout or experiment flag is past expiry
(kill switches exempt). The nightly `expired-flags` job in `.github/workflows/nightly.yml` runs it.
A release cites a `just flags-report` run on the candidate SHA (or that night's `expired-flags`
job); a failing report is a NO-GO until the flag is retired or re-dated with a stated reason — an
expired flag that ships anyway is exactly the drift this policy exists to catch.

## Experiments never touch the hard-constraint layer

The recommendation engine's hard-constraint layer is not flag-gated or experimented on (doc 13 §11
simulation gate) — enforced by module boundaries, not by flag discipline. Do not "just add a flag"
around a hard constraint even for a controlled experiment; that is an architecture question, not a
rollout question.

## What this file is not

Not a flag-SDK reference (PostHog's own docs own that) and not the place to add per-flag records —
those live in `packages/shared-kernel/registry/feature-flags.json`. Not yet a skill in its own
right: once P05-T10 lands the first product flags and kill switches, split this content into a
standalone `feature-flags-rollout` skill with its own evals, mirroring every other skill in this
repo — until then, this file is where that content lives.
