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
};

export const ENTITLEMENTS = REGISTERED_ENTITLEMENTS satisfies Record<string, EntitlementDefinition>;

export type EntitlementName = keyof typeof ENTITLEMENTS;

/** Weighted generative tasks metered against `credits.monthly` (doc 12 §3.3). */
export { CREDIT_METERS };
export type CreditMeter = (typeof CREDIT_METERS)[number];
