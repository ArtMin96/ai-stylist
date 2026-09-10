// forbidden-field (planning/11 §8, brief §6): request bodies, headers and cookies carry
// credentials, selfies, measurements and tokens. They never reach a log call — the pino
// redaction allowlist is the last line, this lint is the first.
//
// Flags a member expression named `body`, `headers` or `cookies` (e.g. `req.body`,
// `request.headers`) passed as an argument — directly or as an object property value — to a call
// whose callee ends in `.info|.debug|.warn|.error|.trace|.fatal`.
const LOG_METHODS = new Set(['info', 'debug', 'warn', 'error', 'trace', 'fatal']);
const FORBIDDEN = new Set(['body', 'headers', 'cookies']);

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
    return FORBIDDEN.has(node.property.name) ? node.property.name : null;
  }
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'never pass a request body/headers/cookies to a logger' },
    schema: [],
    messages: {
      forbidden:
        'forbidden-field: `.{{field}}` must not be logged (11 §8); log an allowlisted, redacted view instead',
    },
  },
  create(context) {
    function check(node) {
      const field = forbiddenMember(node);
      if (field !== null) context.report({ node, messageId: 'forbidden', data: { field } });
    }
    return {
      CallExpression(node) {
        if (!isLogCall(node.callee)) return;
        for (const arg of node.arguments) {
          check(arg);
          if (arg.type === 'ObjectExpression') {
            for (const prop of arg.properties) {
              if (prop.type === 'Property') check(prop.value);
              if (prop.type === 'SpreadElement') check(prop.argument);
            }
          }
        }
      },
    };
  },
};
