// Mobile runtime configuration from `EXPO_PUBLIC_*` variables (.env.example "Mobile / Expo").
// Expo inlines `process.env.EXPO_PUBLIC_*` only for literal member accesses, so the reads live in
// `readPublicEnv()`; `parseConfig()` is the pure validator (tests in ./tests/config.test.ts).

export type MobileConfig = {
  /** Absolute base URL of the API the generated client talks to (no trailing slash). */
  readonly apiBaseUrl: string;
  /** EAS project id once `eas init` has run; absent locally. */
  readonly easProjectId: string | undefined;
  /** App version from the Expo config (`version` in app.config.ts), for analytics properties. */
  readonly appVersion: string;
};

export type RawPublicEnv = {
  readonly EXPO_PUBLIC_API_BASE_URL: string | undefined;
  readonly EXPO_PUBLIC_EAS_PROJECT_ID: string | undefined;
  /** Not an env var: injected by the composition root from `expo-constants`. */
  readonly appVersion: string | undefined;
};

/** Local dev default: the API listens on API_PORT=3000 (`just dev-api`). */
export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/** Validate raw env into a typed config; throws `ConfigError` naming the offending key. */
export function parseConfig(raw: RawPublicEnv): MobileConfig {
  const apiBaseUrl = blankToUndefined(raw.EXPO_PUBLIC_API_BASE_URL) ?? DEFAULT_API_BASE_URL;
  if (!isHttpUrl(apiBaseUrl)) {
    throw new ConfigError(`EXPO_PUBLIC_API_BASE_URL must be an absolute http(s) URL`);
  }
  return {
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
    easProjectId: blankToUndefined(raw.EXPO_PUBLIC_EAS_PROJECT_ID),
    appVersion: blankToUndefined(raw.appVersion) ?? '0.0.0',
  };
}

/** Literal reads so Expo's bundler can inline the values. */
export function readPublicEnv(appVersion: string | undefined): RawPublicEnv {
  return {
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    appVersion,
  };
}
