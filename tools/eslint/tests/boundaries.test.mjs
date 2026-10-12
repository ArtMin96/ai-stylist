// Proves that `boundaries/dependencies` (tools/eslint/boundaries.mjs) still reports and that its
// templates still render. eslint-plugin-boundaries renders each policy `message` and each
// `captured` selector with handlebars, a dependency that pnpm-workspace.yaml overrides
// (docs/security/dependency-ignores.md). A workspace lint run cannot show either: a clean tree has
// no violation to report. There is no fixture tree, because the plugin ignores `**/fixtures/**` and
// its element patterns start at the repo root. Each case lints source text as a file that does not
// exist, under a real module directory, importing files that do exist. Run by
// tools/eslint/check-fixtures.sh (`just lint --fixtures`) as `node --test`.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ESLint } from 'eslint';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const RULE = 'boundaries/dependencies';
const PROBE = 'apps/api/src/modules/closet/boundary-probe.ts';

// The plugin classifies an import by the file it resolves to. If a target is gone, the import
// belongs to no element, nothing is reported, and the last case passes without checking anything.
const IMPORTED_FILES = [
  'apps/api/src/platform/index.ts',
  'apps/api/src/modules/profile/internal/README.md',
  'apps/api/src/modules/closet/internal/README.md',
];
for (const file of IMPORTED_FILES) {
  if (!existsSync(path.join(REPO_ROOT, file))) {
    throw new Error(`${file} is gone: import another file of that directory in this suite`);
  }
}

// The fixture config is the root config without type-checking: the probe is in no tsconfig project.
const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfigFile: path.join(REPO_ROOT, 'tools/eslint/fixtures/eslint.config.mjs'),
});

/** Every finding for `code` linted as the probe file, as `<rule id>: <message>`. */
async function findings(code) {
  const [result] = await eslint.lintText(code, { filePath: path.join(REPO_ROOT, PROBE) });
  return result.messages.map((finding) => `${finding.ruleId}: ${finding.message}`);
}

describe('boundaries/dependencies', () => {
  it('names the importing module when a module imports platform', async () => {
    assert.deepEqual(await findings("import '../../platform/index.js';\n"), [
      `${RULE}: modules-not-platform: module "closet" must depend on a port, not on apps/api/src/platform (04 §4.2 rule 5)`,
    ]);
  });

  it('names the package when a module imports a provider SDK', async () => {
    assert.deepEqual(await findings("import 'pg-boss';\n"), [
      `${RULE}: domain-no-provider-sdk: "pg-boss" is a provider SDK; declare a port and implement it in platform (04 §4.2 rule 4)`,
    ]);
  });

  // The `captured` selector `!{{ from.element.captured.module }}` separates these two cases.
  it("names both modules when a module imports another module's internal directory", async () => {
    assert.deepEqual(await findings("import '../profile/internal/README.md';\n"), [
      `${RULE}: public-api-only: module "closet" may import "profile" only through its index.ts (04 §4.2 rule 1)`,
    ]);
  });

  it('accepts a module importing its own internal directory', async () => {
    assert.deepEqual(await findings("import './internal/README.md';\n"), []);
  });
});
