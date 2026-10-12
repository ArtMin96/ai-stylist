# Proposal: doc text for the working-tree gitleaks config (AI-31) and `R2_JURISDICTION` (AI-21)

> Status: APPLIED 2026-10-12 (sections 2–4; steps 6 and 7 of section 4 reworded) and 2026-10-13
> (section 1, by the owner's `git apply`); section 5 with docs-maintainer. Do not re-apply.
> Written 2026-10-12 by tooling-engineer (main checkout, base
> `aa50e96`). Every file below is outside the tooling write set. Sections 1 to 3 describe AI-31:
> apply them with the commit that adds `tools/security/gitleaks-worktree.toml`, and section 2 only
> once `just ci-parity` has passed on a machine whose `.env` holds real keys. Section 4 describes
> AI-21: apply it when the storage adapter reads `R2_JURISDICTION`. No workflow YAML changes:
> `pr-gate.yml` keeps `GITLEAKS_CONFIG: .gitleaks.toml`, and `portability.yml` and the parity job
> reach the new config through `just security-scan`.

## 1. `.github/workflows/README.md` (path-guarded; a human applies it)

Under "Shared pieces", add one bullet directly after the `.gitleaks.toml` bullet (line 29):

```markdown
- `tools/security/gitleaks-worktree.toml` - the config of the working-tree scan only (`gitleaks dir .` in `just security-scan`). It extends `.gitleaks.toml` and allowlists one more path, the gitignored repo-root `.env` (`^\.env$`, DEC-77): `just secrets-sync` writes real keys there on a developer machine, and CI has no `.env`. The pre-commit hook, the PR-diff scan (`GITLEAKS_CONFIG: .gitleaks.toml`), `just ci-gitleaks-history` and the history scan of `just security-scan` read `.gitleaks.toml` alone, so a committed `.env` is still reported. `scripts/security/gitleaks-fixtures.sh` proves both in `just ci-parity`.
```

## 2. `docs/NEW-REPO-SETUP.md`

Section 12, item 2 (line 725). Replace the item with:

```markdown
2. **The local gate.** `just ci-parity`. Every step must pass, also on a machine whose `.env` holds real keys: the working-tree secret scan skips the gitignored repo-root `.env` (Appendix C item 3).
```

Appendix C, item 3 (line 891). Replace the item with (set the date to the day it merges):

```markdown
3. **Fixed on 2026-10-12: `just ci-parity` could not pass on a machine whose `.env` holds real keys.** Its last stage, `just security-scan`, scans the working tree with gitleaks, which does not honour `.gitignore`, and `.gitleaks.toml` allows `.env.example` but not `.env`. By the decision of 2026-10-09 (DEC-77) that one scan now reads `tools/security/gitleaks-worktree.toml`, which extends `.gitleaks.toml` and skips one more path: the `.env` in the repository root. A `.env` in any other directory and every other name (`.env.local`) are still reported. The pre-commit hook, the pull-request scan and the history scans read `.gitleaks.toml` alone, so a `.env` that someone force-adds is reported before it is committed. `scripts/security/gitleaks-fixtures.sh` proves both.
```

## 3. `planning/16-risks-open-questions-and-decision-log.md`, row DEC-77 (line 182)

The decision does not change; the row names where it is implemented. In the first cell, replace the
sentence that starts "The secret scan allow-lists" with:

```markdown
The working-tree secret scan (`gitleaks dir .` in `just security-scan`) allow-lists the gitignored repo-root `.env` only, because `just secrets-sync` writes real keys there by design; the scans of committed content (pre-commit hook, PR diff, history) still report a `.env`, and CI has no `.env`, so the CI gate does not change
```

Replace the last cell (the sources) with:

```markdown
Owner decision 2026-10-09; `docs/NEW-REPO-SETUP.md`; `tools/security/gitleaks-worktree.toml` (extends `.gitleaks.toml`, which itself does not allow-list `.env`); PROGRESS handoff 2026-10-03
```

## 4. `docs/SERVICES-SETUP.md`, the Cloudflare R2 section (human-only)

Step 6 (line 326). Replace its last sentence ("The S3 endpoint is … so it is not a separate key.") with:

```markdown
The S3 endpoint of a bucket in a jurisdiction is `https://<R2_ACCOUNT_ID>.<jurisdiction>.r2.cloudflarestorage.com`, for this project `https://<R2_ACCOUNT_ID>.eu.r2.cloudflarestorage.com`; a bucket without a jurisdiction uses `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. The adapter builds it from `R2_ACCOUNT_ID` and `R2_JURISDICTION`, so it is not a separate key.
```

Step 7 (line 327). Replace its first sentence ("Set `R2_BUCKET=ai-stylist-dev`.") with:

```markdown
Set `R2_BUCKET=ai-stylist-dev` and `R2_JURISDICTION=eu` (the jurisdiction chosen in step 3; every environment of this project uses `eu`, DEC-61).
```

"What to record", first bullet (line 334). Replace with:

```markdown
- `.env.example` keys: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_JURISDICTION`, `R2_PUBLIC_BASE_URL` (one set per environment); `R2_LIVE_TEST` (machine-local opt-in for the live test suite, empty by default).
```

## 5. For `docs-maintainer` at close-out (ledger wording is theirs)

- Root `PROGRESS.md` line 11 ("Last green") still says that `just security-scan`, and therefore
  `just ci-parity`, cannot pass on a machine whose gitignored `.env` holds real keys. After AI-31
  the working-tree scan passes on such a machine (2026-10-12, Linux: `no leaks found`).
- The task-state cell of P02-T12 in `planning/phases/P02-repo-foundations-and-ci.md` (line 194).
