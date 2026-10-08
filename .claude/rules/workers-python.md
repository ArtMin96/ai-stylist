---
paths:
  - "workers/**"
  - "tools/codegen/gen-python.sh"
---

# Python ML/media workers (FastAPI)

**Skill:** `media-ml-pipeline`.
Line-level quality: `code-quality` with `.agents/skills/code-quality/references/python.md` only (its
language lock: never apply another language's idioms here).

**Agent:** `ml-engineer`, except `workers/ml/generated/**`, which belongs to `contracts-engineer` and is
written only by `just generate`.

**Proof:** `just test workers`, then `just lint` (ruff check) and `just typecheck` (basedpyright);
`just ml-eval` when a model step changed; `just generate --check` after a `tools/codegen/gen-python.sh`
change.

**Invariants that bite here:**
1. Tests outside a service's own tests/ directory are never collected: `workers/pyproject.toml` sets
   `testpaths = ["ml/*/tests"]`, so a misplaced `test_*.py` silently stops running — the PreToolUse path
   guard `scripts/hooks/guard-protected-paths.sh` denies a `test_*.py` outside a tests/ directory.
2. Customer data goes only to providers on the approved list, with no provider training on it by
   default (root `CLAUDE.md` "AI usage in product code"); a new provider import needs its entry in
   `planning/10-ai-usage-cost-and-evaluation.md` in the same change (reviewer-checked).
3. ruff is the only lint and format authority for workers; never hand-tune what ruff would reformat —
   `just lint` (ruff check) and `just format --check` (ruff format --check).
4. `workers/ml/generated/**` is never hand-edited — the path guard denies it; `just generate --check`
   catches drift.
5. `workers/uv.lock` is single-writer and changes only when the task grants a dependency change — the
   path guard denies hand edits; `scripts/hooks/guard-bash.sh` denies `uv add`.
6. Logs go through the structlog redaction of `workers/ml/observability/` (`ai_stylist_observability`:
   `redaction.py`, `tracing.py`, `correlation.py`), which every service depends on and never copies;
   its unit tests are in `workers/ml/observability/tests/`. Each service keeps its own canary through
   its configured logger: copy `workers/ml/segmentation/tests/test_redaction.py` for a new service
   (reviewer-checked).
