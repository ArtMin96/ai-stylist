# Module Contract — `platform`

> Module names are canonical per [SPINE §3](../../planning/SPINE.md). Path: `apps/api/src/platform`. This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** Infrastructure adapters that implement the ports declared by domain modules: storage (R2), durable jobs (pg-boss), outbox relay, logger, OTel init, PostHog server, resilience utilities, provider SDK wrappers; deployment target is owned servers + Coolify (DEC-42).
- **Owner:** @team (placeholder — see `CODEOWNERS`) · **Status:** skeleton (P02) · **Last updated:** 2026-09-24

## Public interface

Public interface: `index.ts` only. Domain modules never import from here; only composition roots do (`modules-not-platform`).

| Export                                                                                                                                                        | Kind (service/command/query/type/port) | Purpose                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlatformModule.forRoot(bindings)`, `PlatformBindings`                                                                                                        | service / type                         | Global Nest module: binds the ports to adapters the composition root built, serves `GET /v1/health` and `GET /v1/version`, installs the logger and the problem filter |
| `CLOCK`, `Clock`, `SystemClock`                                                                                                                               | port / adapter                         | Injectable time source                                                                                                                                                |
| `HEALTH_PROBE`, `HealthProbe`, `PgHealthProbe`, `UnconfiguredHealthProbe`                                                                                     | port / adapter                         | Readiness probe behind `/v1/health` (Postgres, or `down` when `DATABASE_URL` is unset)                                                                                |
| `STORAGE_PROVIDER`, `StorageProvider`, `InMemoryStorageProvider`, `StorageError`, `Presign*` types, `StorageNamespace`, `MAX_PRESIGN_TTL_SECONDS`, `clampTtl` | port / adapter                         | Object storage with presigned URLs; R2 adapter pending (P02-T13)                                                                                                      |
| `ProblemFilter`, `PROBLEM_CONTENT_TYPE`, `ProblemBody`, `toProblem`                                                                                           | adapter                                | RFC 9457 problem+json responses for every error                                                                                                                       |
| `loggerOptions`, `httpLoggerOptions`, `FORBIDDEN_LOG_KEYS`, `REDACTED`, `isForbiddenLogKey`, `redactForbidden`                                                | adapter                                | pino logger configuration with sensitive-key redaction                                                                                                                |

## Owned data

No domain data (SPINE §3). Infrastructure tables only: `platform_outbox` and `platform_idempotency_keys`, defined in `packages/db/src/schema/platform.ts` and created by migrations 0001/0002 in `packages/db/migrations/`. They are owned by `platform`; no domain module reads them directly.

## Invariants

1. Adapters translate only: no business rule lives in any adapter, task body, or provider wrapper (doc 04 §4.2 rule 9).
2. This module writes only the tables it owns (doc 04 §4.2 rule 8); cross-module behaviour goes through public application services or events.
3. Further invariants: OPEN until the first domain phase that touches this module fills them in (each needs at least one test).

## Events

| Event (published) | Payload schema (owner: `packages/contracts`) | When emitted |
| ----------------- | -------------------------------------------- | ------------ |
| —                 | —                                            | none yet     |

| Event (consumed) | From module | Reaction |
| ---------------- | ----------- | -------- |
| —                | —           | none yet |

## Dependencies (allowed)

- `packages/shared-kernel` and provider SDKs only (`platform-leaf`, doc 04 §4.2 rule 5). Adapters are bound to ports at `apps/api/src/main.ts` / `app.module.ts` and `apps/api/src/jobs/index.ts`.
- Ports: implements ports declared by modules; declares none of its own. Fakes for tests live in `packages/test-support/`.

## Forbidden dependencies

Derived from P02 brief §5 and doc 04 §4.2; every rule has a failing fixture in `just arch-check`, and exceptions need an ADR.

- Any edge that closes a cycle (`no-cycles`); the graph must equal doc 04 §4.1.
- `apps/api/src/modules/**` entirely — public API included (leaf-only).
- (Provider SDKs are allowed here — this is the only place they may be imported.)
- Creating `utils/`, `helpers/`, or `common/` directories (`no-utils-dirs`); importing `prototype/**` (`prototype-unimportable`).
- Logger: allowlist serialization + forbidden-key denylist (doc 11 §8); `console.*` and raw `req.body` logging are lint errors (P02 §6).

## Tests

- Location: `apps/api/src/platform/tests/` (test-placement rule: `*.test.ts` only inside a `tests/` directory); `*.sec.test.ts` for signed-URL constraints (T13)
- Required levels (once behaviour exists): unit for invariants/rules · contract tests for the public interface and events · integration (Testcontainers Postgres + pgvector) where repositories or adapters exist. P02 ships a smoke test that the module loads.
- Fixtures/builders: `packages/test-support/` and `packages/seed-data/` factories; never duplicated across modules; synthetic data only.

## Extension points

- New provider = new adapter implementing an existing port + fake in `packages/test-support/`; never a new import path into domain modules.

Status: skeleton (P02).
