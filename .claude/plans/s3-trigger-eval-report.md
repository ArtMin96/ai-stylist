# T21 — Trigger-eval optimization report

> Status: HISTORICAL (2026-09-13). Checked 2026-09-25: the "Plan/impl discrepancy" below is resolved;
> DC-05 now enforces both description ≤ 1024 and name + description ≤ 1536
> (`scripts/docs/lib/checks-skills-agents.sh`). Still open: C9's automated trigger scores were never
> produced. The skill-creator plugin named below is no longer installed; use
> `anthropic-skills:skill-creator`.

## What failed (precisely) and why the manual pass was used instead

`Skill(skill-creator:skill-creator)` was invoked. A smoke test of `scripts/run_eval.py` (2 queries,
`docs-maintenance`, `--model claude-sonnet-5`) proved the mechanism works — no API-key issue. Scaling to
the required `run_loop.py` (9 skills × ≤5 iterations × 20 queries × 3 runs) was stopped after starting
skill 1, for safety: `find_project_root()` must run from the skill-creator plugin dir (for the import to
resolve), so it walks up to `~/.claude`, resolving `project_root` to the **user's home directory**, not
this repo. Every nested `claude -p` call then writes its command file into `~/.claude/commands/` —
shared by *every concurrent session on this machine*, not this repo/worktree. Confirmed: killing the
run left 3 orphaned `docs-maintenance-skill-*.md` files there (removed); this session's own
`available_skills` briefly showed 8–10 phantom entries. Scaling across 9 skills risked corrupting other
agents' sessions — a tool defect outside this task's write set. Did a manual pass instead; no score
fabricated.

## Manual pass: description vs. each skill's body Trigger section + its 20 queries

Fixed (should-trigger query had no textual anchor; term confirmed present in the skill's own body):
- `observability-analytics`: added "audit-trail entries, feature-flag policy (owner, expiry, rollout)".
- `fashion-intel-ingestion`: added `` `trends.level` tier seam``.
- `tooling-ci`: added `shellcheck`.

No gap (every positive had an anchor; every negative excluded by an existing `Not for` clause):
`docs-maintenance`, `data-lifecycle`, `e2e-device-testing`, `notifications-delivery`,
`admin-moderation`, `assistant-chat`.

## Verification

`just docs-check <path>` → exit 0, "0 errors, 0 warning(s)" for all 9 SKILL.md files.

**Plan/impl discrepancy:** C5 states `len(name)+len(description) <= 1536`; shipped `DC-05`
(`checks-skills-agents.sh`) enforces `description` alone `<= 1024`. All 9 satisfy the stricter rule
(`fashion-intel-ingestion` trimmed to 998).

## Gaps

No automated train/test scores exist — `run_loop.py` never completed; six skills rest on manual
cross-check only. `trigger-evals.json` reviewed, not edited (outside this task's write set). `tooling-ci`
query #5 (DC-11/shellcheck) is moderate-confidence, left unedited for lack of clear evidence.
