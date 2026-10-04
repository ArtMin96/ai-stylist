# workers/ — Python ML services

Stateless **FastAPI** services that pg-boss job handlers call over HTTP for CV/ML steps that need
Python or native tooling (planning/04 §2, §6). One service per directory under `ml/`, each
shipped as its own Docker image. In P02 the only service is `ml/segmentation`, an echo stub.

```
workers/
├── pyproject.toml          uv workspace root: shared dev tooling + ruff / pytest / basedpyright config
├── uv.lock                 single lockfile for every member (committed; `uv sync --frozen`)
├── conftest.py             pytest plugin: the no-skip rule (see below)
├── .dockerignore           build context for every image is this directory
├── .gitignore              workspace-local caches (.hypothesis/); the root .gitignore covers the rest
└── ml/
    ├── generated/          `ai-stylist-generated`: Pydantic models from packages/contracts/events (never hand-edited)
    └── segmentation/       `ai-stylist-segmentation`: FastAPI service
        ├── pyproject.toml  runtime deps only (hatchling build)
        ├── Dockerfile      multi-stage, python:3.14-slim, uv --frozen, non-root, HEALTHCHECK /health
        ├── src/ai_stylist_segmentation/
        │   ├── main.py        composition root: configures logging + tracing, builds `app` (uvicorn target)
        │   ├── app.py         `create_app()` factory + correlation-id and body-free access-log middleware
        │   ├── routes.py      GET /health, POST /v1/segment (thin adapters, no domain logic)
        │   ├── schemas.py     Pydantic request/response models; re-exports the generated envelope
        │   ├── redaction.py   forbidden log words + the structlog redaction processor
        │   ├── correlation.py `x-correlation-id`: validate or mint, bind to logs + span, echo
        │   └── tracing.py     span sanitizer (OTLP export backstop) + `trace_id`/`span_id` log processor
        └── tests/          the service's tests (always here — test-placement rule)
```

## Boundaries (brief §5, root CLAUDE.md)

- **`workers-not-server`** (brief §5; dependency-cruiser covers TypeScript only, so review
  enforces it here): workers may depend only on `packages/contracts` (through the generated
  models) and `packages/shared-kernel`. Never on `apps/api`. The versioned JSON
  schemas in `packages/contracts/events/*.json` are the _only_ contract shared with the
  TypeScript side; `just generate` turns them into `ml/generated/ai_stylist_generated/events/`.
- **`composition-root-only`:** `ml/<service>/src/<pkg>/main.py` is the only module that builds
  the app, configures logging, or constructs adapters. Everything else is pure, importable code.
- **Logging:** structlog JSON to stdout. A redaction processor drops every key that is, or contains
  as a camelCase / snake_case / kebab-case word, one of the forbidden words (planning/11 §8) at any
  nesting depth, for structlog and stdlib records alike. The words are the single source
  `packages/shared-kernel/registry/forbidden-log-keys.json`; the image has no `packages/`, so
  `FORBIDDEN_LOG_KEYS` in `redaction.py` is a copy that `tests/test_redaction.py` pins to that file
  (copy the registry's words when it fails). Matching mirrors `isForbiddenLogKey` in
  `apps/api/src/platform/logger.ts`. Request bodies, headers and query strings are never logged.
  Inside a request every line carries `correlation_id`; inside a traced request also `trace_id` and
  `span_id`. `tests/test_redaction.py` is the canary.
- **Honesty:** every generated result carries `provenance {generated, model, confidence}`.

## Telemetry (planning/14 §2–§3, ADR-0007)

Same pipeline and rules as the API (`apps/api/src/platform/telemetry/README.md`); Grafana setup in
`docs/observability/grafana.md`.

- **Off unless configured.** An empty or unset `OTEL_EXPORTER_OTLP_ENDPOINT` builds nothing: no
  tracer provider, no exporter, no network (tests, CI, local runs without Grafana).
- **Traces** (`main.py`): OpenTelemetry SDK `TracerProvider` → `BatchSpanProcessor` (`OTEL_BSP_*`)
  → `SanitizingSpanExporter` → OTLP/HTTP protobuf exporter, which reads
  `OTEL_EXPORTER_OTLP_ENDPOINT` (or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) and
  `OTEL_EXPORTER_OTLP_HEADERS` itself. Resource: `service.name` = `segmentation`,
  `service.version` = `APP_VERSION` (else the package version), `deployment.environment.name` =
  `APP_ENV` (omitted when empty; `just dev-workers` starts the worker with `local` in that case);
  `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` win. No host or
  process detector runs. The provider's `atexit` hook flushes pending spans on a graceful stop.
- **Instrumentation:** `opentelemetry-instrumentation-fastapi`, one SERVER span per request that
  continues the caller's W3C `traceparent` (the jobs process's `fetch` span); propagation is
  `traceparent` only (caller `baggage` is ignored). `/health` is not traced, there are no
  per-message `receive`/`send` spans, and span attributes use the stable HTTP semantic conventions
  (`OTEL_SEMCONV_STABILITY_OPT_IN=http` by default).
