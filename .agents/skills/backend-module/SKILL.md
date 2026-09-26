---
name: backend-module
description: Create or change a NestJS domain module under apps/api/src/modules/ — application services, domain rules, controllers, ports, module-owned repositories, events — or add a port adapter in apps/api/src/platform/ and bind it at the composition root (apps/api/src/app.module.ts). Use for identity, profile, avatar, closet, media, outfit, context, or platform work — a new application service or controller, a context provider, a repository behind a port, a provider adapter, or a composition-root binding. Not for recommendation scoring or a scoring rule that consumes context facts — use `recommendation-rules`; not for `fashion-intel` — use `fashion-intel-ingestion`; not for a schema or migration change — use `db-migration`; not for an endpoint's wire shape — use `api-contract-change`; not for billing or entitlements — use `entitlements-billing`; not for notifications, admin, or assistant work — use their own skills.
metadata:
  modules: identity,profile,avatar,closet,media,outfit,context,platform
  last-reviewed: 2026-09-26
  owner-agent: api-engineer,recommendation-engineer,platform-engineer
---

# Backend Domain-Module Changes

## Trigger

- Behaviour inside one of the 8 modules this skill covers: `identity`, `profile`, `avatar`, `closet`, `media`, `outfit`, `context` (including its context providers), `platform`. The other 7 SPINE modules have their own skill (see Overlap).
- Executing agent per module (coverage table in `.agents/skills/README.md`): `api-engineer` for identity, profile, avatar, closet, media; `recommendation-engineer` for outfit, context; `platform-engineer` for platform.
- Adding a port adapter in `apps/api/src/platform/` and binding it in `apps/api/src/app.module.ts`.
- Do first, then return: `api-contract-change` (endpoint or event shape), `db-migration` (tables), `entitlements-billing`, `media-ml-pipeline` (pipeline steps), `recommendation-rules` (scoring).
- State at last review (re-check `planning/PROGRESS.md` before relying on it): all 13 domain modules are P02 skeletons (`index.ts` exports an empty `@Module({})`, an internal README, one smoke test). The only real TypeScript precedents live in `apps/api/src/platform/`, `apps/api/src/app.module.ts` and `packages/test-support/src/`. The first service in any module is a new pattern: copy the siblings in Workflow step 4 and name each one in the report.

## Required reading

1. `docs/modules/<name>.md` — public interface, owned data, invariants, allowed/forbidden dependencies, extension points.
2. `.agents/skills/backend-module/references/<name>.md` — per-module cheat sheet: key files, the phase that owns current work, escalation triggers.
3. `planning/PROGRESS.md` (current phase line) and the module's phase file `planning/phases/P<NN>-*.md` — is the phase that creates this module's tables and events started?
4. `planning/04-architecture.md` §4.1 (allowed edges), §4.2 (rules), §5 (composition roots), §9 (outbox semantics); `planning/03-domain-model-and-glossary.md` for terms.
5. `tools/depcruise/rules.cjs` — `ALLOWED_EDGES` is the enforced copy of doc 04 §4.1; every rule applies to test files under `apps/api/src/modules/**` too.
6. `apps/api/src/modules/<name>/index.ts` and each neighbour's `index.ts` — what is already public.

## Workflow

1. Restate scope, non-goals, acceptance criteria; name the single owning module. Behaviour that seems to belong to two modules is a contract question: stop.
2. Confirm what exists, then search by behaviour before writing:

   ```bash
   git ls-files apps/api/src/modules/<name> apps/api/src/platform packages/test-support/src
   rg -n -i '<noun>|<synonym>|<verb>' apps/api/src packages/shared-kernel/src packages/shared-kernel/registry packages/test-support/src packages/contracts/openapi packages/contracts/events
   rg -n 'export' apps/api/src/modules/<neighbour>/index.ts
   ```

   Read every hit in full. Reuse it, or state in the report why it does not fit.

3. Read `references/<name>.md` for the module. Check the edge you need in `ALLOWED_EDGES` (`tools/depcruise/rules.cjs`); a missing edge is a stop, never a workaround.
4. Copy the structure from these siblings (all exist today):

   | New thing                                                                                          | Copy from                                                                                                                                 |
   | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
   | Nest module + public API                                                                           | `apps/api/src/modules/closet/index.ts`                                                                                                    |
   | Thin controller, `@Inject(TOKEN)` on every constructor parameter (tsx emits no decorator metadata) | `apps/api/src/platform/version.controller.ts`                                                                                             |
   | Controller that calls a port and throws a Nest exception                                           | `apps/api/src/platform/health.controller.ts`                                                                                              |
   | Port type + `Symbol` DI token                                                                      | `apps/api/src/platform/ports/health-probe.port.ts` (shape only, see step 7)                                                               |
   | Adapter implementing a port                                                                        | `apps/api/src/platform/pg-health-probe.ts`                                                                                                |
   | Binding ports to adapters                                                                          | `apps/api/src/app.module.ts` + `apps/api/src/platform/index.ts` (`{ provide: TOKEN, useValue }`)                                          |
   | Error responses                                                                                    | throw a Nest `HttpException`; `apps/api/src/platform/problem.filter.ts` maps it; codes from `packages/shared-kernel/src/errors.ts`        |
   | Event envelope                                                                                     | `newId('event', …)` + `EventEnvelope` in `apps/api/src/dev/demo-events.controller.ts`; schema `packages/contracts/events/demo.event.json` |
   | Port fake (structural match, no import of the port)                                                | `packages/test-support/src/clock.ts`, exported from `packages/test-support/src/index.ts`                                                  |
   | Unit test with injected time                                                                       | `apps/api/src/platform/tests/storage.port.test.ts`                                                                                        |
   | Module test (Nest testing module)                                                                  | `apps/api/src/modules/closet/tests/closet.smoke.test.ts`                                                                                  |
   | In-process HTTP test (`createApp` + `app.inject`)                                                  | `apps/api/tests/http.test.ts`                                                                                                             |

   Copy the port shape, never its placement: `apps/api/src/platform/ports/*.port.ts` and the `InMemoryStorageProvider` fake inside `storage.port.ts` are P02-interim platform ports that modules may not even import.

