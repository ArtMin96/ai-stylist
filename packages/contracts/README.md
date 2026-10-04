# @ai-stylist/contracts

Canonical wire contracts (planning/06 §1): OpenAPI 3.1 per module under `openapi/` (root
`openapi/openapi.yaml`), JSON Schema 2020-12 event schemas under `events/` (the envelope
`events/envelope.json` plus one schema per event version), and the analytics taxonomy under
`events/analytics/`. `gen/` holds the generated clients and the bundle; only `just generate`
writes it. Change a contract with the `api-contract-change` skill.

## Contract gates

| Gate                        | Command                                                      | Fails on                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generated output is current | `just generate --check`                                      | any stale file under `gen/`, the Swift/Kotlin clients, the kernel or `workers/ml/generated`                                                                                                   |
| OpenAPI lint                | `just lint` (contracts `lint`), `just ci-contracts-spectral` | a spectral finding of severity `warn` or higher (`.spectral.yaml`)                                                                                                                            |
| Breaking change, base vs PR | `just ci-contracts-breaking <base-sha>`                      | an oasdiff `WARN` or `ERR` finding on `gen/openapi.bundle.json`, or a breaking event-schema change (below)                                                                                    |
| Breaking change, local lint | `OASDIFF_BASE=<base bundle> just lint`                       | an oasdiff `WARN` or `ERR` finding; skipped with a message when `OASDIFF_BASE` is unset                                                                                                       |
| Contract tests              | `just test` (`tests/`)                                       | schema examples, registries, the generated client, the generated Python kernel (`kernel-python.test.ts` imports it with `$PYTHON`, default `python3`) and the event-schema checker's fixtures |

The pr-gate `contracts` job runs `just generate --check`, `just ci-contracts-spectral` and, on pull
requests, `just ci-contracts-breaking "$BASE_SHA"` (`scripts/ci/contracts-breaking.sh`).

**oasdiff threshold: `--fail-on WARN`, in both places.** Doc 06 allows only additive changes
within `/v1` (§2) and requires an ADR for a breaking diff (§9), but names no oasdiff severity, so
the stricter level applies: a `WARN` finding (a change oasdiff thinks may break a client) fails
too. An intended breaking change follows doc 06 §2 (`v2` side by side, deprecation window) and
ships as `feat(contracts)!:` with a `BREAKING CHANGE:` footer.

**Event schemas: `scripts/events-breaking.mjs`.** Doc 06 §4: additive-only within `vN`; renaming,
removing or retyping needs `vN+1` (a new schema next to the old one). For every
`events/*.json` schema version on the base (keyed by its `type` const, else its `$id`), the head
must still have that version and must not remove a property, newly require one, change or
narrow a type, remove an enum value (or add an enum/const), or tighten `additionalProperties` /
`unevaluatedProperties`. It follows properties, array items and local `$ref`s; it does not compare
`allOf`/`anyOf`/`oneOf` or value constraints (pattern, length, range). Run it alone with
`pnpm --filter @ai-stylist/contracts run breaking:events --base-ref <git-ref>` (or
`node packages/contracts/scripts/events-breaking.mjs --base-ref <git-ref>`, which needs no
install). The script finds this package's `events/` from its own location and reads the base side
from git at that directory's path relative to `git rev-parse --show-toplevel`, so it works from any
cwd and wherever the package sits; `tests/events-breaking.test.ts` pins it with the fixtures in
`tests/fixtures/events-breaking/`.