- **Span attributes** carry ids and enums only, e.g. `http.request.method`, `http.route`,
  `url.path`, `http.response.status_code`, `correlation_id`. The
  exporter wrapper (`tracing.py`) drops `url.query`, `client.address`, `network.peer.address`,
  `user_agent.original`, `exception.message`, `exception.stacktrace` (and their old-convention
  names), cuts the query and fragment from `url.full`/`url.path`/`http.url`/`http.target`, drops
  the status description, keeps `exception.type`, and replaces with `[REDACTED]` any attribute whose
  last dot-segment is a forbidden word.
- **Correlation id** (`correlation.py`): the `x-correlation-id` request header is accepted when it
  matches the API's `CORRELATION_ID_PATTERN` (1–128 chars of `[A-Za-z0-9._:-]`, one header),
  else a UUID is minted. It is bound as `correlation_id` for every log line of the request, set on
  the request span and echoed in the response header.
- **Logs stay on stdout** (JSON); they are not sent over OTLP. The OpenTelemetry Python logs signal
  is still "Development" (opentelemetry-python README; 1.45.0 changed the Logger API), so shipping
  stdout to Loki is the platform's log collector's job.

## Toolchain

Python 3.14.x and uv 0.12.x are pinned in the root `mise.toml`; nothing here uses the system
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
(basedpyright additionally needs `--project workers` to find its config). The `just` recipes run
exactly these: `just test workers`, and the workers leg of `just lint`, `just typecheck` and
`just format [--check]`.

### Run a service locally (`just dev-workers`)

```bash
uv run --project workers/ml/segmentation uvicorn ai_stylist_segmentation.main:app --reload --port 8001
curl localhost:8001/health
curl -X POST localhost:8001/v1/segment -H 'content-type: application/json' \
  -d '{"request_id":"req_1","image_ref":"media/u1/garment.jpg","hint":"top"}'
```

Port 8001 keeps the API's 8000 free; inside Docker the service listens on 8000. To export traces
locally, set `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_HEADERS` in the environment and
`OTEL_SERVICE_NAME=segmentation` (or leave it unset) so a shared `.env` value for the API does not
rename the worker.

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
Generated files start with a `` # GENERATED — run `just generate` `` banner and are excluded from
`ruff check`; they are still type-checked.

## Rules enforced by tooling

| Rule           | Where                                                        | Effect                                                                                                                      |
| -------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| no-skip        | `workers/conftest.py`                                        | `@pytest.mark.skip`/`skipif` must carry `reason=` containing `#<n>` or `<PROJECT>-<n>`; otherwise collection fails (exit 4) |
| test-placement | `testpaths = ["ml/*/tests"]`                                 | tests outside a service's `tests/` are never collected                                                                      |
| strict pytest  | `--strict-markers`, `xfail_strict`, `filterwarnings = error` | typos and deprecations fail fast                                                                                            |
| lint           | ruff `E,F,I,B,UP,N,S,ASYNC,RUF`, line length 100, py314      | `S101` allowed in tests                                                                                                     |
| types          | basedpyright `standard`                                      | 0 errors, 0 warnings required                                                                                               |

## Adding a service

1. `mkdir ml/<name>` with a `pyproject.toml` (copy segmentation's; package `ai_stylist_<name>`).
2. `main.py` composition root, `app.py` factory, `routes.py`, `schemas.py`, `tests/`, `Dockerfile`.
3. In the root `workers/pyproject.toml`, add `ai-stylist-<name>` to `dependencies` and to
   `[tool.uv.sources]` (`{ workspace = true }`) so `uv sync --frozen` installs it, and add
   `ai_stylist_<name>` to ruff's `known-first-party`.
4. `uv lock` (lockfiles are single-writer — sequence with other lockfile changes), commit `uv.lock`.
5. The workspace glob `ml/*` makes it a member; `pytest` (`ml/*/tests`) and `basedpyright`
   (`include = ["ml", …]`) need no changes.
