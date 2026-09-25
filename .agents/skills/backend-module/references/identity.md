# `identity` — module reference

Last reviewed: 2026-09-13

## Contract summary

Accounts, sessions, auth providers, consent records, and the age gate. Full contract:
[`docs/modules/identity.md`](../../../../docs/modules/identity.md).

## Invariants that bite

- Leaf among domain modules: depends on `packages/shared-kernel` only — no other module's public API, and definitely no `internal/**` of another module.
- Auth, authorization, and consent changes require the `security-privacy-review` skill before PR (CLAUDE.md); this is not optional review, it blocks merge.
- Age-gate policy is OPEN (`planning/16-risks-open-questions-and-decision-log.md` OQ-03) — do not hard-code an age threshold as if it were settled; flag it if the task assumes one.

## Key files

- `apps/api/src/modules/identity/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/identity/internal/README.md` — placeholder; `apps/api/src/modules/<name>/internal/schema.ts` does not exist yet (P03 creates it via `db-migration`).
- `apps/api/src/modules/identity/tests/` — this module's test suite.

## Owned data

None yet. Planned per SPINE §3: `users`, `sessions`, `consents`, defined in `apps/api/src/modules/<name>/internal/schema.ts` once P03 lands them.

## Events

None yet. P03 adds `account.created`, `consent.changed`, `account.deletion_requested` — declare payload schemas in `packages/contracts` when that work starts, not ahead of it.

## Allowed / forbidden edges

Allowed: `packages/shared-kernel` only; consumed by `profile`, `billing`, `notifications`, `admin`. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); any edge outside the doc 04 §4.1 graph (`allowed-edges-only`).

## Test command

```bash
just test identity
```

## Phase tasks that touch this module

Status: skeleton (P02), no domain-phase task has touched it yet. `planning/phases/P03-identity-consent-onboarding.md` §6 is where the next real work lands: better-auth integration, users/sessions/consents tables, the age gate, recovery, rate limits, and a deletion-orchestration entry point. Check that file's §12/§19 for the current task list before assuming this still holds.

## Escalate when

- A task needs the age-gate threshold decided rather than deferred — that is OQ-03, not an implementation detail; surface it.
- Auth/consent/deletion code is about to ship without a `security-privacy-review` pass — stop and route it there first.
