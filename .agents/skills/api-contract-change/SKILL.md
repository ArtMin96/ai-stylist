---
name: api-contract-change
description: Change the OpenAPI 3.1 API contract or event schemas in packages/contracts and regenerate clients/types. Use for any new/changed endpoint, request/response shape, event payload, or shared enum that crosses the mobile / API / workers boundary.
---

# API / Event Contract Changes

## Trigger

- Adding or changing an endpoint, request/response schema, error shape (RFC 9457 problem details), pagination, event envelope/payload, or a cross-boundary enum/constant.
- Any PR where `just generate --check` fails.
- Not this skill: module-internal types (`backend-module`); DB tables (`db-migration`) — contracts describe the wire, not storage.

## Required reading

1. `planning/06-data-api-and-event-contracts.md` — API style, versioning/compatibility policy, error model, idempotency, event/outbox contracts, deprecation.
2. `packages/contracts/openapi/` (per-module YAML) and `packages/contracts/events/` (`envelope.json`, event schemas); `packages/contracts/gen/` is generated output — read, never edit.
3. `packages/shared-kernel/` registries (reason codes, entitlement names, units, ULID prefixes) — wire values reference these, never redefine them.
4. `CLAUDE.md` "Parallel sessions" (contracts are single-writer) and "Single source of truth".

## Workflow

1. Restate which consumer needs what and whether the change is additive or breaking. Confirm no parallel session owns `packages/contracts` right now; producers land before consumers rebase.
2. Search before write on the contract itself: reuse shared components (problem details, pagination, envelope, ids, units) before adding a schema.
3. Additive (new optional field/endpoint) is a normal change. Breaking (remove/rename/retype/semantic change) needs the doc 06 versioning path, a deprecation note, and `feat(contracts)!:` with a `BREAKING CHANGE:` footer.
4. Every mutating endpoint declares auth, idempotency behaviour, and the full error surface; every list paginates; every generated-content field carries provenance + confidence (CLAUDE.md honesty invariants). Shapes must also serve the future `assistant` client — no mobile-UI leakage.
5. Edit the YAML/JSON source, run `just generate`, commit source and generated output together (`gen/ts-client`, `gen/events-ts`, worker Pydantic models). spectral lint and oasdiff run in the PR gate.
6. Update server stubs/validators and contract tests so responses validate against the schema and client fixtures compile.

## Validation commands

```bash
just generate && just generate --check
just test <each consuming module>     # e.g. just test closet
just typecheck                        # mobile + workers still compile against the new client
just lint && just arch-check
just ci-parity                        # before opening the PR
```

## Output

- One PR: contract diff + regenerated artifacts + server conformance + a one-line compatibility statement ("additive" or "breaking: vN + deprecation note").
- Consumers updated in the same PR when small, otherwise linked follow-up issues that land before release.

Done checklist: `generate --check` clean · contract tests green · typecheck green across workspaces · no hand-edited generated file · PR states compatibility · `PROGRESS.md` updated if session-ending.

## Stop / escalation

- Breaking change with no doc 06 versioning path → stop; present options to a human.
- The change would put module internals, Drizzle types, or renderer/3D types on the wire → stop; redesign.
- Two modules claim the same resource/concept → ownership question for SPINE §3; do not pick silently.
- Another session is editing `packages/contracts` → stop and sequence.

## Overlap

Adjacent: `backend-module` (implements the endpoint after the contract lands), `db-migration` (storage shape, separate PR), `mobile-feature` and `media-ml-pipeline` (consumers of generated clients), `architecture-review` (reviews the resulting diff). This skill alone owns edits under `packages/contracts/`.
