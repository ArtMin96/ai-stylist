// Recommendation reason-code registry (planning/09 §7): stable identifiers emitted by rules and
// scorers *while deciding*; explanations are templated from these afterwards, never invented.
//
// Namespaces are fixed by doc 09 §7. Concrete codes land per rule/scorer in P09 (recommendation
// engine); adding a code is a versioned shared-kernel change with a test and a template.

export const REASON_CODE_NAMESPACES = [
  'RC-EXCL', // hard exclusions (stage 3)
  'RC-WEATHER',
  'RC-OCCASION',
  'RC-COLOR',
  'RC-FIT',
  'RC-REPEAT',
  'RC-RARELY-WORN',
  'RC-PREF',
  'RC-TREND',
  'RC-GAP', // sparse closet
  'RC-CTX-MISSING',
  'RC-STALE',
] as const;

export type ReasonCodeNamespace = (typeof REASON_CODE_NAMESPACES)[number];

/** Stage of the pipeline (doc 09 §2) that may emit the code. */
export type ReasonCodeStage = 'exclusion' | 'scoring' | 'diagnostic';

export type ReasonCodeDefinition = {
  readonly namespace: ReasonCodeNamespace;
  readonly stage: ReasonCodeStage;
  /** Names of the typed template params (doc 09 §7), e.g. `['threshold', 'feelsLike']`. */
  readonly params: readonly string[];
  readonly description: string;
};

/**
 * Registry shape: `{ 'RC-EXCL-COLD-SAFETY': { namespace: 'RC-EXCL', stage: 'exclusion', … } }`.
 * Only the doc-09 worked example is registered in P02; the full set arrives with P09.
 */
export const REASON_CODES = {
  'RC-EXCL-COLD-SAFETY': {
    namespace: 'RC-EXCL',
    stage: 'exclusion',
    params: ['threshold', 'feelsLike'],
    description: 'Excluded: feels-like temperature is below the safety threshold for this coverage',
  },
} as const satisfies Record<`${ReasonCodeNamespace}${string}`, ReasonCodeDefinition>;

export type ReasonCode = keyof typeof REASON_CODES;
