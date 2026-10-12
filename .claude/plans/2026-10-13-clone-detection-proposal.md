# Proposal: clone detection with jscpd (AI-36, P02-T18, OQ-35, DEC-83)

> Status: PARTLY APPLIED (2026-10-13) by the owner's `git apply` of one patch for the guarded
> files: sections 1, 2, 3 and 5 (with the optional §12.2 line) and, of section 7,
> `tooling-engineer.md`, the `tooling-ci` rule and skill, and root `CLAUDE.md`. Not in that patch:
> sections 4 and 6, the other eight agents of section 7, sections 8 to 10. Check those against the
> tree before acting on them. Written 2026-10-13 by tooling-engineer (main checkout, base
> `aa50e96`, branch `artmins96/ai-31-p02-t12-gate-repair-allow-list-the-repo-root-env-in-the`).
> The gate itself is built in the tooling write set (`tools/jscpd/**`, `justfile`, `package.json`)
> and is not committed. This file holds what a human applies or decides: section 0 reports the
> state, including a lockfile change nobody asked for; sections 1 to 7 are text for files outside
> the tooling write set; section 8 is a decision about `handlebars`; section 9 is the owner's
> command block; section 10 is the work that needs the gate to run.

## 0. State

### What was built

`just clone-check` runs `jscpd --config tools/jscpd/jscpd.json apps packages workers scripts tools`.
`just clone-check --fixtures` runs one failing case per format plus a passing `_clean` case.
`just ci-parity` calls both after `just arch-check --fixtures`. `tools/jscpd/README.md` describes
the scope, the exclusions and the threshold rules.

**The gate has not run once.** The per-agent Bash guard has no `just clone-check*` entry (section
7), and the brief excluded `just ci-parity`. `threshold` is `0`, so the first run fails and prints
the measured share. Do not merge before section 10 has set it.

### `pnpm-lock.yaml` changed, and nobody ran an install

`just format --check` (asked for in the brief) runs `pnpm exec prettier`. pnpm 12.6.0 saw that
`package.json` had a dependency the lockfile lacked, and installed before running prettier:
`+ jscpd 4.3.0`, "Done in 7.8s". Result, 2026-10-13 00:33: `pnpm-lock.yaml` +470 lines and 0
removed (jscpd 4.3.0 and its tree, nothing else moved), and `node_modules/` holds jscpd.

- To keep it: review `git diff pnpm-lock.yaml`. It is what the `pnpm install` of section 9 would
  write, so that step becomes a no-op for jscpd.
- To discard it: `git checkout pnpm-lock.yaml`, then section 9.
- Consequence for the guard: denying `pnpm add`, `pnpm update` and `pnpm install` does not keep an
  agent from changing the lockfile. Any recipe that calls `pnpm exec` or `pnpm turbo` after a
  manifest edit does it. pnpm has a `verify-deps-before-run` setting (the string is in the pinned
  binary; its values were not checked). Worth a look by the owner; nothing was changed.

### Tool choice

jscpd is an npm package: it runs on the pinned Node from `pnpm-lock.yaml`, with no new runtime in
`mise.toml`, and one `format` list names TypeScript, JavaScript, Python, Kotlin, Swift and bash.
The others lost for these reasons:

- PMD CPD: a Java distribution that `mise.toml` does not pin (a new pinned tool and download on
  both operating systems), and no shell-script language as far as I know.
- SonarQube or SonarCloud duplication: a server or a cloud account that receives the code, so it is
  not an offline exit-code gate from a pinned version.
- Per-language checks (pylint `duplicate-code`, ESLint identical-function rules, nothing
  equivalent in SwiftLint or detekt) and Simian (proprietary licence): several configs and
  thresholds with Swift, Kotlin and shell uncovered, or a licence outside the OSS-first rule.

**The three lines about the other tools are not checked against current docs.** This pass had no
documentation or web tool: ToolSearch was not available to the agent, so neither context7 nor
Linear could be loaded, and the Bash guard allows no network client. Confirm them before DEC-83
lands. For the same reason the Linear ticket AI-36 was not read: the list of places that spell the
placeholder job's name (sections 1, 2 and 4) comes from `rg 'Clone detection|clone-check'` over the
repository. Compare it with the ticket's list.

