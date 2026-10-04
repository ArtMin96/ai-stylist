# Python 3.14 + FastAPI quality reference

Applies to: `workers/**/*.py` only (never `workers/ml/generated/**`, which is regenerated). Never cite
this file for Swift, Kotlin, TypeScript or shell.

**Gates (they run, so do not hand-check what they cover):** Ruff lint and format from
`workers/pyproject.toml` (rule sets E, F, I, B, UP, N, S, ASYNC, RUF; 100 columns; target py314);
basedpyright in `standard` mode with missing imports as errors; pytest with `--strict-markers`,
`xfail_strict` and every warning turned into an error. Canonical siblings:
`workers/ml/segmentation/src/ai_stylist_segmentation/app.py` (app factory),
`workers/ml/segmentation/src/ai_stylist_segmentation/main.py` (composition root),
`workers/ml/segmentation/src/ai_stylist_segmentation/schemas.py`,
`workers/ml/segmentation/src/ai_stylist_segmentation/routes.py`.

## Naming (PEP 8, gated by `N`)

- Modules, functions, variables `snake_case`; classes `PascalCase`; constants `UPPER_SNAKE_CASE`.
- A leading underscore marks a module-private name; no double-underscore name mangling for privacy.
- Name units and meaning: `timeout_seconds`, `mask_pixels`, not `t`, `data`, `res`.

## Types

- Annotate every function signature, including `-> None`. Annotate module-level constants whose type
  is not obvious.
- Modern syntax (gated by `UP`): `list[str]`, `dict[str, int]`, `X | None`; abstract parameter types
  from `collections.abc` (`Sequence`, `Mapping`, `Callable`, `Iterator`); concrete return types.
- Closed sets are `enum.StrEnum` or `typing.Literal`. Ports and fakes meet a `typing.Protocol`, not an
  abstract base class, unless shared behaviour is needed.
- Avoid `Any`; reserve it for third-party callback signatures that demand it (structlog processors) and
  keep it at that edge. Use `typing.cast` only after a runtime check.
- Wire payloads are Pydantic v2 models (or the generated models in `workers/ml/generated/`); internal
  values are `@dataclass(frozen=True, slots=True)`.

## FastAPI

- Build the app in a factory (`create_app()`); only the composition root reads the environment and
  configures logging and tracing.
- Routes stay thin: validate with the Pydantic model, call a plain function that holds the logic,
  return a model. Declare `response_model` or a return annotation so the contract is explicit.
- Dependencies through `Annotated[T, Depends(provider)]`, so tests override them with
  `app.dependency_overrides` instead of patching.
- Inside `async def`, never block (gated by `ASYNC`): no blocking file or network I/O, no
  `time.sleep`, no CPU-heavy model inference on the event loop. Use async clients, or move the work
  off-loop with `anyio.to_thread.run_sync` / FastAPI's `run_in_threadpool`.
- Startup and shutdown go in a `lifespan` context manager, not `on_event`.
- `HTTPException` only in the route layer; domain code raises domain exceptions that the route maps.

## Errors

- Catch the narrowest exception; never a bare `except:` or `except Exception: pass`. Re-raise with
  `raise NewError(...) from err` to keep the cause.
- EAFP (`try`/`except KeyError`) is idiomatic when the failure is rare; `if` checks when it is common.
- Log once where the error is handled, with structlog key-value fields through the redaction
  processor; never `print`, never sensitive values.

## Idioms

- Comprehensions for simple transforms; a plain loop when there is a side effect or more than one
  condition. Generators for large or streamed data.
- `pathlib.Path` over `os.path`; `with` for every resource; `zip(..., strict=True)`; `enumerate` over
  index counters.
- No mutable default arguments (gated by `B006`); default to `None` and create inside.
- f-strings for messages, but log events as a constant event name plus keyword fields.
- Keep functions short and flat; return early.

## Docstrings and comments

- A module docstring saying what the module is for and what may import it, as the siblings do.
- Docstrings on public functions: one summary line, then arguments, return value and raised exceptions
  when not obvious from the types.

## Tests (pytest)

- Tests in `workers/ml/<service>/tests/` (path guard). Plain functions, fixtures in `conftest.py`,
  `pytest.mark.parametrize` for tables, Hypothesis for properties of pure functions.
- `assert` is allowed only in tests (gated by `S101` outside them). Use FastAPI's test client with
  dependency overrides rather than monkeypatching internals.

## Suppression syntax

`# noqa: <CODE>  # <reason>` on the one line for Ruff, `# pyright: ignore[<rule>]  # <reason>` for
basedpyright. Never a bare `# noqa` or `# type: ignore` without a code, and never a file-level
`# ruff: noqa`.

## Do not import from other languages

| Habit from     | Leaks in as                                                                        | Python instead                                                                |
| -------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Java           | getters/setters, classes holding only static methods, deep inheritance             | attributes or `@property`, module-level functions, composition and `Protocol` |
| TypeScript     | `camelCase` names, `interface` naming, `Optional` used as "maybe undefined" chains | `snake_case`, `Protocol`, `X \| None` with an explicit check                  |
| Kotlin / Swift | a `Result` wrapper returned from every function                                    | exceptions, mapped to HTTP at the route                                       |
| Kotlin / Swift | `data class` thinking via plain dicts                                              | a frozen dataclass or Pydantic model                                          |
| Legacy Python  | `typing.List`, `Optional[X]`, `%` formatting, `os.path`                            | `list`, `X \| None`, f-strings, `pathlib`                                     |
| Node           | callback chains, blocking calls inside `async def`                                 | `await` on async clients, thread offload for blocking work                    |

## Checklist

Every signature typed · modern generics and `X | None` · closed sets as `StrEnum`/`Literal` · Pydantic at
the wire, frozen dataclasses inside · thin routes, logic in plain functions · no blocking call in
`async def` · narrow excepts with `from err` · structlog key-value logging, nothing sensitive · no
mutable defaults · docstrings on public functions · pytest in the service tests directory with dependency overrides.
