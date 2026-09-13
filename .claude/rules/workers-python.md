---
paths:
  - "workers/**"
---

# Python ML/media workers (FastAPI)

**Skill:** `media-ml-pipeline`.

**Agent:** `ml-engineer`.

**Proof:** `just test workers`, then `just lint` (ruff) and `just typecheck` (basedpyright).

**Invariants that bite here:**
1. Tests outside a service's own tests/ are never collected — `workers/pyproject.toml`
   `testpaths = ["ml/*/tests"]`; a misplaced `test_*.py` silently stops running, `just test workers` won't
   catch it as a failure, only as absence.
2. Customer data goes only to providers on the approved list, with no provider training on it by default —
   root `CLAUDE.md` "AI usage in product code"; a new provider import needs the doc-10 entry in the same
   diff.
3. `ruff check workers` and `ruff format --check workers` (via `just lint` / `just format --check`) are the
   only formatting/lint authority — never hand-tune what ruff would reformat.
