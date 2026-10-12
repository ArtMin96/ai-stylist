# tools/jscpd — `just clone-check`

[jscpd](https://github.com/kucherenko/jscpd) is the copy/paste gate (NFR-TEAM-040, P02 AC-9,
DEC-83). It is the mechanical half of the search-before-write rule in the root `CLAUDE.md`: a block
that was copied instead of reused shows up here. `just clone-check` runs `clone-check.sh`, which
calls `jscpd --config tools/jscpd/jscpd.json apps packages workers scripts tools` from the repo root
and fails when the share of duplicated lines is above `threshold` in that file.
`just clone-check --fixtures` runs `check-fixtures.sh`. Both run in `just ci-parity`.

jscpd is a root devDependency (`package.json`, resolved by `pnpm-lock.yaml`; 4.3.0 when the gate was
written), so the gate needs no runtime beyond the pinned Node and no network. The facts below were
read from that version's README and source.

Exit 0 when the share is at or below the threshold, 1 above it (or when jscpd is not installed, or
a fixture case fails), 2 for an unknown argument.

## What is scanned

- Roots (`SCOPE` in `clone-check.sh`): `apps`, `packages`, `workers`, `scripts`, `tools`. Tests
  are scanned like any other source.
- `format`: `typescript` (`.ts`, `.mts`, `.cts`), `javascript` (`.js`, `.mjs`, `.cjs`: the Node
  tools), `python`, `kotlin` (`.kt`, `.kts`), `swift`, `bash` (`.sh`, and an executable file
  without an extension whose shebang names a shell). A file in another format is not read.
- `minTokens` 50, `minLines` 5, `mode` `mild`: the size of the smallest block that counts as a
  clone. These are jscpd's defaults, written out so that a change of the defaults cannot change
  what the gate reports.
- `maxLines` 5000, `maxSize` `1mb`: jscpd skips a larger file without a word, and its defaults
  (1000 lines, 100kb) would skip `scripts/security/tests/secrets.test.sh` (1886 lines on
  2026-10-13).
- `gitignore` `false`: with it on, jscpd also reads the `.gitignore` files above the scanned
  directories, `.git/info/exclude` and the developer's global excludes file, so the scanned set
  would differ between machines. The `ignore` list below covers what git ignores under the roots.
- `noTips` `true`: without it jscpd ends every local run with promotional lines, one of which
  suggests installing an agent skill with `npx`. The gate prints findings only.

## What is excluded (`ignore`)

- Dependencies and build output: `node_modules`, `.venv`, `dist`, `build`, `.build`, `.gradle`,
  `.kotlin`, `.turbo`, `DerivedData`, `coverage`.
- Generated trees, which `just generate` rewrites and nobody edits: `**/gen/**`
  (`packages/contracts/gen`, `packages/shared-kernel/src/gen`) and `**/generated/**`
  (`workers/ml/generated`).
- Fixtures: `**/fixtures/**` (the gate fixtures under `tools/`, `apps/ios/scripts/fixtures`,
  `packages/contracts/tests/fixtures`). They are broken or repetitive on purpose.
- `**/gradlew`: the Gradle wrapper script, which Gradle writes. jscpd would read it as `bash`
  through its shebang.
- Lockfiles, `prototype/**` and `planning/**`. None is in a scanned format or under a scanned root
  today; they are listed so that adding a format or a root cannot pull them in.

A pattern that starts with `**/` matches at any depth, against paths relative to the working
directory. Any other pattern is resolved from the directory of `jscpd.json`, which is why the last
two read `../../prototype/**` and `../../planning/**`.

## The threshold

`threshold` is the highest share of duplicated lines, in percent over every scanned format
(`statistics.total.percentage` in the report: duplicated lines over total lines, two decimals), at
which the gate passes. jscpd fails only when the share is greater than it. Three rules:

- It is the measured value of the tree, never a target with room in it.
- It never goes up. A change that adds a clone removes it again by reusing or extracting the shared
  code. Accepting more duplication is a weakened gate: it needs an ADR and a human decision.
- It goes down. A change that lowers the measured share lowers `threshold` to the new value in the
  same change, so the room it freed cannot be spent on a new clone.

### Baseline

Measured on 2026-10-13 with jscpd 4.3.0: 28 clones, 249 duplicated lines in 49,235 lines, a share
of **0.51%**. `threshold` is `0.51`.

