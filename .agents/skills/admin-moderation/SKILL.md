---
name: admin-moderation
description: Build or change support tooling, moderation queues, audit logging, and admin CRUD surfaces in the `admin` module — RBAC on admin actions, an append-only audit log, and the rule that any admin action on user content is both logged and reversible. Use for any work in `apps/api/src/modules/admin` (including plain services and endpoints there), the `audit_log`/`moderation_queue` tables, a content-scan quarantine or approve/reject queue (P06-T13), fashion-intel moderation or source-register admin surfaces (P12-T04, P12-T08), or the support/admin minimum + audit-log viewer (P14-T12). Not for work in other modules — use `backend-module` or that module's skill. Not for deciding who may hold an admin role or reviewing an admin diff for auth correctness — run `security-privacy-review` first.
metadata:
  modules: admin
  last-reviewed: 2026-09-25
  owner-agent: api-engineer
---

# Admin and Moderation

## Trigger

- Any change inside `apps/api/src/modules/admin/`: an admin CRUD surface, moderation queue, audit-log entry, RBAC check, or plain service. Today the module is a P02 skeleton (empty `AdminModule`, an internal README, one smoke test).
- Wiring a quarantine/approve/reject workflow: content-scan results from `media`/`closet` (P06-T13), fashion-intel quarantine and user reports, the editor spot-check queue (P12-T08).
- The source-register admin CRUD with a mandatory rights basis (P12-T04), the support/admin minimum and audit-log viewer (P14-T12).
- Not this skill: the owning module's own domain rule (what counts as a valid closet item stays in `closet`); who may hold an admin role → `security-privacy-review` first.

## Required reading

1. `docs/modules/admin.md` — public interface (skeleton), planned `audit_log` and `moderation_queue`, invariants, allowed dependencies.
2. `tools/depcruise/rules.cjs` `ALLOWED_EDGES.admin`: `media`, `closet`, `billing`, `identity` public APIs only. `fashion-intel` is not reachable from `admin`, and `fashion-intel` may not import `admin`.
3. `planning/11-security-privacy-and-compliance.md` §4.4 (admin RBAC) and §6 (admin reads of S2/S3 data are audited).
4. The phase rows that build this module: `planning/phases/P06-closet-capture-pipeline.md` P06-T13, `planning/phases/P12-fashion-intelligence.md` P12-T04 and P12-T08, `planning/phases/P14-hardening-and-launch.md` P14-T12.
5. `planning/04-architecture.md` §4.2 (adapters translate, modules decide; a module writes only its own tables) and §9 (events).

## Workflow

1. Restate which surface changes — moderation queue, CRUD form, audit entry, or RBAC check — and confirm the decision still lives in the owning module (whether an upload is malware is `media`'s scan result; `admin` queues it and a human approves or rejects).
2. Search before write:

   ```bash
   git ls-files apps/api/src/modules/admin
   rg -n 'export' apps/api/src/modules/media/index.ts apps/api/src/modules/closet/index.ts apps/api/src/modules/billing/index.ts apps/api/src/modules/identity/index.ts
   rg -n -i 'audit|moderation|quarantin|role|rbac' apps/api/src packages/contracts packages/shared-kernel/src
   ```

3. Copy the structure from the `backend-module` sibling table (`.agents/skills/backend-module/SKILL.md` Workflow step 4): controller `apps/api/src/platform/version.controller.ts`; denial as a Nest exception mapped by `apps/api/src/platform/problem.filter.ts` (`FORBIDDEN` from `packages/shared-kernel/src/errors.ts`); module test `apps/api/src/modules/admin/tests/admin.smoke.test.ts`; in-process HTTP test `apps/api/tests/http.test.ts`.
4. Every admin action on user content (approve, reject, quarantine, delete, restore, edit) writes an `audit_log` row before or atomically with the action: who, what, when, prior state, reversal path. "Logged and reversible" is the module's central invariant.
5. RBAC is checked at the point of the action, not only at the route: authenticate like any endpoint, then check the caller's admin permission before the write (doc 04 §4.2 rule 9: no business rule in the controller alone).
6. Reversibility means the audit row holds enough to undo (prior state or an explicit inverse action). The 30-day purge in P06-T13 is the one legitimate exception, and its code states why it is irreversible.
7. Cross-module reads go through the public `index.ts` of `media`, `closet`, `billing` or `identity` only. Content from `fashion-intel` arrives as events (`fashionintel.content.quarantined.v1`, `fashionintel.signal.recorded.v1`); `admin` never reads another module's table, even for a queue it owns.
8. Tests in `apps/api/src/modules/admin/tests/`: RBAC denial for a non-admin caller, an audit row for every mutating action, and the reversal path restoring prior state where the phase task defines one.

## Validation commands

```bash
just test admin
just test-regression <test-file>      # bug fix: fails at merge-base, passes at HEAD
just lint && just typecheck && just arch-check
just security-scan                    # RBAC/audit surfaces are a standing security-scan target
just ci-parity                        # before PR
```

## Output

- A diff scoped to `apps/api/src/modules/admin/` (cross-module calls only through an allowed `index.ts`), with real test output for the RBAC and audit cases; `docs/modules/admin.md` updated when the surface, owned tables, or invariants changed. Report in the `agent-operating-contract` format.

Done checklist: scoped tests green (RBAC denial, audit write, reversal where applicable) · `lint`/`typecheck`/`arch-check` green · no import outside `media`/`closet`/`billing`/`identity` · no direct table read of another module · every mutating action has an audit row · `security-privacy-review` done for any RBAC change · contract doc updated.

## Stop / escalation

- P12-T04 (source-register CRUD) or P12-T08 (moderation wiring) needs a synchronous call between `admin` and `fashion-intel` → doc 04 §4.1 allows neither direction; stop and ask the lead for the decision (events only, or an ADR adding an edge).
- Consuming events (fashion-intel quarantine, scan results) needs the outbox relay and pg-boss → P02-T08 is `NOT_STARTED`; stop and name it.
- `audit_log` or `moderation_queue` is needed → no module `schema.ts` exists yet; route to `db-migration`, which has its own first-table stop.
- Who may hold an admin role, a new permission tier, or an authorization review → `security-privacy-review` before writing or merging.
- A moderation decision needs a new field on another module's data (e.g. a `flagged` state on a closet item) → add it in that module via its skill first.
- An action made irreversible for convenience (skipping the audit write "for this one path") → stop; it breaks the central invariant.
- An invariant in `docs/modules/admin.md` conflicts with the task → surface it; never violate the contract quietly.

## Overlap

Adjacent: `backend-module` (sibling table and the modules `admin` reads through), `security-privacy-review` (mandatory for RBAC/authorization changes), `media-ml-pipeline` (the scan job that produces the quarantine result), `fashion-intel-ingestion` (source register and ingestion; emits the quarantine/report events this module consumes), `observability-analytics` (audit-trail entries in doc 14 dashboards), `db-migration` (`audit_log`/`moderation_queue` tables). This skill owns `apps/api/src/modules/admin/**`, its `audit_log`/`moderation_queue` tables, and RBAC checks on admin endpoints.
