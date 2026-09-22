---
name: backend-module
description: Create or change a NestJS domain module under apps/api/src/modules/ — application services, domain rules, ports, module-owned repositories, events, and Postgres-outbox side effects — or add a port adapter in apps/api/src/platform/ and bind it at the composition root. Use for identity, profile, avatar, closet, media, outfit, context, or platform work: a new application service, a repository behind a port, wiring a provider adapter, or an outbox-driven async job. Not for recommendation scoring, outfit constraints, context-provider rules, or fashion-intel invariants — use `recommendation-rules`; not for a schema or migration change — use `db-migration`; not for an endpoint's wire shape — use `api-contract-change`; not for billing or entitlements — use `entitlements-billing`; not for notifications, admin, or assistant work — use their own skills.

metadata:
  modules: identity,profile,avatar,closet,media,outfit,context,platform
  last-reviewed: 2026-09-13
  owner-agent: api-engineer
---

# Backend Domain-Module Changes

## Trigger

- Adding or changing behaviour inside one of the 8 modules this skill covers: `identity`, `profile`, `avatar`, `closet`, `media`, `outfit`, `context`, `platform`. (The other 7 SPINE modules have their own skill — see Overlap.)
- Adding a port implementation in `apps/api/src/platform/` and binding it at the composition root.
- Do first, then return: `api-contract-change` (endpoint shapes), `db-migration` (tables), `recommendation-rules`, `entitlements-billing`, `media-ml-pipeline` (pipeline steps).

## Required reading

1. `docs/modules/<name>.md` — public interface, owned data, invariants, allowed/forbidden dependencies, extension points.
2. `.agents/skills/backend-module/references/<name>.md` — this skill's per-module cheat sheet: key files, the phase that owns current work, and module-specific escalation triggers.
3. `planning/phases/P<NN>-*.md` current phase file — what this module delivers now; `PROGRESS.md`.
4. `planning/04-architecture.md` §4.2 (rules), §5 (composition roots), §9 (outbox semantics); `planning/03-domain-model-and-glossary.md` for terms.
5. `apps/api/src/modules/<name>/index.ts` and neighbours' `index.ts` — what is already public.

## Workflow

1. Restate scope, non-goals, acceptance criteria; name the single owning module. Behaviour that seems to belong to two modules is a contract question — stop.
2. Read `references/<name>.md` for the module you are touching before writing anything — it names the current phase, the invariants that actually get missed, and the escalation path specific to that module.
3. Search before write (CLAUDE.md): this module's internals, neighbours' public APIs, `packages/shared-kernel/`, `packages/test-support/`.
4. Implement in `apps/api/src/modules/<name>/internal/`; export through `index.ts` only what `docs/modules/<name>.md` declares public. Controllers and pg-boss job handlers stay thin: parse via contract types → call application service → map result. No business rules in controllers, schema files, job handlers, or provider wrappers. Schema ownership is split, not shared: the module owner edits `apps/api/src/modules/<name>/internal/schema.ts`; `platform-engineer` generates and tests the migration (`db-migration` owns that step).
5. Cross-module needs go through the other module's `index.ts` or an event, never its tables or `internal/**`. A new edge must exist in doc 04 §4.1; update both contract docs in the same PR.
6. External capability = port interface in the module (or `shared-kernel` if shared) + adapter in `apps/api/src/platform/` + fake in `packages/test-support/`; bind in `apps/api/src/main.ts` / `app.module.ts`, or in the jobs composition root once P02-T08 lands it (see `apps/api/src/jobs/README.md` — no jobs composition root exists yet). Never import a provider SDK in `modules/**`.
7. Async side effects go through the Postgres outbox with an idempotency key, retry policy, and DLQ path — no fire-and-forget.
8. Logging via the `platform` logger only; no `console.*`, no raw `req.body`, no sensitive fields (measurements, photos, location, tokens).
9. Tests in `apps/api/src/modules/<name>/tests/`: unit for rules (no framework), Testcontainers Postgres for repositories, fakes for ports. Bug fix = regression test that fails first, with output pasted.

## Validation commands

```bash
just test <module>
just lint && just typecheck && just arch-check
just generate --check                 # only if contracts were touched in a prior step
just ci-parity                        # before PR
```

## Output

- PR scoped to the module (plus `platform`/composition-root files when a port was added), with real test output; `docs/modules/<name>.md` updated when the public surface, invariants, events, or dependencies changed.

Done checklist: scoped tests green · `lint`/`typecheck`/`arch-check` green · nothing exported beyond the contract · no provider SDK or `platform` import in `modules/**` · contract doc updated · `PROGRESS.md` updated.

## Stop / escalation

- The task needs a forbidden edge or a weaker `arch-check` rule → ADR territory; stop.
- A schema or endpoint change surfaces mid-task → pause, run `db-migration` / `api-contract-change` as their own step, then continue.
- An invariant in `docs/modules/<name>.md` conflicts with the task → surface the conflict; never violate the contract quietly.
- Auth, consent, deletion, or webhook code → `security-privacy-review` before PR.

## Overlap

Adjacent: `api-contract-change` (wire shape first), `db-migration` (tables first, and the migration step even when the module owns `modules/<name>/internal/schema.ts`), `recommendation-rules` (owns `recommendation`, `outfit` scoring/constraints, `context` provider rules, and `fashion-intel`), `entitlements-billing` (owns `billing`), `notifications-delivery` / `admin-moderation` / `assistant-chat` (own their own modules), `media-ml-pipeline` (pipeline steps inside `media`), `architecture-review` (reviews the result). This skill owns each covered module's `apps/api/src/modules/<name>/internal/` directory and `index.ts`, plus `platform` adapters, for `identity`, `profile`, `avatar`, `closet`, `media`, `outfit`, `context`, and `platform` itself.
