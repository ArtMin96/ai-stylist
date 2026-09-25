// Conventional Commits (planning/15 §7). Enforced by the prek commit-msg hook.
//
// Scopes are free-form (no scope-enum): use the module or area touched, e.g. `closet`, `contracts`,
// `tooling`. The native apps use `ios` (apps/ios) and `android` (apps/android); a change to both
// apps uses `ios,android`. `mobile` belonged to the removed React Native app and is not used.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 200],
  },
};
