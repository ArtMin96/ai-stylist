---
name: data-lifecycle
description: Implement or review the consent registry, cross-module account-deletion cascade, data-export jobs, retention windows, and purge verification for the AI Stylist API — the mechanics behind planning/06-data-api-and-event-contracts.md §8. Use whenever the task is a consent-withdrawal flow, an account-deletion request, a GDPR/CCPA data export, a retention-window job, an orphaned-data purge-verification scan, or extending the ordered deletion chain (Postgres cascade → R2 prefix → provider data → pg-boss cancellation → session revocation) to a new module. Not for the module's own service code — start in `backend-module` (or `entitlements-billing` for credit-ledger retention) and come here for the cross-module ordering, consent/deletion invariants, and the mandatory `security-privacy-review` gate.

metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: api-engineer
---

# Data Lifecycle: Consent, Deletion, Export, Retention

## Trigger

- A consent-registry change: a new purpose, wiring withdrawal to halt in-flight processing, or the `consent.changed` event.
- A deletion cascade: `identity.account.deletion_requested.v1`, a consent-withdrawal-triggered deletion (e.g. revoking face processing), or extending the doc 06 §8 chain to cover a module that doesn't participate yet.
- A data-export job: the ZIP of profile/measurements/preferences/consent history and its signed R2 link.
- A retention-window job, an orphaned-data purge-verification scan, or a `just docs-check` / audit finding about data that should have been purged and wasn't.
- Trigger phrases: "delete account", "deletion cascade", "export my data", "data export", "retention window", "consent withdrawal", "purge", "GDPR", "CCPA", "right to be forgotten".
- Do first, then return: the owning module's skill for the actual service code (`backend-module` for `identity`/`profile`/`closet`/`media`, `entitlements-billing` for credit-ledger and RevenueCat subscriber retention) — this skill supplies the cross-module ordering and invariants, not the module implementation itself.

## Required reading

1. `planning/06-data-api-and-event-contracts.md` §8 (Deletion propagation) — the canonical ordered chain: Postgres cascade (dependency order) → R2 prefix delete → provider data (fal.ai/RevenueCat/PostHog) → pg-boss job cancellation → session revocation → outbox residual; §4 for the `identity.account.deletion_requested.v1` and `consent.changed` event shapes.
2. `planning/phases/P03-identity-consent-onboarding.md` — P03-T05 (consent registry: append-only `consents` + purposes + audit rows + withdrawal-halts-processing), P03-T09 (export job: pg-boss chain → ZIP → R2 signed link, 24 h, 1-concurrent), P03-T10 (deletion cascade v1: grace window + cancel, ordered chain, per-step audit + idempotency, FK coverage test).
3. `planning/phases/P05-selfie-face-personalization.md` — P05-T08, a worked example of extending the cascade to a second data class: a face-scoped deletion job, a consent-withdrawal trigger, an account-deletion integration, and an orphan-verification scan.
4. `docs/modules/<module>.md` for every module the task's cascade, export, or retention window touches — the module's Invariants section is where "this module writes only the tables it owns" and any deletion/export invariant get recorded.
5. `.agents/skills/security-privacy-review/SKILL.md` — read before finishing, not just before PR: every flow this skill covers is one root `CLAUDE.md` marks mandatory-review (auth, consent, deletion flows, sensitive data).

## Workflow

1. Restate scope: which data class, which module(s) own the touched tables, and whether this is a new consent purpose, a new deletion target, an export field, or a retention window. A cascade step that writes to a module's tables belongs in that module's `apps/api/src/modules/<name>/internal/`, invoked by the orchestrating job — never reached directly from another module's code, the same module-boundary rule as everywhere else in this repo.
2. Consent is append-only: a withdrawal is a new `consents` row, never a mutation of history. Withdrawal must halt in-flight processing for that purpose (cancel the pending pg-boss job) before it blocks new requests — a job that started a moment before withdrawal and runs to completion anyway silently ignores the user's choice.
3. Deletion cascade: extend the doc 06 §8 step table, not a parallel mechanism. Add the new module's tables to the Postgres cascade step in FK dependency order, add the new R2 prefix step if the module owns objects, and add the provider-deletion step if the module calls an external provider. Every step is per-step audited and idempotent — safe to resume from the correct point after a partial failure, not just safe to re-run from the start.
4. Export: extend the one export job's ZIP contents, not a second export path. One export job per account, one signed link, one concurrency slot (P03-T09) — two rapid export requests must not race on the same R2 key.
5. A retention window is a value with a named source: this file, an ADR, or a provider's stated policy (e.g. the PITR backup retention in doc 06 §8). Never invent a retention number ad hoc in application code.
6. Purge verification is the cascade's last step, not an afterthought: an R2 list-empty check, a Postgres FK-coverage test, or both. A cascade without a verification step that can actually fail is unproven, the same way a bug fix without a failing-first test is unproven.
7. Every workflow under this skill ends with `security-privacy-review` before PR — root `CLAUDE.md`'s "Security and privacy rules" makes this non-optional for auth, consent, and deletion flows.

## Validation commands

```bash
just test <module>            # the module(s) whose cascade step, export field, or consent table changed
just test-regression <file>   # bug fix: prove the failure first, then the fix
just lint && just typecheck && just arch-check
just generate --check         # only if a contract or event schema changed
just security-scan            # dependency/secret gates; not a substitute for the review skill
just ci-parity                # before PR
```

## Output

- PR scoped to the module(s) whose cascade/export/consent code changed, citing the doc 06 §8 step table row for what changed and why; `docs/modules/<module>.md` updated for any new owned data or invariant.
- The `security-privacy-review` outcome attached, or explicitly requested as the next step, before the PR opens.

Done checklist: the new/changed cascade step is idempotent and audited · a verification step exists and was exercised · the export or consent change extends the existing job/table rather than forking a parallel one · `security-privacy-review` run or requested · `PROGRESS.md` line suggested.

## Stop / escalation

- A new sensitive-data class (a new kind of measurement, biometric, or location data) → `security-privacy-review` decides classification before code lands, not after.
- A retention window with no documented source (ADR, provider policy, or this file) → stop and ask; never invent a number.
- A request that would need a second export path or a second deletion mechanism instead of extending doc 06 §8's chain → that is an architecture question; raise it, don't fork the mechanism.
- A table or column change the cascade needs (e.g. a new `deleted_at` column) → `db-migration` first.
- A new event or endpoint shape (e.g. a new export-status field) → `api-contract-change` first.

## Overlap

Adjacent: `backend-module` (implements the module-side service code the cascade/export calls into — this skill owns the cross-module ordering and invariants, not the module internals), `entitlements-billing` (billing/credit-ledger retention and RevenueCat subscriber deletion live inside its module but follow this skill's cascade ordering), `db-migration` (any schema change the cascade needs), `api-contract-change` (event/endpoint shape changes), `security-privacy-review` (the mandatory gate every workflow here ends at — it reviews, this skill implements). This skill owns no SPINE module directly; it owns the consent/deletion/export/retention mechanics that cut across `identity`, `profile`, `closet`, `media`, and `billing`.
