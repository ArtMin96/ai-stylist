// Entitlement name registry (planning/12 §3.1): the only entitlement identifiers. Semantics,
// plan matrix and enforcement points are owned by doc 12; the server-side `billing.entitlements`
// table is the runtime source of truth. Mobile, API, workers and admin import these — never copy.
//
// Data lives in packages/shared-kernel/registry/entitlements.json (the single source for TS, Swift
// and Kotlin, OQ-15); `just generate` writes ./gen/entitlements.ts. This file owns the types and
// the `satisfies` check.
import {
  CREDIT_METERS,
  ENTITLEMENTS as REGISTERED_ENTITLEMENTS,
  type ENTITLEMENT_VALUE_KINDS,
} from './gen/entitlements.js';

export type EntitlementValueKind = (typeof ENTITLEMENT_VALUE_KINDS)[number];

export type EntitlementDefinition = {
  readonly kind: EntitlementValueKind;
  readonly description: string;
  /** `level` kind only: its levels, lowest first. */
  readonly levels?: readonly string[];
};

export const ENTITLEMENTS = REGISTERED_ENTITLEMENTS satisfies Record<string, EntitlementDefinition>;

export type EntitlementName = keyof typeof ENTITLEMENTS;

/** The entitlements whose value is a level (`avatar.level`, `tryon.generative`, `trends.level`). */
export type LevelEntitlementName = {
  [N in EntitlementName]: (typeof ENTITLEMENTS)[N] extends { readonly kind: 'level' } ? N : never;
}[EntitlementName];

/** One level of the level entitlement `N`, e.g. `'G0' | 'G2'` for `tryon.generative`. */
export type EntitlementLevel<N extends LevelEntitlementName> =
  (typeof ENTITLEMENTS)[N]['levels'][number];

/**
 * Orders two levels of one entitlement by the registry, which lists them lowest first: negative
 * when `a` is below `b`, 0 when they are equal, positive when `a` is above. The resolver keeps the
 * highest level any active grant gives (most generous wins, doc 12 §3.2).
 */
export function compareEntitlementLevels<N extends LevelEntitlementName>(
  name: N,
  a: EntitlementLevel<N>,
  b: EntitlementLevel<N>,
): number {
  const levels: readonly string[] = ENTITLEMENTS[name].levels;
  return levels.indexOf(a) - levels.indexOf(b);
}

/**
 * Kinds of entitlement grant the resolver reads (doc 12 §3.2), reported as `source` by
 * `GET /v1/me/entitlements`. The P03 trial is a `trial_grant` (doc 12 §2) and its rows stay valid
 * for P13, so a kind is never renamed or removed.
 */
export const ENTITLEMENT_GRANT_KINDS = [
  'plan_grant',
  'trial_grant',
  'promo_grant',
  'grandfather_grant',
] as const;
export type EntitlementGrantKind = (typeof ENTITLEMENT_GRANT_KINDS)[number];

/** Lifecycle states of a user's entitlements (doc 03 §4.3), reported as `state`. */
export const ENTITLEMENT_LIFECYCLE_STATES = [
  'trial',
  'free',
  'active_paid',
  'grace',
  'cancelled_active',
] as const;
export type EntitlementLifecycleState = (typeof ENTITLEMENT_LIFECYCLE_STATES)[number];

/** Weighted generative tasks metered against `credits.monthly` (doc 12 §3.3). */
export { CREDIT_METERS };
export type CreditMeter = (typeof CREDIT_METERS)[number];
