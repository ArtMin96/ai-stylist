# @ai-stylist/api

NestJS on the Fastify adapter. `src/main.ts` + `src/app.module.ts` are the composition root
(the only files that construct adapters; `src/jobs/index.ts` is the job composition root
(`startJobs`; process entry `src/jobs/main.ts`));
`src/platform/` holds ports and infrastructure adapters; `src/modules/<name>/` one directory per
SPINE domain module (13, registered in `DOMAIN_MODULES`; public API = `index.ts`).

- `just dev-api` — compose Postgres (`docker compose up -d --wait postgres`) +
  `tsx watch src/main.ts` (no build step), reading the repo-root `.env`. Run `just db-migrate`
  once first ([packages/db](../../packages/db/README.md)). tsx does not emit decorator metadata, so every
  injected constructor parameter uses an explicit `@Inject(TOKEN)`.
- With `DATABASE_URL` set, the API process also runs the outbox relay: on bootstrap it starts a
  `PgBossQueue` (queues `JOB_QUEUES` from `src/jobs/index.ts`), then an `OutboxRelay` routing
  each event type with `queueForEventType`; on shutdown it stops the relay, then the queue, then
  closes the pool. Boot fails, naming `just db-migrate`, when the pg-boss schema is missing.
  Job handlers run in the separate jobs process: package scripts `dev:jobs` (watch), `jobs`, and
  `start:jobs` (after `build`), e.g. `pnpm --filter @ai-stylist/api run dev:jobs`.
- Listens on `0.0.0.0:${API_PORT}`, falling back to `PORT` (Coolify), then 3000.
- Routes (all under `/v1`, matching the contract paths): `GET /v1/health` (200, or 503
  problem+json when `DATABASE_URL` is unset or Postgres is down), `GET /v1/version`, and the
  dev-only `POST /v1/dev/demo-events` (not registered when `NODE_ENV=production`): appends a
  `demo.outbox-flow.requested.v1` envelope to `platform_outbox` (202), or a 503 problem when
  `DATABASE_URL` is unset.
- `just test api` (all projects) / `just test <module>` / `just test platform` — vitest projects
  `api` (unit + in-process HTTP), `platform-docker` and `migrations` (Testcontainers; both fail
  loudly without Docker). With `DATABASE_URL` set (local hosts only), `tests/http.test.ts`
  migrates that database and asserts the demo event's outbox row.
- Config: `src/config.ts` (zod) — every key must appear in the root `.env.example`.
- Errors: RFC 9457 `application/problem+json` via `platform/problem.filter.ts`.
- Rate limit: `@fastify/rate-limit`, `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS` (defaults
  600 / 60 000 ms); a 429 becomes a `RATE_LIMITED` problem.
- Logging: pino with allowlist serializers + forbidden-key denylist (`platform/logger.ts`).
