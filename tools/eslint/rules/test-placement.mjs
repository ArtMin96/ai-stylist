// test-placement (brief §5, planning/04 §4.3): test files live in a `tests/` directory owned by
// the module under test. A file-name check on `Program`; the file body is irrelevant.
//
// Exceptions (documented framework placements):
//   apps/mobile/e2e/**          Maestro flows (YAML + helpers)
//   apps/api/tests/**           API-level HTTP tests and the Testcontainers migration suite
//                               (apps/api/tests/migrations/**) — the "module" is the whole app
import path from 'node:path';

const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const EXCEPTIONS = [/^apps\/mobile\/e2e\//, /^apps\/api\/tests\//];

export function isMisplacedTest(relativePath) {
  const posix = relativePath.split(path.sep).join('/');
  if (!TEST_FILE.test(path.basename(posix))) return false;
  if (EXCEPTIONS.some((re) => re.test(posix))) return false;
  return !posix.split('/').slice(0, -1).includes('tests');
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'test files must live in a tests/ directory' },
    schema: [
      { type: 'object', properties: { root: { type: 'string' } }, additionalProperties: false },
    ],
    messages: {
      misplaced:
        'test-placement: "{{file}}" must live in a tests/ directory (exceptions: apps/mobile/e2e/**, apps/api/tests/**)',
    },
  },
  create(context) {
    const root = context.options[0]?.root ?? context.cwd;
    const relative = path.relative(root, context.filename);
    return {
      Program(node) {
        if (isMisplacedTest(relative)) {
          context.report({ node, messageId: 'misplaced', data: { file: relative } });
        }
      },
    };
  },
};
