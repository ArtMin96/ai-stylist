# Proposal: root `CLAUDE.md` updates (human-authorized only)

**Task:** T20 of `.claude/plans/s3-agent-operating-foundation.md`. No commit in this plan edits
`CLAUDE.md` directly — it is human-only per its own "Prohibited without explicit human authorization"
section and the `guard-protected-paths.sh` PreToolUse hook. This file is the proposal; a human applies it.

**Grounding:** `bash scripts/docs/docs-check.sh --strict`, run against the branch built by waves 1–3 of
`s3-agent-operating-foundation.md`. Full output is reproduced per finding below. DC-14 is WARN-only by
default and becomes an ERROR under `--strict` (`scripts/docs/lib/checks-repo.sh` `check_dc14`) — exactly
the two gates this plan leaves human-gated (see that plan's "Risks & decisions").

Every before-block below was checked byte-for-byte against the current file
(`grep -Fxq -- '<line>' CLAUDE.md`, one call per quoted line) before being written here.

---

## Why

`docs-check --strict` reports 4 DC-14 errors — the repository grew four top-level directories
(`artifacts/`, `node_modules/`, `prototype/`, `secrets/`) that the "Repository layout" block never
mentions:

```
ERROR DC-14 CLAUDE.md:1 top-level directory 'artifacts/' is not mentioned in the layout block
ERROR DC-14 CLAUDE.md:1 top-level directory 'node_modules/' is not mentioned in the layout block
ERROR DC-14 CLAUDE.md:1 top-level directory 'prototype/' is not mentioned in the layout block
ERROR DC-14 CLAUDE.md:1 top-level directory 'secrets/' is not mentioned in the layout block
```

`check_dc14` only walks non-dot top-level directories, so it cannot see that this plan also added
several *nested* orientation-relevant paths that a new session has no way to discover from the block as
it stands: `.claude/agents/`, `.claude/skills/` (the `.agents/skills/` symlinks), `.claude/rules/`,
`.claude/settings.json`, `scripts/hooks/`, `scripts/docs/`, `tools/docs/`, `templates/linear/`, and
`docs/security/`. Leaving these out means an agent orienting from `CLAUDE.md` alone (step 1 of "Session
workflow") does not know the hook layer, the rules layer, or the docs-check gate exist.

Three more gaps, none caught by an automated check because the block content isn't cross-referenced
against anything but the real tree:
1. `just docs-check` — the new self-consistency gate this plan builds — is not in "Standard commands" or
   the completion checklist, so nothing tells an agent it is a minimum-before-done check.
2. "Session workflow" never mentions that `.claude/rules/` rules auto-load, or that the
   `docs-maintenance` skill/`just docs-check` are how step 6 ("Close out ... affected docs") gets done.
3. `.claude/settings.json`'s five hooks and their two escape hatches (`AGENT_MAY_EDIT_POLICY`,
   `AGENT_SKIP_PROGRESS_GATE`) are undocumented in the operating contract, even though they now enforce
   parts of it automatically.

## Diff

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -33,22 +33,41 @@
 packages/seed-data/     synthetic fixtures/factories (never real user data)
 packages/test-support/  shared test builders/fakes
 tools/                  depcruise/rules.cjs (arch-check), codegen/ (contract generators)
+tools/docs/             docs-check fixtures (tools/docs/fixtures/DC-*) + planned-paths.txt
 planning/               SPINE, docs 00–16, phases/, templates/  (read-only context)
 docs/adr/  docs/modules/                decisions and module contracts
+docs/security/          dependency-ignore and license-policy notes (`just security-scan`)
 templates/              issue, PR, ADR, session-handoff, module-contract, phase templates
+templates/linear/       Linear issue-type templates (feature, bug, spike, contract-change, migration, security-review, chore)
 .agents/skills/         one SKILL.md per task type (see "Match a skill" below)
+.claude/skills/         symlinks into `.agents/skills/` so Claude Code's skill loader finds them
+.claude/agents/         one agent persona per task type, invoked via the Agent tool
+.claude/rules/          path-scoped rules, auto-loaded when an agent touches matching files
+.claude/settings.json   hooks + permission policy (see the hook-layer note below)
 .github/workflows/      CI tiers; every job calls `just`, never raw tools
 scripts/  justfile  mise.toml           tooling; `just` is the only entry point
+scripts/hooks/          `.claude/settings.json` hook scripts (path guard, Bash guard, scoped lint, PROGRESS gate, orientation)
+scripts/docs/           docs-check.sh + lib/ (`just docs-check`)
+artifacts/              generated build output (e.g. sbom/); gitignored, not read for orientation
+node_modules/           package-manager output; gitignored, never read or edited directly
+prototype/              throwaway spikes (e.g. g3-filament-spike); not shipped
+secrets/                sops+age encrypted per-environment config (planning/15 §6); never plaintext
 ```

 ## Session workflow

 1. **Orient:** read `planning/SPINE.md` (product + architecture canon; skim if already loaded this session), `PROGRESS.md`, the current phase file, and the contract of every module in scope. Check the decision log for anything touching the task.
 2. **Restate** the task's scope, non-goals, and acceptance criteria in your own words. If they are unclear, or conflict with what you read, **stop and ask** — do not guess.
-3. **Match a skill:** if a skill in `.agents/skills/` covers the task type, follow its workflow; skills compose (e.g., contract change first, then module work).
+3. **Match a skill:** if a skill in `.agents/skills/` covers the task type, follow its workflow; skills compose (e.g., contract change first, then module work). Path-scoped rules in `.claude/rules/` load automatically when you touch matching files — treat them as binding, not optional reading.
 4. **Search before write** (below), then implement the smallest coherent change.
 5. **Verify** with the scoped checks for what you touched; paste real output.
-6. **Close out:** update `PROGRESS.md` and affected docs; leave the repo buildable or report the precise failure; write a handoff note if work remains.
+6. **Close out:** update `PROGRESS.md` and affected docs (the `docs-maintenance` skill and `just docs-check` cover this); leave the repo buildable or report the precise failure; write a handoff note if work remains.
+
+Five deterministic hooks in `.claude/settings.json` (scripts in `scripts/hooks/`) back parts of this
+workflow: a path guard on protected files, a Bash-command guard, scoped post-edit lint, a PROGRESS-ledger
+gate on session stop, and an orientation print on session start. Two escape hatches exist for
+human-authorized exceptions: `AGENT_MAY_EDIT_POLICY=1` bypasses the path guard for a sanctioned policy
+edit; `AGENT_SKIP_PROGRESS_GATE=1` bypasses the stop gate for a session intentionally left mid-work.

 ## Parallel sessions

@@ -88,7 +107,7 @@
 - `just doctor` — environment check (run when anything is weird)
 - `just dev-api` / `just dev-mobile` / `just dev-workers`
 - `just test <module>` (scoped) · `just test` (full)
-- `just lint` · `just typecheck` · `just format` · `just arch-check`
+- `just lint` · `just typecheck` · `just format` · `just arch-check` · `just docs-check`
 - `just generate` — contracts → clients (`--check` = staleness gate)
 - `just db-migrate` / `just db-rollback` / `just db-reset` (local only)
 - `just assets-validate` · `just ml-eval` · `just security-scan`
@@ -139,7 +158,7 @@

 - [ ] Acceptance criteria restated at start; all met, with evidence pasted (real command output).
 - [ ] Semantic reuse check done; new code justified against candidates.
-- [ ] Scoped checks green: `just test <module>` + `lint` + `typecheck` + `arch-check` (+ `generate --check` / `assets-validate` where relevant).
+- [ ] Scoped checks green: `just test <module>` + `lint` + `typecheck` + `arch-check` + `docs-check` (+ `generate --check` / `assets-validate` where relevant).
 - [ ] Regression test failed-then-passed for any bug fix.
 - [ ] No new duplication of schemas/constants/validators/mappings; generated files regenerated, not edited.
 - [ ] No sensitive data introduced into logs/fixtures/prompts/output.
```

Full recipe catalog (including `just db-generate`, `just test-regression`, `just lint-file`, `just sbom`)
stays in `planning/15-team-workflow-and-ai-agent-operations.md` §5, which "Standard commands" already
points to — see `s3-doc15-proposal.md` for that table's diff. Only `just docs-check` is added to
`CLAUDE.md`'s own curated bullet list, because it is now a required minimum-before-done gate, matching
how `generate --check`/`assets-validate` are called out only when conditionally relevant.

## Verify after applying

1. `git apply` (or hand-apply) the diff above to `CLAUDE.md`.
2. `just docs-check --strict` — DC-14 must report zero findings (it reported 4 before). Full-repo run,
   confirmed in isolation against this exact block by invoking `scripts/docs/lib/checks-repo.sh`'s
   `check_dc14` directly against a tree of symlinks to the real top-level entries plus the proposed
   `CLAUDE.md`: `errors=0 warnings=0`.
3. `just lint` (shellcheck/markdown rules unaffected) and `just ci-parity` still green.
4. After applying **both** this proposal and `s3-doc15-proposal.md`, flip `just docs-check` to `--strict`
   in `ci-parity` (justfile) so DC-14/DC-15 become errors instead of warnings — the two only remain
   WARN-only pending exactly these human-approved edits.
