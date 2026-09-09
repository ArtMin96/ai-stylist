// Entitlement name registry (planning/12 §3.1): the only entitlement identifiers. Semantics,
// plan matrix and enforcement points are owned by doc 12; the server-side `billing.entitlements`
// table is the runtime source of truth. Mobile, API, workers and admin import these — never copy.

export type EntitlementValueKind = 'boolean' | 'limit' | 'level' | 'map';

export type EntitlementDefinition = {
  readonly kind: EntitlementValueKind;
  readonly description: string;
};

export const ENTITLEMENTS = {
  'closet.max_items': { kind: 'limit', description: 'Maximum closet items (null = unlimited)' },
  'recs.daily_limit': { kind: 'limit', description: 'Recommendations per local day' },
  'recs.context.full': {
    kind: 'boolean',
    description: 'Full context richness (hourly weather, holidays, all occasions)',
  },
  'recs.future_planning': { kind: 'boolean', description: 'Future-day outfit planning' },
  'avatar.level': { kind: 'level', description: 'Avatar ladder level (A1, A1 + all poses)' },
  'tryon.generative': {
    kind: 'level',
    description: 'Outfit view generation ladder level (G0, G2)',
  },
  'views.missing_view': { kind: 'boolean', description: 'Missing-view synthesis' },
  'credits.monthly': { kind: 'limit', description: 'Generative credits granted per month' },
  'credits.topup': { kind: 'boolean', description: 'Credit top-up packs purchasable' },
  'credits.weights': {
    kind: 'map',
    description: 'Versioned credit weights per generative task, carried on the plan',
  },
  'trends.level': { kind: 'level', description: 'Trends feed level (basic, personalized)' },
  'analytics.wardrobe': { kind: 'boolean', description: 'Wardrobe analytics' },
  'processing.priority': { kind: 'boolean', description: 'Priority queue processing' },
  'export.multi_angle': { kind: 'boolean', description: 'Multi-angle exports' },
  'features.early_access': { kind: 'boolean', description: 'Early-access features' },
  'chat.stylist': { kind: 'boolean', description: 'Assistant chat (future)' },
  'data.export': { kind: 'boolean', description: 'Personal data export' },
} as const satisfies Record<string, EntitlementDefinition>;

export type EntitlementName = keyof typeof ENTITLEMENTS;

/** Weighted generative tasks metered against `credits.monthly` (doc 12 §3.3). */
export const CREDIT_METERS = ['tryon', 'missing_view'] as const;
export type CreditMeter = (typeof CREDIT_METERS)[number];
