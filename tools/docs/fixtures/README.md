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
