# Hook payload fixtures

Claude Code hook JSON payloads for `scripts/hooks/*.sh`. `just docs-check --fixtures` replays every
`*.json` file here through the script its row names and fails unless the decision equals the
**Expected** cell (`scripts/docs/lib/hook-fixtures.sh`). This table is the only source of expected
decisions; every payload needs exactly one row.

Field names (`hook_event_name`, `tool_name`, `tool_input.file_path`, `tool_input.notebook_path`,
`tool_input.command`, `cwd`, `scratchpad_dir`, `agent_type`, `stop_hook_active`,
`last_assistant_message`) follow https://code.claude.com/docs/en/hooks (checked 2026-09-25).

How a case runs:

- `/home/arthur/Projects/app` becomes a throwaway committed checkout (`.gitignore`, `PROGRESS.md`,
  `planning/PROGRESS.md`, `apps/api/src/app.ts`, `apps/android/app/build.gradle.kts`,
  `.claude/rules/r.md`), and `/home/arthur/scratchpad` a throwaway scratch directory.
- The optional top-level `_harness` key is read by the runner only: `args` (the hook's exec-form
  args, as an agent's frontmatter would pass them), `setup` (steps run first, in order: `start`
  records the SessionStart baseline; `edit-source`, `edit-progress`, `edit-rules`, `commit`,
  `worktree`, `edit-worktree-source`, `symlink`; see `hook_fixture_step`), and `nojq` (run the hook
  with a `PATH` that has no `jq`).
- Decision: `permissionDecision` (PreToolUse), `decision` (Stop), or `allow` when the hook prints
  nothing.

