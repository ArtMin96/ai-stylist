// Config used ONLY by tools/eslint/check-fixtures.sh: the root config minus the `ignores` entry
// that hides fixtures from workspace lint runs, and without type-checking (fixtures belong to no
// tsconfig project). Rules are otherwise identical to what every workspace runs.
import tseslint from 'typescript-eslint';

import { base, ignores } from '../../../eslint.config.mjs';

export default [
  ...base.filter((entry) => entry !== ignores),
  { files: ['**/*.ts'], ...tseslint.configs.disableTypeChecked },
];