5. Implement in `apps/api/src/modules/<name>/internal/`; export through `index.ts` only what `docs/modules/<name>.md` declares public. Controllers and job handlers parse via contract types, call the application service, map the result. No business rule in controllers, schema files, job handlers, or provider wrappers.
6. Cross-module needs go through the other module's `index.ts` or an event, never its tables or `internal/**`. A new edge needs doc 04 §4.1, `tools/depcruise/rules.cjs` and both contracts changed: ADR territory.
7. External capability, in this order: port type + token declared in the module's `index.ts` (or `packages/shared-kernel` when two modules share it, via `api-contract-change`) → adapter in `apps/api/src/platform/` (`platform-engineer`) → fake in `packages/test-support/src/` (`api-engineer`) → binding in `apps/api/src/app.module.ts` (`api-engineer`; `platform-engineer` reports the exact binding). Never import a provider SDK in `modules/**`.
8. Time: domain rules take `now: Date` as a parameter. Modules cannot import `Clock`/`CLOCK` from `apps/api/src/platform/ports/clock.port.ts` (`modules-not-platform`); tests use `fakeClock`.
9. Schema: the module owner edits `apps/api/src/modules/<name>/internal/schema.ts`; `platform-engineer` runs `db-migration` for the migration. No module has a `schema.ts` yet.
10. Logging: no `console.*` (lint error). The pino logger and its redaction are configured in `apps/api/src/platform/logger.ts` and exported as `LoggerModule` from `apps/api/src/platform/index.ts`; never log measurements, photos, location, tokens, or `req.body`.
11. Tests in `apps/api/src/modules/<name>/tests/`: unit tests for rules (no Nest), module tests with fakes. Bug fix: a regression test proved with `just test-regression <file>` (the `testing-regression` skill).

## Validation commands

```bash
just test <module>                    # platform: just test platform
just test api                         # when apps/api/tests/http.test.ts or app.module.ts changed (includes the Docker migrations project)
just test-regression <test-file>      # bug fix: fails at merge-base, passes at HEAD
just lint && just typecheck && just arch-check
just generate --check                 # only if contracts were touched in a prior step
just docs-check                       # when docs/modules/<name>.md changed
just ci-parity                        # before PR
```

## Output

- A diff scoped to the module (plus `apps/api/src/platform/` and composition-root files when a port was added), with real test output; `docs/modules/<name>.md` updated when the public surface, invariants, events, or dependencies changed. Report in the `agent-operating-contract` format, naming every sibling copied.

Done checklist: scoped tests green · `lint`/`typecheck`/`arch-check` green · nothing exported beyond the contract · no provider SDK or `platform` import in `modules/**` (tests included) · every sibling copied is named · contract doc updated · `PROGRESS.md` line suggested.

## Stop / escalation

- The task needs an edge missing from `ALLOWED_EDGES` or a weaker `arch-check` rule → ADR territory; stop.
- A schema or endpoint change surfaces mid-task → pause; run `db-migration` / `api-contract-change` as their own step, then continue.
- The task assumes tables, events or services of a phase that is `NOT_STARTED` in `planning/PROGRESS.md` → stop and name the phase task that creates them.
- The task needs the outbox relay, pg-boss or a jobs composition root → unless P02-T08 is `DONE` in `planning/phases/P02-repo-foundations-and-ci.md` (`apps/api/src/platform/outbox/README.md`, `apps/api/src/jobs/README.md`), stop and sequence after T08. Same for the R2 adapter (P02-T13).
- An application service needs a clock → no `Clock` port is importable by modules; stop and request one in `packages/shared-kernel` (`contracts-engineer`, `api-contract-change`), structurally identical to `apps/api/src/platform/ports/clock.port.ts`.
- A repository needs a database handle, or a test needs a real Postgres → module code and module tests may not import `packages/db` (package @ai-stylist/db, rule `composition-root-only`) or `apps/api/src/platform/**` (`modules-not-platform`), and no module repository exists to copy. Stop and report; the first one needs a decision from the lead.
- An invariant in `docs/modules/<name>.md` conflicts with the task → surface it; never violate the contract quietly.
- Auth, consent, deletion, or webhook code → `security-privacy-review` before PR.

## Overlap

Adjacent: `api-contract-change` (wire shape lands first), `db-migration` (tables first; it runs the migration even though the module owns its `apps/api/src/modules/<name>/internal/schema.ts`), `recommendation-rules` (owns `recommendation` and every scoring rule, including scorers that consume `context` facts or `outfit` types), `fashion-intel-ingestion` (owns `fashion-intel`), `entitlements-billing` (owns `billing`), `notifications-delivery` / `admin-moderation` / `assistant-chat` (own their modules), `media-ml-pipeline` (pg-boss handlers and workers behind `media`), `data-lifecycle` (cross-module consent/deletion/export ordering), `architecture-review` (reviews the result). This skill owns `apps/api/src/modules/<name>/**` for `identity`, `profile`, `avatar`, `closet`, `media`, `outfit`, `context`, plus `apps/api/src/platform/**` adapters and their composition-root bindings.
