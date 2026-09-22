# Hook payload fixtures

Realistic Claude Code hook JSON payloads for `scripts/hooks/*.sh` (T3) to run against. Field
names (`hook_event_name`, `tool_name`, `tool_input.file_path`, `tool_input.command`,
`stop_hook_active`) match the documented hook input schema
(https://code.claude.com/docs/en/hooks) as of 2026-09; verify against current docs before
wiring, per root `CLAUDE.md` "fast-moving APIs".

| Fixture                             | Hook              | Expected decision | Why                                                                                                                                                                              |
| ----------------------------------- | ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protected-path.json`               | PreToolUse        | deny              | edits root `CLAUDE.md` (protected path)                                                                                                                                          |
| `generated-file.json`               | PreToolUse        | deny              | writes into `packages/contracts/gen/**` (generated output)                                                                                                                       |
| `lockfile.json`                     | PreToolUse        | deny              | edits `pnpm-lock.yaml` (single-writer lockfile)                                                                                                                                  |
| `test-outside-tests.json`           | PreToolUse        | deny              | a `*.test.ts` file outside the module's `tests/` dir                                                                                                                             |
| `swift-test-outside-tests.json`     | PreToolUse        | deny              | a `*Tests.swift` file outside `apps/ios/Packages/<Pkg>/tests/`                                                                                                                   |
| `kotlin-test-outside-src-test.json` | PreToolUse        | deny              | a `*Test.kt` file outside the Gradle module's `src/test/`                                                                                                                        |
| `gradle-lockfile.json`              | PreToolUse        | deny              | edits an `apps/android` `gradle.lockfile` (only `just android-deps-lock` writes them)                                                                                            |
| `allowed-path.json`                 | PreToolUse        | allow             | an ordinary `internal/` module file                                                                                                                                              |
| `bash-pnpm-add.json`                | PreToolUse (Bash) | deny              | raw dependency-add invocation, not a `just` recipe                                                                                                                               |
| `bash-gh-pr-merge.json`             | PreToolUse (Bash) | deny              | merges a PR without human review                                                                                                                                                 |
| `bash-play-publish.json`            | PreToolUse (Bash) | deny              | a Gradle Play-publish task (store upload is human-only)                                                                                                                          |
| `bash-allowed.json`                 | PreToolUse (Bash) | allow             | read-only `git status`                                                                                                                                                           |
| `stop-dirty-no-progress.json`       | Stop              | block             | the harness must arrange a dirty working tree with no `PROGRESS.md` change before using this fixture; the JSON only supplies the standard Stop shape (`stop_hook_active: false`) |
| `stop-hook-active.json`             | Stop              | allow             | `stop_hook_active: true` — must exit 0 immediately to avoid a hook loop                                                                                                          |
