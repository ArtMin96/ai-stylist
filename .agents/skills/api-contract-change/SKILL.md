---
name: api-contract-change
description: Change the OpenAPI 3.1 API contract, event schemas, the analytics taxonomy, or a shared-kernel registry in packages/contracts and packages/shared-kernel, then regenerate every client with `just generate`. Use for any new or changed endpoint, request/response schema, operationId, event envelope/payload, RFC 9457 error shape, a reason code, entitlement name, credit meter or unit (`packages/shared-kernel/registry/*.json`), an analytics event name, or a shared enum that crosses the iOS / Android / API / workers boundary; a failing `just generate --check`; a spectral lint error; or an oasdiff breaking-change report. Not for implementing the behavior behind an existing endpoint — use `backend-module` instead. Not for a database table or migration — use `db-migration` instead. Not for editing a codegen script in tools/codegen — that belongs to its owner (see Overlap).
metadata:
  modules: shared-kernel
  last-reviewed: 2026-09-26
  owner-agent: contracts-engineer
---

# API / Event Contract Changes

## Trigger

- Adding or changing an endpoint, request/response schema, error shape (RFC 9457 problem details), pagination, event envelope/payload, analytics event, or a cross-boundary enum/constant.
- A registry entry in `packages/shared-kernel/registry/` (reason codes, entitlements, credit meters, units); the generated TS, Swift (`AIStylistKernel`) and Kotlin (`app.aistylist.contracts.kernel`) outputs follow from it (ADR-0005, DEC-55).
- Any PR where `just generate --check` fails, or `just lint` reports a spectral or oasdiff finding under `packages/contracts`.
- A closet taxonomy registry bump (see `.agents/skills/api-contract-change/references/taxonomy-registry.md`).
- Not this skill: module-internal types (`backend-module`); DB tables (`db-migration`) — contracts describe the wire, not storage.

## Required reading

1. `planning/06-data-api-and-event-contracts.md` — API style, versioning/compatibility, error model, idempotency, event/outbox contracts, deprecation.
2. `packages/contracts/openapi/openapi.yaml` (root; wires per-module files by `$ref`) and `packages/contracts/openapi/modules/platform.yaml` (the only module file today); `packages/contracts/events/envelope.json`.
3. `docs/adr/0005-shared-kernel-registries-for-native-clients.md` and `.agents/skills/api-contract-change/references/shared-kernel.md` — registries, what is generated for which platform, what is still TS-only.
4. `CLAUDE.md` "Parallel sessions" (contracts and shared-kernel are single-writer) and "Single source of truth".
5. For a taxonomy change: `.agents/skills/api-contract-change/references/taxonomy-registry.md`.

## Workflow

1. Restate which consumer needs what and whether the change is additive or breaking. Confirm no parallel session writes `packages/contracts` or `packages/shared-kernel` now; producers land before consumers.
2. Search before write — reuse shared components (problem details, pagination, envelope, ids, units) before adding a schema:

   ```bash
   rg -n -i '<concept>|<synonym>' packages/contracts/openapi packages/contracts/events packages/shared-kernel/src packages/shared-kernel/registry
   rg -n 'operationId' packages/contracts/openapi
   ```

   Read every hit before writing a new definition.

3. Copy the structure from:

   | New thing                                                                                | Copy from                                                                                                                                  |
   | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
   | A module's OpenAPI file (paths, `operationId`, `security`, `default` → shared `Problem`) | `packages/contracts/openapi/modules/platform.yaml`, wired by `$ref` in `packages/contracts/openapi/openapi.yaml`                           |
   | Event schema (envelope narrowed by a `type` const, payload in `$defs`, `examples`)       | `packages/contracts/events/demo.event.json`                                                                                                |
   | Reason code / entitlement / unit                                                         | the matching `packages/shared-kernel/registry/*.json`, validated by its `*.schema.json`                                                    |
   | Analytics event                                                                          | `packages/contracts/events/analytics/events.json` (schema `events.schema.json`)                                                            |
   | Contract tests                                                                           | `packages/contracts/tests/events.test.ts`, `packages/contracts/tests/ts-client.test.ts`, `packages/shared-kernel/tests/registries.test.ts` |

