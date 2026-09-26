---
name: notifications-delivery
description: Build or change push notification delivery in the `notifications` module — FCM/APNs sent through a port so the domain never imports a push SDK, per-user quiet hours and timezone-aware scheduling, opt-out/preference checks, delivery receipts, and dedup/idempotency keyed on the outbox event id. Use for any work in `apps/api/src/modules/notifications` (including plain services and endpoints there), the `notification_prefs`/`deliveries` tables, the daily-outfit push (P09-T16), or an FCM/APNs port or adapter. Not for work in other modules — use `backend-module` or that module's skill. Not for deciding who is authorized to receive what or auditing consent — run `security-privacy-review` first.
metadata:
  modules: notifications
  last-reviewed: 2026-09-26
  owner-agent: api-engineer
---

# Notifications Delivery

## Trigger

- Any change inside `apps/api/src/modules/notifications/`: scheduling, quiet hours, timezone, opt-out, receipts, or a plain service/endpoint. Today the module is a P02 skeleton (empty `NotificationsModule`, an internal README, one smoke test); P09-T16 builds it.
- Adding or changing the FCM/APNs adapter in `apps/api/src/platform/` or its binding in `apps/api/src/app.module.ts`.
- Wiring a notification kind (e.g. the P09-T16 daily-outfit push) into the outbox-driven delivery path.
- Not this skill: whether a user may be notified at all, consent scope, or what a payload may contain → `security-privacy-review` first, then this skill for the mechanics.

## Required reading

1. `docs/modules/notifications.md` — public interface (skeleton), planned `notification_prefs` and `deliveries`, invariants, the ban on importing an FCM/APNs SDK.
2. `planning/phases/P09-recommendation-engine-v1.md` row P09-T16 — prefs, quiet hours, timezone scheduling, the FCM/APNs port, the daily-outfit push gated on context freshness.
3. `planning/04-architecture.md` §4.2 (adapters translate, modules decide; a module writes only its own tables) and §9 (outbox → pg-boss semantics).
4. `apps/api/src/platform/outbox/README.md` and `apps/api/src/jobs/README.md` — the relay and pg-boss are P02-T08 placeholders; delivery cannot run until they exist.
5. `apps/api/src/modules/notifications/index.ts` and `apps/api/src/modules/identity/index.ts` — `identity` is the only module `notifications` may import (`ALLOWED_EDGES` in `tools/depcruise/rules.cjs`).

## Workflow

1. Restate which piece changes — scheduling rule, opt-out check, port adapter, receipt/dedup handling — and confirm it is `notifications`' concern. Whether a user should hear about something (billing, moderation) is decided by the module that owns that decision; `notifications` decides when and how to deliver.
2. Search before write:

   ```bash
   git ls-files apps/api/src/modules/notifications apps/api/src/platform
   rg -n -i 'quiet|timezone|tz|opt.?out|push|fcm|apns|deliver' apps/api/src packages/shared-kernel/src packages/contracts packages/test-support/src
   ```

3. Copy the structure from the `backend-module` sibling table (`.agents/skills/backend-module/SKILL.md` Workflow step 4). The ones this module needs first: pure rule + unit test with fixed time → `apps/api/src/platform/tests/storage.port.test.ts` with `fakeClock` from `packages/test-support/src/clock.ts`; port type + token → `apps/api/src/platform/ports/health-probe.port.ts` (shape only); adapter → `apps/api/src/platform/pg-health-probe.ts`; binding → `apps/api/src/app.module.ts`.
4. Quiet hours and timezone scheduling are pure functions of (prefs, `now`, user timezone). Pass `now` in as a parameter so every boundary is unit-testable: just before, at, and just after each window edge, plus DST transitions. Modules cannot import the platform `Clock` (`modules-not-platform`).
5. FCM/APNs: declare the push port in this module's `index.ts`; `platform-engineer` implements it in `apps/api/src/platform/` (`firebase-admin` is a listed provider SDK, never imported in `modules/**`); `api-engineer` writes the fake in `packages/test-support/src/` and binds it in `apps/api/src/app.module.ts`.
6. Delivery dedup keys off the outbox event id (doc 04 §9: the relay enqueues with `singletonKey = event.id`), not a locally invented dedup table, so relay redelivery is safe by construction.
7. Receipts (sent/delivered/failed/opted-out) live on this module's own `deliveries` table; other modules read delivery history through this module's public API.
8. Tests in `apps/api/src/modules/notifications/tests/`: quiet-hours boundary matrix, opt-out short-circuit before any port call, port failure/timeout, and redelivery of the same event not double-sending.

## Validation commands

```bash
just test notifications
just test-regression <test-file>      # bug fix: fails at merge-base, passes at HEAD
just lint && just typecheck && just arch-check
just generate --check                 # only if a notification kind changed packages/contracts
just ci-parity                        # before PR
```

## Output

- A diff scoped to `apps/api/src/modules/notifications/` (plus `apps/api/src/platform/` and the composition root only when the port changed), with real test output for the quiet-hours, opt-out and dedup cases; `docs/modules/notifications.md` updated when the surface, owned tables, or invariants changed. Report in the `agent-operating-contract` format.

Done checklist: scoped tests green (quiet hours, opt-out, dedup) · `lint`/`typecheck`/`arch-check` green · no FCM/APNs SDK in `modules/notifications/**` · dedup keyed on the outbox event id · contract doc updated · `PROGRESS.md` line suggested.

## Stop / escalation

- Sending, scheduling, or dedup needs the outbox relay or pg-boss → unless P02-T08 is `DONE` in `planning/phases/P02-repo-foundations-and-ci.md`, stop after the pure rules and the port design, and name T08 as the blocker.
- The task needs `notification_prefs` or `deliveries` → no module `schema.ts` exists yet; route the tables to `db-migration`, which has its own first-table stop.
- An application service needs a clock → no `Clock` port is importable by modules; stop and request one in `packages/shared-kernel` via `api-contract-change`, structurally identical to `apps/api/src/platform/ports/clock.port.ts`.
- Deciding who may receive a notification (consent, legal opt-out, sensitive data in a payload) → `security-privacy-review` before writing delivery code.
- A new notification kind needs a new event/payload shape → `api-contract-change` first.
- An invariant in `docs/modules/notifications.md` conflicts with the task → surface it; never violate the contract quietly.

## Overlap

Adjacent: `backend-module` (the sibling table and port pattern this skill reuses; owns the other modules), `api-contract-change` (payload shapes on the wire), `db-migration` (`notification_prefs`/`deliveries`), `media-ml-pipeline` (pg-boss handler plumbing once T08 lands), `security-privacy-review` (mandatory before changing who receives what), `recommendation-rules` (the daily-outfit content itself; this skill only delivers it). This skill owns `apps/api/src/modules/notifications/**` and the FCM/APNs port declaration; the adapter file in `apps/api/src/platform/` is written by `platform-engineer`.
