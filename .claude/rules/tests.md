---
paths:
  - "**/tests/**"
  - "e2e/**"
  - "apps/android/**/src/test/**"
  - "apps/android/**/src/androidTest/**"
---

# Tests

**Skill:** `testing-regression`; Maestro flows in `e2e/`: `e2e-device-testing`.

**Agent:** the agent that the area rule names writes that area's tests, in the same change as the code
(e.g. `apps/api/src/modules/closet/tests/` → `api-engineer`, `apps/ios/Packages/*/tests/**` →
`ios-engineer`, `workers/ml/*/tests/**` → `ml-engineer`). `test-engineer` owns `e2e/**` (it runs
`e2e-device-testing`) and `apps/api/tests/**`, except `apps/api/tests/http.test.ts` (`api-engineer`) and
`apps/api/tests/migrations/**` (`platform-engineer`). It writes a module's tests only when dispatched by
name while that module's engineer agent is not in the wave.

**Proof:** `just test <module>` for an API module; `just test ios`, `just test android`,
`just test workers`, `just test platform` or `just test secrets` for those suites; `just test api` for
`apps/api/tests/**` and `apps/api/src/jobs/tests/**`; `just test` for `packages/*/tests/**` (no scoped
route). Bug fix: `just test-regression <test-file>` proves a TypeScript regression test fails at the
merge-base and passes at HEAD; for Swift, Kotlin and Python, paste the failing run of the new test before
the fix. E2E: `just ios-e2e e2e/<flow>.yaml` (macOS) and `just android-e2e e2e/<flow>.yaml` (running
emulator or device).

**Invariants that bite here:**
1. A TypeScript `*.test.*` or `*.spec.*` file outside a tests/ directory fails eslint's
   quality/test-placement rule (`just lint`); `e2e/**` and `apps/api/tests/**` are the documented
   exceptions.
2. Native test locations: Swift in `apps/ios/Packages/<Pkg>/tests/<Target>Tests/`; Kotlin in each Gradle
   module's src/test/kotlin, instrumented tests in src/androidTest/kotlin; Python in
   `workers/ml/<service>/tests/`; Maestro flows in `e2e/`. The PreToolUse path guard
   `scripts/hooks/guard-protected-paths.sh` denies, anywhere except `tools/*/fixtures/**`: a
   `*.{test,spec}.{ts,tsx,mts,js,mjs}`, `test_*.py` or `*_test.py` file outside a tests/ or e2e/
   directory; a `*Test.swift` or `*Tests.swift` file under `apps/ios/**` outside
   `apps/ios/Packages/*/tests/**`; and a `*Test.kt`, `*Tests.kt` or `*Spec.kt` file under
   `apps/android/**` outside src/test/ and src/androidTest/. A test in the wrong tests/ directory, or a
   file name the guard does not recognise, is reviewer-checked.
3. `it.skip`, `test.skip`, `describe.skip`, `xit`, `xtest` and `xdescribe` need an issue id (`#123`,
   `APP-42`) in the title — eslint's local/no-skip-without-issue rule (`just lint`). The same policy for
   Swift `@Test(.disabled)` and Kotlin `@Ignore` is not mechanically enforced (reviewer-checked).
4. A regression test fails against the pre-fix code and passes after; a PR without that proof is
   incomplete — `just test-regression <test-file>` for TypeScript; the pasted failing run for the rest
   (reviewer-checked).
5. `e2e/smoke.yaml` asserts `AI Stylist` and `Share anonymous usage data`; both apps render these
   byte-identical, and a flow only targets ids that exist on both platforms (iOS
   `accessibilityIdentifier` equals Android `testTag`) — `just ios-e2e` and `just android-e2e`.
6. Test data is synthetic. Reuse `packages/test-support/` and `packages/seed-data/`; a new shared fake or
   builder is `api-engineer`'s, new seed data is `platform-engineer`'s (reviewer-checked).
