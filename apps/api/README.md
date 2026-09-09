# @ai-stylist/api

NestJS on the Fastify adapter. `src/main.ts` + `src/app.module.ts` are the composition root
(the only files that construct adapters); `src/platform/` holds ports and infrastructure
adapters; `src/modules/<name>/` one directory per SPINE domain module (public API = `index.ts`).

- `just dev-api` — compose Postgres + `tsx watch src/main.ts` (no build step). tsx does not emit
  decorator metadata, so every injected constructor parameter uses an explicit `@Inject(TOKEN)`.
- `just test api` / `pnpm --filter @ai-stylist/api test` — vitest projects `api` (unit + in-process
  HTTP) and `migrations` (Testcontainers; fails loudly without Docker).
- Config: `src/config.ts` (zod) — every key must appear in the root `.env.example`.
- Errors: RFC 9457 `application/problem+json` via `platform/problem.filter.ts`.
- Logging: pino with allowlist serializers + forbidden-key denylist (`platform/logger.ts`).