jscpd itself was checked against the installed 4.3.0 (`node_modules/jscpd/README.md` and the
`dist/` sources of `jscpd`, `@jscpd/finder`, `@jscpd/core`, `@jscpd/tokenizer`), by reading only:

| Fact                                                                                                                                                             | Where                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| A `threshold` of `0` is enforced; the check is `threshold < statistics.total.percentage`, so equality passes                                                     | `@jscpd/finder` `ThresholdReporter`             |
| Above the threshold it prints `ERROR: jscpd found too many duplicates (…%) over threshold (…%)`, throws, and the bin exits 1                                     | same; `jscpd/dist/bin/jscpd.js`                 |
| Every clone is printed as `Clone found (<format>):`                                                                                                              | `@jscpd/finder` `cloneFound`                    |
| Extensions: `typescript` ts, mts, cts; `javascript` js, mjs, cjs; `kotlin` kt, kts; `python` py; `swift`; `bash` sh (and shell shebangs of extensionless files)  | `@jscpd/tokenizer` formats; `readShebangFormat` |
| Defaults: `minTokens` 50, `minLines` 5, `mode` mild, `maxLines` 1000, `maxSize` 100kb (larger files are skipped), `gitignore` true, `noTips` only when `CI` set  | `@jscpd/core` `getDefaultOptions`; README       |
| A config `ignore` pattern that does not start with `**/` is resolved from the config file's directory; `**/` patterns match paths relative to the working dir    | `resolveIgnorePattern`, `getFilesToDetect`      |
| The JSON report is `<output>/jscpd-report.json` with `statistics` and `duplicates[]` (`format`, `lines`, `firstFile`, `secondFile`), written before the throw    | `@jscpd/finder` `JsonReporter`                  |

Three things in that version shaped the config:

- `"noTips": true`. Without it every local run ends with promotional lines, one of them
  "Auto-refactor with AI: npx skills add kucherenko/jscpd". That is text aimed at coding agents,
  printed into the output of a gate that agents run. It is suppressed; nothing was installed.
- `"gitignore": false`. With it on, jscpd reads the developer's global excludes file and
  `.git/info/exclude`, so the scanned set would differ between machines. `git ls-files` shows that
  the explicit `ignore` list already covers every git-ignored source file under the five roots.
- `maxLines` 5000 and `maxSize` 1mb, or `scripts/security/tests/secrets.test.sh` (1886 lines) is
  skipped without a word.

### What jscpd brought into the lockfile

- No new finding: `just security-scan` after the install reports the same 6 advisories on the same
  4 package entries as before it. `pnpm audit` and the license gate did not run (the recipe stops
  at osv-scanner); jscpd is MIT and a devDependency, so the license gate can only warn.
- A third dependency path to the ignored `braces` advisory GHSA-vfj7-8cjw-p6xm: `jscpd` ->
  `@jscpd/finder@4.3.0` -> `fast-glob@3.3.3` -> `micromatch@4.0.8`. Gate tooling only; what reaches
  it is repository content. The reason in `osv-scanner.toml` and the 2026-10-13 ledger entry now
  say so. The id and the expiry are unchanged.

## 1. `.github/workflows/pr-gate.yml` (path-guarded; a human applies it)

Generated with `diff -u` against a full proposed copy; `actionlint` on that copy exits 0. It
replaces the placeholder job with a real one, renames the check (the "(placeholder)" suffix goes),
and names the recipe in the header and in the parity step.

