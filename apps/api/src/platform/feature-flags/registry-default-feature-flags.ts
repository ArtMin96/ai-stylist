// The `FeatureFlags` port (packages/shared-kernel/src/feature-flags.ts) without a provider: every
// flag answers its registry `defaultWhenUnavailable`. Bound when no PostHog key is configured
// (local runs, tests, CI), so nothing needs a PostHog project to boot.
import {
  FEATURE_FLAG_REGISTRY,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@ai-stylist/shared-kernel';

/** The part of the registry the adapters read: each flag's fallback value. */
export type FeatureFlagDefaults = {
  readonly [key: string]: Pick<FeatureFlagDefinition, 'defaultWhenUnavailable'> | undefined;
};

/** A `FeatureFlags` adapter the composition root also stops on shutdown. */
export type FeatureFlagsAdapter = FeatureFlags & {
  /** Release the provider client; idempotent. Later checks answer the registry defaults. */
  shutdown(): Promise<void>;
};

/** A key missing from the registry (only possible past the type system) is off: the safe state. */
export function registryDefault(defaults: FeatureFlagDefaults, key: string): boolean {
  return defaults[key]?.defaultWhenUnavailable ?? false;
}

export class RegistryDefaultFeatureFlags implements FeatureFlagsAdapter {
  constructor(private readonly defaults: FeatureFlagDefaults = FEATURE_FLAG_REGISTRY) {}

  isEnabled(key: FeatureFlagKey): Promise<boolean> {
    return Promise.resolve(registryDefault(this.defaults, key));
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
