# docs-check fixtures

`just docs-check --fixtures` proves the gate still catches its own defects: every `DC-NN/` tree
must fail with finding id `DC-NN`, and `_clean/` must pass every check under `--strict`
(catalog: the header of `scripts/docs/docs-check.sh`). `hooks/` holds Claude Code hook payloads
that the same run replays through `scripts/hooks/*.sh`; see `hooks/README.md`. The run also
checks that a PATH-scoped `docs-check` over the repo's whole `.agents/` directory ends in a verdict
rather than a signal (macOS `/bin/bash` 3.2 once died there with SIGTRAP), and that no loop in
`scripts/docs/` is fed by process substitution.

The run is pinned to one date, `DOCS_CHECK_FIXTURE_DATE` in `scripts/docs/docs-check.sh`: it is
"today" for the review-age checks (DC-05, DC-07), and every staged case is committed at it, so
DC-03 dates a fixture's module code by that commit. Fixture dates therefore never rot.

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

A case named `DC-NN-<variant>/` (e.g. `DC-03-shallow/`) is a second case for `DC-NN`; each sub-rule
of DC-05 and DC-07 has one (`DC-05-owner-agent/`, `DC-05-evals/`, `DC-07-color/`, `DC-07-tools/`,
`DC-07-hooks/`, `DC-07-skills/`), pinned by `.expect-only` so it proves that sub-rule alone. Two optional
marker files at a case root are read by the runner and removed from the staged copy:
`.shallow-clone` stages the case as a depth-1 clone of a two-commit repo (what
`actions/checkout` does without `fetch-depth: 0`), and `.expect-only` holds the exact `DC-NN`
finding lines the case must produce, nothing more. `DC-03-shallow/` uses both to prove DC-03
refuses a shallow clone with one clear error instead of a wrong per-module date finding.
