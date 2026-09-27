# AI-17 (P02-T09) tooling C2: workflow, secret and catalog proposal

> Status: PARTIALLY APPLIED (2026-09-27, AI-17) — §I applied (justfile); §A–§H in scratchpad
> ai-17-human.patch. Per section: §I APPLIED by the lead. §A–§F and §H PENDING in the human-applied
> ai-17-human.patch, which revises three of them after the security review: §A uploads dSYMs on
> `main` only, §B sets no PostHog project key in CI, §D pushes CI metrics on pushes to `main` only.
> The patch also carries the doc 15 `lint` row and the `.github/actions/setup/action.yml` header.
> §G PENDING: a human runs it from that patch's README (no `POSTHOG_API_KEY` or `POSTHOG_HOST`;
> the OTLP headers hold a CI-only metrics-write token; the PostHog project is in US Cloud, so
> `POSTHOG_CLI_HOST` is `https://us.posthog.com`, not the EU host in §G's table below).
> Proposed 2026-09-27 by tooling-engineer (C2). Base: f625cf2 plus the uncommitted AI-17 working
> tree (step B's `flags-report` included).

Every diff below was produced with `diff -u` against the current file and checked with
`actionlint -config-file .github/actionlint.yaml <copy>` (5 files, 0 errors, shellcheck rule on).
Apply a section by saving its block to a file and running `git apply <file>` from the repo root.

Order: I (justfile: adds `ci-pr-gate-metrics`, which D calls) → A–F → G (secrets) → `just lint`
(actionlint) → merge. D without I fails only its own `continue-on-error` step, never the gate.

## A. `.github/workflows/ios.yml` (job `macos`)

posthog-cli from mise (with node, which runs its npm wrapper); the SPM cache key also hashes
`apps/ios/project.yml` (it declares posthog-ios); the dev simulator build gets the upload settings,
with the key withheld from `pull_request` runs. `apps/ios/scripts/xcode.sh` uploads only when all
three are set and prints a notice otherwise.

```diff
--- a/.github/workflows/ios.yml
+++ b/.github/workflows/ios.yml
@@ -5,16 +5,19 @@
 #                                  fixtures) and the Core/Features package unit tests, all on Linux
 #                                  (Swift in Docker swift:6.4, the same fallback dev boxes use).
 #   2. macOS build & test          needs 1. Generates the Xcode project, builds the app unsigned for the
-#                                  simulator (Dev) and runs the package test targets through the
-#                                  AIStylist-Dev scheme on an iOS simulator.
+#                                  simulator (Dev), uploads its dSYMs to PostHog (not on pull requests)
+#                                  and runs the package test targets through the AIStylist-Dev scheme
+#                                  on an iOS simulator.
 #   3. summary                     needs 1 + 2; fails when either failed.
 #
 # Triggers: pull_request and push to main touching apps/ios/**, packages/contracts/** (the generated
 #           Swift client lives there), tools/codegen/gen-swift.sh, the justfile, mise.toml,
 #           scripts/native-lane.sh or this file; manual workflow_dispatch.
-# Secrets:  none (unsigned simulator builds only). The TestFlight lane (later, human-approved) will add
-#           APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_API_ISSUER_ID, APP_STORE_CONNECT_API_KEY_P8
-#           and DEVELOPMENT_TEAM.
+# Secrets:  POSTHOG_CLI_API_KEY (dSYM upload of the Dev build; never passed to pull_request runs,
+#           which build key-less and print a notice). Variables: POSTHOG_CLI_PROJECT_ID,
+#           POSTHOG_CLI_HOST. posthog-cli comes from mise.toml. The TestFlight lane (later,
+#           human-approved) will add APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_API_ISSUER_ID,
+#           APP_STORE_CONNECT_API_KEY_P8 and DEVELOPMENT_TEAM.
 # Recipes:  just ios-lint, just ios-format --check, just ios-check-banned [--fixtures],
 #           just ios-test-packages, just ios-doctor, just ios-project, just ios-build --config dev,
 #           just ios-test.
@@ -135,7 +138,8 @@
       - name: Setup · Install mise tools
         uses: jdx/mise-action@v4
         with:
-          install_args: just xcodegen xcbeautify
+          # node runs the npm-packaged posthog-cli (dSYM upload in `just ios-build`).
+          install_args: just xcodegen xcbeautify node npm:@posthog/cli
           cache: true
 
       - name: Setup · Check Xcode
@@ -145,7 +149,8 @@
         uses: actions/cache@v6
         with:
           path: apps/ios/.build/SourcePackages
-          key: ios-spm-${{ runner.os }}-xcode27-${{ hashFiles('apps/ios/Packages/*/Package.swift', 'apps/ios/Packages/*/Package.resolved', 'packages/contracts/gen/swift-client/Package.swift') }}
+          # project.yml declares the app target's package dependencies (posthog-ios).
+          key: ios-spm-${{ runner.os }}-xcode27-${{ hashFiles('apps/ios/project.yml', 'apps/ios/Packages/*/Package.swift', 'apps/ios/Packages/*/Package.resolved', 'packages/contracts/gen/swift-client/Package.swift') }}
           restore-keys: |
             ios-spm-${{ runner.os }}-xcode27-
 
@@ -154,6 +159,12 @@
 
       - name: Build · Simulator app (dev)
         id: build
+        env:
+          # apps/ios/scripts/xcode.sh uploads the dSYMs only when all three are set, else prints a
+          # notice. pull_request runs never get the key (forks and PR code stay key-less).
+          POSTHOG_CLI_API_KEY: ${{ github.event_name != 'pull_request' && secrets.POSTHOG_CLI_API_KEY || '' }}
+          POSTHOG_CLI_PROJECT_ID: ${{ vars.POSTHOG_CLI_PROJECT_ID }}
+          POSTHOG_CLI_HOST: ${{ vars.POSTHOG_CLI_HOST }}
         run: just ios-build --config dev
 
       - name: Test · App on simulator
```

## B. `.github/workflows/android.yml` (job `build`, main only)

Job-level env, empty everywhere but `refs/heads/main`, so pull requests stay key-less. posthog-cli
needs no action change: `.github/actions/setup` runs `jdx/mise-action` with `install: true`, so it
installs every `mise.toml` tool; its `install: 'false'` input only skips `pnpm install`. The existing
`just android-build preview|release` steps then run `:app:uploadPostHogProguardMappings{Preview,Release}`
(the Gradle task's `onlyIf` skips it when a `POSTHOG_CLI_*` value is empty).

```diff
--- a/.github/workflows/android.yml
+++ b/.github/workflows/android.yml
@@ -3,7 +3,11 @@
 # Triggers: pull requests and pushes to main that touch apps/android/**, packages/contracts/** (the
 #           generated Kotlin client and the analytics taxonomy live there), tools/codegen/gen-kotlin.sh,
 #           the justfile, mise.toml, scripts/native-lane.sh or this file; plus manual dispatch.
-# Secrets:  none. The release build is unsigned. Play signing (upload keystore) comes later in a
+# Secrets:  build job on main only (push, or a dispatch on main): POSTHOG_API_KEY (the phc_ project key
+#           compiled into the APKs) and POSTHOG_CLI_API_KEY (R8 mapping upload of preview and release
+#           through posthog-cli, which mise.toml pins); variables POSTHOG_HOST, POSTHOG_CLI_PROJECT_ID,
+#           POSTHOG_CLI_HOST. Pull requests and other branches build key-less (no-op analytics sink,
+#           no upload). The release build is unsigned. Play signing (upload keystore) comes later in a
 #           separate, tag- or dispatch-only job, and uploading to Play stays a human action.
 # Recipes:  just android-sdk install · just android-format --check · just android-lint ·
 #           just android-detekt · just android-test · just android-build <debug|preview|release>
@@ -152,6 +156,17 @@
     concurrency:
       group: ${{ github.workflow }}-build-${{ github.ref }}
       cancel-in-progress: true
+    env:
+      # main only: the PostHog project key goes into the APKs, and the preview/release builds upload
+      # their R8 mappings (:app:uploadPostHogProguardMappings{Preview,Release}, run by the PostHog
+      # Gradle plugin through posthog-cli). The setup action installs every mise.toml tool, so
+      # posthog-cli is on PATH even with install: 'false' (that input only skips pnpm install).
+      # Everywhere else the values are empty: the no-op analytics sink and no upload.
+      POSTHOG_API_KEY: ${{ github.ref == 'refs/heads/main' && secrets.POSTHOG_API_KEY || '' }}
+      POSTHOG_HOST: ${{ github.ref == 'refs/heads/main' && vars.POSTHOG_HOST || '' }}
+      POSTHOG_CLI_API_KEY: ${{ github.ref == 'refs/heads/main' && secrets.POSTHOG_CLI_API_KEY || '' }}
+      POSTHOG_CLI_PROJECT_ID: ${{ github.ref == 'refs/heads/main' && vars.POSTHOG_CLI_PROJECT_ID || '' }}
+      POSTHOG_CLI_HOST: ${{ github.ref == 'refs/heads/main' && vars.POSTHOG_CLI_HOST || '' }}
     steps:
       - name: Setup · Check out
         uses: actions/checkout@v7
@@ -184,6 +199,7 @@
         if: always()
         env:
           JOB_STATUS: ${{ job.status }}
+          POSTHOG_SETTINGS: ${{ github.ref == 'refs/heads/main' && 'passed (main)' || 'withheld (not main)' }}
         run: |
           {
             echo "### Android · Build: ${JOB_STATUS}"
@@ -193,6 +209,7 @@
             echo "| preview | app.aistylist.mobile.preview | debug key |"
             echo "| release (prod) | app.aistylist.mobile | unsigned |"
             echo "- APKs: artifact android-apks-${GITHUB_SHA}"
+            echo "- PostHog project key and R8 mapping-upload settings: ${POSTHOG_SETTINGS}"
           } >> "$GITHUB_STEP_SUMMARY"
 
   summary:
```

## C. `.github/workflows/nightly.yml` (the `expired-flags` job from tooling step B)

Step B's job, with the existing root-job `# needs: none` comment kept (layout rule) and
`actions/checkout@v7` as in every other job. `just flags-report` exits 1 when a rollout or
experiment flag is past expiry; the nightly tier is non-blocking.

```diff
--- a/.github/workflows/nightly.yml
+++ b/.github/workflows/nightly.yml
@@ -3,8 +3,8 @@
 #
 # Triggers:  schedule 03:00 UTC daily, workflow_dispatch, and workflow_call (pre-release.yml
 #            reuses every job below).
-# Recipes:   just test, just sbom, just ml-eval, and the [private] CI helpers ci-pgvector,
-#            ci-gitleaks-history, ci-osv-source (justfile).
+# Recipes:   just test, just sbom, just ml-eval, just flags-report, and the [private] CI helpers
+#            ci-pgvector, ci-gitleaks-history, ci-osv-source (justfile).
 # Required secrets: none.
 # Optional secrets (steps degrade gracefully when unset):
 #   TURBO_TOKEN, TURBO_TEAM   Turborepo remote cache
@@ -172,7 +172,7 @@
           esac
 
   expired-flags:
-    name: Verify · Expired feature flags (placeholder)
+    name: Verify · Expired feature flags
     # needs: none (root of the job tree)
     runs-on: ubuntu-latest
     timeout-minutes: 5
@@ -182,10 +182,14 @@
       group: ${{ github.workflow }}-expired-flags-${{ github.ref }}
       cancel-in-progress: false
     steps:
-      - name: Verify · Report flags past expiry (NOT IMPLEMENTED, P02-T09)
-        run: |
-          echo "NOT IMPLEMENTED (P02-T09): flag registry with owner/expiry lands with the logging/lint task"
-          echo "::notice::expired-flag report placeholder - registry not present yet"
+      - name: Setup · Check out
+        uses: actions/checkout@v7
+      - name: Setup · Install toolchain
+        uses: ./.github/actions/setup
+        with:
+          install: 'false'
+      - name: Verify · Report flags past expiry (planning/14 §11; > 30 days overdue = DEFECT)
+        run: just flags-report
 
   maestro:
     name: Test · Maestro E2E (placeholder)
@@ -229,6 +233,6 @@
             echo "| osv-scanner | ${{ needs.osv-scanner.result }} |"
             echo "| sbom | ${{ needs.sbom.result }} |"
             echo "| ml-eval | ${{ needs.ml-eval.result }} |"
-            echo "| expired-flags | ${{ needs.expired-flags.result }} (placeholder) |"
+            echo "| expired-flags | ${{ needs.expired-flags.result }} |"
             echo "| maestro | ${{ needs.maestro.result }} (placeholder) |"
           } >> "$GITHUB_STEP_SUMMARY"
```

## D. `.github/workflows/pr-gate.yml` (CI metrics push in the summary job)

Reuses the duration the summary job already computes (`ci.pr_gate_duration_seconds`, now also a step
output), derives `conclusion` from `needs.*.result` and calls the `[private]` recipe
`just ci-pr-gate-metrics` (section I; body `tools/ci-metrics/push-pr-gate-metrics.mjs`). Every new
step is `if: always()` + `continue-on-error: true` with a step timeout, and the recipe itself exits 0
without the secrets or on a failed push, so the gate verdict never depends on it. The checkout and
install come after the duration is taken, so they do not count towards it; they are named in the
`Report` phase to keep the Setup → Report order of the workflow-shape rule. The job timeout grows
from 2 to 5 minutes for the checkout and the cached node + just install.

```diff
--- a/.github/workflows/pr-gate.yml
+++ b/.github/workflows/pr-gate.yml
@@ -1,9 +1,11 @@
 # PR gate (tier 1): the fast, blocking check on every pull request and every push to main.
-# Budget: < 10 min wall clock (AC-1; ci.pr_gate_duration_seconds lands in the job summary).
+# Budget: < 10 min wall clock (AC-1; ci.pr_gate_duration_seconds lands in the job summary, and the
+# summary job pushes it to Grafana Cloud as stylist.ci.pr_gate_duration).
 #
 # Triggers:  pull_request (any path), push to main.
 # Recipes:   just ci-parity --core, just generate --check, and the [private] CI helpers
-#            ci-env-example-check, ci-contracts-spectral, ci-contracts-breaking (justfile).
+#            ci-env-example-check, ci-contracts-spectral, ci-contracts-breaking,
+#            ci-pr-gate-metrics (justfile).
 # Native apps: the parity job runs `just ci-parity --core` (NATIVE_LANES=none: the iOS and Android
 #            lanes print "not selected"), because ios.yml and android.yml run those lanes on their own
 #            paths. The contracts job runs the FULL `just generate --check`, so every contract change
@@ -13,6 +15,10 @@
 # Optional secrets (steps degrade gracefully when unset):
 #   TURBO_TOKEN, TURBO_TEAM   Turborepo remote cache (no Vercel account yet)
 #   GITLEAKS_LICENSE          only needed if the repo lives under a GitHub org
+#   OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS
+#                             Grafana Cloud OTLP: the summary job pushes stylist.ci.pr_gate_duration
+#                             and stylist.ci.pr_gate.runs (dashboard 01, CI row); unset (forks) = a
+#                             notice, and a failed push only warns: it never fails the gate
 #
 # Job tree (roots run in parallel; summary fails when any gate job failed or was cancelled):
 #   parity ──────┐
@@ -166,7 +172,8 @@
     needs: [parity, contracts, secrets, clone-check]
     if: always()
     runs-on: ubuntu-latest
-    timeout-minutes: 2
+    # The CI-metrics steps add a checkout and a cached node + just install to the old 2 minutes.
+    timeout-minutes: 5
     permissions:
       contents: read
       actions: read
@@ -177,9 +184,11 @@
       GH_TOKEN: ${{ github.token }}
     steps:
       - name: Report · Run duration and job results
+        id: duration
         run: |
           started=$(gh api "repos/${{ github.repository }}/actions/runs/${{ github.run_id }}" --jq .run_started_at)
           n=$(( $(date +%s) - $(date -d "$started" +%s) ))
+          echo "seconds=${n}" >> "$GITHUB_OUTPUT"
           {
             echo "## PR gate"
             echo ""
@@ -195,6 +204,33 @@
           if [ "$n" -gt 600 ]; then
             echo "::warning::PR gate took ${n}s (> 600s budget, AC-1)"
           fi
+      # CI metrics (planning/14 §4; dashboard 01, CI row): this run's duration and one run sample go
+      # to Grafana Cloud over OTLP. They never fail the gate: every step continues on error, and the
+      # recipe exits 0 without the secrets (forks) or when the push fails. The checkout and install
+      # run here, after the duration is taken, so they never count towards it.
+      - name: Report · Check out for the CI-metrics push
+        if: always()
+        continue-on-error: true
+        timeout-minutes: 1
+        uses: actions/checkout@v7
+      - name: Report · Install node and just for the CI-metrics push
+        if: always()
+        continue-on-error: true
+        timeout-minutes: 2
+        uses: jdx/mise-action@v4
+        with:
+          install_args: node just
+          cache: true
+      - name: Report · Push CI metrics (OTLP; never fails the gate)
+        if: always()
+        continue-on-error: true
+        timeout-minutes: 1
+        env:
+          OTEL_EXPORTER_OTLP_ENDPOINT: ${{ secrets.OTEL_EXPORTER_OTLP_ENDPOINT }}
+          OTEL_EXPORTER_OTLP_HEADERS: ${{ secrets.OTEL_EXPORTER_OTLP_HEADERS }}
+          DURATION_SECONDS: ${{ steps.duration.outputs.seconds }}
+          CONCLUSION: ${{ contains(needs.*.result, 'failure') && 'failure' || (contains(needs.*.result, 'cancelled') && 'cancelled' || 'success') }}
+        run: just ci-pr-gate-metrics --duration "$DURATION_SECONDS" --conclusion "$CONCLUSION"
       - name: Report · Fail when any gate job failed
         if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')
         run: |
```

Dashboard check (`docs/observability/grafana/dashboards/01-service-health.json`, CI row, read
2026-09-27): the four panels query `stylist_ci_pr_gate_duration_seconds{conclusion="success"}`
(`max by (workflow)`, `quantile_over_time(0.95, …[$__range])`) and
`count_over_time(stylist_ci_pr_gate_runs_total{conclusion="success"[, attempt!="1"]}[…])`. They
filter on no resource label (`job`, `service_name`, `deployment_environment_name`). The payload
matches: gauge `stylist.ci.pr_gate_duration` unit `s` with `workflow`, `conclusion`; cumulative
counter `stylist.ci.pr_gate.runs` unit `{run}` with `attempt`, `conclusion`; resource
`service.name=ci` only (no `service.instance.id`, no `deployment.environment.name`, which would add
a `ci` entry to the dashboard's `$env` list through `target_info`). No correction is needed.
`scripts/test/ci-metrics.test.sh` now fails if the panels query another series or label. Two
limits, not defects: Prometheus lookback repeats each run's single gauge sample across about 5 minutes
of steps, so "one point per run" shows as a short run of points; and two runs finishing within
milliseconds of each other can make Mimir reject the later-timestamped-but-earlier-arriving sample as
out of order, which the script reports as a partial-success warning.

## E. `.github/workflows/portability.yml` (optional)

```diff
--- a/.github/workflows/portability.yml
+++ b/.github/workflows/portability.yml
@@ -12,9 +12,9 @@
 # paths; otherwise weekly + manual.
 #
 # Triggers:  workflow_dispatch, schedule Monday 04:00 UTC, pull_request touching scripts/**,
-#            justfile, mise.toml, .npmrc, tools/**/*.sh or this file.
-# Recipes:   just doctor, format --check, lint (+ --fixtures), typecheck, arch-check
-#            (+ --fixtures), generate --check, security-scan, test.
+#            justfile, mise.toml, .npmrc, tools/**/*.sh, tools/**/*.mjs or this file.
+# Recipes:   just doctor, format --check, lint (+ --fixtures), flags-report --fixtures, typecheck,
+#            arch-check (+ --fixtures), generate --check, security-scan, test.
 # Required secrets: none (GITLEAKS_LICENSE only under an org).
 #
 # Job tree:
@@ -32,6 +32,7 @@
       - 'mise.toml'
       - '.npmrc'
       - 'tools/**/*.sh'
+      - 'tools/**/*.mjs'
       - '.github/workflows/portability.yml'
 
 permissions:
@@ -129,6 +130,8 @@
         run: just lint
       - name: Verify · Lint fixtures
         run: just lint --fixtures
+      - name: Verify · Flag report fixtures
+        run: just flags-report --fixtures
       - name: Verify · Typecheck
         run: just typecheck
       - name: Verify · Architecture boundaries
```

`just test` in this workflow already runs the two new tooling suites (section I adds them to
`test-tooling`), so the macOS leg exercises them under `/bin/bash` 3.2.

## F. `.github/workflows/README.md`

Table cells re-padded to the existing column widths (checked: every row still splits into cells of
19, 190, 213, 119 and 151 characters, so `prettier --check` keeps passing).

```diff
--- a/.github/workflows/README.md
+++ b/.github/workflows/README.md
@@ -1,18 +1,18 @@
 # CI workflows
 
-All jobs call `just` recipes from the root `justfile` (15 §5.1); YAML never re-implements a recipe. CI-only glue that has no place in the public recipe catalog lives in `[private]` `ci-*` recipes (hidden from `just --list`, bodies in `scripts/ci/`). Toolchain comes from `mise.toml` via `.github/actions/setup` (or `jdx/mise-action` with `install_args` in the iOS lane). Runners are Linux except the `macos-26` leg of `portability` and the `macos` job of `ios` (runner label `xcode-27`).
+All jobs call `just` recipes from the root `justfile` (15 §5.1); YAML never re-implements a recipe. CI-only glue that has no place in the public recipe catalog lives in `[private]` `ci-*` recipes (hidden from `just --list`, bodies in `scripts/ci/`, or in `tools/` for a Node tool). Toolchain comes from `mise.toml` via `.github/actions/setup` (or `jdx/mise-action` with `install_args` in the iOS lane and the pr-gate summary job). Runners are Linux except the `macos-26` leg of `portability` and the `macos` job of `ios` (runner label `xcode-27`).
 
 Native apps: the aggregate recipes (`just lint`, `format`, `arch-check`, `test`, `generate`) include an iOS and an Android lane through `scripts/native-lane.sh`. The native lanes run in `ios.yml` and `android.yml`; every other workflow sets `NATIVE_LANES: none` (pr-gate's parity job runs `just ci-parity --core`), so those lanes print "not selected" there instead of running twice. The one exception is pr-gate's `contracts` job, which runs the full `just generate --check`: every PR proves the Swift and Kotlin clients match the contract. With `CI=true` a selected lane whose toolchain is missing fails; it never passes silently.
 
 | Workflow          | Trigger                                                                                                                                                                                      | Tier                                                                                                                                                                                                                | Required secrets                                                                                                      | Status                                                                                                                                                |
 | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
-| `pr-gate.yml`     | `pull_request`, `push` to `main`                                                                                                                                                             | 1 - PR fast gate (< 10 min, `ci.pr_gate_duration_seconds` in job summary)                                                                                                                                           | none (`TURBO_TOKEN`/`TURBO_TEAM` optional; `GITLEAKS_LICENSE` only under an org)                                      | active (`clone-check` is a placeholder: NFR-TEAM-040 tool undecided; oasdiff skips while `packages/contracts/openapi.bundle.json` is absent)          |
+| `pr-gate.yml`     | `pull_request`, `push` to `main`                                                                                                                                                             | 1 - PR fast gate (< 10 min, `ci.pr_gate_duration_seconds` in job summary, pushed as `stylist.ci.*` over OTLP)                                                                                                       | none (`TURBO_TOKEN`/`TURBO_TEAM`, `OTEL_EXPORTER_OTLP_*` optional; `GITLEAKS_LICENSE` only under an org)              | active (`clone-check` is a placeholder: NFR-TEAM-040 tool undecided; oasdiff skips while `packages/contracts/openapi.bundle.json` is absent)          |
 | `affected.yml`    | `pull_request` touching `apps/api/**`, `packages/db/**`, `packages/contracts/**`, `pnpm-lock.yaml`                                                                                           | 2 - affected-module (< 25 min)                                                                                                                                                                                      | none (pgvector service container); staging proof runs on a scratch database restored from the staging backup (DEC-43) | active                                                                                                                                                |
-| `nightly.yml`     | `schedule` 03:00 UTC, `workflow_dispatch`, `workflow_call`                                                                                                                                   | 3 - nightly, non-blocking                                                                                                                                                                                           | none                                                                                                                  | active (`ml-eval` exit 2 = skipped; `expired-flags` and `maestro` are placeholders)                                                                   |
+| `nightly.yml`     | `schedule` 03:00 UTC, `workflow_dispatch`, `workflow_call`                                                                                                                                   | 3 - nightly, non-blocking                                                                                                                                                                                           | none                                                                                                                  | active (`ml-eval` exit 2 = skipped; `maestro` is a placeholder)                                                                                       |
 | `pre-release.yml` | `push` to `release/**`, `workflow_dispatch`                                                                                                                                                  | 4 - pre-release skeleton                                                                                                                                                                                            | none in P02                                                                                                           | placeholder (reuses nightly; device-matrix perf, store size gate, a11y checklist, restore drill print `NOT IMPLEMENTED (P14)`)                        |
-| `ios.yml`         | `pull_request` / `push` to `main` touching `apps/ios/**`, `packages/contracts/**`, `tools/codegen/gen-swift.sh`, `justfile`, `mise.toml`, `scripts/native-lane.sh`; `workflow_dispatch`      | native iOS lane: Linux checks (SwiftLint, swift-format, bans + fixtures, package tests in Docker `swift:6.4`), then the `macos` job on `xcode-27` (XcodeGen project, unsigned Dev simulator build, simulator tests) | none (TestFlight secrets come with the future, human-approved upload lane)                                            | active, not a required check (the `xcode-27` image is a preview; `.github/actionlint.yaml` declares the label)                                        |
-| `android.yml`     | `pull_request` / `push` to `main` touching `apps/android/**`, `packages/contracts/**`, `tools/codegen/gen-kotlin.sh`, `justfile`, `mise.toml`, `scripts/native-lane.sh`; `workflow_dispatch` | native Android lane: verify (Spotless, Android Lint + module graph, detekt) then test (unit + Robolectric) and build (debug, preview, unsigned release APKs)                                                        | none (Play signing comes with the future, human-approved upload lane)                                                 | active, not a required check                                                                                                                          |
-| `portability.yml` | `workflow_dispatch`, `schedule` Monday 04:00 UTC, `pull_request` touching `scripts/**`, `justfile`, `mise.toml`, `.npmrc`, `tools/**/*.sh`                                                   | tooling portability: `scripts/bootstrap.sh` (no setup action on purpose) + every gate on `macos-26` (arm64) and `ubuntu-latest` (< 30 min, `ci.portability_duration_seconds` in job summary)                        | none (`GITLEAKS_LICENSE` only under an org)                                                                           | active; macOS runner has no Docker: `just doctor` is non-blocking there and `just test` runs with `SKIP_DOCKER_TESTS=1` (docs/DEVELOPING-ON-MACOS.md) |
+| `ios.yml`         | `pull_request` / `push` to `main` touching `apps/ios/**`, `packages/contracts/**`, `tools/codegen/gen-swift.sh`, `justfile`, `mise.toml`, `scripts/native-lane.sh`; `workflow_dispatch`      | native iOS lane: Linux checks (SwiftLint, swift-format, bans + fixtures, package tests in Docker `swift:6.4`), then the `macos` job on `xcode-27` (XcodeGen project, unsigned Dev simulator build, simulator tests) | `POSTHOG_CLI_API_KEY` (+ vars `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST`): dSYM upload, never on PRs                | active, not a required check (the `xcode-27` image is a preview; `.github/actionlint.yaml` declares the label)                                        |
+| `android.yml`     | `pull_request` / `push` to `main` touching `apps/android/**`, `packages/contracts/**`, `tools/codegen/gen-kotlin.sh`, `justfile`, `mise.toml`, `scripts/native-lane.sh`; `workflow_dispatch` | native Android lane: verify (Spotless, Android Lint + module graph, detekt) then test (unit + Robolectric) and build (debug, preview, unsigned release APKs)                                                        | main only: `POSTHOG_API_KEY`, `POSTHOG_CLI_API_KEY` + vars `POSTHOG_HOST`, `POSTHOG_CLI_PROJECT_ID`/`_HOST`           | active, not a required check                                                                                                                          |
+| `portability.yml` | `workflow_dispatch`, `schedule` Monday 04:00 UTC, `pull_request` touching `scripts/**`, `justfile`, `mise.toml`, `.npmrc`, `tools/**/*.sh`, `tools/**/*.mjs`                                 | tooling portability: `scripts/bootstrap.sh` (no setup action on purpose) + every gate on `macos-26` (arm64) and `ubuntu-latest` (< 30 min, `ci.portability_duration_seconds` in job summary)                        | none (`GITLEAKS_LICENSE` only under an org)                                                                           | active; macOS runner has no Docker: `just doctor` is non-blocking there and `just test` runs with `SKIP_DOCKER_TESTS=1` (docs/DEVELOPING-ON-MACOS.md) |
 
 ## Workflow shape
 
@@ -24,8 +24,9 @@
 
 ## Shared pieces
 
-- `.github/actions/setup/action.yml` - composite: `jdx/mise-action` (cache on), pnpm store cache keyed on `pnpm-lock.yaml`, `pnpm install --frozen-lockfile`, optional `uv sync --frozen` under `workers/**`.
+- `.github/actions/setup/action.yml` - composite: `jdx/mise-action` (cache on; installs every `mise.toml` tool, posthog-cli included, even with `install: 'false'`, which only skips `pnpm install`), pnpm store cache keyed on `pnpm-lock.yaml`, `pnpm install --frozen-lockfile`, optional `uv sync --frozen` under `workers/**`.
 - `.github/actionlint.yaml` - declares runner labels newer than actionlint's built-in list (`xcode-27`); `just lint` runs actionlint over every workflow.
 - `.gitleaks.toml` (repo root) - extends the default ruleset, adds an `age` secret-key rule, allowlists `.env.example`, `planning/**`, `**/*.enc.yaml`, `pnpm-lock.yaml`, `uv.lock`, `.sops.yaml` (age recipients, not secrets), and the gitignored native build caches (`apps/ios/**/.build/`, `apps/ios/**/DerivedData/`, `apps/android/**/build/`, `apps/android/**/.gradle/`, `apps/android/**/.kotlin/`; path-only, no rule allowlisted), proven by `scripts/security/gitleaks-fixtures.sh` in `just ci-parity`.
+- Secrets and variables: API keys and OTLP credentials are repository secrets; hosts and project ids are repository variables (`vars.*`). `pull_request` runs never receive a PostHog key; an empty value switches its step off (a notice, or a skipped Gradle task) instead of failing the build.
 
 Action pins (major tags, verified against each repo's latest release on 2026-09-09): `actions/checkout@v7`, `actions/cache@v6`, `actions/upload-artifact@v7`, `jdx/mise-action@v4`, `gitleaks/gitleaks-action@v3`, `gradle/actions/setup-gradle@v6`. Renovate keeps them current (15 §9).
```

## G. GitHub secrets and variables (human only)

API keys and OTLP credentials are **secrets**; hosts and project ids are **variables** (`vars.*`).
Only `secrets/dev.enc.yaml` exists today (no staging or prod file), so every value below comes from
it. Key names in that file, checked 2026-09-27: `OTEL_EXPORTER_OTLP_ENDPOINT`,
`OTEL_EXPORTER_OTLP_HEADERS`, `POSTHOG_API_KEY` and `POSTHOG_HOST` are present. The three
`POSTHOG_CLI_*` keys are **not** there yet: after C1's `.env.example` change lands, add them with
`just secrets-edit dev`, then run the snippet.

| Name                          | Kind     | Read by                                                       | Purpose                                                                                    | sops source             |
| ----------------------------- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | secret   | pr-gate.yml `summary`                                         | Grafana Cloud OTLP base URL for the `stylist.ci.*` push                                    | dev.enc.yaml (present)  |
| `OTEL_EXPORTER_OTLP_HEADERS`  | secret   | pr-gate.yml `summary`                                         | `Authorization=Basic%20<base64 instanceId:token>` for that push                            | dev.enc.yaml (present)  |
| `POSTHOG_CLI_API_KEY`         | secret   | ios.yml `macos` (not PRs), android.yml `build` (main only)    | personal `phx_` key, error tracking write + organization read: dSYM and R8 mapping upload  | dev.enc.yaml (add it)   |
| `POSTHOG_API_KEY`             | secret   | android.yml `build` (main only)                               | `phc_` project key compiled into the APKs                                                  | dev.enc.yaml (present)  |
| `POSTHOG_HOST`                | variable | android.yml `build` (main only)                               | PostHog ingestion host compiled into the APKs (e.g. `https://eu.i.posthog.com`)            | dev.enc.yaml (present)  |
| `POSTHOG_CLI_PROJECT_ID`      | variable | ios.yml `macos`, android.yml `build`                          | numeric PostHog project id for the symbol uploads                                          | dev.enc.yaml (add it)   |
| `POSTHOG_CLI_HOST`            | variable | ios.yml `macos`, android.yml `build`                          | PostHog app/API host for the uploads (e.g. `https://eu.posthog.com`, not the ingestion one) | dev.enc.yaml (add it)   |

Never CI secrets (C1's `.env.example` says dev only): `POSTHOG_SYNC_API_KEY`,
`GRAFANA_SERVICE_ACCOUNT_TOKEN`, `GRAFANA_ALERT_EMAILS`.

Set them from sops (bash, from the repo root, with an age identity that can decrypt
`secrets/dev.enc.yaml`). Each value goes sops → a shell variable → `printf` (a bash builtin, so it
never appears in a process list or in shell history) → the stdin of `gh`; nothing is echoed, and an
empty value is refused instead of overwriting the secret:

```bash
set_from_sops() { # set_from_sops secret|variable NAME
  local kind="$1" name="$2" value
  value="$(sops -d --extract "[\"$name\"]" secrets/dev.enc.yaml)" || return 1
  if [ -z "$value" ]; then echo "skipped $name: empty in secrets/dev.enc.yaml" >&2; return 1; fi
  printf '%s' "$value" | gh "$kind" set "$name"
}
set_from_sops secret OTEL_EXPORTER_OTLP_ENDPOINT
set_from_sops secret OTEL_EXPORTER_OTLP_HEADERS
set_from_sops secret POSTHOG_API_KEY
set_from_sops secret POSTHOG_CLI_API_KEY
set_from_sops variable POSTHOG_HOST
set_from_sops variable POSTHOG_CLI_PROJECT_ID
set_from_sops variable POSTHOG_CLI_HOST
unset -f set_from_sops
gh secret list && gh variable list   # names and dates only
```

Recommended for `OTEL_EXPORTER_OTLP_HEADERS`: a separate Grafana Cloud token for CI with only the
metrics write scope (docs/observability/grafana.md: one token per environment, so each can be revoked
alone), instead of the dev token. In bash, without echoing either value:

```bash
read -r -s -p 'Grafana Cloud OTLP instance id: ' gid; echo
read -r -s -p 'CI token (metrics write only): ' gtok; echo
printf 'Authorization=Basic%%20%s' "$(printf '%s:%s' "$gid" "$gtok" | base64 | tr -d '\n')" \
  | gh secret set OTEL_EXPORTER_OTLP_HEADERS
unset gid gtok
```

## H. Doc 15 (`planning/15-team-workflow-and-ai-agent-operations.md`, human-only)

`ci-pr-gate-metrics` is `[private]`, so it is not in `just --summary` and needs no §5 row (DC-15
compares §5 with `just --summary`). Two rows are missing today:

§5 catalog, after the `just sbom` row (`just docs-check --strict` reports DC-15 for it now):

```diff
 | `just sbom` | Generate the SPDX + CycloneDX SBOM into `artifacts/sbom/` (same syft invocation `security-scan` runs) |
+| `just flags-report` | Feature-flag expiry report (14 §11): one row per flag in `packages/shared-kernel/registry/feature-flags.json` with owner, `expiresAt` and days left or overdue; exit 1 when a rollout or experiment flag is past expiry (> 30 days overdue = DEFECT), kill-switches exempt; runs nightly; `--fixtures` proves it still fails (in `ci-parity`) |
```

§1.2 pin table, after the XcodeGen row:

```diff
 | XcodeGen, xcbeautify | 2.46.0, 3.2.1 (macOS only) | `apps/ios/project.yml` → `.xcodeproj`; readable `xcodebuild` output |
+| posthog-cli | 0.18.7 (`npm:@posthog/cli`) | dSYM upload after `just ios-build` and the R8 mapping upload of the Android preview/release builds (PostHog error tracking); runs only when `POSTHOG_CLI_*` are set |
```

## I. `justfile` (lead applies after C1's `observability-sync` recipe lands)

The justfile is single-writer and C1's worktree has uncommitted justfile edits, so C2 did not edit it.
C1's hunk only inserts a recipe above `# --- dev servers`; these hunks do not overlap it (at least two
unchanged lines separate them). Verified on a scratch copy: `just --summary` parses it (51 public
recipes, `ci-pr-gate-metrics` hidden as intended), `bash -n` and `shellcheck -s bash` pass on the
new `dev-workers` body, and each string `scripts/test/dev-service-names.test.sh` expects is present.
The service names are quoted because shellcheck reads `OTEL_SERVICE_NAME=jobs cmd` as an assignment
from the `jobs` builtin (SC2209). The two new suites run with `bash <file>` because this agent cannot
set the executable bit; `chmod +x scripts/test/ci-metrics.test.sh scripts/test/dev-service-names.test.sh`
before committing and dropping the `bash ` prefix is equally fine.

```diff
--- a/justfile
+++ b/justfile
@@ -48,12 +48,12 @@
 
 # --- dev servers ---------------------------------------------------------------
 
-# Compose stack (Postgres+pgvector) + NestJS API in watch mode (tsx; reads the repo-root .env)
+# Compose stack (Postgres+pgvector) + NestJS API in watch mode (tsx; reads the repo-root .env); OTel service.name `api` is set here, so an OTEL_SERVICE_NAME in the shared .env never renames it
 dev-api *args:
     docker compose up -d --wait postgres
-    pnpm --filter @ai-stylist/api dev "$@"
+    OTEL_SERVICE_NAME='api' pnpm --filter @ai-stylist/api dev "$@"
 
-# Compose Postgres + pg-boss jobs process (apps/api src/jobs/main.ts, tsx watch; needs `just db-migrate`) in the background + segmentation worker (uvicorn --reload on :8001; args go to uvicorn)
+# Compose Postgres + pg-boss jobs process (apps/api src/jobs/main.ts, tsx watch; needs `just db-migrate`) in the background + segmentation worker (uvicorn --reload on :8001; args go to uvicorn); both read the repo-root .env, with OTel service.name `jobs` and `segmentation` set per process
 dev-workers *args:
     #!/usr/bin/env bash
     set -euo pipefail
@@ -70,13 +70,17 @@
     trap stop_jobs EXIT
     trap 'exit 130' INT
     trap 'exit 143' TERM
-    pnpm --filter @ai-stylist/api run dev:jobs &
+    # One .env serves every process, so each gets its service name here: an exported variable beats
+    # Node's --env-file-if-exists and uvicorn's --env-file (scripts/test/dev-service-names.test.sh).
+    OTEL_SERVICE_NAME='jobs' pnpm --filter @ai-stylist/api run dev:jobs &
     jobs_pid=$!
-    uv run --project workers/ml/segmentation uvicorn ai_stylist_segmentation.main:app --reload --port 8001 "$@"
+    # The worker reads the repo-root .env like the jobs process; uvicorn --env-file fails on a missing file.
+    if [[ -f .env ]]; then set -- --env-file .env "$@"; fi
+    OTEL_SERVICE_NAME='segmentation' uv run --project workers/ml/segmentation uvicorn ai_stylist_segmentation.main:app --reload --port 8001 "$@"
 
 # --- quality gates (* = part of ci-parity) -------------------------------------------
 
-# * Run tests: full suite via turbo + the native lanes, or one module's tests/ dir (`just test recommendation`; `just test ios` / `just test android` = that app's unit tests; `just test secrets` = the sops+age shell suite; `just test tooling` = the scripts/test shell suites: bootstrap/doctor, contracts-breaking, test-regression; `just test platform` = the `api` + `platform-docker` vitest projects); SKIP_DOCKER_TESTS=1 leaves out the Testcontainers `migrations` and `platform-docker` projects (runners without Docker only)
+# * Run tests: full suite via turbo + the native lanes, or one module's tests/ dir (`just test recommendation`; `just test ios` / `just test android` = that app's unit tests; `just test secrets` = the sops+age shell suite; `just test tooling` = the scripts/test shell suites: bootstrap/doctor, contracts-breaking, test-regression, ci-metrics, dev service names; `just test platform` = the `api` + `platform-docker` vitest projects); SKIP_DOCKER_TESTS=1 leaves out the Testcontainers `migrations` and `platform-docker` projects (runners without Docker only)
 test module='':
     #!/usr/bin/env bash
     set -euo pipefail
@@ -139,6 +143,8 @@
     scripts/test/bootstrap-doctor.test.sh
     scripts/test/contracts-breaking.test.sh
     scripts/test/regression.test.sh
+    bash scripts/test/ci-metrics.test.sh
+    bash scripts/test/dev-service-names.test.sh
 
 # Native unit tests for the full `just test` (lane/toolchain policy: scripts/native-lane.sh)
 [private]
@@ -284,6 +290,11 @@
 ci-osv-source:
     scripts/ci/osv-scan.sh
 
+# Push this pr-gate run's CI metrics (stylist.ci.pr_gate_duration + stylist.ci.pr_gate.runs, OTLP/HTTP to OTEL_EXPORTER_OTLP_ENDPOINT; tools/ci-metrics): `--duration <s> --conclusion <success|failure|cancelled>`, workflow + attempt from GITHUB_WORKFLOW / GITHUB_RUN_ATTEMPT; an empty endpoint or a failed push exits 0 (never fails the gate)
+[private]
+ci-pr-gate-metrics *args:
+    node tools/ci-metrics/push-pr-gate-metrics.mjs "$@"
+
 # Run the PR gates locally: format --check, lint (+ fixtures), typecheck, arch-check (+ fixtures), docs-check --strict (+ fixtures, incl. the hook replay), flags-report --fixtures, generate --check, test, native builds, security-scan (+ license, gitleaks and osv-scanner fixtures); native toolchains are required (Xcode-only steps skip on Linux with a notice); `--core` = pr-gate's parity job (native lanes run in ios.yml / android.yml)
 ci-parity *args:
     #!/usr/bin/env bash
```

After applying I: `bash scripts/test/dev-service-names.test.sh` goes from 1 failure (the recipe-wiring
case, today) to all passed, and `just test tooling` runs both new suites.
