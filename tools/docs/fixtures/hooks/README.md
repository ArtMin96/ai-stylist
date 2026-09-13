# Hook payload fixtures

Realistic Claude Code hook JSON payloads for `scripts/hooks/*.sh` (T3) to run against. Field
names (`hook_event_name`, `tool_name`, `tool_input.file_path`, `tool_input.command`,
`stop_hook_active`) match the documented hook input schema
(https://code.claude.com/docs/en/hooks) as of 2026-09; verify against current docs before
wiring, per root `CLAUDE.md` "fast-moving APIs".

| Fixture                       | Hook              | Expected decision | Why                                                                                                                                                                              |
| ----------------------------- | ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protected-path.json`         | PreToolUse        | deny              | edits root `CLAUDE.md` (protected path)                                                                                                                                          |
| `generated-file.json`         | PreToolUse        | deny              | writes into `packages/contracts/gen/**` (generated output)                                                                                                                       |
| `lockfile.json`               | PreToolUse        | deny              | edits `pnpm-lock.yaml` (single-writer lockfile)                                                                                                                                  |
| `test-outside-tests.json`     | PreToolUse        | deny              | a `*.test.ts` file outside the module's `tests/` dir                                                                                                                             |
| `allowed-path.json`           | PreToolUse        | allow             | an ordinary `internal/` module file                                                                                                                                              |
| `bash-pnpm-add.json`          | PreToolUse (Bash) | deny              | raw dependency-add invocation, not a `just` recipe                                                                                                                               |
| `bash-gh-pr-merge.json`       | PreToolUse (Bash) | deny              | merges a PR without human review                                                                                                                                                 |
| `bash-allowed.json`           | PreToolUse (Bash) | allow             | read-only `git status`                                                                                                                                                           |
| `stop-dirty-no-progress.json` | Stop              | block             | the harness must arrange a dirty working tree with no `PROGRESS.md` change before using this fixture; the JSON only supplies the standard Stop shape (`stop_hook_active: false`) |
| `stop-hook-active.json`       | Stop              | allow             | `stop_hook_active: true` — must exit 0 immediately to avoid a hook loop                                                                                                          |
