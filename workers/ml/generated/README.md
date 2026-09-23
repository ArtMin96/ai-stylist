# workers/ml/generated

Output directory of `tools/codegen/gen-python.sh` (invoked by `just generate`).

- Input: every `packages/contracts/events/*.json` JSON Schema (the only contract shared
  between the TypeScript side and the workers — doc 06 §1, brief §5 `workers-not-server`).
- Output: `ai_stylist_generated/events.py`, Pydantic v2 models via `datamodel-code-generator`
  (`--output-model-type pydantic_v2.BaseModel --use-schema-description --target-python-version 3.12`),
  then formatted with the workspace `ruff` config so the result is byte-stable.
- The directory is a uv workspace member (`ai-stylist-generated`); services depend on it and
  import `from ai_stylist_generated.events import ...`.

Rules:

- Every generated file carries a `GENERATED — run \`just generate\`` header. Never hand-edit;
  `just generate --check` fails CI when the committed output drifts from the schemas.
- `events.py` is excluded from `ruff check`; it is still type-checked by basedpyright.
- If `packages/contracts/events/` does not exist yet, the generator prints a notice and exits 0,
  leaving this package with only `__init__.py`.
- Override the input directory with `CONTRACTS_EVENTS_DIR=/path/to/schemas` (used by tests).
