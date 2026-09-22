---
name: cross-platform-feature
description: Orchestrate one client feature across both native apps — contract first through contracts-engineer, then ios-engineer and android-engineer in parallel in separate git worktrees, then a parity review of both diffs (UI states, strings, accessibility ids, analytics events, error handling) before merge. Use when a lead session is asked to "build X on iOS and Android", "ship this screen on both apps", "add the same feature to both platforms", or to plan/split/merge parallel iOS and Android work. Not for a change on one platform only — use `ios-feature` or `android-feature`; not for the contract change itself — use `api-contract-change`; not for backend work — use `backend-module`.
metadata:
  modules:
  last-reviewed: 2026-09-23
  owner-agent: architecture-reviewer
---

# Cross-Platform Feature (lead-session orchestration)

## Trigger

- A feature, screen or fix must land on both `apps/ios` and `apps/android`.
- A lead session plans, launches, or merges parallel iOS and Android agents.
- Not this skill: one platform only (`ios-feature` / `android-feature`); the wire shape itself
  (`api-contract-change`); the API behind it (`backend-module`); Maestro flows
  (`e2e-device-testing`).

## Required reading

1. Root `CLAUDE.md` "Parallel sessions" (disjoint file sets, one worktree per session, producers
   first) and `.claude/agents/README.md` (write sets, cross-seam sequences).
2. The journey and its states in `planning/02-user-journeys-and-information-architecture.md`, the
   current phase file, and `PROGRESS.md`.
3. `.agents/skills/ios-feature/SKILL.md` and `.agents/skills/android-feature/SKILL.md`: the per-
   platform workflows the two agents follow.
4. `e2e/smoke.yaml` and `e2e/README.md`: the strings and ids both apps must render identically.

## Workflow

1. **Restate the feature and write the shared UI contract once** (the single brief both agents
   receive, before any code): user outcome, every UI state (empty, loading, partial, failure,
   retry, offline, accessibility), exact user-visible strings, accessibility identifiers (iOS
   `accessibilityIdentifier` = Android `Modifier.testTag`, same literal), analytics event names
   from the taxonomy, the endpoints used, acceptance criteria, and non-goals. Platform idioms may
   differ (navigation, controls); behaviour, copy, ids and events may not. If scope is unclear,
   stop and ask before launching anyone.
2. **Contract first.** If an endpoint, field or analytics event is missing or changes shape, run
   `contracts-engineer` (`api-contract-change`) alone: it changes `packages/contracts`, runs
   `just generate` (TS, Python, Swift, Kotlin clients) and merges before any app work starts.
   Single-writer: never in parallel with anything else touching `packages/contracts` or
   `packages/shared-kernel`. Producers land before consumers; both app branches start from the
   commit that contains the contract.
3. **Launch `ios-engineer` and `android-engineer` in parallel** (one message, two Agent calls),
   each in its own git worktree: `ios-engineer` owns `apps/ios/**` only, `android-engineer` owns
   `apps/android/**` only, so the file sets are disjoint. Neither touches `packages/**`, `e2e/**`,
   the `justfile`, `mise.toml` or `.github/**`; a need there is a stop condition reported back to
   the lead. Keep each prompt small and specific: the brief, the exact files or screen in scope,
   the verification commands, and the report format. Do not paste whole planning docs; point at
   paths. A big feature is split into several small sequential or parallel agents per platform
   (e.g. data layer, then screen), never one large agent with a sprawling context.
4. **Collect both reports.** Each must include its real verification transcript, what was not run
   (Xcode on Linux, emulator), the self-review of its review-invisible bug classes (the per-platform
   skills list them), and parity notes.
5. **Parity review** (lead session), comparing the two diffs side by side:
   - every state from the brief exists on both platforms with the same trigger conditions;
   - user-visible strings, accessibility ids / test tags and analytics event names are identical;
   - both call the same operations of the generated client and map the same failures to the same
     UI state; neither decides a business rule locally;
   - both put logic in the testable layer (`*Model` target / ViewModel) with equivalent tests.
     A mismatch goes back to the owning agent; an intended difference is written into both PRs.
     Then run `architecture-reviewer` on each diff for the boundary, duplication and
     source-of-truth lens.
6. **Shared e2e, extended once.** If the shared Maestro flow in `e2e/` must change, `test-engineer`
   (`e2e-device-testing`) extends it once, for both apps, after both render the asserted strings
   and ids. Never a per-platform copy of a flow.
7. **Both lanes green:** `just ios-check` (plus the macOS steps `just ios-build`, `just ios-test`,
   `just ios-e2e` on a Mac or via the `ios` CI workflow) and `just android-check` (plus
   `just android-e2e` on an emulator or via the `android` CI workflow).
8. **Merge and close out.** Merge order: contract PR, then both app PRs (either order; they share
   no files), then the e2e PR. Update the owning docs and apply the proposed `PROGRESS.md` lines
   (`docs-maintenance`), then `just docs-check`.

## Never

- Copy-paste constants between platforms or from `packages/shared-kernel` into Swift or Kotlin
  (reason codes, entitlement names, units, error codes). There is no language-neutral emission
  yet; that is open question OQ-15 (`planning/16-risks-open-questions-and-decision-log.md`). If the
  feature needs such a constant and the contract does not carry it, stop and escalate.
- Fork business logic into the clients: rules, scoring and entitlement decisions stay in the API;
  both apps render what the generated client returns.
- Let the two agents share a working tree, or widen either write set mid-run.
- Add 3D or rendering work: none now; the future path is Google Filament C++ on both platforms
  (ADR-0004), never RealityKit, never a platform-specific 3D stack.
- Hand-edit `packages/contracts/gen/swift-client/` or `packages/contracts/gen/kotlin-client/`;
  regenerate with `just generate`.

## Validation commands

```bash
just generate --check          # contract and all four generated clients in sync
just ios-check                 # iOS half (Linux: package tests, lint, format, bans)
just ios-build && just ios-test  # macOS only
just android-check             # Android half
just docs-check                # docs and PROGRESS after close-out
just ci-parity                 # everything, before the PRs open
```

Run `just ios-e2e` (macOS) and `just android-e2e` (emulator) when the shared flow changed and the
environment exists; otherwise name the CI workflow runs (`ios`, `android`) as the evidence.

## Output

- One brief, one contract PR (if needed), two app PRs, a parity-review note listing every checked
  item with pass/fix, and one proposed `PROGRESS.md` line per PR.

Done checklist: brief written before any code · contract merged first · worktrees disjoint · small
prompts · both reports carry real verification output · parity review and `architecture-reviewer`
done · e2e extended once, after both apps · docs and `PROGRESS.md` updated.

## Stop / escalation

- The two platforms need different contracts → stop; the contract is shared, redesign it with
  `api-contract-change`.
- A platform agent needs a file outside its write set → the lead sequences that change; never widen
  an agent's write set mid-run.
- The feature needs a shared-kernel constant the contract does not carry → stop; OQ-15 is open,
  a human decides (never copy it).
- Parity cannot be reached because of a platform limitation → document the difference in both PRs
  and in the brief; a human accepts it.

## Overlap

Adjacent: `ios-feature` and `android-feature` (the per-platform work this skill dispatches),
`api-contract-change` (the producer step), `architecture-review` (boundary and duplication lens on
each diff; this skill adds the parity lens), `e2e-device-testing` (shared Maestro flows),
`release-readiness` (both platform artifacts from one commit).