```diff
--- a/.github/workflows/pr-gate.yml
+++ b/.github/workflows/pr-gate.yml
@@ -3,14 +3,15 @@
 # push to main the summary job also pushes it to Grafana Cloud as stylist.ci.pr_gate_duration).
 #
 # Triggers:  pull_request (any path), push to main.
-# Recipes:   just ci-parity --core, just generate --check, and the [private] CI helpers
-#            ci-env-example-check, ci-contracts-spectral, ci-contracts-breaking,
-#            ci-pr-gate-metrics (justfile).
+# Recipes:   just ci-parity --core, just generate --check, just clone-check (+ --fixtures), and
+#            the [private] CI helpers ci-env-example-check, ci-contracts-spectral,
+#            ci-contracts-breaking, ci-pr-gate-metrics (justfile).
 # Native apps: the parity job runs `just ci-parity --core` (NATIVE_LANES=none: the iOS and Android
 #            lanes print "not selected"), because ios.yml and android.yml run those lanes on their own
 #            paths. The contracts job runs the FULL `just generate --check`, so every contract change
 #            proves the TS, Python, Swift (Docker swift:6.4) and Kotlin (JDK 25) clients are current.
 #            The PR-diff secret scan uses gitleaks/gitleaks-action directly (no recipe needed).
+#            The clone-check job runs the gate that `just ci-parity` also runs, as its own check.
 # Required secrets: none.
 # Optional secrets (steps degrade gracefully when unset):
 #   TURBO_TOKEN, TURBO_TEAM   Turborepo remote cache (no Vercel account yet)
@@ -81,7 +82,7 @@
           fi
       - name: Verify · .env.example covers every API env key
         run: just ci-env-example-check
-      - name: Verify · Run the PR gate sequence (format, lint, typecheck, arch, docs, generate, test, security)
+      - name: Verify · Run the PR gate sequence (format, lint, typecheck, arch, clones, docs, generate, test, security)
         run: just ci-parity --core
       - name: Report · Job duration
         if: always()
@@ -152,20 +153,25 @@
           GITLEAKS_ENABLE_UPLOAD_ARTIFACT: 'false'
 
   clone-check:
-    name: Gate · Clone detection (placeholder)
+    name: Gate · Clone detection
     # needs: none (root of the job tree)
     runs-on: ubuntu-latest
-    timeout-minutes: 2
+    # Same budget as the parity job: on a cold cache the setup action installs every pinned tool.
+    timeout-minutes: 10
     permissions:
       contents: read
     concurrency:
       group: ${{ github.workflow }}-clone-check-${{ github.ref }}
       cancel-in-progress: true
     steps:
-      - name: Verify · Clone detection (NOT IMPLEMENTED, NFR-TEAM-040)
-        run: |
-          echo "NOT IMPLEMENTED (NFR-TEAM-040): clone detection tool undecided"
-          echo "::notice::clone-check placeholder - tool undecided (brief §9)"
+      - name: Setup · Check out
+        uses: actions/checkout@v7
+      - name: Setup · Install toolchain and dependencies
+        uses: ./.github/actions/setup
+      - name: Verify · Duplication within the threshold (jscpd, NFR-TEAM-040)
+        run: just clone-check
+      - name: Verify · Clone fixtures still fail
+        run: just clone-check --fixtures
 
   summary:
     # Whole-run wall clock (all jobs above), the number AC-1 is measured on. Also the single job a
```

The parity job runs the same gate through `just ci-parity --core`. The separate job keeps the job
tree and the count of five required checks. Dropping the job instead would be a change of the
required checks (four), which is the owner's call.

Apply sections 1 and 4 in one commit: `scripts/test/repo-setup.test.sh` (`just test tooling`)
compares the job names of `pr-gate.yml` with `tools/github/repo-settings.json`, so one without the
other fails.

## 2. `.github/workflows/README.md` (path-guarded; a human applies it)

In the `pr-gate.yml` row of the workflow table (line 9), in the last cell, replace

```text
is a placeholder: NFR-TEAM-040 tool undecided
```

with

```text
runs `just clone-check` (jscpd, NFR-TEAM-040)
```

Both are 45 characters long, so the table stays aligned for Prettier.

## 3. `.github/workflows/portability.yml` (path-guarded; a human applies it)

Without this the macOS leg (`/bin/bash` 3.2, BSD tools) never runs `tools/jscpd/*.sh`.

Header, replace the two `# Recipes:` lines (16 and 17) with:

```yaml
# Recipes:   just doctor, format --check, lint (+ --fixtures), flags-report --fixtures, typecheck,
#            arch-check (+ --fixtures), clone-check (+ --fixtures), generate --check, security-scan,
#            test.
```