4. Additive (new optional field or endpoint) is a normal change. Breaking (remove, rename, retype, semantic change) needs the doc 06 versioning path, a deprecation note, and `feat(contracts)!:` with a `BREAKING CHANGE:` footer.
5. Every mutating endpoint declares auth, idempotency behaviour, and the full error surface; every list paginates; every generated-content field carries provenance + confidence (CLAUDE.md honesty invariants). Shapes serve every client (both native apps, workers, the future `assistant`), so no screen-specific fields.
6. Edit the YAML/JSON source, run `just generate`, and commit source and every generated output together: `packages/contracts/gen/ts-client`, `packages/contracts/gen/events-ts`, `packages/contracts/gen/swift-client`, `packages/contracts/gen/kotlin-client`, `packages/shared-kernel/src/gen`, `workers/ml/generated`. Never hand-edit any of them.
7. Consumers you must name in the report: `apps/api/tests/http.test.ts` (`api-engineer`) validates responses against generated types. Swift and Kotlin kernels are generated but no app target consumes them yet (ADR-0005). Error codes, IDs and the envelope are TS-only. Swift analytics event names are hand-written and must equal `events.json` byte for byte, so list every new analytics name for `ios-engineer`; Android uses the generated `AnalyticsTaxonomy`.

## Validation commands

```bash
just generate && just generate --check
just lint                             # eslint + spectral (fail on warn) incl. packages/contracts
just typecheck                        # TS workspaces + workers compile against the new output
just test                             # full run: covers packages/contracts/tests and packages/shared-kernel/tests (no scoped recipe)
just test <each consuming module>     # e.g. just test closet
just test ios                         # compiles the generated Swift client (swift on PATH or Docker; macOS or Linux)
just test android                     # compiles the generated Kotlin client (Android SDK)
just arch-check
just ci-parity                        # before opening the PR
```

oasdiff runs inside `just lint` only when `OASDIFF_BASE` is set. The contracts job in `.github/workflows/pr-gate.yml` is the authoritative breaking-change check: it runs `scripts/ci/contracts-breaking.sh` against the PR base. If you did not run oasdiff locally, write `oasdiff: not run — <reason>`. If a native toolchain is missing, write `Not run: just test ios — <reason>`; never claim the Swift or Kotlin client compiles without that output.

## Output

- One PR: contract diff + regenerated artifacts + a one-line compatibility statement ("additive" or "breaking: vN + deprecation note") + the consumer list from Workflow step 7. Report in the `agent-operating-contract` format.
- Consumers land in the same PR only when the change is additive and their diff is regenerated types; otherwise a linked follow-up per consumer lands before release.

Done checklist: `generate --check` clean · contract tests green · typecheck green · Swift/Kotlin compile shown or listed under Not run · no hand-edited generated file · compatibility stated · new analytics names listed for iOS · `PROGRESS.md` line suggested.

## Stop / escalation

- Breaking change with no doc 06 versioning path → stop; present options to a human.
- The change would put module internals, Drizzle types, or renderer/3D types on the wire → stop; redesign.
- Two modules claim the same resource or concept → SPINE §3 ownership question; do not pick silently.
- Another session is editing `packages/contracts` or `packages/shared-kernel` → stop and sequence.
- `just generate` fails inside a codegen script, or the generated output is wrong → do not patch `gen/**`; report to the script's owner (Overlap).
- A registry value has no consumer yet → stop and ask why it cannot wait for the consumer.
- A taxonomy task: no taxonomy registry exists yet (`packages/shared-kernel/registry/` holds reason codes, entitlements and units only; P06-T01 creates v1) → design only; stop before inventing a location.
- A taxonomy bump rule cannot decide a case → `.other` + a review nudge, never a silent guess (`.agents/skills/api-contract-change/references/taxonomy-registry.md`).

## Overlap

Adjacent: `backend-module` and the other module skills (implement the endpoint after the contract lands), `db-migration` (storage shape, separate PR), `ios-feature` / `android-feature` / `media-ml-pipeline` (consumers of the generated clients), `tooling-ci` (owns `tools/codegen/generate.sh`, `tools/codegen/gen-ts.sh`, `tools/codegen/gen-events-ts.mjs`, `tools/codegen/gen-kernel.mjs` and `tools/codegen/kernel/`), `ios-feature` (owns `tools/codegen/gen-swift.sh`), `android-feature` (owns `tools/codegen/gen-kotlin.sh`), `media-ml-pipeline` (owns `tools/codegen/gen-python.sh`), `architecture-review` (reviews the diff). This skill runs `just generate` but edits no codegen script. This skill alone owns edits under `packages/contracts/` and `packages/shared-kernel/`.
