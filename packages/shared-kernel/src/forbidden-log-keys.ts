// Forbidden log key words (planning/11 §8, planning/14 §2): the redaction denylist every logger
// applies as a backstop behind its allowlist, and the list the forbidden-field lint checks.
//
// Data lives in packages/shared-kernel/registry/forbidden-log-keys.json (schema beside it). Non-TS
// readers (the ESLint rule, the Python workers' drift test) read that JSON directly; TS code
// imports this constant. Never copy the words into a consumer.
//
// registry/forbidden-log-keys.examples.json holds the word-split examples every matcher's tests
// check: `forbidden` keys must match, `allowed` keys must not. TS tests import
// FORBIDDEN_LOG_KEY_EXAMPLES; non-TS tests read the JSON.
import examples from '../registry/forbidden-log-keys.examples.json' with { type: 'json' };
import registry from '../registry/forbidden-log-keys.json' with { type: 'json' };

/** One lowercase word per entry; a key matches when any of its camel/snake/kebab words does. */
export const FORBIDDEN_LOG_KEYS: readonly string[] = Object.freeze([...registry.keys]);

export type ForbiddenLogKeyExamples = {
  /** Log keys a matcher MUST treat as forbidden (camel, snake, kebab and UPPER variants). */
  readonly forbidden: readonly string[];
  /** Log keys a matcher must NOT treat as forbidden (required ids and near-misses). */
  readonly allowed: readonly string[];
};

/** Test vectors for every forbidden-key matcher; data only, no matching rule lives here. */
export const FORBIDDEN_LOG_KEY_EXAMPLES: ForbiddenLogKeyExamples = Object.freeze({
  forbidden: Object.freeze([...examples.forbidden]),
  allowed: Object.freeze([...examples.allowed]),
});
