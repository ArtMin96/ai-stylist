// Recommendation reason-code registry (planning/09 §7): stable identifiers emitted by rules and
// scorers *while deciding*; explanations are templated from these afterwards, never invented.
//
// Namespaces are fixed by doc 09 §7. Concrete codes land per rule/scorer in P09 (recommendation
// engine); adding a code is a versioned shared-kernel change with a test and a template.
//
// Data lives in packages/shared-kernel/registry/reason-codes.json (the single source for TS, Swift
// and Kotlin, OQ-15); `just generate` writes ./gen/reason-codes.ts. This file owns the types and
// the `satisfies` check.
import {
  REASON_CODES as REGISTERED_REASON_CODES,
  REASON_CODE_NAMESPACES,
  type REASON_CODE_STAGES,
} from './gen/reason-codes.js';

export { REASON_CODE_NAMESPACES };

export type ReasonCodeNamespace = (typeof REASON_CODE_NAMESPACES)[number];

/** Stage of the pipeline (doc 09 §2) that may emit the code. */
export type ReasonCodeStage = (typeof REASON_CODE_STAGES)[number];

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
export const REASON_CODES = REGISTERED_REASON_CODES satisfies Record<
  `${ReasonCodeNamespace}${string}`,
  ReasonCodeDefinition
>;

export type ReasonCode = keyof typeof REASON_CODES;
