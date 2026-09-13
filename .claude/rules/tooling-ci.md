---
paths:
  - "justfile"
  - "scripts/**"
  - "tools/**"
  - "mise.toml"
---

# Tooling, CI, and the `just` gate

**Skill:** `tooling-ci`.

**Agent:** `tooling-engineer`.

**Proof:** `just ci-parity` (the exact PR-gate sequence, run locally).

**Invariants that bite here:**
1. `scripts/**` and every recipe body run under bash 3.2 (macOS ships no newer bash) — `just lint`
   shellchecks them with `-s bash`; a bash-4-only construct fails there, not on Linux CI.
2. `.github/workflows/**` calls `just` recipes only, never a raw tool — a new workflow step that shells out
   directly is the defect this file exists to catch (root `CLAUDE.md` repo layout already states the rule;
   `docs-check` DC-11 enforces it for `.agents/**`/`.claude/**`, not workflows, so review by hand here).
3. Every `tools/depcruise/rules.cjs` rule stays `severity: 'error'` — no warning tier; an exception needs an
   ADR (`tools/depcruise/README.md`), not a quiet downgrade.
