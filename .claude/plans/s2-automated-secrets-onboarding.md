# Plan s2 — Automated developer onboarding for the sops + age secrets workflow

> Status: APPLIED 2026-09-13 (PR #2; `planning/PROGRESS.md` handoff "2026-09-13 — Automated secrets
> onboarding"). The unticked boxes and the branch name below are history. Still open: the five "Open
> questions" at the end of this file are not tracked in the decision log or in an issue; the human
> decides where they go. Do not re-execute.

**Branch:** `fix/repo-sops-age-hardening`
**Scope:** full plan — 12 files, 3 new scripts, a shared library change other tasks depend on, and work that parallelises cleanly across 4 waves.
**Owner decisions:** taken as given (see the task brief); this plan does not reopen them.

**Grounding (files read in full):** `CLAUDE.md`, `scripts/bootstrap.sh`, `scripts/doctor.sh`, `scripts/lib.sh`,
`scripts/security/secrets-lib.sh`, `secrets-sync.sh`, `secrets-edit.sh`, `secrets-updatekeys.sh`,
`scripts/security/tests/secrets.test.sh`, `justfile` (recipes + shellcheck globs), `.sops.yaml`, `.gitleaks.toml`,
`.pre-commit-config.yaml`, `commitlint.config.*` (`@commitlint/config-conventional`, no scope-enum, header ≤ 100),
`mise.toml`, `.github/actions/setup/action.yml`, `.github/workflows/portability.yml`, `secrets/README.md`,
`README.md` §5, `docs/SERVICES-SETUP.md` §2, `docs/DEVELOPING-ON-MACOS.md`,
`planning/15-team-workflow-and-ai-agent-operations.md` §4/§5/§6, `.gitignore`, `.envrc`, `PROGRESS.md`.

**Facts verified by running commands (2026-09-12), not from memory:**

| Claim | Evidence |
|---|---|
| `age-keygen -o FILE` already creates the file with mode `600` | ran it; `stat -c '%a'` → `600` |
| `age-keygen -o FILE` **refuses to overwrite** an existing file (`O_EXCL`) | `failed to open output file ...: file exists`, exit 1 |
| `age-keygen -o FILE` does **not** create parent directories | `no such file or directory`, exit 1 → `mkdir -p` first |
| `age-keygen -y FILE` prints only the `age1...` public key | ran it |
| mise shims are cwd-bound | outside the repo: `mise ERROR No version is set for shim: sops` |
| `refs/remotes/origin/HEAD` → `refs/remotes/origin/main` in this clone | `git symbolic-ref refs/remotes/origin/HEAD` |
| GitHub compare URL form is real | `curl -o /dev/null -w '%{http_code}'` on `https://github.com/git/git/compare/master...maint?expand=1` → **200** |
| `/pull/new/<branch>` also exists but 302s to login | same method |
| `origin` is `https://github.com/ArtMin96/ai-stylist.git` (private: anonymous compare URL 404s, authenticated browser is fine) | `git remote -v` + curl |
| CI runs `./scripts/bootstrap.sh` on ubuntu **and macos-15** runners | `.github/workflows/portability.yml` L78-91 |
| `chore(secrets): ...` passes commitlint | `commitlint.config.*` extends config-conventional with no scope restriction |
| `.gitleaks.toml` allowlists `^age1[0-9a-z]{58}$` inside `.sops.yaml` | file read — a new recipient commit passes the pre-commit hook |

---

## Contract

Acceptance criteria. Every line is checkable by a command; `just test secrets` means
`scripts/security/tests/secrets.test.sh`.

- [ ] **C1 — identity generation.** On a machine with no age identity at the resolved path
      (`SOPS_AGE_KEY_FILE` if set, else `${XDG_CONFIG_HOME:-$HOME/.config}/sops/age/keys.txt`), `just bootstrap`
      creates one; the key file is mode `600`, its directory mode `700`, and no `AGE-SECRET-KEY-1…` string
      appears anywhere in bootstrap's output.
- [ ] **C2 — never overwrite.** Running `just bootstrap` twice leaves the key file byte-identical (sha256 unchanged)
      and prints `age identity present at <path>`.
- [ ] **C3 — recipient insertion.** When the developer's public key is absent from the `dev` rule of `.sops.yaml`,
      bootstrap produces a commit on branch `onboard/<slug>` whose only change is `.sops.yaml`, adding exactly two
      lines directly under that rule's `# ADD RECIPIENTS` marker: `# developer: <label>` then `- age1…`.
      `secrets_recipient_count` for `secrets/dev.enc.yaml` increases by exactly 1 on that branch.
- [ ] **C4 — working tree untouched.** After `just bootstrap`, `git status --porcelain` is unchanged from before it
      ran (the onboarding commit is made in a temporary worktree), and the developer's current branch is still
      checked out.
- [ ] **C5 — one-click PR.** When `origin` is a `github.com` remote and the push succeeds, bootstrap prints
      `https://github.com/<owner>/<repo>/compare/<default-branch>...onboard/<slug>?expand=1`.
- [ ] **C6 — offline fallback.** When the push fails (no remote access), bootstrap exits **0**, prints a warning and
      the exact `git push -u origin onboard/<slug>` command; the local branch and commit still exist.
- [ ] **C7 — already listed.** When the developer's recipient is already in the `dev` rule, bootstrap creates no
      branch, makes no commit, and says so. Re-running `just bootstrap` any number of times is a no-op (idempotent).
- [ ] **C8 — CI safety.** With `CI` set (as on GitHub runners) or `SOPS_AGE_KEY` set, bootstrap generates no key,
      creates no branch and pushes nothing; `.github/workflows/portability.yml` keeps passing.
- [ ] **C9 — end of bootstrap.** If `secrets/dev.enc.yaml` decrypts with the resolved identity, bootstrap ends by
      running `scripts/security/secrets-sync.sh dev` so `.env` is populated; otherwise it prints the
      "waiting for approval — an approver must run `just secrets-approve <branch>`" next step. Neither path prints a
      secret value.
- [ ] **C10 — doctor checks.** `just doctor` reports, with fix hints: (a) identity present at the resolved path with
      mode 600; (b) that public key listed in the `dev` rule of `.sops.yaml`; (c) `secrets/dev.enc.yaml` decrypts
      with it; (d) a warning (never a failure) when the backup marker file is missing. Doctor writes **no** file.
- [ ] **C11 — backup marker.** `just secrets-backup-done` writes `<identity-path>.backed-up` containing the UTC date
      (`YYYY-MM-DD`) and nothing else, mode 600; doctor's check (d) then reports ✔.
- [ ] **C12 — approve: diff gate.** `just secrets-approve <branch>` exits non-zero, runs no `sops`, and changes no
      file when the branch (vs. its merge base with the default branch) touches any file other than `.sops.yaml`,
      removes any line from `.sops.yaml`, or adds any line that is not a `# developer:` comment or a bare
      `- age1<58 chars>` recipient.
- [ ] **C13 — approve: happy path.** For a valid onboarding branch, `just secrets-approve <branch>` re-wraps every
      existing `secrets/*.enc.yaml` for the new recipient list, commits them on that branch with a Conventional
      Commit message, pushes, and prints the PR URL. The newly added identity can then decrypt the file from the
      pushed branch; the approver's working tree and current branch are untouched.
- [ ] **C14 — approve: authorisation.** `just secrets-approve` fails with the existing actionable message when the
      caller has no identity that can decrypt today (reuses `secrets_require_identity`).
- [ ] **C15 — tests.** `just test secrets` is green and covers C1–C14 with synthetic identities only (no developer
      key, no real `secrets/` file), using a local **bare git repo as the "remote"** so push/fetch are exercised
      without GitHub. The 7 existing tests still pass unchanged.
- [ ] **C16 — gates.** `just lint` (shellcheck `-s bash` over `scripts/**`), `just format --check` and
      `just ci-parity` pass; every new script runs under macOS `/bin/bash` 3.2 (no associative arrays, no `mapfile`,
      no `${var,,}`, no GNU-only flags) and is exercised on the `macos-15` runner by `portability.yml`.
- [ ] **C17 — docs.** `docs/SERVICES-SETUP.md` §2 steps 1–3 and 9, `secrets/README.md` onboarding section,
      `README.md` §5, bootstrap's "Next steps" text, and `planning/15…md` §5 all describe the same flow:
      clone → `just bootstrap` → open the printed PR → approver runs `just secrets-approve <branch>` → merge →
      `just secrets-sync`. §5's catalog has rows for `secrets-approve` and `secrets-backup-done`.

**Must not change**

- Existing behaviour, flags, exit codes and printed messages of `secrets-sync.sh`, `secrets-edit.sh`,
  `secrets-updatekeys.sh` (all 7 existing tests must pass **unmodified**).
- `secrets_recipient_count`'s output contract (bare `- age1…` lines only; label comments stay separate lines).
- `.sops.yaml` layout: the `# ADD RECIPIENTS` marker, one comment label line above each key, no trailing comments
  on key lines. Existing recipients are never reordered or removed.
- `.env` merge semantics and its mode 600; the `secrets/*` ignore policy in `.gitignore`; `.gitleaks.toml`.
- `just bootstrap` stays idempotent and re-runnable and still ends with `just doctor`'s exit code.
- No new mise tool pins; **no dependency on the `gh` CLI** (it is not in `mise.toml`).

**Out of scope (do not build)**

- Any GitHub API/`gh` integration: auto-creating the PR, requesting reviewers, auto-merge, notifications.
- A CI workflow that validates onboarding PRs, and branch-protection/CODEOWNERS changes.
- Automatic recipient addition to the `staging` / `prod` rules (deployers keep doing that by hand, per decision 1).
- Key rotation/removal automation (`secrets/README.md` "Losing or rotating an identity" stays manual).
- Changing the secrets backend, the `.env` merge algorithm, or `mise.toml`.

---

## Settled interface contract (single source for every task)

Tasks copy these verbatim. **No task needs to open another task's file to learn them.**

### S1. New helpers in `scripts/security/secrets-lib.sh` (T1 implements; T3/T4/T5 consume)

All of them are bash 3.2-safe, print no secret material, operate on `./.sops.yaml` relative to the **current working
directory** (exactly like today's `secrets_recipient_count`), and return non-zero with a message on stderr on failure.

```
SECRETS_SOPS="${SECRETS_SOPS:-sops}"                 # tool indirection: callers that run without mise on
SECRETS_AGE_KEYGEN="${SECRETS_AGE_KEYGEN:-age-keygen}" # PATH (doctor) may point these at absolute paths

secrets_tool <name>            # prints a usable binary path: `command -v <name>` when it is NOT a mise shim,
                               # else `"${MISE_BIN:-$HOME/.local/bin/mise}" which <name>` (cwd must be the repo),
                               # else the bare name. Returns 1 when nothing resolves.
secrets_identity_file          # prints "$SOPS_AGE_KEY_FILE" when non-empty, else
                               # "${XDG_CONFIG_HOME:-$HOME/.config}/sops/age/keys.txt". Never checks existence.
secrets_identity_from_env      # returns 0 when SOPS_AGE_KEY is non-empty (key material in the environment, no file)
secrets_backup_marker          # prints "$(secrets_identity_file).backed-up"
secrets_public_key <file>      # "$SECRETS_AGE_KEYGEN" -y <file>; prints the age1… recipient only
secrets_is_age_recipient <s>   # returns 0 when <s> matches age1 + 58 lowercase-bech32 chars (length 62 exactly)
secrets_rule_recipients [env]  # prints the bare `- age1…` keys of the .sops.yaml rule matching ENC_FILE, one/line
secrets_recipient_count        # UNCHANGED OUTPUT: now implemented as `secrets_rule_recipients | wc -l` (trim spaces)
secrets_recipient_listed <pub> # returns 0 when <pub> is in secrets_rule_recipients
secrets_add_recipient <pub> <label>
                               # inserts, directly below the matching rule's `# ADD RECIPIENTS` line and at that
                               # line's indentation:   "# developer: <sanitised label>"  then  "- <pub>"
                               # - no-op + return 0 when <pub> is already listed
                               # - return 1 ("no '# ADD RECIPIENTS' marker in the rule for <file>") when absent
                               # - <label> sanitised to [A-Za-z0-9 ._-], collapsed to one line, max 40 chars
                               # - atomic: awk to a mode-700 mktemp dir, then `command mv` over .sops.yaml
secrets_can_decrypt [env]      # "$SECRETS_SOPS" --decrypt --input-type yaml --output-type dotenv <file> >/dev/null 2>&1
secrets_slug <string>          # lowercase via `tr '[:upper:]' '[:lower:]'` (NOT ${var,,}), every run of characters
                               # outside [a-z0-9] → "-", trimmed of leading/trailing "-", max 40 chars,
                               # prints "developer" when the result is empty
secrets_default_branch         # `git symbolic-ref --short refs/remotes/origin/HEAD` minus the "origin/" prefix;
                               # prints "main" when that ref is absent. Never hits the network.
secrets_github_compare_url <base> <head>
                               # from `git remote get-url origin`, accepting
                               #   https://github.com/O/R[.git] | git@github.com:O/R[.git] | ssh://git@github.com/O/R[.git]
                               # prints "https://github.com/O/R/compare/<base>...<head>?expand=1"
                               # returns 1 and prints nothing for a missing or non-github.com remote
```

`secrets_require_identity` is refactored to call `secrets_identity_file` (one definition of the default path) with
**byte-identical messages and return codes**.

### S2. New/changed CLI surface

| Command | Script | Exit codes |
|---|---|---|
| (called by `just bootstrap`) | `scripts/security/secrets-onboard.sh` | `0` always, except missing `sops`/`age` (`1`, existing `secrets_require_tools` message) |
| `just secrets-approve <branch>` | `scripts/security/secrets-approve.sh` | `0` ok · `1` refused / no identity · `2` wrong usage |
| `just secrets-backup-done` | `scripts/security/secrets-backup-done.sh` | `0` ok · `1` no identity file |

### S3. Exact output substrings (tests assert on these; implementers must emit them verbatim)

`secrets-onboard.sh`:

```
generated a new age identity at <path> (the private key is never printed)
age identity present at <path>
your age recipient is already listed in .sops.yaml (dev) — nothing to do
added your recipient to the dev rule of .sops.yaml on branch <branch>
pushed <branch> — open the pull request:
could not push <branch> (no remote access?) — run this when you have access:
could not commit .sops.yaml (a git hook refused it) — run these commands manually:
waiting for approval: an approver must run  just secrets-approve <branch>
back up <path> in the team password manager, then run: just secrets-backup-done
skipping onboarding (CI or SOPS_AGE_KEY is set)
```

`scripts/security/secrets-doctor.sh` check lines (via `ok` / `fail` / `warnc` from `scripts/lib.sh`):

```
ok    age identity present (<path>, mode 600)
fail  no age identity at <path>
      fix: just bootstrap   (generates one and opens the onboarding PR)
fail  age identity <path> has mode <mode>, expected 600
      fix: chmod 600 <path>
ok    age recipient listed in .sops.yaml (dev)
fail  your age recipient is not listed in the dev rule of .sops.yaml
      fix: open the onboarding PR printed by 'just bootstrap', then ask an approver to run 'just secrets-approve <branch>'
ok    secrets/dev.enc.yaml decrypts with your identity
fail  secrets/dev.enc.yaml does not decrypt with your identity
      fix: ask an approver to run 'just secrets-approve <branch>'
ok    age identity backup recorded (<date>)
warnc age identity not recorded as backed up
      hint: store <path> in the team password manager, then run: just secrets-backup-done
```

`secrets-approve.sh`:

```
refusing: <branch> changes files other than .sops.yaml:
refusing: <branch> removes <n> line(s) from .sops.yaml (this tool only adds recipients)
refusing: <branch> adds a line that is not a '# developer:' comment or an 'age1...' recipient
secrets-approve: re-wrapped <n> file(s) for the new recipient list and pushed <branch>
secrets-approve: <branch> is already re-wrapped — nothing to commit
```

`secrets-backup-done.sh`: `recorded <marker> (<date>) — 'just doctor' will stop warning`

### S4. Git conventions used by both automated commits

- Branch: `onboard/$(secrets_slug "<git user.name, else $USER, else id -un>")`.
- Commit messages (Conventional Commits; header ≤ 100 chars — the label is already capped at 40):
  - onboard: `chore(secrets): add age recipient for <label>`
  - approve: `chore(secrets): re-wrap secrets for the updated recipient list`
- **Never** `git commit --no-verify` and never `git push --force` (security controls stay on; CLAUDE.md).
- Both scripts work in a `git worktree add` temporary checkout under `mktemp -d`, remove it with
  `git worktree remove --force` + `git worktree prune` in an `EXIT` trap, and delete temp dirs with
  `command rm -rf` (the developer's shell aliases `rm` interactively).
- Approve pushes with `git push origin HEAD:refs/heads/<branch>` from a **detached** worktree, so no local branch of
  the approver's is created or moved.

---

## Risks & decisions

1. **Onboarding logic lives in `scripts/security/secrets-onboard.sh`, not inline in `bootstrap.sh`.**
   `bootstrap.sh` installs mise, runs `pnpm install` and `uv sync` — it cannot be executed inside a test. A separate
   script is black-box testable, matches planning/15 §5 ("long recipes call `scripts/*.sh`, not inline blobs"), and
   still satisfies decision 1 because `just bootstrap` calls it. Rejected: inlining (untestable), or a `just`
   recipe that only developers remember to run (not automatic).
2. **Bootstrap invokes it as `mise_exec scripts/security/secrets-onboard.sh`.** mise shims are cwd-bound and a fresh
   `./scripts/bootstrap.sh` runs in a shell with no mise activation; `mise exec --` puts the pinned `sops`/`age` on
   PATH for the child. Rejected: requiring the developer to activate mise first (breaks the fresh-clone flow).
3. **CI guard is mandatory, not cosmetic.** `.github/workflows/portability.yml` runs `./scripts/bootstrap.sh` on
   ubuntu **and macos-15**. Without the `CI`/`SOPS_AGE_KEY` short-circuit, CI runners would generate age keys and
   push `onboard/*` branches. The guard is a required behaviour (C8) with its own test.
4. **Doctor's secrets checks are skipped in CI without `SOPS_AGE_KEY`** (one informational line instead), so
   `portability.yml`'s doctor summary stays meaningful. With `SOPS_AGE_KEY` set (future deploy jobs) only the
   decrypt check runs — there is no key file to stat.
5. **The four doctor checks live in `scripts/security/secrets-doctor.sh` as a sourced fragment** defining
   `secrets_doctor_checks()`, called by `doctor.sh`. Reason: `doctor.sh` cannot be run in a test (mise, docker,
   pnpm), but a fragment can be sourced with stubbed `ok`/`fail`/`warnc` to assert outcomes (C10/C15). The fragment
   defines a function only — no top-level side effects.
6. **Both automated commits happen in a temporary worktree.** It never disturbs the developer's or approver's index,
   current branch or dirty files (C4/C13), and sidesteps "cannot checkout: local changes". Rejected: `git stash` +
   `checkout -b` (loses work if interrupted).
7. **`secrets-approve` runs the *worktree's* copy of `secrets-updatekeys.sh`** (its `secrets_root` must resolve to
   the worktree so `sops` picks up the branch's `.sops.yaml`). This executes a script from a branch under review —
   contained because the diff gate has already proven that the branch changes **no file other than `.sops.yaml`**
   relative to its merge base with the default branch, so every script in that checkout is byte-identical to the
   trusted base commit. The gate therefore runs **before** anything is executed; state that ordering in the script's
   header comment.
8. **The plan is red between wave 2 and wave 3 by design.** Wave 2 lands failing tests (the repo's regression rule:
   a new behaviour's test must fail first). Waves 2 and 3 must be run back to back; the branch is only green again
   at the end of wave 3, and wave 4 proves it. Do not open a PR mid-flight.
9. **Commit hooks can refuse the automated commit** (`prek` runs gitleaks + commitlint; commitlint needs
   `node_modules`, installed in bootstrap step 3 — hence the onboarding step must stay **after** steps 3 and 4).
   `.gitleaks.toml` already allowlists `^age1[0-9a-z]{58}$` inside `.sops.yaml`, so the expected path is clean; if
   the commit still fails, the script prints the manual commands and exits 0 rather than using `--no-verify`.
10. **`age-keygen` already refuses to overwrite** (verified: `O_EXCL`). The scripts still check `[[ -e ]]` first so
    the developer sees `age identity present at <path>` instead of a tool error — belt and braces on a key file.
11. **The approve gate is content-based, not name-based.** Any branch name is accepted (after
    `git check-ref-format --branch`); the diff rules are the real control. A name filter would be bypassable and
    would block legitimately renamed branches.

---

## Waves

| Wave | Tasks | Parallel? |
|---|---|---|
| 1 | T1 | runs alone — settles `secrets-lib.sh`, which every later task consumes |
| 2 | T2 | runs alone — single test file, single writer; lands the red tests |
| 3 | T3, T4, T5, T6 | **4 disjoint write sets — safe to run concurrently** |
| 4 | T7 | runs alone — whole-repo verification + ledger |

---

### Tasks

**Wave 1 — shared library (runs alone: settles shared structure)**

#### T1 — Extend `secrets-lib.sh` with the onboarding helpers

- **Wave:** 1
- **Owns (exclusive write):** `scripts/security/secrets-lib.sh`
- **May read:** `scripts/lib.sh`, `.sops.yaml`, `scripts/security/secrets-*.sh`, `scripts/security/tests/secrets.test.sh`
- **Depends on:** nothing
- **Do:** implement every function in **S1** exactly as specified, in the existing file's style (4-space indent,
  comment above each function saying what it prints and when it returns 1, no function ever printing key material).
  Refactor `secrets_recipient_count` onto the new `secrets_rule_recipients` so the `path_regex`-matching awk exists
  **once** (copy-and-diverge is forbidden), keeping its printed output identical. Refactor
  `secrets_require_identity` to call `secrets_identity_file`, keeping its messages byte-identical. Add the
  `SECRETS_SOPS` / `SECRETS_AGE_KEYGEN` indirection with today's defaults so existing scripts are unaffected.
  Portability: bash 3.2 only — no associative arrays, no `mapfile`, no `${var,,}` (use `tr`), no `grep -P`, no
  `sed -i` without `sed_inplace`-style handling (prefer awk-to-tempfile + `command mv`); awk must avoid ERE
  intervals (`{58}`) exactly as the current file does, using a `length(key) == 62` test instead.
- **Contract it establishes:** section **S1** above (function names, arguments, output, return codes).
- **Verify:**
  - `just test secrets` → the 7 existing tests all `PASS` (proves `secrets_recipient_count`,
    `secrets_require_identity` and the real sops round-trip are unchanged).
  - `just lint` → shellcheck clean for `scripts/security/*.sh`.
  - Manual probe pasted into the task report (real output, not narrated):
    `cd /home/arthur/Projects/app && . scripts/security/secrets-lib.sh && secrets_select_env dev && secrets_recipient_count && secrets_slug 'Arthur Minasyan' && secrets_github_compare_url main onboard/arthur-minasyan`
    → expect `2`, `arthur-minasyan`,
    `https://github.com/ArtMin96/ai-stylist/compare/main...onboard/arthur-minasyan?expand=1`.

**Wave 2 — failing tests (runs alone: one test file, one writer)**

#### T2 — Extend the secrets suite with the onboarding tests (expected RED)

- **Wave:** 2
- **Owns (exclusive write):** `scripts/security/tests/secrets.test.sh`
- **May read:** `scripts/security/secrets-lib.sh` (settled in T1), `scripts/lib.sh`, `.sops.yaml`, `justfile`
- **Depends on:** T1
- **Given contract:** S1, S2, S3, S4 above. Assert only on the substrings in **S3** and the exit codes in **S2**.
- **Do:**
  1. Extend `fixture_repo` to also copy — **each guarded with `[[ -f ]]` so a not-yet-written script cannot abort
     the suite under `set -e`** — `scripts/lib.sh`, `scripts/security/secrets-onboard.sh`,
     `scripts/security/secrets-approve.sh`, `scripts/security/secrets-backup-done.sh`,
     `scripts/security/secrets-doctor.sh` (preserving `scripts/` vs `scripts/security/` layout). A test whose script
     is missing must `return 1` (a clean `FAIL` line), never kill the run.
  2. Extend `write_sops_config` to emit the `# ADD RECIPIENTS:` marker line at the recipients' indentation, since
     insertion is anchored on it. Keep its existing call sites working.
  3. Add `fixture_git_repo <dir>`: `git init -b main` the fixture, `git config user.name/user.email` **locally**,
     `core.hooksPath` pointed at an empty dir (fixtures must not run the developer's prek hooks), `commit.gpgsign
     false`, commit everything, then `git init --bare <dir>.git` + `git remote add origin <dir>.git` +
     `git push -u origin main`. Isolate `HOME` **and** `XDG_CONFIG_HOME` into the fixture for every invocation.
  4. Use `resolve_tool` (already in the file) for `sops`/`age`/`age-keygen` symlinks in `bin/` — the scripts cd into
     the fixture and mise shims are cwd-bound.
  5. Add these tests and register them with `run_test` (name → behaviour → the criterion it proves):

     | Test function | Proves | Turns green in |
     |---|---|---|
     | `test_onboard_generates_identity_mode_600` | key created, file 600, dir 700, no `AGE-SECRET-KEY` in output (C1) | T3 |
     | `test_onboard_never_overwrites_existing_key` | second run: sha256 of the key unchanged, prints `age identity present at` (C2) | T3 |
     | `test_onboard_adds_labelled_recipient_under_marker` | the two lines directly after `# ADD RECIPIENTS` are `# developer: <label>` then `- <pub>`; recipient count +1 (C3) | T3 |
     | `test_onboard_pushes_branch_and_leaves_tree_clean` | bare remote has `onboard/<slug>` whose `.sops.yaml` holds the pub key; fixture `git status --porcelain` empty; branch still `main` (C3/C4) | T3 |
     | `test_onboard_prints_compare_url_for_github_remote` | unit: source `secrets-lib.sh`, set origin to `git@github.com:Owner/Repo.git`, expect `https://github.com/Owner/Repo/compare/main...onboard/x?expand=1` (C5) | T1 (green earlier — keep it, it pins the URL format) |
     | `test_onboard_push_failure_prints_manual_commands` | origin → nonexistent path: exit 0, `could not push`, `git push -u origin onboard/` present, commit still exists locally (C6) | T3 |
     | `test_onboard_noop_when_recipient_already_listed` | prints `already listed`, creates no branch in the bare remote, `.sops.yaml` unchanged (C7) | T3 |
     | `test_onboard_skips_in_ci` | `CI=true`: no key file created, no branch, output contains `skipping onboarding` (C8) | T3 |
     | `test_backup_done_writes_dated_marker` | `<key>.backed-up` exists, mode 600, content is exactly today's UTC `YYYY-MM-DD`, no key material (C11) | T5 |
     | `test_doctor_checks_report_expected_outcomes` | source `secrets-doctor.sh` with stub `ok`/`fail`/`warnc` recording to a file, in 3 scenarios: no identity → `no age identity`; identity present but unlisted → `not listed in the dev rule` + hint naming `secrets-approve`; listed + decryptable + no marker → 3 ✔ and a warn naming `secrets-backup-done` (C10) | T4 |
     | `test_approve_refuses_extra_files` | branch also edits another file: exit 1, `changes files other than .sops.yaml`, ciphertext byte-identical (sops never ran) (C12) | T5 |
     | `test_approve_refuses_recipient_removal` | branch deletes a recipient line: exit 1, `removes`, ciphertext unchanged (C12) | T5 |
     | `test_approve_rewraps_and_new_identity_decrypts` | real sops+age, bare remote: after approve, the pushed branch's `secrets/dev.enc.yaml` lists `recipient: <pub_b>`, B decrypts the value, A still can, approver's branch/tree untouched, no plaintext in output (C13) | T5 |
     | `test_approve_requires_decrypting_identity` | no `SOPS_AGE_KEY*`: exit 1 with the existing `no age private key found` message (C14) | T5 |

  6. Keep every fixture synthetic, delete temp dirs with `command rm -rf`, and never read the real
     `~/.config/sops` or `secrets/`.
- **Verify (this task is expected to be RED — that is the evidence):** run
  `scripts/security/tests/secrets.test.sh` and paste the real output showing (a) the 7 pre-existing tests still
  `PASS`, (b) each new test printing `FAIL` for a *missing-implementation* reason, (c) the run exiting 1. Also
  `just lint` clean (shellcheck covers `scripts/security/tests/*.sh`).

**Wave 3 — implementations (T3, T4, T5, T6 have disjoint write sets — safe to run concurrently)**

#### T3 — `secrets-onboard.sh` + bootstrap wiring

- **Wave:** 3
- **Owns (exclusive write):** `scripts/security/secrets-onboard.sh` (new, `chmod +x`), `scripts/bootstrap.sh`
- **May read:** `scripts/security/secrets-lib.sh` (T1), `scripts/lib.sh`, `scripts/security/secrets-sync.sh`,
  `.sops.yaml`, `scripts/security/tests/secrets.test.sh` (T2 — for the exact assertions)
- **Depends on:** T1, T2
- **Given contract:** S1, S3 (`secrets-onboard.sh` block), S4.
- **Do:**
  - **`scripts/security/secrets-onboard.sh`** — header comment in the house style (what it does, why, `set -euo
    pipefail`, `source secrets-lib.sh` with the `# shellcheck source=` directive, `cd "$(secrets_root)"`). Flow:
    1. `secrets_select_env dev`; `secrets_require_tools`.
    2. If `${CI:-}` is non-empty or `secrets_identity_from_env` → print `skipping onboarding (CI or SOPS_AGE_KEY is
       set)` and exit 0.
    3. `path="$(secrets_identity_file)"`. If it exists: print `age identity present at <path>`. Else `mkdir -p
       "$(dirname "$path")"`, `chmod 700` that dir, `age-keygen -o "$path" >/dev/null 2>&1` (stdout discarded so the
       key can never reach the terminal), print `generated a new age identity at <path> (the private key is never
       printed)`. Then `chmod 600 "$path"` in both branches, noting it in one line when it changed.
    4. `pub="$(secrets_public_key "$path")"`. If `secrets_recipient_listed "$pub"` → print the "already listed" line
       and jump to step 8.
    5. Not a git work tree (`git rev-parse --is-inside-work-tree`) → warn + print the manual steps, go to step 8.
    6. `label` = `git config user.name`, else `${USER:-$(id -un)}`; `branch="onboard/$(secrets_slug "$label")"`.
       `base` = `origin/$(secrets_default_branch)` when that ref exists, else `HEAD`. In a `mktemp -d` worktree:
       `git worktree add --quiet -b "$branch" "$wt" "$base"` (when the branch already exists locally, add the
       worktree on it without `-b`; if its `.sops.yaml` already lists `$pub`, skip straight to the push/URL step).
       `(cd "$wt" && secrets_add_recipient "$pub" "$label")`, `git -C "$wt" add .sops.yaml`, assert
       `git -C "$wt" diff --cached --name-only` is exactly `.sops.yaml`, then commit with the S4 message. On commit
       failure print the `could not commit` line + the manual commands and exit 0.
    7. `git -C "$wt" push --set-upstream origin "$branch"`; on success print `pushed <branch> — open the pull
       request:` followed by `secrets_github_compare_url "$(secrets_default_branch)" "$branch"` on its own line
       (when the helper returns 1, print "open a pull request for it on your git host" instead). On failure: warn
       with the `could not push` line plus `git push -u origin <branch>`, exit 0. Always clean the worktree in an
       `EXIT` trap (`git worktree remove --force` + `git worktree prune` + `command rm -rf`).
    8. If `secrets_can_decrypt dev` → run `scripts/security/secrets-sync.sh dev`; else print the
       `waiting for approval:` line naming `just secrets-approve <branch>`. Finally, when
       `[[ ! -f "$(secrets_backup_marker)" ]]`, print the `back up <path> …` line. Exit 0.
  - **`scripts/bootstrap.sh`** — insert a new numbered step **after** step 5 (`.env`) and **before** the doctor step
    (renumber the doctor and comment banners): `log "age identity + secrets onboarding"` then call
    `mise_exec scripts/security/secrets-onboard.sh` inside a `set +e` / `set -e` pair so a non-zero result warns
    instead of aborting bootstrap (`warn "secrets onboarding step reported a problem — see above; bootstrap
    continues"`). Update the "Next steps" heredoc to the C17 flow: activate mise → `direnv allow` → open the printed
    onboarding PR → ask an approver to run `just secrets-approve <branch>` → after it merges `just secrets-sync` →
    `just doctor` → `just dev-api`; mention `just secrets-backup-done`. Do not touch any other step, and keep
    bootstrap exiting with doctor's return code.
- **Verify:**
  - `scripts/security/tests/secrets.test.sh 2>&1 | grep -E 'onboard'` → every `test_onboard_*` line is `PASS`
    (other tasks' tests may still be `FAIL` in this wave; that is expected and not this task's concern).
  - `just lint` clean.
  - Real end-to-end evidence on this machine, pasted: `just bootstrap` re-run (an identity already exists and is
    already listed) prints `age identity present at …` and `your age recipient is already listed …`,
    `git status --porcelain` is unchanged, and no `onboard/*` branch is created.

#### T4 — Doctor secrets checks

- **Wave:** 3
- **Owns (exclusive write):** `scripts/security/secrets-doctor.sh` (new), `scripts/doctor.sh`
- **May read:** `scripts/security/secrets-lib.sh` (T1), `scripts/lib.sh`, `scripts/security/tests/secrets.test.sh` (T2)
- **Depends on:** T1, T2
- **Given contract:** S1, S3 (doctor block). `ok`/`fail`/`warnc` come from `scripts/lib.sh` and already maintain
  `DOCTOR_FAILURES` / `DOCTOR_WARNINGS`.
- **Do:**
  - **`scripts/security/secrets-doctor.sh`** — a **sourced fragment** (no `set -e`, no top-level side effects, no
    `cd`) defining exactly one function `secrets_doctor_checks()` that assumes cwd is the repo root and that
    `secrets-lib.sh` is already sourced. It must call only `ok` / `fail` / `warnc` for output, never write a file,
    and never print key material. Logic:
    - `SECRETS_SOPS="$(secrets_tool sops)"` / `SECRETS_AGE_KEYGEN="$(secrets_tool age-keygen)"` (best effort; when a
      tool cannot be resolved, `fail` with fix hint `just bootstrap`).
    - `secrets_identity_from_env` → run the decrypt check only, then return.
    - `${CI:-}` non-empty and no `SOPS_AGE_KEY` → print one informational `ok "secrets checks skipped (CI without
      SOPS_AGE_KEY)"` and return (see decision 4).
    - Checks (a)–(d) with the exact strings in S3; mode read via the same `stat -c '%a'` / `stat -f '%Lp'` fallback
      pattern the test file uses (macOS has no `stat -c`). Check (c) is skipped with a `warnc` when
      `secrets/dev.enc.yaml` does not exist. Check (d) is `warnc` — **never** `fail`.
  - **`scripts/doctor.sh`** — source `secrets-lib.sh` next to the existing `lib.sh` source (with the
    `# shellcheck source=scripts/security/secrets-lib.sh` directive), source the new fragment, `secrets_select_env
    dev`, and call `secrets_doctor_checks` in a new `# --- sops + age identity ---` section placed directly after
    the `.env keys` section. Change nothing else; doctor stays read-only.
- **Verify:**
  - `scripts/security/tests/secrets.test.sh 2>&1 | grep -E 'doctor|backup'` → `test_doctor_checks_report_expected_outcomes`
    is `PASS`.
  - `NO_COLOR=1 just doctor` on this machine, output pasted: the four new lines appear with the right glyphs, and
    the summary counters are consistent (warning ≠ failure for the backup marker).
  - `just lint` clean.

#### T5 — `secrets-approve`, `secrets-backup-done`, and their `just` recipes

- **Wave:** 3
- **Owns (exclusive write):** `scripts/security/secrets-approve.sh` (new, `chmod +x`),
  `scripts/security/secrets-backup-done.sh` (new, `chmod +x`), `justfile`
- **May read:** `scripts/security/secrets-lib.sh` (T1), `scripts/security/secrets-updatekeys.sh`,
  `scripts/security/tests/secrets.test.sh` (T2)
- **Depends on:** T1, T2
- **Given contract:** S1, S2, S3 (approve + backup blocks), S4.
- **Do:**
  - **`secrets-approve.sh <branch>`**:
    1. Usage check (exit 2 with a usage line when `$#` ≠ 1 or the argument starts with `-`);
       `git check-ref-format --branch "$1"`.
    2. `secrets_require_tools`; `secrets_require_identity` (an approver must be able to decrypt **today**).
    3. `git fetch --quiet origin "$branch"`; `head="$(git rev-parse FETCH_HEAD)"`;
       `base="$(git merge-base "origin/$(secrets_default_branch)" "$head")"`.
    4. **Gate, before anything is executed or written** (decision 7):
       - `git diff --name-only "$base" "$head"` must be exactly `.sops.yaml`;
       - in `git diff "$base" "$head" -- .sops.yaml`, no removed line (`^-` excluding `---`) may exist;
       - every added line (`^+` excluding `+++`) must be either `# developer: <[A-Za-z0-9 ._-]+>` or a bare
         `- <key>` where `secrets_is_age_recipient <key>` returns 0;
       - at least one recipient must be added.
       Any violation → the matching S3 `refusing:` message on stderr, exit 1, nothing written, `sops` never invoked.
    5. `mktemp -d` + `git worktree add --detach --quiet "$wt" "$head"`; `EXIT` trap removes the worktree
       (`git worktree remove --force`, `git worktree prune`, `command rm -rf`).
    6. In the worktree: run `"$wt/scripts/security/secrets-updatekeys.sh"` with cwd `"$wt"` and **no arguments**
       (it already loops over every existing `secrets/*.enc.yaml` and fails loudly when there is none).
    7. `git -C "$wt" add -- 'secrets/*.enc.yaml'`; when nothing is staged print the `already re-wrapped` line, skip
       the commit, and still print the PR URL. Otherwise assert every staged path matches
       `^secrets/.*\.enc\.yaml$`, commit with the S4 message, `git -C "$wt" push origin HEAD:refs/heads/<branch>`.
    8. Print the S3 success line plus `secrets_github_compare_url "$(secrets_default_branch)" "$branch"`.
    Never print a decrypted value; `sops updatekeys -y` only re-wraps data keys (values are not written to disk).
  - **`secrets-backup-done.sh`**: resolve the identity path; when `secrets_identity_from_env` or the file is missing,
    fail (exit 1) with an actionable message; else write `secrets_backup_marker` containing exactly
    `date -u +%Y-%m-%d` (one line, no key material), `chmod 600`, print the S3 line. Idempotent (rewrites the date).
  - **`justfile`**: add two recipes in the `# --- environment ---` block next to the other `secrets-*` recipes, each
    with the one-line `#` comment `just --list` shows (`set positional-arguments := true` is already set, so use
    `"$@"`):
    `secrets-approve branch:` → `scripts/security/secrets-approve.sh "$@"`;
    `secrets-backup-done:` → `scripts/security/secrets-backup-done.sh`.
    The existing shellcheck glob `scripts/security/*.sh` already covers both new scripts — do not change the `lint`
    recipe.
- **Verify:**
  - `scripts/security/tests/secrets.test.sh 2>&1 | grep -E 'approve|backup'` → all five tests `PASS`.
  - `just --list | grep secrets` shows both new recipes with their descriptions (paste the output).
  - `just secrets-backup-done && just doctor` on this machine → the backup warning turns into ✔ (paste both).
  - `just lint` clean.

#### T6 — Documentation of the new flow

- **Wave:** 3
- **Owns (exclusive write):** `docs/SERVICES-SETUP.md`, `secrets/README.md`, `README.md`,
  `planning/15-team-workflow-and-ai-agent-operations.md`
- **May read:** everything; writes no script.
- **Depends on:** T1, T2 (for the settled command names/messages — all of which are in S2/S3/S4 of this plan, so no
  implementation file needs to be opened)
- **Authorisation note:** editing `planning/15-…md` is normally forbidden for agents (CLAUDE.md "Prohibited without
  explicit human authorization" → workflow policy). The product owner explicitly authorised **this** file for
  **this** work (decision 5). Limit the edit to §5's command catalog rows; do not touch §6 or any other section.
- **Do:** describe one flow everywhere — **clone → `just bootstrap` → open the printed PR → an approver runs
  `just secrets-approve <branch>` → merge → `just secrets-sync`**:
  - `docs/SERVICES-SETUP.md` §2: rewrite steps **1–3** into "run `just bootstrap`; it generates the identity at the
    resolved path (mode 600), adds your `# developer:` label + recipient to the `dev` rule, pushes `onboard/<slug>`
    and prints the PR link", keeping the existing precedence note (`SOPS_AGE_KEY` → `SOPS_AGE_KEY_FILE` → default
    file) and the manual `age-keygen` commands as the fallback path. Keep step 2's backup instruction and add
    `just secrets-backup-done`. Rewrite step **9** (onboarding another developer) around `just secrets-approve
    <branch>`. Leave steps 4–8 and 10 alone except where they name a replaced command. The `### Verify` block gains
    the new doctor lines.
  - `secrets/README.md`: rewrite "Onboarding a developer" as the automated flow (developer side / approver side),
    add `just secrets-approve` and `just secrets-backup-done` rows to the Commands table, and note that only the
    `dev` rule is automated — deployers still add themselves to `staging`/`prod` by hand.
  - `README.md` §5: replace the prose with the three commands a new developer actually runs, and what to do while
    waiting for approval.
  - `planning/15-…md` §5: add exactly two catalog rows, in the `secrets-*` group, matching the recipe comments:
    `| just secrets-approve <branch> | Approve a developer's onboarding branch: verify it only adds age recipients to .sops.yaml, re-wrap every secrets/*.enc.yaml, push, print the PR URL (§6 onboarding) |`
    `| just secrets-backup-done | Record that your age identity is backed up in the password manager (marker file checked by just doctor) |`
  - Honesty rules apply: describe only behaviour this plan implements; no claim that the PR is created or merged
    automatically; state the offline fallback.
- **Verify:**
  - `just format --check` passes for the four files (prettier formats markdown; run `just format` first if needed).
  - `grep -n 'secrets-approve\|secrets-backup-done' README.md secrets/README.md docs/SERVICES-SETUP.md planning/15-team-workflow-and-ai-agent-operations.md`
    → every file mentions both recipes; paste the output.
  - No stale instruction remains: `grep -n 'age-keygen -o ~/.config' README.md secrets/README.md` → only inside an
    explicitly-labelled manual-fallback block.

**Wave 4 — integration (runs alone: whole-repo gates and the ledger)**

#### T7 — Whole-repo verification and PROGRESS update

- **Wave:** 4
- **Owns (exclusive write):** `PROGRESS.md`, `planning/PROGRESS.md`
- **May read:** everything landed in waves 1–3
- **Depends on:** T1–T6
- **Do:**
  1. Run the full gate and fix **nothing** silently — if something is red, report the precise failure and stop
     (a fix belongs to the owning task, to keep write sets exclusive).
  2. Confirm the cross-task criteria that no single task could prove: C8 (bootstrap in a `CI=true` shell creates
     nothing), C9 (bootstrap's tail either syncs or prints the waiting step), C17 (all five surfaces describe the
     same flow, including bootstrap's "Next steps" text).
  3. Update `planning/PROGRESS.md` (canonical ledger): phase row status and a new session-handoff entry from
     `templates/session-handoff.md` — branch, last green command with its real output, done vs. remaining criteria,
     decisions 1–11 of this plan, files touched, exact next action. Keep the root `PROGRESS.md` "Current phase" /
     "Last green" lines in sync. Do not duplicate the ledger in the root file.
- **Verify (paste real output for each):**
  - `just test secrets` → `secrets tests: all passed`, with **every** new test listed as `PASS` and the 7 original
    ones still present.
  - `just lint` · `just typecheck` · `just format --check` → green.
  - `NO_COLOR=1 just doctor` → the four secrets lines present and consistent.
  - `CI=true ./scripts/bootstrap.sh` in a throwaway `HOME`/`XDG_CONFIG_HOME` (or the documented equivalent) → no key
    generated, no branch created, `skipping onboarding` in the log.
  - `just ci-parity` → green, or the exact failing command and its output.

---

## Collision check

Every file any task writes, listed exactly once. No file appears twice anywhere in the plan, so no wave can collide.

| File | Owned by | Wave | New? |
|---|---|---|---|
| `scripts/security/secrets-lib.sh` | T1 | 1 | no |
| `scripts/security/tests/secrets.test.sh` | T2 | 2 | no |
| `scripts/security/secrets-onboard.sh` | T3 | 3 | **new** |
| `scripts/bootstrap.sh` | T3 | 3 | no |
| `scripts/security/secrets-doctor.sh` | T4 | 3 | **new** |
| `scripts/doctor.sh` | T4 | 3 | no |
| `scripts/security/secrets-approve.sh` | T5 | 3 | **new** |
| `scripts/security/secrets-backup-done.sh` | T5 | 3 | **new** |
| `justfile` | T5 | 3 | no |
| `docs/SERVICES-SETUP.md` | T6 | 3 | no |
| `secrets/README.md` | T6 | 3 | no |
| `README.md` | T6 | 3 | no |
| `planning/15-team-workflow-and-ai-agent-operations.md` | T6 | 3 | no |
| `PROGRESS.md` | T7 | 4 | no |
| `planning/PROGRESS.md` | T7 | 4 | no |

Deliberately **not** written by anyone: `.sops.yaml` (changed only by the generated onboarding commit, never by an
implementer), `.gitleaks.toml` (its allowlist already covers the new recipient lines), `mise.toml`,
`.github/workflows/**`, `.pre-commit-config.yaml`, `scripts/lib.sh`, `scripts/security/secrets-sync.sh`,
`secrets-edit.sh`, `secrets-updatekeys.sh`.

## Regression map (which test is red before which task)

| Expected-to-fail test (lands in T2, wave 2) | Turns green in |
|---|---|
| `test_onboard_generates_identity_mode_600`, `test_onboard_never_overwrites_existing_key`, `test_onboard_adds_labelled_recipient_under_marker`, `test_onboard_pushes_branch_and_leaves_tree_clean`, `test_onboard_push_failure_prints_manual_commands`, `test_onboard_noop_when_recipient_already_listed`, `test_onboard_skips_in_ci` | T3 |
| `test_doctor_checks_report_expected_outcomes` | T4 |
| `test_approve_refuses_extra_files`, `test_approve_refuses_recipient_removal`, `test_approve_rewraps_and_new_identity_decrypts`, `test_approve_requires_decrypting_identity`, `test_backup_done_writes_dated_marker` | T5 |
| `test_onboard_prints_compare_url_for_github_remote` | already green after T1 (it pins the verified URL format) |

## Open questions (flagged, not guessed)

1. **How does an approver learn a branch is waiting?** The plan stops at "print the PR URL"; there is no
   notification, no `gh` (not pinned in `mise.toml`), no CODEOWNERS/branch-protection change. For a 2–3 person team
   the developer pasting the link is probably enough — confirm, or file a follow-up for a CI workflow that labels
   `onboard/*` PRs and pings the key holders.
2. **Should an onboarding PR be gated by CI?** A workflow could re-run the same diff gate as `secrets-approve` so a
   hand-edited `.sops.yaml` cannot merge. Out of scope here; worth its own task if the answer is yes.
3. **`staging` / `prod` recipients stay manual.** Decision 1 names only the `dev` rule, so a deployer still edits
   those two rules by hand and runs `just secrets-updatekeys`. Assumed intentional — confirm.
4. **Branch-name collision between two developers with the same `git user.name`.** `onboard/<slug>` would collide;
   the plan reuses the existing branch (idempotent path), which is right for a re-run but would let developer B push
   onto developer A's branch. A `-<short-fingerprint-of-pubkey>` suffix would make it unique at the cost of an
   uglier branch name. Not chosen — say the word if uniqueness matters more than readability.
5. **Whether `just secrets-approve` should also re-wrap `staging`/`prod`.** As specified it re-wraps *every* existing
   `secrets/*.enc.yaml` (today only `dev` exists). Once `staging.enc.yaml`/`prod.enc.yaml` exist, approving a
   dev-only onboarding branch would also re-wrap them — harmless (the recipient list for those rules is unchanged,
   so `sops updatekeys` is a no-op) but worth confirming before those files land.
