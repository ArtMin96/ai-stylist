// Forbidden log key words (planning/11 §8, planning/14 §2): the redaction denylist every logger
// applies as a backstop behind its allowlist, and the list the forbidden-field lint checks.
//
// Data lives in packages/shared-kernel/registry/forbidden-log-keys.json (schema beside it). Non-TS
// readers (the ESLint rule, the Python workers' drift test) read that JSON directly; TS code
// imports this constant. Never copy the words into a consumer.
import registry from '../registry/forbidden-log-keys.json' with { type: 'json' };

/** One lowercase word per entry; a key matches when any of its camel/snake/kebab words does. */
export const FORBIDDEN_LOG_KEYS: readonly string[] = Object.freeze([...registry.keys]);
