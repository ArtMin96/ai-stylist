---
name: data-lifecycle
description: Implement or review the consent registry, the cross-module account-deletion cascade, data-export jobs, retention windows, and purge verification for the AI Stylist API — the mechanics behind planning/06-data-api-and-event-contracts.md §8 and planning/11-security-privacy-and-compliance.md §6–§7 and §13. Use whenever the task is a consent-withdrawal flow, an account-deletion request, a GDPR/CCPA data export, a retention-window job, an orphaned-data purge-verification scan, or extending the ordered deletion chain (Postgres cascade → R2 prefix → provider data → pg-boss cancellation → session revocation) to a new module or data class. Not for the module's own service code — start in `backend-module` (or `entitlements-billing` for credit-ledger retention) and come here for the cross-module ordering, consent/deletion invariants, and the mandatory `security-privacy-review` gate.
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: api-engineer,platform-engineer
---

# Data Lifecycle: Consent, Deletion, Export, Retention

## Trigger

- A consent-registry change: a new purpose, wiring withdrawal to halt in-flight processing, or the `consent.changed` event.
- A deletion cascade: `identity.account.deletion_requested.v1`, a consent-withdrawal-triggered deletion (e.g. revoking face processing), or extending the doc 06 §8 chain to a module that does not participate yet.
- A data-export job: the ZIP of profile/measurements/preferences/consent history and its signed R2 link.
- A retention-window job, an orphaned-data purge-verification scan, or an audit finding about data that should have been purged.
- Trigger phrases: "delete account", "deletion cascade", "export my data", "retention window", "consent withdrawal", "purge", "GDPR", "CCPA", "right to be forgotten".
- Executing agents: `api-engineer` writes each module's cascade/export step inside that module; `platform-engineer` writes the orchestrating pg-boss job chain in `apps/api/src/jobs/` (tests in `apps/api/src/jobs/tests/<handler>.test.ts`).
- State on 2026-09-25: none of this exists. P03 (consent registry, export, deletion v1) is `NOT_STARTED`; pg-boss and the outbox relay are P02-T08, `NOT_STARTED`.

## Required reading

1. `planning/06-data-api-and-event-contracts.md` §8 — the canonical ordered chain: Postgres cascade (dependency order) → R2 prefix delete → provider data (fal.ai/RevenueCat/PostHog) → pg-boss cancellation → session revocation → outbox residual; §4 for the `identity.account.deletion_requested.v1` and `consent.changed` shapes.
2. `planning/11-security-privacy-and-compliance.md` §6 (classes S0–S3 and the Retention column — the source for every retention number), §7 (consent registry and purposes), §13 (export and deletion).
3. `planning/phases/P03-identity-consent-onboarding.md` — P03-T05 (append-only `consents`, purposes, audit rows, withdrawal halts processing), P03-T09 (export: pg-boss chain → ZIP → R2 signed link, 24 h, 1-concurrent), P03-T10 (deletion v1: grace window, ordered chain, per-step audit + idempotency, FK coverage test).
4. `planning/phases/P05-selfie-face-personalization.md` P05-T08 — a worked example of extending the cascade to a second data class.
5. `docs/modules/<module>.md` for every module the cascade, export, or retention window touches, and `tools/depcruise/rules.cjs` `ALLOWED_EDGES` — the orchestrating job in `apps/api/src/jobs/` may call any module's public API; one module's step may not call another module.
6. `.agents/skills/security-privacy-review/SKILL.md` — read before finishing: every flow here is mandatory-review.

## Workflow

1. Restate scope: data class (doc 11 §6), the module(s) owning the touched tables, and whether this is a new consent purpose, deletion target, export field, or retention window.
2. Search before write — extend the existing mechanism, never a parallel one:

   ```bash
   git ls-files apps/api/src/jobs apps/api/src/modules/identity
   rg -n -i 'consent|deletion|delete_requested|export|retention|purge|orphan' apps/api/src packages/contracts/events packages/contracts/openapi packages/db/src/schema
   ```

