---
paths:
  - "justfile"
  - "mise.toml"
  - "scripts/**"
  - "tools/**"
  - ".github/**"
  - "docs/security/**"
  - "package.json"
  - "pnpm-workspace.yaml"
  - "pnpm-lock.yaml"
  - "turbo.json"
  - "tsconfig.base.json"
  - "eslint.config.mjs"
  - ".npmrc"
  - ".gitignore"
  - ".gitattributes"
  - ".editorconfig"
  - ".prettierrc"
  - ".prettierignore"
  - ".pre-commit-config.yaml"
  - "renovate.json"
  - "osv-scanner.toml"
  - ".gitleaks.toml"
  - "commitlint.config.mjs"
  - ".env.example"
---

# Tooling, CI, and the `just` gate

**Skill:** `tooling-ci`.

**Agent:** `tooling-engineer`, with these exceptions:
- `scripts/hooks/**` → no project agent (enforcement layer, `agent-authoring.md`).
- `tools/codegen/gen-swift.sh` → `ios-engineer`; `tools/codegen/gen-kotlin.sh` → `android-engineer`;
  `tools/codegen/gen-python.sh` → `ml-engineer`.
- `.github/workflows/**` and `.github/actions/**` → a human applies the exact diff that
  `tooling-engineer` writes into a new `.claude/plans/<yyyy-mm-dd>-<slug>-proposal.md` and names
  under Blockers in its report.
- `pnpm-lock.yaml` → no standing owner: it is single-writer and changes only through the install that a
  human-granted dependency task runs.

**Proof:** `just ci-parity` before a PR. Per change: `just lint` (shellcheck, actionlint),
`just lint --fixtures`, `just arch-check --fixtures`, `just docs-check --fixtures`; `just test secrets`
after a `scripts/security/**` change.

**Invariants that bite here:**
1. `scripts/**` and every recipe body run under macOS /bin/bash 3.2. `just lint` shellchecks with
   `-s bash`, which does not catch bash-4-only constructs (`declare -A`, `mapfile`, `${x,,}`); run the
   script under /bin/bash on a Mac — the `portability` workflow
   (`.github/workflows/portability.yml`) catches it in CI.
2. Workflows and composite actions call `just` recipes only, never a raw tool. Agents never edit them —
   the PreToolUse path guard `scripts/hooks/guard-protected-paths.sh` denies `.github/workflows/` and
   `.github/actions/`. DC-11 scans only `.agents/skills/**`, `.claude/agents/**` and
   `.claude/rules/**`, so a workflow step's commands are reviewer-checked.
3. Never weaken a gate: every `tools/depcruise/rules.cjs` rule stays `severity: 'error'`, and every
   fixture under `tools/*/fixtures/` keeps failing its rule; an exception needs an ADR —
   `just arch-check --fixtures`, `just lint --fixtures`, `just docs-check --fixtures`.
4. `tools/docs/fixtures/hooks/*.json` record each hook's expected decision; change an expectation only
   together with a hook change the human approved — `just docs-check --fixtures` replays them.
5. `tools/codegen/generate.sh` always runs every generator (there is no per-client mode), so
   `just generate` without `--check` rewrites every generated tree; only `contracts-engineer` runs it —
   the per-agent Bash guard's pattern list (`agent-authoring.md` invariant 2).
6. `mise.toml`, `pnpm-lock.yaml`, `.env.example` and CI config are single-writer (root `CLAUDE.md`
   "Parallel sessions"). `pnpm-lock.yaml` is never hand-edited — the path guard denies it, and
   `scripts/hooks/guard-bash.sh` denies `pnpm add`-style dependency changes.
