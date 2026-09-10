# workers/ — Python ML services

Stateless **FastAPI** services that Trigger.dev tasks call over HTTP for CV/ML steps that need
Python or native tooling (planning/04 §2, §6). One service per directory under `ml/`, each
shipped as its own Docker image. In P02 the only service is `ml/segmentation`, an echo stub.

```
workers/
├── pyproject.toml          uv workspace root: shared dev tooling + ruff / pytest / basedpyright config
├── uv.lock                 single lockfile for every member (committed; `uv sync --frozen`)
├── conftest.py             pytest plugin: the no-skip rule (see below)
├── .dockerignore           build context for every image is this directory
└── ml/
    ├── generated/          `ai-stylist-generated`: Pydantic models from packages/contracts/events (never hand-edited)
    └── segmentation/       `ai-stylist-segmentation`: FastAPI service
        ├── pyproject.toml  runtime deps only (hatchling build)
        ├── Dockerfile      multi-stage, python:3.12-slim, uv --frozen, non-root, HEALTHCHECK /health
        ├── src/ai_stylist_segmentation/
        │   ├── main.py     composition root: configures logging, builds `app` (uvicorn target)
        │   ├── app.py      `create_app()` factory + body-free access-log middleware
        │   ├── routes.py   GET /health, POST /v1/segment (thin adapters, no domain logic)
        │   └── schemas.py  Pydantic request/response models; re-exports the generated envelope
        └── tests/          the service's tests (always here — test-placement rule)
```

## Boundaries (brief §5, root CLAUDE.md)

- **`mobile/workers-not-server`:** workers may depend only on `packages/contracts` (through the
  generated models) and `packages/shared-kernel`. Never on `apps/api`. The versioned JSON
  schemas in `packages/contracts/events/*.json` are the _only_ contract shared with the
  TypeScript side; `just generate` turns them into `ml/generated/ai_stylist_generated/events/`.
- **`composition-root-only`:** `ml/<service>/src/<pkg>/main.py` is the only module that builds
  the app, configures logging, or constructs adapters. Everything else is pure, importable code.
- **Logging:** structlog JSON to stdout. A redaction processor drops every key in
  `FORBIDDEN_LOG_KEYS` (planning/11 §8: measurements, selfie, face, photo, location, token,
  authorization, password, email) at any nesting depth, for structlog and stdlib records alike.
  Request bodies, headers and query strings are never logged. `tests/test_redaction.py` is the canary.
- **Honesty:** every generated result carries `provenance {generated, model, confidence}`.

## Toolchain

Python 3.12.x and uv 0.12.x are pinned in the root `mise.toml`; nothing here uses the system
Python. Either activate mise (`eval "$(~/.local/bin/mise activate zsh)"`) or prefix commands with
`~/.local/bin/mise exec --`. `just` prepends the mise shims automatically.

```bash
cd workers
uv sync --frozen                       # creates workers/.venv with every member + dev tooling
uv run pytest -q                       # all services (testpaths = ml/*/tests)
uv run ruff check . && uv run ruff format --check .
uv run basedpyright                    # config in workers/pyproject.toml (typeCheckingMode = standard)
```

From the repository root the same commands are `uv run --project workers <cmd> workers`
(basedpyright additionally needs `--project workers` to find its config).

### Run a service locally (`just dev-workers`)

```bash
uv run --project workers/ml/segmentation uvicorn ai_stylist_segmentation.main:app --reload --port 8001
curl localhost:8001/health
curl -X POST localhost:8001/v1/segment -H 'content-type: application/json' \
  -d '{"request_id":"req_1","image_ref":"media/u1/garment.jpg","hint":"top"}'
```

Port 8001 keeps the API's 8000 free; inside Docker the service listens on 8000.

### Docker

```bash
docker build -f workers/ml/segmentation/Dockerfile -t ai-stylist-segmentation:dev workers
docker run --rm -p 8001:8000 ai-stylist-segmentation:dev
```

The build context is `workers/` so the shared `uv.lock` and the generated-models member are
available; `workers/.dockerignore` keeps tests, caches and venvs out of the context.

### Generated models (`just generate`)

`tools/codegen/gen-python.sh [--check]` runs `datamodel-codegen` over the top-level
`packages/contracts/events/*.json` into `ml/generated/ai_stylist_generated/events/` (one module
per schema), formats the result with the workspace ruff config and is idempotent. `--check`
exits 1 when the committed output is stale. `CONTRACTS_EVENTS_DIR` overrides the input directory.
Generated files start with a `GENERATED — run \`just generate\``banner and are excluded from`ruff check`; they are still type-checked.

## Rules enforced by tooling

| Rule           | Where                                                        | Effect                                                                                                                      |
| -------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| no-skip        | `workers/conftest.py`                                        | `@pytest.mark.skip`/`skipif` must carry `reason=` containing `#<n>` or `<PROJECT>-<n>`; otherwise collection fails (exit 4) |
| test-placement | `testpaths = ["ml/*/tests"]`                                 | tests outside a service's `tests/` are never collected                                                                      |
| strict pytest  | `--strict-markers`, `xfail_strict`, `filterwarnings = error` | typos and deprecations fail fast                                                                                            |
| lint           | ruff `E,F,I,B,UP,N,S,ASYNC,RUF`, line length 100, py312      | `S101` allowed in tests                                                                                                     |
| types          | basedpyright `standard`                                      | 0 errors, 0 warnings required                                                                                               |

## Adding a service

1. `mkdir ml/<name>` with a `pyproject.toml` (copy segmentation's; package `ai_stylist_<name>`).
2. `main.py` composition root, `app.py` factory, `routes.py`, `schemas.py`, `tests/`, `Dockerfile`.
3. `uv lock` (lockfiles are single-writer — sequence with other lockfile changes), commit `uv.lock`.
4. The workspace glob `ml/*` picks it up; `pytest`, `ruff` and `basedpyright` need no changes.
