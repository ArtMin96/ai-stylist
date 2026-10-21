# @ai-stylist/contracts

Canonical wire contracts (planning/06 §1): OpenAPI 3.1 per module under `openapi/` (root
`openapi/openapi.yaml`), JSON Schema 2020-12 event schemas under `events/` (the envelope
`events/envelope.json` plus one schema per event version), the analytics taxonomy under
`events/analytics/`, and the internal API ↔ worker HTTP contracts under `workers/<service>/`.
`gen/` holds the generated clients and the bundle; only `just generate` writes it. Change a
contract with the `api-contract-change` skill.

## Event schemas (`events/`)

One file per event version, `events/<type>.event.json` (e.g.
`events/identity.account.created.v1.event.json`; the P02 `demo.event.json`, with its closed payload
and free-text `note`, predates these rules and P03-X02 retires it). Each
narrows the envelope by its `type` const, holds its payload in `$defs` and ships an `examples`
envelope with synthetic ids. Payloads carry ids, enums and timestamps only (doc 06 §6) and are open
content: consumers ignore properties they do not know (doc 06 §4). `just generate` writes the TS
types to `gen/events-ts/index.ts` and one Pydantic module per file to
`workers/ml/generated/ai_stylist_generated/events/`; `tests/events.test.ts` validates each example
and pins every id pattern and enum to the API and the shared kernel.

## Worker HTTP contracts (`workers/`)

One JSON Schema 2020-12 file per worker service and contract version, e.g.
`workers/segmentation/segmentation.v1.json` (`POST /v1/segment`, `GET /health` of
`workers/ml/segmentation`). These are internal and not part of the public OpenAPI. The root is
an `anyOf` of the messages (`SegmentRequest`, `SegmentResponse`, `HealthResponse`), each a `$defs`
entry with its `examples`; shared types such as `MaskLabel` (garment values owned by the
`closet` taxonomy, see `docs/modules/closet.md`) and `Provenance` sit next to them. `just generate` writes:

- TypeScript types: `gen/workers-ts/index.ts`, imported as `@ai-stylist/contracts/workers`
  (`SegmentationWorkerV1`, `SegmentRequest`, `SegmentResponse`, `MaskRef`, `MaskLabel`,
  `Provenance`, `HealthResponse`). The raw schema is exported as
  `@ai-stylist/contracts/workers/segmentation/segmentation.v1.json` for runtime validation.
- Pydantic v2 models: `workers/ml/generated/ai_stylist_generated/segmentation/segmentation_v1.py`
  (`from ai_stylist_generated.segmentation.segmentation_v1 import SegmentRequest, ...`;
  `MaskLabel` is a `StrEnum`).

Additive-only within `v1`; a breaking change ships `segmentation.v2.json` next to v1. The
breaking-change gate below compares these files like event schemas (keyed by `$id`), and also
fails when a message disappears from the root `anyOf`. `tests/workers.test.ts` validates the
examples and pins the generated TS types.

## Contract gates

| Gate                        | Command                                                      | Fails on                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generated output is current | `just generate --check`                                      | any stale file under `gen/`, the Swift/Kotlin clients, the kernel or `workers/ml/generated`, or any generator that fails (named on stderr: `generate: generator <name> failed`)               |
| OpenAPI lint                | `just lint` (contracts `lint`), `just ci-contracts-spectral` | a spectral finding of severity `warn` or higher (`.spectral.yaml`)                                                                                                                            |
| Breaking change, base vs PR | `just ci-contracts-breaking <base-sha>`                      | an oasdiff `WARN` or `ERR` finding on `gen/openapi.bundle.json`, or a breaking event or worker schema change (below)                                                                          |
| Breaking change, local lint | `OASDIFF_BASE=<base bundle> just lint`                       | an oasdiff `WARN` or `ERR` finding; skipped with a message when `OASDIFF_BASE` is unset                                                                                                       |
| Contract tests              | `just test` (`tests/`)                                       | schema examples, registries, the generated client, the generated Python kernel (`kernel-python.test.ts` imports it with `$PYTHON`, default `python3`) and the event-schema checker's fixtures |

The pr-gate `contracts` job runs `just generate --check`, `just ci-contracts-spectral` and, on pull
requests, `just ci-contracts-breaking "$BASE_SHA"` (`scripts/ci/contracts-breaking.sh`).
Both OpenAPI lint commands run this package's `lint:spectral` script on the bundled contract.

**oasdiff threshold: `--fail-on WARN`, in both places.** Doc 06 allows only additive changes
within `/v1` (§2) and requires an ADR for a breaking diff (§9), but names no oasdiff severity, so
the stricter level applies: a `WARN` finding (a change oasdiff thinks may break a client) fails
too. An intended breaking change follows doc 06 §2 (`v2` side by side, deprecation window) and
ships as `feat(contracts)!:` with a `BREAKING CHANGE:` footer.

**Event and worker schemas: `scripts/events-breaking.mjs`.** Doc 06 §4: additive-only within
`vN`; renaming, removing or retyping needs `vN+1` (a new schema next to the old one). For every
`events/*.json` and `workers/<service>/*.json` schema version on the base (keyed by its `type`
const, else its `$id`), the head must still have that version and must not remove a property,
newly require one, change or narrow a type, remove an enum value (or add an enum/const), or
tighten `additionalProperties` / `unevaluatedProperties`. It follows properties, array items and
local `$ref`s, and the messages of a root `anyOf`/`oneOf` of local `$ref`s (each must stay listed);
it does not compare other `allOf`/`anyOf`/`oneOf` or value constraints (pattern, length, range). Run it alone with
`pnpm --filter @ai-stylist/contracts run breaking:events --base-ref <git-ref>` (or
`node packages/contracts/scripts/events-breaking.mjs --base-ref <git-ref>`, which needs no
install). The script finds this package's `events/` and `workers/<service>/` dirs from its own
location and reads the base side from git at each directory's path relative to `git rev-parse --show-toplevel`, so it works from any
cwd and wherever the package sits; `tests/events-breaking.test.ts` pins it with the fixtures in
`tests/fixtures/events-breaking/`.
