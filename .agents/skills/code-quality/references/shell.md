# Bash quality reference

Applies to: `.sh` files under `scripts/`, `tools/`, `apps/ios/scripts/` and `apps/android/tools/`, and
`justfile` recipe bodies. Never cite this file for Swift, Kotlin, TypeScript or Python.

**Gates (they run, so do not hand-check what they cover):** shellcheck as `just lint` runs it
(`-s bash -x -P SCRIPTDIR`, following sourced files); the `portability` CI workflow runs scripts under
macOS /bin/bash 3.2, which shellcheck does not emulate (`.claude/rules/tooling-ci.md` invariant 1).
Canonical siblings: `scripts/lint-file.sh`, `scripts/lib.sh`.

## Structure

- Shebang `#!/usr/bin/env bash`, then a header comment: what it does, the `just` recipe that calls it,
  usage, and exit codes, as `scripts/lint-file.sh` shows.
- `set -euo pipefail` at the top. Source shared helpers from `scripts/lib.sh` with a
  `# shellcheck source=` directive instead of copying functions.
- Wrap logic in functions with `local` variables; keep the top level to argument parsing and a call to
  `main "$@"` (or the sibling's equivalent).
- Validate arguments first: print a `usage:` line to stderr and exit 2 on misuse.

## Bash 3.2 portability (macOS)

- No associative arrays (`declare -A`), `mapfile`/`readarray`, `${var,,}`/`${var^^}`, `&>>`,
  negative array indices, or `wait -n`.
- Under `set -u`, expand a possibly-empty array as `${arr[@]+"${arr[@]}"}`.
- Use portable tool flags: no GNU-only `sed -i` without a suffix argument, `readlink -f`, `date -d`
  or `grep -P`; reuse the helpers in `scripts/lib.sh` and `scripts/docs/lib/common.sh` when they exist.

## Quoting and expansion

- Quote every expansion: `"$var"`, `"$@"`, `"$(cmd)"`. Use arrays for argument lists, never a
  space-joined string.
- `[[ … ]]` for tests, `(( … ))` for arithmetic, `$(…)` never backticks.
- `printf '%s\n'` for data; `echo` only for fixed messages.

## Errors and output

- Diagnostics go to stderr with the script name as prefix; stdout carries only the result.
- Exit codes mean something: 0 success, 1 a failed check, 2 misuse. Document them in the header.
- A missing optional toolchain prints a notice and exits 0 when the sibling scripts do; a missing
  required tool fails with an install hint (fail closed).
- Clean up temporary files with `mktemp` and a `trap … EXIT`.

## Readability

- Names in `snake_case`; environment and exported variables in `UPPER_SNAKE_CASE`.
- A pipeline longer than about three stages, or any parsing of structured data, becomes a function
  with a name, or uses `jq` for JSON.
- Comment why a non-obvious flag or workaround exists (usually a portability reason).

## Suppression syntax

`# shellcheck disable=SC<code>  # <reason>` on the line above the one command. Never a file-wide
disable, and never `SC2086` (unquoted expansion) to save quoting.

## Do not import from other languages

| Habit from                   | Leaks in as                                                           | Bash instead                                                        |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Python / TypeScript          | dictionaries via `declare -A`, string building for argument lists     | parallel indexed arrays or a `case`, real arrays for argv           |
| Any language with exceptions | expecting `set -e` to catch failures in pipelines and `if` conditions | `pipefail`, plus an explicit `\|\| { …; exit 1; }` where it matters |
| Linux-only scripting         | GNU flags, bash 4/5 features                                          | the bash 3.2 and BSD-tool subset above                              |
| Large programs               | 300-line scripts with business logic                                  | a TypeScript tool under `tools/` with tests                         |

## Checklist

Header with purpose, usage and exit codes · `set -euo pipefail` · shared helpers sourced, not copied ·
arguments validated · every expansion quoted, arrays for argv · bash 3.2 and BSD-tool safe ·
diagnostics on stderr, meaningful exit codes · temp files trapped · shellcheck clean without
suppressions.
