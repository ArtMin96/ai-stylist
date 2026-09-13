---
paths:
  - "**/tests/**"
  - "apps/mobile/e2e/**"
---

# Tests

**Skill:** `testing-regression`.

**Agent:** `test-engineer` (never in the same wave as the engineer agent owning the module under test — see
`docs-and-progress.md` for the matching `docs-maintainer` concurrency rule).

**Proof:** `just test <module>` for the owning module; `just test-regression <test-file>` to prove a bug fix
fails before the change and passes after.

**Invariants that bite here:**
1. A `*.test.*`/`*.spec.*` file outside a tests/ directory fails eslint's quality/test-placement rule
   (`apps/mobile/e2e/**` and `apps/api/tests/**` are the only documented exceptions).
2. `it.skip`/`test.skip`/`describe.skip`/`xit`/`xtest`/`xdescribe` without an issue id (`#123`, `APP-42`)
   in the title fails eslint's local/no-skip-without-issue rule.
3. A regression test must fail against the pre-fix code and pass after — `just test-regression <file>`
   runs both sides; a PR without that proof is incomplete, not merely undocumented.
