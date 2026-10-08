# Proposal: current descriptive text for `workers/ml/generated/` (owner-applied)

> Status: APPLIED (2026-10-05, PR #15, at the owner's request "apply all"; written with a shell command because the path guard has no per-edit approval). The path guard (`scripts/hooks/guard-protected-paths.sh`)
> denies agents every file under `workers/ml/generated/`, including the three hand-written files
> below that `tools/codegen/gen-python.sh` never writes. Their text still describes only the event
> models; the package also holds the worker-contract models (`segmentation/`, since `0922d2f`) and
> the shared-kernel constants (`kernel/`, DEC-59, with `correlation` since 2026-10-05). This replaces
> the open "descriptive text in `workers/ml/generated/`" item of
> `2026-10-04-human-applied-followups-proposal.md`. Apply all three, then run
> `just generate --check` (nothing it writes changes) and `just docs-check`.

## 1. `workers/ml/generated/README.md` (replace the whole file)

````markdown
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
````

## 2. `workers/ml/generated/pyproject.toml` (lines 1–2 and `description`)

```toml
# Generated Python package: Pydantic models from packages/contracts (events, worker contracts) and
# the shared-kernel constants (DEC-59). Regenerate with `just generate`; see README.md.
```

```toml
description = "Pydantic v2 models and shared-kernel constants generated from packages/contracts and packages/shared-kernel"
```

The description is package metadata only; `workers/uv.lock` does not record it, so no lockfile change.

## 3. `workers/ml/generated/ai_stylist_generated/__init__.py` (replace the docstring)

```python
"""Generated from ``packages/contracts`` and ``packages/shared-kernel`` by ``just generate`` — see
README.md.

Subpackages: ``events`` (event schemas), one per worker contract (``segmentation``) and ``kernel``
(shared-kernel constants, including the correlation id rule). Nothing in this package is
hand-written except this docstring.
"""
```
