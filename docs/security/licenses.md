# Dependency license gate

`just security-scan` runs `scripts/security/license-check.sh`, which checks the license of every
npm and PyPI dependency against `tools/security/license-policy.json` (planning/15 §9: no GPL/AGPL
in shipped bundles). It also generates the SBOM (`scripts/security/sbom.sh`, see below). Like the
vulnerability scan, the gate is never weakened to get a green run: no threshold flags, no
`|| true`; the only escape hatch is a time-boxed exception recorded in the policy file.

## What is scanned

| Tree | Source of truth                                                                                                                 | Production vs dev-only                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| npm  | `pnpm licenses list --json` (reads `pnpm-lock.yaml` + the installed store; every workspace package, every version)              | `pnpm licenses list --json --prod` (drops `devDependencies` of every workspace package)        |
| PyPI | `pip-licenses==5.5.5 --from=mixed`, run as an ephemeral overlay on the `workers/` venv (`uv run --with`), filtered to `uv.lock` | `uv export --project workers --no-dev` (packages reachable without the `dev` dependency group) |

Not scanned: Maven (Gradle, `apps/android`) and SwiftPM (`apps/ios`, the generated Swift
client). See "Open item" below.

First-party packages (`@ai-stylist/*`, `ai-stylist-*`) are skipped. Runtime on a warm checkout is
about 7 s.

## Policy

`tools/security/license-policy.json` has four lists of license ids (SPDX ids, or trove classifier
names as pip-licenses prints them minus any trailing parenthetical; case-insensitive; `*` is a
glob). Precedence per id: `deny` > `warn` > `allow`; an id in none of the lists is
_unclassified_.

| Verdict        | Production dependency | Dev-only dependency | Contents today                                                                                                                     |
| -------------- | --------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `allow`        | silent                | silent              | MIT, ISC, BSD-2/3, 0BSD, Apache-2.0, BlueOak-1.0.0, CC0-1.0, CC-BY-3.0/4.0, Unlicense, Zlib, PSF-2.0, MPL-2.0, WTFPL, Artistic-2.0 |
| `warn`         | WARN                  | WARN                | LGPL-\* (doc 15 does not mention LGPL; warn until legal decides), EPL-\*, CDDL-\*, OSL-\*, CC-BY-SA-\*, BUSL-\*                    |
| `deny`         | **FAIL**              | WARN                | GPL-\*, AGPL-\*, SSPL-\*, CC-BY-NC\*, UNKNOWN / UNLICENSED / NONE / no license field                                               |
| _unclassified_ | **FAIL**              | WARN                | anything not listed: add it to the right list in a reviewed PR                                                                     |

Dev-only copyleft warns instead of failing because it never ships in the API bundle or a
worker image; the warning keeps it visible so it is not promoted to a production dependency by accident.
MPL-2.0 is file-level copyleft and allowed as long as we do not modify the dependency's own
source (lightningcss, certifi).

SPDX expressions are evaluated: `A OR B` takes the most permissive alternative (so
`(BSD-3-Clause OR GPL-2.0)` passes as BSD), `A AND B` the least permissive part, `A WITH exc`
ignores the exception. pip-licenses' `;`-joined classifier lists are treated as AND.

Legal-flagged licenses (anything that needs a `warn` or an exception) also go to the doc 16
legal-review register, as planning/15 §9 requires.

## Reading the output

```text
FAIL  npm  fake-agpl-lib@1.0.0  "AGPL-3.0-only"  production dependency, deny license
WARN  npm  fake-gpl-devtool@2.0.0  "GPL-3.0-or-later"  dev-only dependency, deny license
license check: npm: 3 packages (2 production); 1 failure(s), 1 warning(s)
```

One line per finding (`FAIL` first, then `WARN`), a summary, exit 1 on any `FAIL`. The check
never prints anything but package names, versions and license strings.

## Fixing a failure

In order of preference, the same order as `docs/security/dependency-ignores.md`:

1. **Swap the dependency** for one with an allowed license.
2. **Bump the dependent** if a newer release dropped the copyleft transitive.
3. **Move it to `devDependencies`** if it is only used at build or test time (turns the FAIL into
   a WARN; the SBOM still lists it).
4. **Exception with expiry**, when none of the above works yet and legal has agreed.

An exception is one entry in the `exceptions` array of `tools/security/license-policy.json`:

```json
{
  "package": "some-lib",
  "license": "LGPL-3.0-only",
  "ecosystem": "npm",
  "reason": "dynamically linked only; legal review LR-12 pending; swap planned in #123",
  "added": "2026-09-10",
  "expiry": "2026-11-10"
}
```

- `package` may use `*`; `license` must equal the reported license string exactly; `ecosystem`
  (`npm` | `pypi`) is optional.
- `expiry` is at most **two months (62 days)** after `added`; the check refuses to run with a
  longer one (exit 2). When it passes, the finding is a FAIL again until someone fixes it or
  renews the entry with a fresh reason and date.
- An active exception downgrades the finding to a WARN that names the expiry, so it stays visible.

## Open item: native dependencies are not license-checked

Recorded 2026-09-23. The gate covers npm and PyPI only. The Android app's Maven dependencies
(`apps/android/gradle/libs.versions.toml`, locked in the `gradle.lockfile`s) and the iOS SwiftPM
packages (`apps/ios/Packages/*/Package.resolved`) are not checked against
`tools/security/license-policy.json`. Their vulnerabilities are scanned by osv-scanner, but their
licenses are not. Until this closes, a reviewer checks the license of every new Maven or SwiftPM
dependency by hand. Candidate fixes:

- A Gradle license-report plugin feeding `license-check.sh`. A new Gradle plugin needs an ADR-lite.
- Reading the licenses from the SBOM, since syft already lists the Gradle and SwiftPM packages.

Owner: Android and iOS leads. Not built yet.

## Proving the gate works

`scripts/security/license-check.sh --fixtures` (run by `just ci-parity`, < 1 s) evaluates the
hand-written tree in `tools/security/fixtures/agpl-tree/` and asserts that the AGPL production
dependency fails, the GPL dev-only tool warns, and the MIT dependency is silent. The fixture's
`node_modules/` is committed on purpose (`.gitignore` re-includes it) and excluded from the SBOM.

## SBOM

`scripts/security/sbom.sh` (also `just sbom`) runs
`syft scan dir:. -o spdx-json -o cyclonedx-json` into `artifacts/sbom/sbom.spdx.json` and
`artifacts/sbom/sbom.cdx.json`, the same invocation, formats and file names as the `sbom` job in
`.github/workflows/nightly.yml`, so a local file and the CI artifact can be diffed. The directory
is gitignored; the SBOM is never committed, only uploaded per release (planning/15 §9).
Excluded from the scan: `node_modules/.cache`, `prototype/`, `.git`, `artifacts/`, and the license
fixture tree. About 2,400 packages (npm, Maven, PyPI, GitHub Actions, SwiftPM), 15 to 25 s on a warm
checkout (measured 2026-09-24).
