# @ai-stylist/api

NestJS on the Fastify adapter. `src/main.ts` + `src/app.module.ts` are the composition root
(the only files that construct adapters; `src/jobs/index.ts` joins them with P02-T08);
`src/platform/` holds ports and infrastructure adapters; `src/modules/<name>/` one directory per
SPINE domain module (13, registered in `DOMAIN_MODULES`; public API = `index.ts`).

- `just dev-api` — compose Postgres (`docker compose up -d --wait postgres`) +
  `tsx watch src/main.ts` (no build step), reading the repo-root `.env`. Run `just db-migrate`
  once first ([packages/db](../../packages/db/README.md)). tsx does not emit decorator metadata, so every
  injected constructor parameter uses an explicit `@Inject(TOKEN)`.
- Listens on `0.0.0.0:${API_PORT}`, falling back to `PORT` (Coolify), then 3000.
- Routes (all under `/v1`, matching the contract paths): `GET /v1/health` (200, or 503
  problem+json when `DATABASE_URL` is unset or Postgres is down), `GET /v1/version`, and the
  dev-only `POST /v1/dev/demo-events` (not registered when `NODE_ENV=production`).
- `just test api` (both projects) / `just test <module>` / `just test platform` — vitest projects
  `api` (unit + in-process HTTP) and `migrations` (Testcontainers; fails loudly without Docker).
- Config: `src/config.ts` (zod) — every key must appear in the root `.env.example`.
- Errors: RFC 9457 `application/problem+json` via `platform/problem.filter.ts`.
- Rate limit: `@fastify/rate-limit`, `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS` (defaults
  600 / 60 000 ms); a 429 becomes a `RATE_LIMITED` problem.
- Logging: pino with allowlist serializers + forbidden-key denylist (`platform/logger.ts`).