3. Copy the structure from: event schema `packages/contracts/events/demo.event.json` (via `api-contract-change`); envelope construction `apps/api/src/dev/demo-events.controller.ts`; module service and tests per the `backend-module` sibling table (`.agents/skills/backend-module/SKILL.md` Workflow step 4); migration and FK test harness `apps/api/tests/migrations/migrate.test.ts` (`platform-engineer`). No job handler exists yet (`apps/api/src/jobs/README.md`).
4. A cascade step that writes to a module's tables lives in that module's `apps/api/src/modules/<name>/internal/`, exposed through its `index.ts`, and is invoked by the orchestrating job — never reached from another module's code.
5. Consent is append-only: a withdrawal is a new `consents` row, never a mutation of history. Withdrawal cancels the pending pg-boss job for that purpose before it blocks new requests; otherwise a job that started a moment earlier silently ignores the user's choice.
6. Deletion: extend the doc 06 §8 step table. Add the module's tables to the Postgres step in FK dependency order, an R2 prefix step if it owns objects, a provider step if it calls a provider. Every step is audited and idempotent — resumable from the right point after a partial failure, not just re-runnable from the start.
7. Export: extend the one export job's ZIP contents. One job per account, one signed link, one concurrency slot (P03-T09), so two rapid requests never race on the same R2 key.
8. Retention: every window cites a named source — `planning/11-security-privacy-and-compliance.md` §6 (Retention column), an ADR, or a provider's stated policy (e.g. PITR retention in doc 06 §8). Never invent a number in code.
9. Purge verification is the cascade's last step: an R2 list-empty check, a Postgres FK-coverage test, or both, and it must be able to fail.
10. Finish with `security-privacy-review` before PR (root `CLAUDE.md` "Security and privacy rules").

## Validation commands

```bash
just test <module>            # each module whose cascade step, export field, or consent table changed
just test api                 # FK-coverage / migration tests in apps/api/tests (needs Docker)
just test-regression <file>   # bug fix: prove the failure first, then the fix
just lint && just typecheck && just arch-check
just generate --check         # only if a contract or event schema changed
just security-scan            # dependency/secret gates; not a substitute for the review skill
just ci-parity                # before PR
```

## Output

- PR scoped to the module(s) whose cascade/export/consent code changed, citing the doc 06 §8 step row it changes; `docs/modules/<module>.md` updated for new owned data or invariants; the `security-privacy-review` outcome attached or requested as the next step. Report in the `agent-operating-contract` format.

Done checklist: the new/changed step is idempotent and audited · a verification step exists and was exercised · the change extends the existing job/table · every retention number cites its source · `security-privacy-review` run or requested · `PROGRESS.md` line suggested.

## Stop / escalation

- The orchestrating job chain, withdrawal-cancels-job, or export job needs pg-boss or the outbox relay → P02-T08 is `NOT_STARTED` (`apps/api/src/platform/outbox/README.md`, `apps/api/src/jobs/README.md`); stop and sequence after T08.
- The task assumes `consents`, the export job, or deletion v1 exist → P03-T05/T09/T10 are not built; stop and name the task.
- A new sensitive-data class (measurement kind, biometric, location) → `security-privacy-review` decides the classification before code lands.
- A retention window with no source in doc 11 §6, an ADR, or a provider policy → stop and ask; never invent a number.
- A request needs a second export path or deletion mechanism instead of extending doc 06 §8 → architecture question; raise it.
- A table or column change the cascade needs (e.g. `deleted_at`) → `db-migration` first.
- A new event or endpoint shape (e.g. an export-status field) → `api-contract-change` first.

## Overlap

Adjacent: `backend-module` (module-side service code the cascade/export calls — this skill owns the cross-module ordering and invariants), `entitlements-billing` (ledger retention and RevenueCat subscriber deletion follow this skill's cascade order), `media-ml-pipeline` (pg-boss handler plumbing, job cancellation), `db-migration` (schema the cascade needs), `api-contract-change` (event/endpoint shapes), `assistant-chat` (conversation deletion once built), `security-privacy-review` (the mandatory gate every workflow here ends at). This skill owns no SPINE module; it owns the consent/deletion/export/retention ordering that cuts across `identity`, `profile`, `closet`, `media`, `billing` and later `assistant`.
