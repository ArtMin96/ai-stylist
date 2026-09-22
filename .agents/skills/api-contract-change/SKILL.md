---
name: api-contract-change
description: Change the OpenAPI 3.1 API contract or event schemas in packages/contracts and regenerate clients/types. Use for any new/changed endpoint shape, request/response schema, OpenAPI operation, event envelope/payload, RFC 9457 error shape, a shared enum, reason code, or entitlement name that crosses the mobile / API / workers boundary; a failing `just generate --check`; a `spectral` lint error; or an `oasdiff` breaking-change report. Not for implementing the behavior behind an existing endpoint — use `backend-module` instead. Not for a database table or migration — use `db-migration` instead.

metadata:
  modules: shared-kernel
  last-reviewed: 2026-09-13
  owner-agent: contracts-engineer
---

# API / Event Contract Changes

## Trigger

- Adding or changing an endpoint, request/response schema, error shape (RFC 9457 problem details), pagination, event envelope/payload, or a cross-boundary enum/constant.
- Any PR where `just generate --check` fails, or where `just lint` reports a spectral or `oasdiff` finding under `packages/contracts`.
- A taxonomy version bump in `closet` (see `.agents/skills/api-contract-change/references/taxonomy-registry.md`) — the registry lives in `packages/contracts`/`shared-kernel` even though `closet` owns the taxonomy concept.
- Not this skill: module-internal types (`backend-module`); DB tables (`db-migration`) — contracts describe the wire, not storage.

## Required reading

1. `planning/06-data-api-and-event-contracts.md` — API style, versioning/compatibility policy, error model, idempotency, event/outbox contracts, deprecation.
2. `packages/contracts/openapi/` (per-module YAML) and `packages/contracts/events/` (`envelope.json`, event schemas); `packages/contracts/gen/` is generated output — read, never edit.
3. `packages/shared-kernel/` registries (reason codes, entitlement names, units, ULID prefixes) — wire values reference these, never redefine them. `.agents/skills/api-contract-change/references/shared-kernel.md` in this skill has the file-by-file map.
4. `CLAUDE.md` "Parallel sessions" (contracts are single-writer) and "Single source of truth".
5. For a taxonomy change specifically: `.agents/skills/api-contract-change/references/taxonomy-registry.md` (bump procedure, backfill, saved-filter survival).

## Workflow

1. Restate which consumer needs what and whether the change is additive or breaking. Confirm no parallel session owns `packages/contracts` right now; producers land before consumers rebase.
2. Search before write on the contract itself: reuse shared components (problem details, pagination, envelope, ids, units) before adding a schema. Run
   `rg -ni '<concept>' packages/contracts/openapi packages/contracts/events packages/shared-kernel/src`
   (concept = the noun you are about to add, e.g. `pagination`, `provenance`, `reasonCode`) and read every hit before writing a new one.
3. Additive (new optional field/endpoint) is a normal change. Breaking (remove/rename/retype/semantic change) needs the doc 06 versioning path, a deprecation note, and `feat(contracts)!:` with a `BREAKING CHANGE:` footer.
4. Every mutating endpoint declares auth, idempotency behaviour, and the full error surface; every list paginates; every generated-content field carries provenance + confidence (CLAUDE.md honesty invariants). Shapes must also serve the future `assistant` client — no mobile-UI leakage.
5. Edit the YAML/JSON source, run `just generate`, commit source and generated output together (`packages/contracts/gen/ts-client`, `packages/contracts/gen/events-ts`, worker Pydantic models). spectral lint and oasdiff run through `just lint` in the PR gate.
6. Update server stubs/validators and contract tests so responses validate against the schema and client fixtures compile.

## Validation commands

```bash
just generate && just generate --check
just lint                             # eslint + spectral (fail on warn) for every workspace, incl. packages/contracts
just typecheck                        # api and workers still compile against the new client
just test <each consuming module>     # e.g. just test closet; no scoped recipe exists for contracts/shared-kernel — `just test` (full) covers packages/contracts/tests and packages/shared-kernel/tests
just arch-check
just ci-parity                        # before opening the PR
```

`OASDIFF_BASE=<path-to-base-bundle> just lint` adds the oasdiff breaking-change check to the same `just lint` run (the contracts package's own `lint` script reads `OASDIFF_BASE`); state explicitly if it was not set and the breaking-change check therefore did not run.

## Output

- One PR: contract diff + regenerated artifacts + server conformance + a one-line compatibility statement ("additive" or "breaking: vN + deprecation note").
- Consumers land in the same PR when the change is additive and the consumer diff is confined to regenerated generated-client types (no hand-written logic change); otherwise open a linked follow-up issue per consumer and land it before release.

Done checklist: `generate --check` clean · contract tests green · typecheck green across workspaces · no hand-edited generated file · PR states compatibility · `PROGRESS.md` updated if session-ending.

## Stop / escalation

- Breaking change with no doc 06 versioning path → stop; present options to a human.
- The change would put module internals, Drizzle types, or renderer/3D types on the wire → stop; redesign.
- Two modules claim the same resource/concept → ownership question for SPINE §3; do not pick silently.
- Another session is editing `packages/contracts` → stop and sequence.
- A taxonomy bump reveals a migration rule that cannot decide a case → fall to `.other` + a review nudge (never a silent guess), per `.agents/skills/api-contract-change/references/taxonomy-registry.md`.

## Overlap

Adjacent: `backend-module` (implements the endpoint after the contract lands), `db-migration` (storage shape, separate PR), `ios-feature` / `android-feature` and `media-ml-pipeline` (consumers of generated clients), `architecture-review` (reviews the resulting diff). This skill alone owns edits under `packages/contracts/` and `packages/shared-kernel/`.