After the step `Verify · Architecture fixtures` (lines 139 and 140), insert:

```yaml
      - name: Verify · Clone detection
        run: just clone-check
      - name: Verify · Clone fixtures
        run: just clone-check --fixtures
```

## 4. The check name in four more places (same commit as section 1)

Everywhere the old string is `Gate · Clone detection (placeholder)` and the new one is
`Gate · Clone detection`. The count of checks stays five.

- `tools/github/repo-settings.json`, line 25 (tooling write set; left untouched on purpose until
  the workflow changes, see the note in section 1):

  ```diff
  -        "Gate · Clone detection (placeholder)",
  +        "Gate · Clone detection",
  ```

- `scripts/test/repo-setup.test.sh`, line 702 (tooling write set; same reason): in the `for check
  in …` list replace `'Gate · Clone detection (placeholder)'` with `'Gate · Clone detection'`.
- `docs/NEW-REPO-SETUP.md`, the "Protection of `main`" bullet (line 284): replace
  `` `Gate · Clone detection (placeholder)` `` with `` `Gate · Clone detection` ``.
- `docs/SERVICES-SETUP.md`, step 5 of the branch-protection steps (line 65): the same replacement.

When branch protection exists (it waits for the organization move, DEC-77 and DEC-82), the owner
runs `just repo-setup settings --apply` once so that GitHub requires the new name.

## 5. `planning/15-team-workflow-and-ai-agent-operations.md` §5 (human-applied)

