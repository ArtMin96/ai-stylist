# tools/eslint — repo-wide lint rules

Loaded by the root `eslint.config.mjs`, so every workspace's `eslint .` (and `just lint`, which also
lints `tools/` at the root) runs them. `just lint --fixtures` runs `check-fixtures.sh`: each tree under
`fixtures/<case>/` must be reported by its named rule (`fixtures/eslint.config.mjs` is the root config
minus the ignore that hides fixtures from workspace runs). Both run in `just ci-parity`.

| Rule (as reported)            | File                            | Severity | What it enforces                                                                                                                                        |
| ----------------------------- | ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boundaries/dependencies`     | `boundaries.mjs`                | error    | `public-api-only`, `modules-not-platform`, `platform-leaf`, `shared-kernel-pure`, `domain-no-provider-sdk` (each message starts with the rule name)     |
| `quality/test-placement`      | `rules/test-placement.mjs`      | error    | `*.test.*` / `*.spec.*` must sit under a `tests/` directory; exceptions `e2e/**`, `apps/api/tests/**` (HTTP tests + `tests/migrations/**`)              |
| `quality/no-log-request-body` | `rules/no-log-request-body.mjs` | error    | forbidden-field: `x.body` / `x.headers` / `x.cookies` never passed (directly or as an object value) to a `.info/.debug/.warn/.error/.trace/.fatal` call |
| `no-console`                  | `quality.mjs`                   | error    | everywhere in `apps/**`, `packages/**`, `tools/**` except `**/scripts/**`, `tools/codegen/**` and generated code — log through pino (API)               |
| `max-lines`                   | `quality.mjs`                   | **warn** | file-size: a source file above **400 lines** (blank lines and comments count); tests, `e2e/`, generated dirs and fixtures are exempt                    |
| `local/no-skip-without-issue` | root `eslint.config.mjs`        | error    | `it.skip` / `test.skip` / `describe.skip` / `xit` / `xtest` / `xdescribe` need an issue ID (`#123`, `APP-42`) in the title                              |

## Boundaries element types

`module` (`apps/api/src/modules/<name>`), `module-internal` (`.../<name>/internal`), `platform`,
`job-handler` (`apps/api/src/jobs`), `dev` (`apps/api/src/dev`), `shared-kernel`, `contracts`;
`composition-root` is a file category (`app.module.ts`, `main.ts`) because eslint-plugin-boundaries v7 classifies single files through `boundaries/files`. ESLint gives
inline feedback; `tools/depcruise` is the whole-graph gate and carries the full rule set.

## File-size threshold

The threshold is **400 lines** (`FILE_SIZE_MAX_LINES` in `quality.mjs`), warn-only per brief §8 row 8.
NFR-TEAM-050 says the number lives in planning doc 15 — doc 15 does not record it yet; a human must add
"400 lines (warn)" to doc 15 (`planning/` is not edited by agents).

## Fixtures

| Case                 | Rule                          |
| -------------------- | ----------------------------- |
| `stray-test`         | `quality/test-placement`      |
| `skip-without-issue` | `local/no-skip-without-issue` |
| `file-size`          | `max-lines` (warning)         |
| `log-request-body`   | `quality/no-log-request-body` |
