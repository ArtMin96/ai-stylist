// Closed value sets of the profile contract (planning/06 §3.1; P03 phase §6; owner decisions
// 2026-10-13). Wire values are snake_case strings, except the size systems, which keep the region
// codes doc 08 §5 writes. Consumers import these lists; OpenAPI enums are tested against them.

/** How warm or cold the person usually feels (REQ-ONB-070). A skipped answer counts as `neutral`. */
export const CLIMATE_TOLERANCES = ['runs_cold', 'neutral', 'runs_hot'] as const;
export type ClimateTolerance = (typeof CLIMATE_TOLERANCES)[number];
export const DEFAULT_CLIMATE_TOLERANCE: ClimateTolerance = 'neutral';

/**
 * Presentation the person chooses (doc 07 §3.1, REQ-AVA-010); never inferred (doc 11 §17 rule 4)
 * and independent of the starting shape. No pronoun field exists (owner decision 2026-10-13).
 */
export const PRESENTATIONS = ['feminine', 'masculine', 'androgynous', 'unspecified'] as const;
export type Presentation = (typeof PRESENTATIONS)[number];
export const DEFAULT_PRESENTATION: Presentation = 'unspecified';

/** Preferred fit per garment group (doc 08 §4.2 `attr.cut` / `attr.silhouette`). */
export const FIT_CHOICES = ['fitted', 'regular', 'relaxed', 'oversized'] as const;
export type FitChoice = (typeof FIT_CHOICES)[number];

/**
 * Top-level garment groups (doc 08 §3 `cat.*`). Fit choices use the first four; `shoes` is used by
 * sizing only.
 */
export const GARMENT_GROUPS = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes'] as const;
export type GarmentGroup = (typeof GARMENT_GROUPS)[number];

/** Style types (doc 03 §1.2, doc 06 §3.1). */
export const STYLE_TYPES = ['minimal', 'classic', 'smart_casual'] as const;
export type StyleType = (typeof STYLE_TYPES)[number];

/** What a soft dislike or a hard exclusion refers to (doc 06 §3.1, doc 09 §3.1). */
export const PREFERENCE_KINDS = ['material'] as const;
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number];

/**
 * Materials (doc 08 §4.1 `attr.material`), for soft dislikes and hard exclusions alike. An early
 * slice of the closet taxonomy registry: it moves there when P06-T01 adopts it (OQ-37).
 */
export const MATERIALS = [
  'cotton',
  'linen',
  'wool',
  'cashmere',
  'silk',
  'denim',
  'leather',
  'suede',
  'synthetic',
  'blend',
  'knit',
  'down',
  'canvas',
  'metal',
  'other',
] as const;
export type Material = (typeof MATERIALS)[number];

/** Occasion presets offered at onboarding (doc 03 §1.7). */
export const OCCASION_PRESETS = ['work_day', 'dinner', 'travel', 'sport'] as const;
export type OccasionPreset = (typeof OCCASION_PRESETS)[number];

/** Label size systems (doc 08 §5); with a garment group they name a usual size (REQ-ONB-040). */
export const SIZE_SYSTEMS = ['EU', 'US', 'UK', 'ALPHA'] as const;
export type SizeSystem = (typeof SIZE_SYSTEMS)[number];
