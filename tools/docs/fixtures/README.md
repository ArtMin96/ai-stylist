# docs-check fixtures

`just docs-check --fixtures` proves the gate still catches its own defects: every `DC-NN/` tree
must fail with finding id `DC-NN`, and `_clean/` must pass every check under `--strict`
(catalog: the header of `scripts/docs/docs-check.sh`). `hooks/` holds Claude Code hook payloads
and is documented in `hooks/README.md`.

Directories that a real repo would name `.claude` or `.agents` are checked in as `dot-claude` and
`dot-agents`: Claude Code walks the working tree for `.claude/skills/*` and would otherwise load
fixture skills as real project skills. The `--fixtures` runner copies each fixture to a temp dir
and renames the `dot-` prefix back before running the checks, so the check functions themselves
never see the convention. Symlink targets inside a fixture still use the real `.agents`/`.claude`
names, because they are resolved only inside the staged copy.

Each staged case is `git init`ed, so a fixture's own `.gitignore` applies exactly as the real
repo's does: the recursive content scans skip gitignored files. `_clean/` carries a gitignored
agent worktree (`dot-claude/worktrees/probe/`) holding the same banned-vendor note that makes
`DC-13/` fail; `_clean/` must report nothing for it.

A case named `DC-NN-<variant>/` (e.g. `DC-03-shallow/`) is a second case for `DC-NN`. Two optional
marker files at a case root are read by the runner and removed from the staged copy:
`.shallow-clone` stages the case as a depth-1 clone of a two-commit repo (what
`actions/checkout` does without `fetch-depth: 0`), and `.expect-only` holds the exact `DC-NN`
finding lines the case must produce, nothing more. `DC-03-shallow/` uses both to prove DC-03
refuses a shallow clone with one clear error instead of a wrong per-module date finding.
