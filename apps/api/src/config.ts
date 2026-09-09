// Every env key the API reads, validated once at boot (zod). `.env.example` must list each key
// (CI: `.env.example` ⊇ this schema, brief §6). Empty strings count as unset so a copied
// `.env.example` boots with defaults.
import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  /** Preferred listen port; `PORT` is the PaaS fallback. */
  API_PORT: port.optional(),
  PORT: port.optional(),
  API_BASE_URL: z.url().optional(),
  DATABASE_URL: z.url().optional(),
  APP_VERSION: z.string().min(1).default('0.0.0-dev'),
  GIT_COMMIT: z.string().min(1).default('unknown'),
  BUILD_TIME: z.iso.datetime({ offset: true }).default('1970-01-01T00:00:00Z'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(600),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1).default(60_000),
});

export type AppConfig = z.infer<typeof configSchema> & { readonly listenPort: number };

/** Keys an `.env` must list (checked by `just doctor` against .env.example). */
export const CONFIG_KEYS = Object.keys(configSchema.shape) as readonly (keyof z.infer<
  typeof configSchema
>)[];

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const present: Record<string, string> = {};
  for (const key of CONFIG_KEYS) {
    const value = env[key];
    if (value !== undefined && value.trim() !== '') present[key] = value;
  }
  const parsed = configSchema.safeParse(present);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(`invalid configuration: ${issues.join('; ')}`);
  }
  return { ...parsed.data, listenPort: parsed.data.API_PORT ?? parsed.data.PORT ?? 3000 };
}