| Format     | Files | Lines  | Clones | Duplicated lines | Share |
| ---------- | ----- | ------ | ------ | ---------------- | ----- |
| typescript | 192   | 17,607 | 21     | 182              | 1.03% |
| kotlin     | 41    | 3,117  | 2      | 23               | 0.74% |
| swift      | 20    | 1,562  | 1      | 11               | 0.70% |
| python     | 20    | 2,408  | 1      | 5                | 0.21% |
| bash       | 79    | 14,920 | 2      | 22               | 0.15% |
| javascript | 52    | 9,621  | 1      | 6                | 0.06% |
| Total      | 404   | 49,235 | 28     | 249              | 0.51% |

What the number means:

- jscpd counts one copy of each clone, as its last line minus its first, and rounds the share to
  two decimals: 249 / 49,235 is 0.5057%, reported as 0.51. So `0.51` is the lowest value this tree
  passes, and `0.50` fails it.
- At 49,235 lines the gate passes up to 253 duplicated lines and fails at 254. That is four lines
  of room, and the smallest clone jscpd counts is five lines (`minLines`), so one more clone in a
  tree of this size fails the gate.
- It limits a share, not a count: the tree may not become more duplicated than it is today, about
  one line in 200. New code without a clone lowers the measured share and so makes room: about
  1,000 new lines for one five-line clone on average, and fewer than 100 on the day of the
  baseline, because the share sat near the top of its rounding step. The third rule above closes that room,
  and only review enforces it.
- 27 of the 28 clones are in tests and test helpers. The other one is the `strictSettings` block
  that the two `Package.swift` manifests share. No clone is in production source.

### Follow-ups: the five largest clones

From the JSON report of the baseline run. Its `lines` field counts both end lines, so it is one
higher than the number in the console output and in the table above. Removing one lowers the
measured share; lower `threshold` in the same change.

1. 19 lines, typescript: `apps/api/src/jobs/tests/fake-segmentation-worker.ts:88-106` and
   `apps/api/src/platform/tests/fake-posthog.ts:84-102`. The handle of the fake HTTP server (the
   behaviour switch and `close`); a second clone of 10 lines sits at `:33-42` and `:24-33`.
2. 18 lines, kotlin: `apps/android/app/src/test/kotlin/app/aistylist/app/AppContainerTest.kt:21-38`
   and
   `apps/android/core/analytics/src/test/kotlin/app/aistylist/core/analytics/ConsentGatedAnalyticsTest.kt:19-36`.
   The `RecordingSink` test double.
3. 17 lines, bash: `scripts/test/bootstrap-doctor.test.sh:39-55` and
   `scripts/test/ci-metrics.test.sh:79-95`. `expect_eq` and `expect_contains`; `dev.test.sh` and
   `dev-service-names.test.sh` define the same `expect_eq`.
4. 14 lines, typescript: `apps/api/src/jobs/tests/demo-outbox-flow.test.ts:69-82` and
   `apps/api/src/jobs/tests/segmentation-client.test.ts:24-37`. The `beforeAll`, `afterAll` and
   `beforeEach` of the fake segmentation worker.
5. 13 lines, typescript: `apps/api/src/platform/tests/acceptance-lifecycle.docker.test.ts:131-143`
   and `apps/api/src/platform/tests/outbox-relay.docker.test.ts:91-103`. The `relay()` factory of
   the outbox Docker suites; seven more clones link these two files and
   `apps/api/src/jobs/tests/acceptance-dispatch.docker.test.ts`.

## Reading a run

jscpd prints every clone as `Clone found (<format>):` with both locations, then one table row per
format ("Files analyzed" is the number of files it read), then, above the threshold,
`ERROR: jscpd found too many duplicates (<share>%) over threshold (<threshold>%)`.

The JSON report of the last run is `artifacts/clone-check/jscpd-report.json` (gitignored; it holds
the duplicated fragments). The largest clones:

```bash
jq -r '.duplicates | sort_by(-.lines) | .[:5][] | "\(.lines) lines \(.format) \(.firstFile.name):\(.firstFile.start)-\(.firstFile.end) <-> \(.secondFile.name):\(.secondFile.start)-\(.secondFile.end)"' artifacts/clone-check/jscpd-report.json
```

## Fixtures (`just clone-check --fixtures`)

`check-fixtures.sh` reads the `format` list from `jscpd.json` and runs one case per format with the
production config unchanged. `jscpd.json` ignores `**/fixtures/**`, so the cases are copied to a
temp directory under `artifacts/` and scanned from there.

- `typescript/`, `javascript/`, `python/`, `kotlin/`, `swift/`, `bash/`: two files that share one
  copied function body under different names. Each must make jscpd exit non-zero with its threshold
  error ("too many duplicates"), reporting clones of that format and of no other. The `javascript`
  files are `.mjs`.
- `_clean/`: one unrelated file per format. It must exit 0 with no clone.

A format added to `jscpd.json` without a case directory of that name fails the run, and so does a
case directory that no format names.
