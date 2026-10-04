// RuleTester suite for quality/no-log-request-body against the shared word-split examples
// (packages/shared-kernel/registry/forbidden-log-keys.examples.json): every `forbidden` example used
// as a log payload key must be reported, every `allowed` example must not. The examples file is the
// canonical test vector set every forbidden-key matcher checks (shared-kernel, logger, workers), so
// this rule's own word split cannot drift from it. Run by tools/eslint/check-fixtures.sh
// (`just lint --fixtures`) as `node --test`.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { RuleTester } from 'eslint';

import rule from '../rules/no-log-request-body.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

// Resolved through the package export, as the rule resolves its registry.
const EXAMPLES = createRequire(import.meta.url).resolve(
  '@ai-stylist/shared-kernel/registry/forbidden-log-keys.examples.json',
);
const { forbidden, allowed } = JSON.parse(readFileSync(EXAMPLES, 'utf8'));

// An empty or renamed list would make this suite pass vacuously.
for (const [name, list] of [
  ['forbidden', forbidden],
  ['allowed', allowed],
]) {
  if (!Array.isArray(list) || list.length === 0 || list.some((k) => typeof k !== 'string' || !k)) {
    throw new Error(`${EXAMPLES} must hold a non-empty "${name}" string array`);
  }
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Log calls that carry `key` as a payload key: quoted, plain and shorthand where it is an identifier, and nested. */
function payloads(key) {
  const quoted = JSON.stringify(key);
  const codes = [
    `logger.info({ ${quoted}: 1 });`,
    `log.warn('msg', { meta: { ${quoted}: 1 } });`,
    `logger.error({ items: [{ ${quoted}: 1 }] });`,
  ];
  if (IDENTIFIER.test(key)) {
    codes.push(`logger.debug({ ${key}: 1 });`, `const ${key} = 1; logger.trace({ ${key} });`);
  }
  return codes;
}

// Exactly one forbiddenKey report per payload: the key check fires once, on the planted key. The
// reported word is not asserted, so this suite never restates the matcher it is checking.
new RuleTester().run('no-log-request-body (forbidden-log-keys.examples.json)', rule, {
  valid: allowed.flatMap((key) => payloads(key)),
  invalid: forbidden.flatMap((key) =>
    payloads(key).map((code) => ({ code, errors: [{ messageId: 'forbiddenKey' }] })),
  ),
});
