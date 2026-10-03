// Picks the `FeatureFlags` adapter from configuration (the composition root passes the validated
// `POSTHOG_API_KEY` / `POSTHOG_HOST`; this module never reads `process.env`). No key: the registry
// defaults, so local runs, tests and CI need no PostHog project.
import type { Logger } from 'pino';

import { PostHogFeatureFlags } from './posthog-feature-flags.js';
import {
  type FeatureFlagsAdapter,
  RegistryDefaultFeatureFlags,
} from './registry-default-feature-flags.js';

export type FeatureFlagsConfig = {
  /** `POSTHOG_API_KEY`: the project key `phc_…`. Empty or undefined: registry defaults. */
  readonly apiKey: string | undefined;
  /** `POSTHOG_HOST`, e.g. `https://us.i.posthog.com`. Required when `apiKey` is set. */
  readonly host: string | undefined;
  /** A pino logger built from `loggerOptions()`. */
  readonly logger: Logger;
};

/** `PostHogFeatureFlags` when a key is configured, else `RegistryDefaultFeatureFlags`. */
export function createFeatureFlags(config: FeatureFlagsConfig): FeatureFlagsAdapter {
  const apiKey = config.apiKey?.trim() ?? '';
  if (apiKey === '') {
    config.logger.info({ provider: 'registry-defaults' }, 'feature flags: no PostHog key');
    return new RegistryDefaultFeatureFlags();
  }
  const host = config.host?.trim() ?? '';
  if (host === '') {
    throw new TypeError('feature flags: POSTHOG_HOST is required when POSTHOG_API_KEY is set');
  }
  config.logger.info({ provider: 'posthog' }, 'feature flags: PostHog remote evaluation');
  return new PostHogFeatureFlags({ apiKey, host, logger: config.logger });
}
