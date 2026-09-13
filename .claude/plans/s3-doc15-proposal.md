# Proposal: `planning/15-team-workflow-and-ai-agent-operations.md` updates, plus a `planning/CLAUDE.md`
# disposition decision (human-authorized only)

**Task:** T20 of `.claude/plans/s3-agent-operating-foundation.md`. `planning/15-*.md` is human-only per
root `CLAUDE.md`'s "Prohibited without explicit human authorization" section and the
`guard-protected-paths.sh` PreToolUse hook (`*/planning/15-*.md` pattern). This file is the proposal; a
human applies it.

**Grounding:** `bash scripts/docs/docs-check.sh --strict`, same run as `s3-claude-md-proposal.md`. DC-15
is WARN-only by default and becomes an ERROR under `--strict`
(`scripts/docs/lib/checks-repo.sh` `check_dc15`, comparing the §5 table against `just --summary`).

Every before-block below was checked byte-for-byte against the current files
(`grep -Fxq -- '<line>' <file>`, one call per quoted line) before being written here.

---

## Part A — §5 recipe catalog vs `just --summary`

### Why

`docs-check --strict` reports 5 DC-15 errors — this plan added five recipes to the justfile that §5's
"canonical catalog" (which the doc's own prose calls binding: "every planning doc and skill references
exactly these names") does not list:

```
ERROR DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'db-generate' (just --summary) missing from the §5 catalog
ERROR DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'docs-check' (just --summary) missing from the §5 catalog
ERROR DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'lint-file' (just --summary) missing from the §5 catalog
ERROR DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'sbom' (just --summary) missing from the §5 catalog
ERROR DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'test-regression' (just --summary) missing from the §5 catalog
```

Two more inaccuracies DC-15 cannot see (it only diffs recipe *names*, not descriptions):
- The existing `just test <module>` row only documents the `modules/<name>/tests` case; it silently omits
  that `mobile`, `workers`, `secrets`, `platform`, and `api` are special-cased to their own suites
  (justfile `test` recipe body) — exactly the "test mobile|workers" gap this plan's T20 task calls out.
- The existing `just ci-parity` row lists `format-check, lint, typecheck, arch-check, generate --check,
  test, security-scan` — the real recipe now also runs `docs-check` between `arch-check` and
  `generate --check` (this plan wired it in specifically so `ci-parity` enforces the gate).

Confirmed *not* a gap: `just mobile-ios-submit` does not exist in `just --summary` and is correctly
absent from §5 — it is only a TODO comment in `.github/workflows/ios-eas.yml:81` (this plan's own risk
log already flags this; do not add a row for it).

### Diff

```diff
--- a/planning/15-team-workflow-and-ai-agent-operations.md
+++ b/planning/15-team-workflow-and-ai-agent-operations.md
@@ -97,13 +97,17 @@
 | `just dev-api` | Compose stack (Postgres+pgvector) + NestJS API in watch mode |
 | `just dev-mobile` | Expo dev client (Metro); `--android` targets connected device/emulator |
 | `just dev-workers` | Python ML workers locally (pg-boss job handlers run inside `just dev-api` or a local `jobs` process — no separate job dev server) |
-| `just test <module>` | Scoped: one module's `tests/` dir (e.g. `just test recommendation`) |
+| `just test <module>` | Scoped: one module's `tests/` dir (e.g. `just test recommendation`); `mobile`, `workers`, `secrets`, `platform`, `api` route to their own suites instead of a `modules/<name>/tests` dir |
 | `just test` | Full suite (all modules + packages), as CI PR gate runs it |
+| `just test-regression <file>` | Prove a regression test fails at the merge-base and passes at HEAD — the structural form of CLAUDE.md's "regression test fails before the fix" |
 | `just lint` | ESLint (incl. boundary rules) + Ruff for workers |
+| `just lint-file <path>` | Single-file lint dispatch by extension (eslint/ruff/shellcheck, else no-op); used by the PostToolUse hook so one edit doesn't pay for a whole-repo lint |
 | `just typecheck` | `tsc --noEmit` across workspace + Pyright for workers |
 | `just format` | Prettier + Ruff format, write mode; `--check` in CI |
 | `just arch-check` | dependency-cruiser: module dependency rules, public-API-only imports (SPINE §3) |
+| `just docs-check [--strict]` | Repo self-consistency gate: module↔contract bijection, ADR/skill/agent README sync, PROGRESS.md sync, stale review dates, dead repo paths, undocumented recipes, raw package-manager invocations in `.agents`/`.claude`; `--strict` turns the two human-approval-pending checks (this table, the CLAUDE.md layout block) into errors |
 | `just generate` | OpenAPI contract → TS client + types; event schema types; `--check` fails on stale output |
+| `just db-generate <name>` | Generate a Drizzle migration from `packages/db` schema changes (`drizzle-kit generate --name`); reminds you `packages/db/migrations/down/<idx>.sql` is required by `db-rollback` |
 | `just db-migrate` | Apply pending drizzle-kit migrations to the target env (default: local) |
 | `just db-rollback` | Roll back last migration per doc 06 policy (expand/contract aware) |
 | `just db-reset` | Drop + recreate + migrate + seed **local** DB only (refuses non-local `DATABASE_URL`) |
@@ -113,7 +117,8 @@
 | `just assets-validate` | 3D asset gate: glTF 2.0 validity, KTX2 encoding, poly/texture budgets, manifest schema, morph-target names (doc 07) |
 | `just ml-eval` | Run versioned eval suites for classification/segmentation/try-on against golden datasets (doc 10) |
 | `just security-scan` | gitleaks + osv-scanner + npm/pnpm audit + license check (§9) |
+| `just sbom` | Generate the SPDX + CycloneDX SBOM into `artifacts/sbom/` (same syft invocation `security-scan` runs) |
+| `just ci-parity` | Run the exact PR-gate sequence locally: format-check, lint, typecheck, arch-check, docs-check, generate --check, test, security-scan |
 | `just golden-accept` | Accept updated golden/visual-regression baselines as a reviewed commit (doc 13 §6) |
 | `just rec-replay <id>` | Re-run a stored recommendation from its snapshots and diff against the stored result (doc 09 §9) |
 | `just rec-golden-update` | Regenerate recommendation golden fixtures for review (doc 09 §13.3) |
```

Note the diff replaces the old `just ci-parity` row (it is deleted then re-added with the `docs-check`
step) — apply as one hunk, not two separate edits, to avoid a duplicate row.

### §12.5 sentence

**Why:** §12.5 "Recommended tooling" still describes the reference setup as `CLAUDE.md` +
`.agents/skills/` only. It predates this plan's `.claude/agents/`, `.claude/rules/`, and hook layer, so a
reader following §12.5 alone would not know those exist.

```diff
--- a/planning/15-team-workflow-and-ai-agent-operations.md
+++ b/planning/15-team-workflow-and-ai-agent-operations.md
@@ -233,7 +238,7 @@

 ### 12.5 Recommended tooling (recommendations, not requirements)

-- **Claude Code** with this repo's `CLAUDE.md` + `.agents/skills/` is the reference setup; any agent tooling must obey the same contract.
+- **Claude Code** with this repo's `CLAUDE.md` + `.agents/skills/` (symlinked at `.claude/skills/`) + `.claude/agents/` (agent personas) + `.claude/rules/` (path-scoped rules) + the `.claude/settings.json` hook layer (`scripts/hooks/`) is the reference setup; any agent tooling must obey the same contract.
 - **MCP servers worth adding:** `context7` (current library docs — Expo/Filament/Drizzle/pg-boss move fast; CLAUDE.md requires consulting current docs) and a read-only **Postgres MCP** pointed at local/staging for schema inspection during migration work. Evaluate others via ADR; each MCP server is an attack/typo surface, keep the list short.
 - **Model tiers for cost:** cheap/fast models for mechanical work (renames, fixture generation, applying a settled pattern across files, commit messages); top-tier models for architecture, recommendation-engine rules, security-sensitive code, and anything touching contracts. Batch mechanical tasks per §12.3 fan-out. Track agent spend the same way we track provider AI spend (doc 10): it is a real unit cost.
```

### Verify after applying (Part A)

1. `git apply` (or hand-apply) both diffs above to `planning/15-team-workflow-and-ai-agent-operations.md`.
2. `just docs-check --strict` — DC-15 must report zero findings (it reported 5 before). Confirmed in
   isolation against this exact table by invoking `scripts/docs/lib/checks-repo.sh`'s `check_dc15`
   directly, with the real `justfile` and the proposed doc copied into a scratch root: `errors=0
   warnings=0`.
3. After applying **both** this proposal and `s3-claude-md-proposal.md`, flip `just docs-check` to
   `--strict` in `ci-parity` (justfile) so DC-14/DC-15 become errors instead of warnings.

---

## Part B — `planning/CLAUDE.md` disposition (open question 3)

### Why

`planning/CLAUDE.md` is auto-loaded by Claude Code for any `planning/**` edit (nested-directory
CLAUDE.md discovery), alongside root `CLAUDE.md`. It still carries its original `Status: PROPOSED` banner
telling the reader it "moves to the repository root when implementation starts (P02)" — that move already
happened (root `CLAUDE.md`'s own banner: "Status: LIVE ... as of 2026-09-09 (P02, task T16)"). Below the
banner it still names **Trigger.dev** in "Architectural invariants" and "Honesty about results", a vendor
ADR-0003 retired (r7, DEC-41–48; see `docs/adr/0003-self-hosted-infrastructure-baseline.md`). `docs-check`
DC-13 cannot catch this: its banned-vendor-name scan covers `.agents/**`, `.claude/**`, `docs/**`, and
`justfile` only, not `planning/**` (`planning/` is deliberately excluded there as "read-only context").
Result: any session editing `planning/**` gets two operating contracts loaded at once, one of them stale
and self-contradicting — silently, with no gate to catch it. `guard-protected-paths.sh` already treats
`planning/CLAUDE.md` as human-only (its `*/CLAUDE.md` deny pattern matches this path too), consistent
with root `CLAUDE.md`'s "Editing this file ... is prohibited without explicit human authorization" — so
this is a proposal, not a direct edit, same as Part A.

### Two options

**Option 1 — banner (recommended).** Replace the status line so the file is explicitly historical and
points to the live contract, without touching anything else in the file (no other line changes, nothing
else to re-review, no broken relative links from other docs that reference `planning/CLAUDE.md`).
Trade-off: the stale vendor names later in the file remain physically present — the banner's job is to
tell the reader not to trust them, not to remove them (removing them piecemeal would itself be a
policy edit needing separate review of exactly what "Architectural invariants" should say instead).

**Option 2 — rename** (e.g. `git mv planning/CLAUDE.md planning/CLAUDE.historical.md`). Fully stops the
auto-load contradiction (Claude Code only auto-loads files literally named `CLAUDE.md`). Trade-off: breaks
the relative link in `planning/15-team-workflow-and-ai-agent-operations.md:199`
(`[CLAUDE.md](CLAUDE.md)`, itself inside a human-only file needing a coordinated edit), and removes any
contract at all from `planning/**` sessions unless a new `.claude/rules/` entry with
`paths: ["planning/**"]` is added to point at root `CLAUDE.md` instead — a second human-only file to
land in the same change. Larger blast radius for the same outcome the banner already achieves.

**Recommendation: apply Option 1.** It is the minimal, reversible fix and mirrors the pattern root
`CLAUDE.md` itself already used when it went from `PROPOSED` to `LIVE`.

### Diff (Option 1 — banner)

```diff
--- a/planning/CLAUDE.md
+++ b/planning/CLAUDE.md
@@ -1,6 +1,10 @@
 # CLAUDE.md — AI Stylist Operating Contract

-> **Status: PROPOSED.** Lives in `planning/` during planning; move to the repository root when implementation starts (P02). Paths below assume the implementation-repo layout.
+> **Status: HISTORICAL.** The binding operating contract moved to the repository root (`CLAUDE.md`) at
+> P02-T16 (2026-09-09); root `CLAUDE.md` is now LIVE and wins any conflict with this copy (root
+> `CLAUDE.md` § Source-of-truth priority). This file is kept for planning-phase context only. It still
+> names vendors superseded by [ADR-0003](../docs/adr/0003-self-hosted-infrastructure-baseline.md)
+> (e.g. Trigger.dev, Neon, Railway) — treat every tooling name below as historical, not current.

 This file is the permanent operating contract for every AI agent session in this repository. Phase-specific detail lives in `planning/phases/`; module detail lives in module contracts. Rules here are permanent and binding.
```

### Verify after applying (Part B)

1. `git apply` (or hand-apply) the diff above to `planning/CLAUDE.md`.
2. `just docs-check --strict` — no DC-13 regression (the file was never in scope, and stays out of scope;
   this is a banner, not a vendor-name removal, so DC-13's finding count is unaffected by this change).
3. Manual check: open a `planning/**` file in a fresh session and confirm both `CLAUDE.md` (root, LIVE)
   and `planning/CLAUDE.md` (HISTORICAL banner) load without contradicting each other on which one binds.
4. If Option 2 is chosen instead, additionally update the `planning/15-*.md:199` link and add a
   `paths: ["planning/**"]` rule under `.claude/rules/` in the same human-authorized change — do not land
   the rename alone.