`just docs-check --strict` reports DC-15 ("recipe 'clone-check' (just --summary) missing from the §5
catalog") until this row exists, and `just ci-parity` runs `docs-check --strict`. It is the only
finding of `just docs-check --strict` on 2026-10-13.

Add this row directly after the `just arch-check` row (line 114):

```markdown
| `just clone-check` | Clone detection (NFR-TEAM-040): jscpd over the hand-written TypeScript/JavaScript, Python, Kotlin, Swift and shell sources in `apps`, `packages`, `workers`, `scripts` and `tools` (`tools/jscpd/jscpd.json`; generated trees, fixtures, lockfiles and build output excluded); exit 1 when the share of duplicated lines is above the recorded threshold, which never goes up; `--fixtures` proves it still fails (in `ci-parity`) |
```

In the `just ci-parity` row (line 149), replace `arch-check, docs-check,` with
`arch-check, clone-check, docs-check,`.

Optional, §12.2 step 6 (line 256): replace
``Run `just arch-check` + lint (duplication rules) before completion.`` with
``Run `just arch-check`, `just clone-check` and lint before completion.``

## 6. `planning/16-risks-open-questions-and-decision-log.md` (human-applied)

Confirm the tool comparison of section 0 against current docs before this row lands.

Header, append to the `**Amended:**` list:

```markdown
 · 2026-10-13 (DEC-83 added; OQ-35 resolved — clone detection with jscpd, P02-T18)
```

Row OQ-35, replace the Notes cell (`Added 2026-10-09. The `pr-gate` job is a placeholder`) with:

```markdown
Added 2026-10-09. The `pr-gate` job was a placeholder. **Resolved 2026-10-13 by DEC-83:** jscpd, run by `just clone-check` in `just ci-parity` and in the `clone-check` job of `pr-gate`
```

New row after DEC-82:

```markdown
| DEC-83 | **(2026-10-12) Clone detection is built now, with jscpd.** The owner chose to build it in P02 instead of leaving the placeholder; the tooling pass of 2026-10-13 chose the tool (jscpd 4.3.0, a root devDependency). `just clone-check` runs it over the hand-written TypeScript/JavaScript, Python, Kotlin, Swift and shell sources (tests included; generated trees, fixtures, lockfiles, build output, `prototype/**` and `planning/**` excluded) and fails when the share of duplicated lines is above the threshold in `tools/jscpd/jscpd.json`. The threshold is the measured share of the tree on the day of the first run, never a target with room in it; it never goes up and it is lowered whenever a clean-up lowers the measured share. `just clone-check --fixtures` proves that the gate still fails for each language. Both run in `just ci-parity` and in the `clone-check` job of `pr-gate`. Consequence: jscpd is a third dependency path to the ignored `braces` advisory (lint and gate tooling only; `docs/security/dependency-ignores.md`). Resolves OQ-35 | jscpd is an npm package: it runs offline on the pinned Node from `pnpm-lock.yaml`, needs no new runtime in `mise.toml`, covers all five languages with one config and exits non-zero above the threshold. PMD CPD needs a Java distribution that is not pinned and has no shell-script language; SonarQube needs a server or an account; per-language checks leave Swift, Kotlin and shell uncovered | Owner decision 2026-10-12 ("Build it now"); NFR-TEAM-040; P02 AC-9; `tools/jscpd/README.md` (scope, threshold rules, the measured baseline); `.claude/plans/2026-10-13-clone-detection-proposal.md`; AI-36 |
```

## 7. Enforcement layer (human-applied)

Required, or the tooling agent cannot run its own gate (the per-agent Bash guard denies
`just clone-check`):

- `.claude/agents/tooling-engineer.md`, frontmatter, the `guard-agent-bash.sh` args: add
  `"just clone-check*"` after `"just arch-check*"`. The other eight agents whose args hold
  `"just arch-check*"` (android-engineer, api-engineer, architecture-reviewer, contracts-engineer,
  ios-engineer, platform-engineer, recommendation-engineer, test-engineer) need the same entry if
  they are to run the gate before handing back.
- The same file, line 45: after `` `just flags-report --fixtures` `` add
  ``, `just clone-check --fixtures` ``. Line 127: replace the line with
  `just lint --fixtures && just arch-check --fixtures && just clone-check --fixtures && just docs-check --fixtures`.

Recommended, so that the documents name the gate:

- `.claude/rules/tooling-ci.md`, the Proof line (line 48) and invariant 3 (line 62): add
  `` `just clone-check --fixtures` `` to both lists.
- `.agents/skills/tooling-ci/SKILL.md`: line 18, add `` `tools/jscpd` `` to the list of gates; in
  "Validation commands", after the `just arch-check` line add
  `just clone-check && just clone-check --fixtures # jscpd threshold; every clone fixture still fails`.
- Root `CLAUDE.md`: layout line 39, append `, jscpd/ (clone-check)`; "Standard commands", add
  `` · `just clone-check` `` after `` `just arch-check` ``.

## 8. Decision needed before the owner's commands: `handlebars`

`handlebars` 4.7.9 → 4.7.10 cannot be reached by re-resolving the lockfile. Evidence, read from the
installed manifests on 2026-10-13:

- `node_modules/eslint-plugin-boundaries/package.json` (7.2.0): `"handlebars": "4.7.9"`.
- `@boundaries/elements` 3.1.1 (its `package.json` under `node_modules/.pnpm/`): `"handlebars": "4.7.9"`.
- These are the only two dependents in `pnpm-lock.yaml`, and both are the latest releases: pnpm's
  registry metadata cache, refreshed 2026-10-12 22:15, has `eslint-plugin-boundaries` latest 7.2.0
  and `@boundaries/elements` latest 3.1.1 (both last modified 2026-08-09), and `handlebars` latest
  4.7.10 (modified 2026-10-05).

An exact pin admits no other version, so `pnpm update` leaves 4.7.9 in place and the three
advisories (GHSA-8r5x-fm3f-whwj 9.8, GHSA-p8wg-vrv2-v86f 9.2, GHSA-xw65-4hp5-5hc7 4.7) stay.
`docs/security/dependency-ignores.md` orders the remedies: bump the dependent (none exists), then a
scoped override. An ignore is not allowed while an override works. The override is a dependency
change the brief did not grant, so it is not applied. If the owner agrees, add two lines to
`pnpm-workspace.yaml` (tooling write set) **before** running section 9:

```yaml
overrides:
  '@hey-api/json-schema-ref-parser>js-yaml': ^4.3.2
  '@esbuild-kit/core-utils>esbuild': ^0.25.4
  'eslint-plugin-boundaries>handlebars': ^4.7.10
  '@boundaries/elements>handlebars': ^4.7.10
```

The `pnpm install` of section 9 then resolves 4.7.10 for both; no extra command. Reach: lint
tooling only. The plugin renders the message and selector templates of `tools/eslint/boundaries.mjs`
with it, and those are repository content. Verification after the install: `just lint` and
`just lint --fixtures` (the boundary messages still render), then `just security-scan`. The
`handlebars` row of the 2026-10-13 ledger table then becomes: Action "Overrides
`eslint-plugin-boundaries>handlebars: ^4.7.10` and `@boundaries/elements>handlebars: ^4.7.10`
(resolve 4.7.10); remove them when the plugin releases with a fixed pin", Verification the three
commands above with their results.

Without the override `just security-scan` stays red after section 9 on these three advisories only.

## 9. The owner's commands (run once, from the repo root, in this order)

```bash
cd /home/artmins96/Projects/garderi
pnpm install
pnpm update -r source-map-js
(cd prototype/g3-filament-spike/viewer && npm update source-map-js --package-lock-only)
uv lock --project workers --upgrade-package werkzeug
git status --short
```

What each does:

1. `pnpm install` brings `pnpm-lock.yaml` in line with `package.json` and `pnpm-workspace.yaml`:
   `jscpd` (already there if the lockfile change of section 0 was kept) and, if section 8 was
   applied, `handlebars` 4.7.10.
2. `pnpm update -r source-map-js` re-resolves the transitive package under `postcss@8.5.28`
   (`^1.2.1`) to 1.2.2. Bare name on purpose: pnpm 12.6.0 rejects a version for a package that is
   not a direct dependency ("An update resolves a transitive dependency the way a fresh install
   would, so a version on the command line has no effect on it"); `--depth` defaults to unlimited;
   `-r` covers every workspace project. Form taken from the strings of the pinned binary; it was
   not run here.
3. The npm line does the same for the spike viewer's `package-lock.json` (`postcss` there declares
   `^1.2.1`), without creating `node_modules`.
4. `uv lock` moves `werkzeug` to 3.1.9 (`schemathesis@4.28.0` declares `werkzeug<4,>=0.16.0`).

Expected in `git status --short` beyond what is already dirty: `pnpm-lock.yaml`,
`prototype/g3-filament-spike/viewer/package-lock.json`, `workers/uv.lock`. `pnpm update` must not
change any `package.json`.

Stop and send the output instead of working around it when `pnpm update` answers "None of the
specified packages were found in the dependencies", or when a command changes a file outside that
list.

`docs/security/dependency-ignores.md` already carries the 2026-10-13 record and a new section with
these command forms. Both were written before the commands ran. The "Action" cells describe the
tree after them; the "Verification run" cells say "Pending" instead of a result nobody has seen.

## 10. Second pass (tooling-engineer; needs section 7's `just clone-check*`)

1. `just clone-check --fixtures`: six format cases fail on their format, `_clean` passes.
2. `just clone-check` with `threshold` 0: it fails and prints the measured share. Compare "Files
   analyzed" per format with the tree. On 2026-10-13 `git ls-files` (tracked and untracked, minus
   the ignore list) gives these upper bounds: typescript 192, javascript 56, python 20, kotlin 41,
   swift 20, bash 79. jscpd leaves out a file shorter than `minLines`, so a count may be lower; a
   count far below, or a format missing from the table, means the scope is wrong.
3. Set `threshold` to the measured share (equality passes), rerun: exit 0. Record the baseline in
   `tools/jscpd/README.md` (date, version, share, clones, duplicated lines).
4. The five largest clones as follow-ups, with the `jq` line in `tools/jscpd/README.md`.
5. `just security-scan` after section 9: green, or red on `handlebars` only when section 8 was
   declined. This is also the first run of `pnpm audit` and the license gate over jscpd's tree.
   Replace the "Pending" cells of the 2026-10-13 ledger table with the real results.
6. `tools/github/repo-settings.json` and `scripts/test/repo-setup.test.sh` (section 4), once the
   workflow diff is applied; `just test tooling`.
7. `chmod +x tools/jscpd/clone-check.sh tools/jscpd/check-fixtures.sh` (the agent could not; the
   recipe calls them through `bash`, so nothing depends on it).
8. `just ci-parity`.
