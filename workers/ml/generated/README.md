# workers/ml/generated

Output of `tools/codegen/gen-python.sh` (run by `just generate`): the Python package
`ai_stylist_generated`, a uv workspace member (`ai-stylist-generated`) that every worker service
depends on. Nothing here is hand-written except this README, `pyproject.toml` and the package
`__init__.py` docstring.

| Subpackage | Generated from | Generator | Import |
| --- | --- | --- | --- |
| `events/` | every `packages/contracts/events/*.json` JSON Schema (doc 06 §1) | `datamodel-code-generator`, Pydantic v2 | `from ai_stylist_generated.events.envelope import EventEnvelope` |
| `<service>/` (today `segmentation/`) | `packages/contracts/workers/<service>/*.json`, the internal API ↔ worker HTTP contract | `datamodel-code-generator`, Pydantic v2, `--use-default` | `from ai_stylist_generated.segmentation.segmentation_v1 import SegmentRequest` |
| `kernel/` | `packages/shared-kernel/registry/{forbidden-log-keys,forbidden-log-keys.examples,log-redaction,correlation}.json`, plus the `correlationId` rule of `packages/contracts/events/envelope.json` (DEC-59) | `tools/codegen/gen-kernel.mjs python` | `from ai_stylist_generated.kernel import CORRELATION_ID_HEADER, ERROR_NAME_SHAPE` |

Rules:

- Every generated file carries a `GENERATED` banner naming its source. Never hand-edit one:
  `just generate --check` fails when the committed output differs from what the sources generate.
- Every module is formatted with the workspace `ruff` config, so the output is byte-stable.
- `events/` is excluded from `ruff check` (its schema descriptions become long lines); the
  worker-contract modules get a per-file E501 waiver where needed; `kernel/` is linted as is (its
  string literals are ASCII-escaped). basedpyright type-checks all of it.
- The `kernel/` patterns are compiled with `re.ASCII`; always match them with `fullmatch`.
- With no `packages/contracts/events/*.json`, the generator prints a notice and skips `events/`.
  `CONTRACTS_EVENTS_DIR=/path/to/schemas` overrides the event schema directory (tests use it).
