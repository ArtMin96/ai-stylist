// forbidden-field (planning/11 §8, planning/14 §2, brief §6, AC-2): sensitive fields never reach a
// log call. The pino redaction backstop is the last line, this lint is the first. Two checks on a
// call whose callee ends in `.info|.debug|.warn|.error|.trace|.fatal`:
//
//   1. member: a member expression named `body`, `headers` or `cookies` (e.g. `req.body`) passed
//      as an argument, directly, as an object property value or as a spread.
//   2. key: an object-literal key (shorthand `{ userEmail }` included), at any depth of the literal
//      payload (nested object and array literals), whose camel/snake/kebab words include a word from
//      packages/shared-kernel/registry/forbidden-log-keys.json (`.keys`). That JSON is the single
//      source of truth, read once here; never copy the words. Computed keys and spreads are not
//      inspected (their keys are unknown here); the redaction backstop still covers them.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LOG_METHODS = new Set(['info', 'debug', 'warn', 'error', 'trace', 'fatal']);
const FORBIDDEN_MEMBERS = new Set(['body', 'headers', 'cookies']);

const REGISTRY = path.resolve(
  import.meta.dirname,
  '../../../packages/shared-kernel/registry/forbidden-log-keys.json',
);

function loadForbiddenWords() {
  const { keys } = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  // A renamed field or an empty list would silently pass every log call: fail the lint run instead.
  if (!Array.isArray(keys) || keys.length === 0 || keys.some((k) => typeof k !== 'string' || !k)) {
    throw new Error(`no-log-request-body: ${REGISTRY} must hold a non-empty "keys" string array`);
  }
  return new Set(keys);
}

const FORBIDDEN_WORDS = loadForbiddenWords();

// Same word split as isForbiddenLogKey in apps/api/src/platform/logger.ts: runs of
// non-alphanumerics (snake_case, kebab-case) and lower→upper boundaries (camelCase).
const WORD_SPLIT = /[^a-zA-Z0-9]+|(?<=[a-z0-9])(?=[A-Z])/;

/** The forbidden word `key` contains, or null. */
function forbiddenWordIn(key) {
  const whole = key.toLowerCase();
  if (FORBIDDEN_WORDS.has(whole)) return whole;
  for (const part of key.split(WORD_SPLIT)) {
    const word = part.toLowerCase();
    if (word.length > 0 && FORBIDDEN_WORDS.has(word)) return word;
  }
  return null;
}

function isLogCall(callee) {
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    LOG_METHODS.has(callee.property.name)
  );
}

function forbiddenMember(node) {
  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return FORBIDDEN_MEMBERS.has(node.property.name) ? node.property.name : null;
  }
  return null;
}

/** Static name of a non-computed property key (`a`, `'a-b'`), else null. */
function keyName(prop) {
  if (prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'never log a request body/headers/cookies, or a payload key named with a forbidden log word',
    },
    schema: [],
    messages: {
      forbidden:
        'forbidden-field: `.{{field}}` must not be logged (11 §8); log an allowlisted, redacted view instead',
      forbiddenKey:
        'forbidden-field: log key `{{key}}` contains the forbidden word `{{word}}` (packages/shared-kernel/registry/forbidden-log-keys.json, 11 §8); drop it or log a non-sensitive field instead',
    },
  },
  create(context) {
    function checkMember(node) {
      const field = forbiddenMember(node);
      if (field !== null) context.report({ node, messageId: 'forbidden', data: { field } });
    }
    // Walks the literal payload only: object and array literals, never into calls or functions.
    function checkKeys(node) {
      if (node.type === 'ArrayExpression') {
        for (const element of node.elements) if (element) checkKeys(element);
        return;
      }
      if (node.type !== 'ObjectExpression') return;
      for (const prop of node.properties) {
        if (prop.type !== 'Property') continue;
        const key = keyName(prop);
        const word = key === null ? null : forbiddenWordIn(key);
        if (word !== null) {
          context.report({ node: prop.key, messageId: 'forbiddenKey', data: { key, word } });
        }
        checkKeys(prop.value);
      }
    }
    return {
      CallExpression(node) {
        if (!isLogCall(node.callee)) return;
        for (const arg of node.arguments) {
          checkMember(arg);
          if (arg.type === 'ObjectExpression') {
            for (const prop of arg.properties) {
              if (prop.type === 'Property') checkMember(prop.value);
              if (prop.type === 'SpreadElement') checkMember(prop.argument);
            }
          }
          checkKeys(arg);
        }
      },
    };
  },
};
