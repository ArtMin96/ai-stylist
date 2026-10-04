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
  /** PostHog project key for server-side flag evaluation; unset → the registry defaults. */
  POSTHOG_API_KEY: z
    .string()
    .regex(/^phc_\w+$/, 'must be a PostHog project key (phc_…); a personal phx_ key is refused')
    .optional(),
  /**
   * PostHog host, e.g. https://us.i.posthog.com (this project is on US Cloud); required when
   * POSTHOG_API_KEY is set.
   */
  POSTHOG_HOST: z.url({ protocol: /^https?$/ }).optional(),
  /**
   * Cloudflare R2 (`StorageProvider`, P02-T13): all four set → presigned URLs on R2's S3 endpoint
   * `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`; none set → the in-memory provider (local,
   * dev, tests, CI; refused on staging, prod and NODE_ENV=production, see
   * `isLocalOrDevDeployment`); some → refused. Checked here for presence and all-or-none only: the
   * shape of each value is the R2 adapter's rule (platform/storage/r2-storage-provider.ts), and a
   * malformed value fails at boot when `AppModule.forRoot` builds the adapter, with an error that
   * names the key, never the value. `R2_PUBLIC_BASE_URL` (public assets, P04/P06) is not read yet.
   */
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
});

/** Set together or not at all. */
const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

export type AppConfig = z.infer<typeof configSchema> & { readonly listenPort: number };

/** Keys an `.env` must list (checked by `just doctor` against .env.example). */
export const CONFIG_KEYS = Object.keys(configSchema.shape) as readonly (keyof z.infer<
  typeof configSchema
>)[];

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/**
 * Fail closed: true only outside production builds AND in a local or dev deployment, so a
 * staging/prod deploy that forgets NODE_ENV=production still counts as deployed. The one predicate
 * for what only local and dev may have: the dev routes (`DevModule`, apps/api/src/dev/index.ts) and
 * the in-memory storage provider standing in for R2 (`createStorageProvider`'s `allowsInMemory`).
 * Staging and prod use real R2 buckets (doc 15 §11), so there `loadConfig` refuses a configuration
 * without the R2 keys instead of minting in-memory URLs that store nothing.
 */
export function isLocalOrDevDeployment(config: Pick<AppConfig, 'NODE_ENV' | 'APP_ENV'>): boolean {
  return (
    config.NODE_ENV !== 'production' && (config.APP_ENV === 'local' || config.APP_ENV === 'dev')
  );
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
  if (parsed.data.POSTHOG_API_KEY !== undefined && parsed.data.POSTHOG_HOST === undefined) {
    // posthog-node would otherwise fall back to its US host.
    throw new ConfigError(
      'invalid configuration: POSTHOG_HOST: required when POSTHOG_API_KEY is set',
    );
  }
  const missingR2 = R2_KEYS.filter((key) => parsed.data[key] === undefined);
  if (missingR2.length > 0 && missingR2.length < R2_KEYS.length) {
    // A half-configured environment must not fall back to in-memory URLs silently.
    throw new ConfigError(
      `invalid configuration: ${missingR2.join(', ')}: required when any R2_* key is set`,
    );
  }
  if (missingR2.length === R2_KEYS.length && !isLocalOrDevDeployment(parsed.data)) {
    // Names the keys and the rule only, never a configured value.
    throw new ConfigError(
      `invalid configuration: ${R2_KEYS.join(', ')}: required when APP_ENV is staging or prod ` +
        'or NODE_ENV is production (the in-memory storage provider is for local and dev only)',
    );
  }
  return { ...parsed.data, listenPort: parsed.data.API_PORT ?? parsed.data.PORT ?? 3000 };
}
