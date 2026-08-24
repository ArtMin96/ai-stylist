---
name: api-contract-change
description: Change the OpenAPI 3.1 API contract or event schemas in packages/contracts and regenerate clients/types. Use for any new/changed endpoint, request/response shape, event payload, or shared enum that crosses the mobile↔API↔workers boundary.
---

# API / Event Contract Changes

## Trigger

- Adding or changing an endpoint, request/response schema, error shape, pagination, event envelope/payload, or a cross-boundary enum/constant.
- Any PR where `just generate --check` fails.

**Not this skill:** module-internal types (`backend-module`); DB schema (`db-migration`) — contracts describe the wire, not the tables.

## Required reading

1. `planning/06-data-api-and-event-contracts.md` — API style, versioning + compatibility policy, error model, idempotency, event/outbox contracts, deprecation process.
2. `packages/contracts` — existing paths, shared components, naming conventions; the schema you need may already exist.
3. `planning/SPINE.md` §2 (OpenAPI 3.1 canonical, generated TS client) and §8 terminology — wire names use canonical terms.

## Workflow

1. Restate: which consumer needs what, and whether the change is backward-compatible. Contracts are single-writer — coordinate so no parallel agent session touches `packages/contracts` at the same time (doc 15 §12.3).
2. Semantic reuse check on the contract itself: reuse shared component schemas (Money, Pagination, ProblemDetail, ids, units, reason codes referencing `shared-kernel` registries). Never define a second shape for an existing concept.
3. Design for compatibility (doc 06 policy):
   - Additive (new optional field, new endpoint) → normal change.
   - Breaking (remove/rename/retype, semantic change) → needs versioning per doc 06 + a deprecation note + explicit callout in PR title (`feat(contracts)!: …`).
   - Future-chat rule: shapes must be usable by the future `assistant` module — no mobile-UI-specific leakage into contracts.
4. Every mutating endpoint: define auth requirements, idempotency behavior, and the full error surface (not just 200). Every list: pagination. Every generated-content field: provenance + confidence fields per SPINE honesty rules.
5. Edit the contract source, then `just generate` — commit contract + regenerated client together. **Never hand-edit generated output.**
6. Update server implementation stubs/validators to match; update contract tests (doc 13): server responses validate against the schema, client fixtures compile.

## Validation

```bash
just generate && just generate --check   # regeneration clean + committed
just test contracts                      # contract test suite
just test <affected-modules>
just typecheck                           # proves mobile/workers still compile against new client
just arch-check && just ci-parity
```

## Output

- PR containing contract diff + regenerated artifacts + server-side conformance + a compatibility statement ("additive" or "breaking: v-bump + migration note").
- Consumers (mobile/workers) either updated in the same PR (small) or ticketed as follow-ups landing before release.

## Stop / escalate

- A breaking change without a doc-06-sanctioned versioning path → stop; propose options to a human.
- The "contract change" is actually leaking module internals or renderer/3D types onto the wire → stop; redesign the shape.
- Two modules claim the same resource path/concept → ownership question; surface it, don't pick silently.
