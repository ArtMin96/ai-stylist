# tools/eslint — repo-wide lint rules

Loaded by the root `eslint.config.mjs`, so every workspace's `eslint .` (and `just lint`, which also
lints `tools/` at the root) runs them. `just lint --fixtures` runs `check-fixtures.sh`: each tree under
`fixtures/<case>/` must be reported by its named rule (`fixtures/eslint.config.mjs` is the root config
minus the ignore that hides fixtures from workspace runs). The same `--fixtures` run also proves the
analytics taxonomy check's fixtures (`tools/analytics/README.md`). Both run in `just ci-parity`.

| Rule (as reported)            | File                            | Severity | What it enforces                                                                                                                                        |
| ----------------------------- | ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boundaries/dependencies`     | `boundaries.mjs`                | error    | `public-api-only`, `modules-not-platform`, `platform-leaf`, `shared-kernel-pure`, `domain-no-provider-sdk` (each message starts with the rule name)     |
| `quality/test-placement`      | `rules/test-placement.mjs`      | error    | `*.test.*` / `*.spec.*` must sit under a `tests/` directory; exceptions `e2e/**`, `apps/api/tests/**` (HTTP tests + `tests/migrations/**`)              |
| `quality/no-log-request-body` | `rules/no-log-request-body.mjs` | error    | forbidden-field: in a `.info/.debug/.warn/.error/.trace/.fatal` call, no `x.body` / `x.headers` / `x.cookies` and no forbidden-word payload key (below) |
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
NFR-TEAM-050 says the number lives in planning doc 15, which records it (§7, "File-size review threshold",
DEC-40): 400 lines, warning only, tests and generated files exempt, reviewers enforce it.

## forbidden-field (`quality/no-log-request-body`)

Two checks on every call whose callee ends in `.info/.debug/.warn/.error/.trace/.fatal`:

- **member check**: a `x.body` / `x.headers` / `x.cookies` member passed directly, as an object
  property value or as a spread.
- **key check** (AC-2): an object-literal key, shorthand included (`{ userEmail }`), at any depth of
  the literal payload (nested object and array literals, never into calls or functions), whose
  camelCase / snake_case / kebab-case words include a word from
  `packages/shared-kernel/registry/forbidden-log-keys.json` (`.keys`). The rule reads that JSON once
  at load and fails the lint run if it is missing or malformed; never copy the words. The word split
  is the one `isForbiddenLogKey` in `apps/api/src/platform/logger.ts` uses, so `userEmail`,
  `refresh_token` and `set-cookie` match while `userId` and `imagination` do not. Computed keys and
  spreads are not inspected; the pino redaction backstop still covers them at runtime.

A test that plants forbidden keys on purpose (the redaction canary) disables the rule on each
planting line with `// eslint-disable-next-line quality/no-log-request-body -- <reason>`; there is
no file- or directory-wide exemption.

## Fixtures

| Case                  | Rule                                         |
| --------------------- | -------------------------------------------- |
| `stray-test`          | `quality/test-placement`                     |
| `skip-without-issue`  | `local/no-skip-without-issue`                |
| `file-size`           | `max-lines` (warning)                        |
| `log-request-body`    | `quality/no-log-request-body` (member check) |
| `log-forbidden-field` | `quality/no-log-request-body` (key check)    |

## RuleTester suites

`tests/*.test.mjs` are ESLint `RuleTester` suites run with `node --test` by the same
`check-fixtures.sh` (`just lint --fixtures`, so `just ci-parity` runs them). A failing suite fails the
run, and so does an empty `tests/` directory.

| Suite                                | What it proves                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/no-log-request-body.test.mjs` | every `forbidden` key in `packages/shared-kernel/registry/forbidden-log-keys.examples.json` is reported (quoted, plain, shorthand, nested and in an array payload) and every `allowed` key is not; the examples file is canonical, so the matcher follows it |
