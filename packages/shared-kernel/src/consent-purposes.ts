// Consent purposes (planning/11 §7.2; P03 phase §10): one consent per purpose, never bundled. The
// `identity` consent registry records grants and withdrawals per purpose; `calendar` (doc 11 §7.2,
// future P15) is not added until its feature ships.

/** Per-purpose consent keys, in doc 11 §7.2 order. */
export const CONSENT_PURPOSES = [
  'core_service',
  'face_processing',
  'location_precise',
  'analytics',
  'ai_generative',
  'notifications',
  'training_data',
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
