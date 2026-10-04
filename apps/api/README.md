# @ai-stylist/api

NestJS on the Fastify adapter. `src/main.ts` + `src/app.module.ts` are the composition root
(the only files that construct adapters; `src/jobs/index.ts` is the job composition root
(`startJobs`; process entry `src/jobs/main.ts`));
`src/platform/` holds infrastructure adapters for the ports in `@ai-stylist/shared-kernel`
(`CLOCK`, `STORAGE_PROVIDER`, `OUTBOX_WRITER`, `FEATURE_FLAGS`; plus its one internal port,
`HEALTH_PROBE`); `src/modules/<name>/` one directory per
SPINE domain module (13, registered in `DOMAIN_MODULES`; public API = `index.ts`).

- `just dev-api` — compose Postgres (`docker compose up -d --wait postgres`, in compose project
  `ai-stylist` from every checkout and worktree; `just doctor` reports a container that another
  project owns) + package script
  `dev` (`tsx watch` of `src/main.ts` behind the telemetry `--import` entry; no build step),
  reading the repo-root `.env`. The recipe passes `APP_ENV` as the exported value, else the `.env`
  value, else `local`. Run `just db-migrate`
  once first ([packages/db](../../packages/db/README.md)). tsx does not emit decorator metadata, so every
  injected constructor parameter uses an explicit `@Inject(TOKEN)`.
- With `DATABASE_URL` set, the API process also runs the outbox relay: on bootstrap it starts a
  `PgBossQueue` (queues `JOB_QUEUES` from `src/jobs/queues.ts`, never `src/jobs/index.ts`, so the
  job runtime stays out of the API process), then an `OutboxRelay` routing each event type with
  `queueForEventType` and keying jobs per user with `userIdOf`; on shutdown it stops the relay, then the queue, then
  closes the pool. Boot fails, naming `just db-migrate`, when the pg-boss schema is missing.
  Job handlers run in the separate jobs process: package scripts `dev:jobs` (watch), `jobs`, and
  `start:jobs` (after `build`), e.g. `pnpm --filter @ai-stylist/api run dev:jobs`.
- Listens on `0.0.0.0:${API_PORT}`, falling back to `PORT` (Coolify), then 3000.
- Routes (all under `/v1`, matching the contract paths): `GET /v1/health` (200, or 503
  problem+json when `DATABASE_URL` is unset or Postgres is down), `GET /v1/version`, and the
  dev-only `POST /v1/dev/demo-events` (registered only when `NODE_ENV` is not `production`
  AND `APP_ENV` is `local` or `dev`, so it fails closed on staging/prod; answered only while
  the `demo-outbox-flow` flag is on, else a 404 problem and no outbox row): appends a
  `demo.outbox-flow.requested.v1` envelope to `platform_outbox` (202), a 503 problem when
  `DATABASE_URL` is unset, or a 400 `VALIDATION_FAILED` problem when `demoId` exceeds 128
  characters (`note` is truncated to the contract's 200). The envelope's `correlationId` is the
  request's `x-correlation-id` (or the id the API minted); a body `correlationId` is ignored.
- `just test api` (all projects) / `just test <module>` / `just test platform` — vitest projects
  `api` (unit + in-process HTTP), `platform-docker` and `migrations` (Testcontainers; both fail
  loudly without Docker). With `DATABASE_URL` set (local hosts only), `tests/http.test.ts`
  migrates that database and asserts the demo event's outbox row.
- Config: `src/config.ts` (zod) — every key must appear in the root `.env.example`. Values never
  appear in a config error.
- Telemetry and flags ([docs/observability](../../docs/observability/README.md) has the flow):
  every process starts behind its `--import` entry (`src/platform/telemetry/instrument-api.ts`
  for `dev` / `start`, `instrument-jobs.ts` for `dev:jobs` / `jobs` / `start:jobs`), which does
  nothing while `OTEL_EXPORTER_OTLP_ENDPOINT` is empty. `createApp` installs the correlation id
  (a valid `x-correlation-id` is echoed, else a minted UUID; every log line of the request carries
  it) and the request metrics; the root module flushes telemetry last on shutdown. Feature flags
  come from `createFeatureFlags`: `POSTHOG_API_KEY` (a `phc_` project key; a `phx_` key is
  refused) with `POSTHOG_HOST` (required with a key), or the registry defaults without a key
  (local runs, tests, CI). `demo-outbox-flow` gates the dev route above.
- Errors: RFC 9457 `application/problem+json` via `platform/problem.filter.ts`.
- Rate limit: `@fastify/rate-limit`, `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS` (defaults
  600 / 60 000 ms); a 429 becomes a `RATE_LIMITED` problem.
- Logging: pino with allowlist serializers + forbidden-key denylist (`platform/logger.ts`).