| Fixture                                | Script                     | Expected | Why                                                                                    |
| -------------------------------------- | -------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `protected-path.json`                  | `guard-protected-paths.sh` | deny     | edits root `CLAUDE.md` (protected path)                                                |
| `generated-file.json`                  | `guard-protected-paths.sh` | deny     | writes into `packages/contracts/gen/**` (generated output)                             |
| `lockfile.json`                        | `guard-protected-paths.sh` | deny     | edits `pnpm-lock.yaml` (single-writer lockfile)                                        |
| `test-outside-tests.json`              | `guard-protected-paths.sh` | deny     | a relative `*.test.ts` path outside the module's `tests/` dir                          |
| `swift-test-outside-tests.json`        | `guard-protected-paths.sh` | deny     | a `*Tests.swift` file outside `apps/ios/Packages/<Pkg>/tests/`                         |
| `kotlin-test-outside-src-test.json`    | `guard-protected-paths.sh` | deny     | a `*Test.kt` file outside the Gradle module's `src/test/`                              |
| `gradle-lockfile.json`                 | `guard-protected-paths.sh` | deny     | edits an `apps/android` `gradle.lockfile` (only `just android-deps-lock` writes them)  |
| `allowed-path.json`                    | `guard-protected-paths.sh` | allow    | an ordinary `internal/` module file (relative path)                                    |
| `path-relative-claude-md.json`         | `guard-protected-paths.sh` | deny     | a relative `CLAUDE.md` resolves against `cwd` and is still protected (HL-13)           |
| `path-shared-kernel-gen.json`          | `guard-protected-paths.sh` | deny     | writes into `packages/shared-kernel/src/gen/**` (generated, S5)                        |
| `path-github-action.json`              | `guard-protected-paths.sh` | deny     | edits the composite action `.github/actions/setup/action.yml` (human-applied, HL-9)    |
| `path-fixture-exempt.json`             | `guard-protected-paths.sh` | allow    | a gate fixture tree may hold a rule-breaking `CLAUDE.md` (HL-8)                        |
| `path-test-tsx.json`                   | `guard-protected-paths.sh` | deny     | a `*.test.tsx` file outside `tests/` (HL-14)                                           |
| `path-python-test-suffix.json`         | `guard-protected-paths.sh` | deny     | a `*_test.py` file outside `tests/` (HL-14)                                            |
| `path-swift-test-singular.json`        | `guard-protected-paths.sh` | deny     | a `*Test.swift` file outside `apps/ios/Packages/<Pkg>/tests/` (HL-14)                  |
| `path-kotlin-tests-plural.json`        | `guard-protected-paths.sh` | deny     | a `*Tests.kt` file in `src/main` (HL-14)                                               |
| `path-nojq.json`                       | `guard-protected-paths.sh` | deny     | no `jq` on PATH: fail closed (HL-7)                                                    |
| `bash-pnpm-add.json`                   | `guard-bash.sh`            | deny     | raw dependency-add invocation, not a `just` recipe                                     |
| `bash-gh-pr-merge.json`                | `guard-bash.sh`            | deny     | merges a PR without human review                                                       |
| `bash-play-publish.json`               | `guard-bash.sh`            | deny     | a Gradle Play-publish task (store upload is human-only)                                |
| `bash-allowed.json`                    | `guard-bash.sh`            | allow    | read-only `git status`                                                                 |
| `bash-pnpm-filter-add.json`            | `guard-bash.sh`            | deny     | `pnpm --filter <pkg> add` still rewrites the lockfile (HL-2)                           |
| `bash-pnpm-up.json`                    | `guard-bash.sh`            | deny     | `pnpm up` rewrites the lockfile (HL-2)                                                 |
| `bash-uv-project-add.json`             | `guard-bash.sh`            | deny     | `uv --project workers add` rewrites `workers/uv.lock` (HL-2)                           |
| `bash-uv-lock-upgrade.json`            | `guard-bash.sh`            | deny     | `uv lock --upgrade` rewrites `workers/uv.lock` (HL-2)                                  |
| `bash-git-gh-pr-merge.json`            | `guard-bash.sh`            | deny     | this repo's `git gh` wrapper form of a PR merge (HL-4)                                 |
| `bash-gh-api-method-delete.json`       | `guard-bash.sh`            | deny     | `--method=DELETE` through the GitHub API (HL-4)                                        |
| `bash-gh-api-merge.json`               | `guard-bash.sh`            | deny     | a merge through the REST API instead of `gh pr merge` (HL-4)                           |
| `bash-gh-repo-delete.json`             | `guard-bash.sh`            | deny     | deletes the repository (HL-4)                                                          |
| `bash-gh-secret-set.json`              | `guard-bash.sh`            | deny     | changes a repository secret (HL-4)                                                     |
| `bash-git-push-d.json`                 | `guard-bash.sh`            | deny     | `git push -d` deletes a remote branch                                                  |
| `bash-itms-transporter.json`           | `guard-bash.sh`            | deny     | uploads a build with iTMSTransporter (store upload, S-6)                               |
| `bash-fastlane-run-upload.json`        | `guard-bash.sh`            | deny     | `fastlane run upload_to_play_store` (store upload, S-6)                                |
| `bash-nojq.json`                       | `guard-bash.sh`            | deny     | no `jq` on PATH: fail closed (HL-7)                                                    |
| `write-set-inside.json`                | `guard-agent-write-set.sh` | allow    | a file inside the agent's write set                                                    |
| `write-set-outside.json`               | `guard-agent-write-set.sh` | deny     | a file outside the agent's write set                                                   |
| `write-set-excluded.json`              | `guard-agent-write-set.sh` | deny     | matches an include glob and a `!` exclude glob                                         |
| `write-set-relative.json`              | `guard-agent-write-set.sh` | allow    | a relative path under directories that do not exist yet                                |
| `write-set-relative-cwd.json`          | `guard-agent-write-set.sh` | allow    | a relative path resolves against the input `cwd`, not the project dir                  |
| `write-set-symlink.json`               | `guard-agent-write-set.sh` | deny     | a directory symlink inside the write set that points outside it                        |
| `write-set-dotdot.json`                | `guard-agent-write-set.sh` | deny     | a `..` segment is refused                                                              |
| `write-set-worktree.json`              | `guard-agent-write-set.sh` | allow    | a file in a linked worktree is judged relative to that worktree's top level            |
| `write-set-scratchpad.json`            | `guard-agent-write-set.sh` | allow    | a file under the session `scratchpad_dir`                                              |
| `write-set-outside-checkout.json`      | `guard-agent-write-set.sh` | deny     | a file outside every checkout and outside the scratchpad                               |
| `write-set-notebook.json`              | `guard-agent-write-set.sh` | deny     | `NotebookEdit` is judged by `notebook_path`                                            |
| `write-set-nojq.json`                  | `guard-agent-write-set.sh` | deny     | no `jq` on PATH: fail closed                                                           |
| `agent-bash-recipe.json`               | `guard-agent-bash.sh`      | allow    | a recipe in the agent's own patterns                                                   |
| `agent-bash-compound.json`             | `guard-agent-bash.sh`      | allow    | `cd` plus baseline commands; `a                                                        | b` inside quotes is one command |
| `agent-bash-env-prefix.json`           | `guard-agent-bash.sh`      | allow    | a leading `VAR=value` is stripped before matching                                      |
| `agent-bash-devnull.json`              | `guard-agent-bash.sh`      | allow    | redirection to `/dev/null` and fd duplication                                          |
| `agent-bash-not-listed.json`           | `guard-agent-bash.sh`      | deny     | a command outside the baseline and the patterns                                        |
| `agent-bash-compound-deny.json`        | `guard-agent-bash.sh`      | deny     | one denied simple command denies the whole compound                                    |
| `agent-bash-generate.json`             | `guard-agent-bash.sh`      | deny     | `just generate` without `--check` is not in the patterns                               |
| `agent-bash-subst.json`                | `guard-agent-bash.sh`      | deny     | unquoted command substitution                                                          |
| `agent-bash-subst-dquote.json`         | `guard-agent-bash.sh`      | deny     | command substitution inside double quotes still runs                                   |
| `agent-bash-backtick.json`             | `guard-agent-bash.sh`      | deny     | backtick command substitution                                                          |
| `agent-bash-procsub.json`              | `guard-agent-bash.sh`      | deny     | process substitution                                                                   |
| `agent-bash-redirect.json`             | `guard-agent-bash.sh`      | deny     | output redirection to a file                                                           |
| `agent-bash-find-delete.json`          | `guard-agent-bash.sh`      | deny     | `find -delete`                                                                         |
| `agent-bash-ansi-c-quote.json`         | `guard-agent-bash.sh`      | deny     | an escaped quote inside `$'...'` does not hide the `;`                                 |
| `agent-bash-comment-quote.json`        | `guard-agent-bash.sh`      | deny     | a quote inside a `#` comment does not hide the next line                               |
| `agent-bash-env-danger.json`           | `guard-agent-bash.sh`      | deny     | `BASH_ENV=` changes what a recipe's shell runs                                         |
| `agent-bash-git-output.json`           | `guard-agent-bash.sh`      | deny     | `git diff --output=<file>` writes a file through a baseline command                    |
| `agent-bash-database-url.json`         | `guard-agent-bash.sh`      | deny     | `DATABASE_URL=` repoints an allowed recipe at another database                         |
| `agent-bash-nojq.json`                 | `guard-agent-bash.sh`      | deny     | no `jq` on PATH: fail closed                                                           |
| `stop-dirty-no-progress.json`          | `session-close-check.sh`   | block    | no baseline recorded: a source change with no PROGRESS change                          |
| `stop-hook-active.json`                | `session-close-check.sh`   | allow    | `stop_hook_active: true` — must exit 0 immediately to avoid a hook loop                |
| `stop-baseline-source.json`            | `session-close-check.sh`   | block    | source changed after the SessionStart baseline                                         |
| `stop-baseline-source-progress.json`   | `session-close-check.sh`   | allow    | source and `PROGRESS.md` both changed after the baseline                               |
| `stop-baseline-predirty.json`          | `session-close-check.sh`   | allow    | files already dirty at session start, untouched since                                  |
| `stop-baseline-progress-predirty.json` | `session-close-check.sh`   | block    | `PROGRESS.md` was dirty before the session; this session only changed source (HL-10 d) |
| `stop-baseline-committed.json`         | `session-close-check.sh`   | block    | the session committed its source change (HL-10 c)                                      |
| `stop-baseline-rules-only.json`        | `session-close-check.sh`   | block    | only `.claude/rules/**` changed (watched, HL-10 b)                                     |
| `stop-cwd-subdir.json`                 | `session-close-check.sh`   | block    | Claude `cd`ed into a subdirectory (HL-10 a)                                            |
| `stop-worktree-suggested-line.json`    | `session-close-check.sh`   | allow    | linked worktree: the final message carries `Suggested PROGRESS.md line:` (W-5)         |
| `stop-worktree-no-line.json`           | `session-close-check.sh`   | block    | linked worktree, no suggested line and no PROGRESS change                              |
| `stop-nojq.json`                       | `session-close-check.sh`   | block    | no `jq` on PATH: block once (fail closed) without looping                              |
