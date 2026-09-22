---
paths:
  - "**/tests/**"
  - "e2e/**"
  - "apps/android/**/src/test/**"
  - "apps/android/**/src/androidTest/**"
---

# Tests

**Skill:** `testing-regression` (Maestro flows in `e2e/`: `e2e-device-testing`).

**Agent:** `test-engineer` (never in the same wave as the engineer agent owning the module under test — see
`docs-and-progress.md` for the matching `docs-maintainer` concurrency rule). Native app tests belong to
`ios-engineer` / `android-engineer` in the same PR as the code.

**Proof:** `just test <module>` for the owning module (`just test ios`, `just test android` for the native
apps); `just test-regression <test-file>` to prove a TypeScript bug fix fails before the change and passes
after (native apps: paste the failing run of the new test before the fix).

**Invariants that bite here:**
1. A `*.test.*`/`*.spec.*` file outside a tests/ directory fails eslint's quality/test-placement rule
   (`e2e/**` and `apps/api/tests/**` are the only documented TypeScript exceptions).
2. Native test locations: Swift tests in `apps/ios/Packages/<Pkg>/tests/<Target>Tests/`; Kotlin tests in
   each Gradle module's src/test/kotlin, instrumented tests in src/androidTest/kotlin (Gradle's
   source-set layout, a documented exception); Maestro flows in `e2e/` (shared `e2e/smoke.yaml`). The
   PreToolUse path guard denies native test files anywhere else.
3. `it.skip`/`test.skip`/`describe.skip`/`xit`/`xtest`/`xdescribe` without an issue id (`#123`, `APP-42`)
   in the title fails eslint's local/no-skip-without-issue rule; the same no-skip policy applies to
   `@Test(.disabled)` in Swift and `@Ignore` in Kotlin.
4. A regression test must fail against the pre-fix code and pass after — a PR without that proof is
   incomplete, not merely undocumented.
