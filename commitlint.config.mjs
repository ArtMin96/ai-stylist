// Conventional Commits (planning/15 §7). Enforced by the prek commit-msg hook.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 200],
  },
};
