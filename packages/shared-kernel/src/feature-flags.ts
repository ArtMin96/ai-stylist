// Feature-flag registry and port (planning/14 §11, NFR-OBS-080). Every flag declares an owner,
// purpose, kind, expiry, rollout plan, a safe off state and the value used when the provider is
// unavailable. Flags gate rollout and experiments only, never paid capability (entitlements do).
//
// Data lives in packages/shared-kernel/registry/feature-flags.json (schema beside it); the
// tests check the schema and the rules it cannot express (owner ∈ owners.json, rollout expiry
// ≤ 90 days). The PostHog adapter implementing `FeatureFlags` lives in `platform`, never here.
import registry from '../registry/feature-flags.json' with { type: 'json' };

import { type PersonId } from './owners.js';

export const FEATURE_FLAG_KINDS = ['rollout', 'experiment', 'kill-switch'] as const;
export type FeatureFlagKind = (typeof FEATURE_FLAG_KINDS)[number];

export type FeatureFlagDefinition = {
  /** Person id from the owners registry. */
  readonly owner: PersonId;
  readonly purpose: string;
  readonly kind: FeatureFlagKind;
  /** `YYYY-MM-DD`. */
  readonly createdAt: string;
  /** `YYYY-MM-DD`; required unless `kind` is `kill-switch` (≤ 90 days after `createdAt` for `rollout`). */
  readonly expiresAt?: string;
  readonly rolloutPlan: string;
  /** What "off" does; off must always be a safe rollback. */
  readonly offBehavior: string;
  /** Returned by the adapter when the provider is unconfigured or unreachable. */
  readonly defaultWhenUnavailable: boolean;
};

/** Union of the registered flag keys, e.g. `'demo-outbox-flow'`. */
export type FeatureFlagKey = keyof typeof registry.flags;

/**
 * Registry shape: `{ 'demo-outbox-flow': { owner: 'arthur-minasyan', kind: 'rollout', … } }`.
 * The JSON import types `kind` as `string`; the schema (validated in the tests) narrows it.
 */
export const FEATURE_FLAG_REGISTRY = registry.flags as {
  readonly [K in FeatureFlagKey]: FeatureFlagDefinition;
};

/** Port: is `key` on for this process? Falls back to `defaultWhenUnavailable`, never throws. */
export type FeatureFlags = {
  isEnabled(key: FeatureFlagKey): Promise<boolean>;
};

/** DI token. `Symbol.for`: two installed copies of the kernel resolve to the same token. */
export const FEATURE_FLAGS: unique symbol = Symbol.for('ai-stylist.feature-flags');
