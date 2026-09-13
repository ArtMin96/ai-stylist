---
name: admin-moderation
description: Build or change support tooling, moderation queues, audit logging, and admin CRUD surfaces in the `admin` module — RBAC on admin actions, an append-only audit log, and the rule that any admin action on user content is both logged and reversible. Use for work in `apps/api/src/modules/admin`, the `audit_log`/`moderation_queue` tables, a content-scan quarantine or approve/reject queue (P06-T13), fashion-intel source-register admin CRUD (P12-T04), moderation quarantine wiring or a user-report endpoint (P12-T08), or the support/admin-surface + audit-log viewer (P14-T12). Not for generic module scaffolding outside admin — use `backend-module` instead. Not for deciding who is authorized to hold an admin role or reviewing the resulting diff for auth correctness — run `security-privacy-review` first.

metadata:
  modules: admin
  last-reviewed: 2026-09-13
  owner-agent: api-engineer
---

# Admin and Moderation

## Trigger

- Adding or changing an admin CRUD surface, moderation queue, or audit-log entry inside `apps/api/src/modules/admin`.
- Wiring a quarantine/approve/reject workflow into the admin queue — malware/content-scan results from `closet`/`media` (P06-T13), or fashion-intel ingestion moderation and the editor spot-check queue (P12-T08).
- Building the source-register admin CRUD with a mandatory rights-basis field (P12-T04), or the support/admin-surface minimum and audit-log viewer demo (P14-T12).
- Not this skill: the module whose content is being moderated deciding its own domain rules (e.g. what counts as a valid closet item) — that stays in the owning module; this skill only owns the admin-side queue, RBAC, and audit trail. Deciding who may hold an admin role, or auditing an admin change for authorization correctness — `security-privacy-review` first.

## Required reading

1. `docs/modules/admin.md` — public interface (currently `index.ts`-only, P02 skeleton), planned owned data (`audit_log`, `moderation_queue`), invariants, and the allowed-dependency list (`media`, `closet`, `billing`, `identity` public APIs only).
2. The phase rows that build this module's real behaviour: `planning/phases/P06-closet-capture-pipeline.md` P06-T13 (malware/content scan stage, quarantine states, admin queue approve/reject audited, 30-day purge job), `planning/phases/P12-fashion-intelligence.md` P12-T04 (source register + admin CRUD, rights basis mandatory) and P12-T08 (moderation quarantine wiring, user-report endpoint, editor spot-check queue), `planning/phases/P14-hardening-and-launch.md` P14-T12 (support/admin minimum complete, audit-log viewer demo).
3. `planning/04-architecture.md` §4.2 (adapters translate, modules decide; a module writes only its own tables) — the rule behind "admin decides, the scanning/ingestion job just reports a result".
4. `apps/api/src/modules/admin/index.ts` and the public `index.ts` of `media`, `closet`, `billing`, `identity` — what admin is already allowed to call versus what a task would newly require.

## Workflow

1. Restate which surface is changing — a moderation queue, an admin CRUD form, an audit-log entry, or an RBAC check — and confirm the _decision_ still lives in the owning module (e.g. whether a closet item is malware is `media`'s scan result; admin only queues it, and a human approves/rejects).
2. Every admin action that touches user content (approve, reject, quarantine, delete, restore, edit) writes an `audit_log` row before or atomically with the action — who, what, when, and the reversal path — because "logged and reversible" (`docs/modules/admin.md`) is the module's central invariant, not a nice-to-have.
3. RBAC is checked at the point of the action, not only at the route: an admin endpoint authenticates like any other endpoint, then checks the caller's admin role/permission before the write, per doc 04 §4.2 rule 9 (business rules do not live in the controller alone).
4. Reversibility means the audit log records enough to undo the action (previous state or an explicit inverse action) — a purge/delete job (e.g. the 30-day purge in P06-T13) is the one legitimate exception, and it must say explicitly in its own logic why it is irreversible and that this was intentional, not an oversight.
5. Cross-module reads (the item under moderation, the fashion-intel source, the flagged garment) go through the owning module's public `index.ts` — `admin` never reads another module's table directly, even for a queue it owns.
6. Tests live in `apps/api/src/modules/admin/tests/`: RBAC denial for a non-admin caller, an audit-log row written for every mutating action, and — where the phase task defines one — the reversal path actually restoring prior state.

## Validation commands

```bash
just test admin
just lint && just typecheck && just arch-check
just security-scan                    # RBAC/audit surfaces are a standing security-scan target
just ci-parity                        # before PR
```

## Output

PR scoped to `apps/api/src/modules/admin` (cross-module calls only through the other module's `index.ts`), with real test output for the RBAC and audit-log cases; `docs/modules/admin.md` updated when the public surface, owned tables, or invariants changed.

Done checklist: scoped tests green (RBAC denial, audit-log write, reversal where applicable) · `lint`/`typecheck`/`arch-check` green · no direct table read of another module · every mutating admin action has a matching audit-log row · `security-privacy-review` done for any RBAC/authorization change · contract doc updated · `PROGRESS.md` updated.

## Stop / escalation

- The task is about _who_ may hold an admin role, a new permission tier, or reviewing an admin diff for authorization correctness → `security-privacy-review` before writing or merging the change.
- A moderation decision needs a new field on another module's data (e.g. a `flagged` state on a closet item) → that field is owned by the other module; add it there via `backend-module` first, then wire the admin queue to it.
- An action is being made irreversible for convenience rather than by design (e.g. skipping the audit-log write "just for this one path") → stop; this violates the module's central invariant.
- An invariant in `docs/modules/admin.md` conflicts with the task → surface the conflict; never violate the contract quietly.

## Overlap

Adjacent: `backend-module` (owns the module's general application-service mechanics this skill's admin services still follow), `security-privacy-review` (mandatory for RBAC/authorization changes and any diff granting or checking an admin permission), `media-ml-pipeline` (the content-scan job that produces the quarantine result admin queues, not the queue itself), `fashion-intel-ingestion` (the source register and ingestion pipeline; this skill owns only the admin CRUD and moderation wiring on top of it). This skill owns `apps/api/src/modules/admin/**`, its `audit_log`/`moderation_queue` tables, and RBAC checks on admin endpoints.
