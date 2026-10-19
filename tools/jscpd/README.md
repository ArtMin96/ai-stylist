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

Measured on 2026-10-20 with jscpd 4.3.0: 27 clones, 238 duplicated lines in 49,504 lines, a share
of **0.48%**. `threshold` is `0.48`. The first baseline (2026-10-13: 28 clones, 249 of 49,235 lines,
0.51%) went down when the `strictSettings` blocks of the SwiftPM manifests were marked (see
[Ignore markers](#ignore-markers)).

| Format     | Files | Lines  | Clones | Duplicated lines | Share |
| ---------- | ----- | ------ | ------ | ---------------- | ----- |
| typescript | 192   | 17,617 | 21     | 182              | 1.03% |
| kotlin     | 44    | 3,149  | 2      | 23               | 0.73% |
| python     | 20    | 2,408  | 1      | 5                | 0.21% |
| bash       | 81    | 15,049 | 2      | 22               | 0.15% |
| javascript | 52    | 9,621  | 1      | 6                | 0.06% |
| swift      | 25    | 1,660  | 0      | 0                | 0.00% |
| Total      | 414   | 49,504 | 27     | 238              | 0.48% |

What the number means:

- jscpd counts one copy of each clone, as its last line minus its first, and rounds the share to
  two decimals: 238 / 49,504 is 0.4808%, reported as 0.48. So `0.48` is the lowest value this tree
  passes, and `0.47` fails it.
- At 49,504 lines the gate passes up to 240 duplicated lines and fails at 241. That is two lines
  of room, and the smallest clone jscpd counts is five lines (`minLines`), so one more clone in a
  tree of this size fails the gate.
- It limits a share, not a count: the tree may not become more duplicated than it is today, about
  one line in 200. New code without a clone lowers the measured share and so makes room: about
  1,000 new lines for one five-line clone on average, and about 600 on the day of this baseline,
  because the share sat in the upper part of its rounding step. The third rule above closes that
  room, and only review enforces it.
- All 27 clones are in tests and test helpers. No clone is in production source.

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

## Ignore markers

jscpd skips every line from the one that holds `jscpd:ignore-start` through the one that holds
`jscpd:ignore-end`, in any scanned format (read from the 4.3.0 tokenizer). The skipped lines still
count in the total, so a marked block lowers the share as a removed clone would.

The owner allowed them on 2026-10-20 (PR #32, AI-186), for one case only: identical blocks that
the language cannot share. Today that is the `strictSettings` block of the three SwiftPM manifests,
`apps/ios/Packages/{Core,Features,DesignSystem}/Package.swift`: a manifest cannot import code, and
DEC-87 keeps DesignSystem a package of its own. The doc comment of each copy names the others, which
are kept in sync by hand.

- Every start marker carries its reason on the same line:
  `// jscpd:ignore-start (<why the language cannot share this block>)`.
- Mark every copy, so that a reader of any of them sees the exception.
- Code that can be shared is never marked: extract a function, a test helper, a Gradle convention
  plugin. A marker on such code is a weakened gate, like a higher `threshold`, and needs a human
  decision.

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
