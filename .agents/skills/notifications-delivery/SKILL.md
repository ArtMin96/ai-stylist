---
name: notifications-delivery
description: Build or change push notification delivery in the `notifications` module — FCM/APNs sent through a port so the domain never imports a push SDK, per-user quiet hours and timezone-aware scheduling, opt-out/preference checks, delivery receipts, and dedup/idempotency via the outbox. Use for work in `apps/api/src/modules/notifications`, the `notification_prefs`/`deliveries` tables, the daily-outfit push (P09-T16), or any FCM/APNs port or adapter. Not for generic module scaffolding outside notifications — use `backend-module` instead. Not for deciding who is authorized to receive what or auditing consent — run `security-privacy-review` first.

metadata:
  modules: notifications
  last-reviewed: 2026-09-13
  owner-agent: api-engineer
---

# Notifications Delivery

## Trigger

- Adding or changing scheduling, quiet-hours, timezone, or opt-out logic for push notifications inside `apps/api/src/modules/notifications`.
- Adding or changing the FCM/APNs port (`apps/api/src/platform/`) or its binding at the composition root.
- Wiring a new notification kind (e.g. the daily-outfit push from P09-T16) into the outbox-driven delivery path, including delivery receipts and dedup/idempotency.
- Not this skill: the module's general application-service shape when nothing above applies — `backend-module`. Deciding whether a user may be notified at all, consent scope, or auditing what got logged — `security-privacy-review` first, then this skill for the delivery mechanics.

## Required reading

1. `docs/modules/notifications.md` — public interface (currently `index.ts`-only, P02 skeleton), planned owned data (`notification_prefs`, `deliveries`), invariants, and the forbidden-dependency rule that the module never imports an FCM/APNs SDK directly.
2. `planning/phases/P09-recommendation-engine-v1.md` row P09-T16 — the phase task that actually builds this: prefs, quiet hours, timezone scheduling, the FCM/APNs port, and the daily-outfit notification, gated on context freshness.
3. `planning/04-architecture.md` §4.2 (adapters translate, modules decide; a module writes only its own tables) and §9 (outbox semantics) — the dedup/idempotency mechanism this skill must use, not reinvent.
4. `apps/api/src/modules/notifications/index.ts` and neighbouring modules' `index.ts` (e.g. `identity`) — what is already public versus what this task would newly export.

## Workflow

1. Restate which piece is changing — scheduling/quiet-hours rule, opt-out check, port adapter, or receipt/dedup handling — and confirm it is `notifications`' own concern per `docs/modules/notifications.md`. A rule about _whether_ a user should be notified about something (billing, moderation) belongs to the module that owns that decision; `notifications` only decides _when and how_ to deliver.
2. Quiet hours and timezone scheduling are pure functions of user prefs + current time in the user's timezone — keep them testable without a clock dependency (inject time, don't call `Date.now()` inline) so the scheduling rule can be unit-tested for every boundary (just before/at/just after the window, DST transitions).
3. Any FCM/APNs interaction goes through a port declared in this module (or `shared-kernel` if genuinely shared) and implemented in `apps/api/src/platform/`, bound only at the composition root — never import the FCM/APNs SDK inside `modules/notifications/**` (`domain-no-provider-sdk`, `just arch-check`).
4. Delivery dedup/idempotency reuses the outbox pattern already established for other modules (`planning/04-architecture.md` §9): a delivery attempt keys off the outbox event id, not a locally invented dedup table, so retries and redelivery from the relay are safe by construction.
5. Delivery receipts (sent/delivered/failed/opted-out) are recorded on the module's own `deliveries` table only; cross-module reads of delivery history go through this module's public API, never a direct table read.
6. Tests live in `apps/api/src/modules/notifications/tests/`: quiet-hours boundary matrix, opt-out short-circuit, port failure/timeout handling, and outbox redelivery does not double-send.

## Validation commands

```bash
just test notifications
just lint && just typecheck && just arch-check
just generate --check                 # only if a new notification kind changed packages/contracts
just ci-parity                        # before PR
```

## Output

PR scoped to `apps/api/src/modules/notifications` (plus `apps/api/src/platform/` and the composition root only when a port was added or changed), with real test output for the quiet-hours/opt-out/dedup cases; `docs/modules/notifications.md` updated when the public surface, owned tables, or invariants changed.

Done checklist: scoped tests green (quiet hours, opt-out, dedup) · `lint`/`typecheck`/`arch-check` green · no FCM/APNs SDK import inside `modules/notifications/**` · delivery dedup keyed on the outbox event id, not a bespoke table · contract doc updated · `PROGRESS.md` updated.

## Stop / escalation

- The task requires deciding _who_ is allowed to receive a notification (consent, legal opt-out, a sensitive-data field in the payload) rather than _how_ to deliver it → `security-privacy-review` before writing delivery code.
- A new notification kind needs a new event/payload shape → `api-contract-change` first, then return here to wire delivery.
- The FCM/APNs port doesn't exist yet and the task assumes it does → build the port in `apps/api/src/platform/` as its own step per `backend-module`'s port pattern, then continue.
- An invariant in `docs/modules/notifications.md` conflicts with the task → surface the conflict; never violate the contract quietly.

## Overlap

Adjacent: `backend-module` (owns the module's general application-service mechanics and the port-implementation pattern this skill reuses for FCM/APNs), `api-contract-change` (new notification-kind payload shapes on the wire), `security-privacy-review` (mandatory before any change to who receives a notification or what a payload contains), `recommendation-rules` (the daily-outfit content decision itself lives there; this skill only delivers it). This skill owns `apps/api/src/modules/notifications/**` and its FCM/APNs port/adapter.
