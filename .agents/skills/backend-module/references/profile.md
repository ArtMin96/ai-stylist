# `profile` — module reference

Last reviewed: 2026-09-13

## Contract summary

Measurements, body data, preferences, style identity, and units/locale for a user. Full contract:
[`docs/modules/profile.md`](../../../../docs/modules/profile.md).

## Invariants that bite

- Body measurements never appear in logs, fixtures, seed data, prompts, or error messages (CLAUDE.md, Security and privacy rules) — this is the module where that rule gets triggered most often.
- Unit definitions and conversions come from `shared-kernel`; a new preference kind extends the existing preferences model, it does not open a second store.
- This module writes only the tables it owns; cross-module behaviour goes through `identity`'s public API or an event, never a shared table.

## Key files

- `apps/api/src/modules/profile/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/profile/internal/README.md` — placeholder; `apps/api/src/modules/<name>/internal/schema.ts` does not exist yet (P03 creates it via `db-migration`).
- `apps/api/src/modules/profile/tests/` — this module's test suite.

## Owned data

None yet. Planned per SPINE §3: `profiles`, `measurements`, `preferences` (measurements are sensitive per doc 11), defined in `apps/api/src/modules/<name>/internal/schema.ts` once P03 lands them.

## Events

None yet. P03 adds `measurements.updated`, which P04's `avatar` module subscribes to read-only — do not add a second publisher for the same fact.

## Allowed / forbidden edges

Allowed: public API of `identity`; `packages/shared-kernel` (units, measurement definitions). Consumed by `avatar`, `closet`, `recommendation`, `fashion-intel`, `assistant`. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); any edge outside the doc 04 §4.1 graph (`allowed-edges-only`).

## Test command

```bash
just test profile
```

## Phase tasks that touch this module

Status: skeleton (P02), no domain-phase task has touched it yet. `planning/phases/P03-identity-consent-onboarding.md` §6 is the main event: profiles/measurements/preferences tables, SI-canonical value objects, plausibility validation, settings services. Later, minor touches land in P04 (avatar subscribes read-only), P07 (wear-count-per-wash preference), and P08 (manual-city field). Check the relevant phase file's §12/§19 for the current task list.

## Escalate when

- A change would put a raw measurement value into a log line, fixture, seed row, or AI prompt — stop, that is a Security and privacy rules violation regardless of intent.
- Plausibility bounds or unit conversions need to change — that is a `shared-kernel` single-source-of-truth question, not a per-caller override inside `profile`.
