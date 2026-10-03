# Proposal: human-applied changes for `just repo-setup` (setup automation, pass 4)

> Status: OPEN (2026-10-03) — nothing in this file is applied. Part A is required: until it lands,
> `just docs-check --strict` (run by `just ci-parity`) fails on DC-15 for `repo-setup`. Part B is
> the replacement text for `docs/NEW-REPO-SETUP.md`. Part C is the Bash-guard rule that keeps
> agents from running the three `--apply` modes. Parts D to F are the other human-only documents
> and one recommendation. Proposed 2026-10-03 by tooling-engineer (main checkout, base 2250bd0).

What the change itself contains (already in the working tree, tooling-engineer's write set):

- the recipe `just repo-setup` and `scripts/repo-setup.sh` (entry point);
- `scripts/github-lib.sh` (origin to OWNER/REPO, the gh checks, the owner-run guard, two doctor lines);
- `scripts/repo-name.sh` with `tools/github/name-keep.txt`;
- `scripts/security/github-secrets.sh` with `tools/github/actions-secrets.txt`;
- `tools/github/repo-settings.mjs`, `settings-file.mjs`, `gh.mjs` with `tools/github/repo-settings.json`;
- `scripts/test/repo-setup.test.sh` (19 cases, in `just test tooling`), `scripts/test/recording.sh`
  (the recording wrappers and the sops fixture, now shared with `just test secrets`) and
  `tools/github/tests/gh-stub.mjs`;
- `scripts/doctor.sh`: two offline checks; `scripts/security/secrets-lib.sh`: the compare URL uses
  the shared origin parser; `tools/github/README.md` and one paragraph in `tools/observability/README.md`.

Not built, on purpose: rotating the CI age identity (it creates and stores a private key and
deserves its own reviewed pass), and creating the GitHub repository itself.

## Part A: `planning/15-team-workflow-and-ai-agent-operations.md` (human-only, required)

### A1. §5, one new row after the `just observability-sync` row

```text
| `just repo-setup` | `[name\|secrets\|settings] [--apply]`: the GitHub side of a repository move, always for the repository `origin` points at. Bare = three read-only checks in order and the apply commands that are needed (exit 1 when one is). `name` re-points this repository's own `OWNER/REPO` in tracked files (offline; third-party links and the paths in `tools/github/name-keep.txt` are left alone); `secrets` sets the Actions secrets and variables listed in `tools/github/actions-secrets.txt` from `secrets/dev.enc.yaml` (values piped from sops into `gh`, never an argument); `settings` applies `tools/github/repo-settings.json` (Actions permissions, protection of `main` with the pr-gate job names as required checks, secret scanning, labels; a setting the plan does not offer is reported as unavailable). Nothing changes without `--apply`, which is owner-run and safe to repeat (`tools/github/README.md`) |
```

### A2. §5, the `just secrets-push` row (still pending from `2026-10-03-setup-automation-proposal.md` Part A)

That proposal's row predates `--replace` and `--prune-values`. If it is not applied yet, use this
one instead, after the `just secrets-sync` row:

```text
| `just secrets-push` | `[dev] [--apply] [--replace] [--prune [--prune-values]]` or `--set KEY`: copy the values `.env` holds for the `.env.example` keys into `secrets/dev.enc.yaml` through sops, no editor. Bare = dry run (key names only); `--apply` creates missing key names and fills empty shared values, and leaves a differing shared value alone unless `--replace` is given; `--prune` also removes empty names `.env.example` no longer has, `--prune --prune-values` also the ones that hold a value; `--set KEY` stores one value from a hidden prompt or stdin. Keys tagged `[machine-local]` in `.env.example` are never copied; staging/prod are refused (§6) |
```

### A3. §5, the `just test <module>` row: one word

```text
old: ci-metrics, dev service names, observability-sync) instead of
new: ci-metrics, dev service names, observability-sync, repo-setup) instead of
```

### A4. §4, the `just doctor` bullet: append one sentence

```text
 It also warns, offline, when tracked files name another repository than `origin` points at (fix: `just repo-setup name`) and when `gh` is missing or logged out; the GitHub side itself (Actions secrets and variables, branch protection, labels) is `just repo-setup`.
```

Check after applying A1 and A2: `just docs-check --strict` prints `docs-check: ok`.

## Part B: `docs/NEW-REPO-SETUP.md` (docs agent or lead; not in tooling-engineer's write set)

Run `just format` afterwards (the tables are width-aligned), then `just format --check`.

### B1. "Before you start", item 2: replace its second sentence

```text
old: `gh` is not pinned in `mise.toml`, `just bootstrap` does not install it and `just doctor` does not check it.
new: `gh` is not pinned in `mise.toml` and `just bootstrap` does not install it; `just doctor` warns when it is missing or has no login, and prints the command.
```

### B2. "The whole job on one screen": rows 4, 5 and 8, and one sentence below the table

```text
| 4   | Re-point the repository name in tracked files                                       | one command (`just repo-setup name --apply`)     | yes        | yes | yes                |
| 5   | Repository settings: Actions permissions, protected `main`, scanning, labels        | one command (`just repo-setup settings --apply`) | yes        | yes | check              |
| 8   | Actions secrets and variables                                                       | one command (`just repo-setup secrets --apply`)  | yes        | yes | check              |
```

Add after the paragraph that follows the table:

```text
At any point, `just repo-setup` runs the checks of steps 4, 8 and 5 without changing anything and lists the commands that are still needed. It ends with `nothing to do` once all three match.
```

### B3. Section 4, whole section

````markdown
## 4. Re-point the repository name in tracked files

Mark: **one command**. **Owner only**: it rewrites two human-only documents among others.

**What it achieves.** Clone commands, runbook links and the offline check name the new repository. Until this is done, `just observability-sync all --check` still passes, but every alert in Grafana links to a runbook address on the old repository, and `just doctor` warns `N tracked line(s) in M file(s) name <old-owner>/<old-repo>, but origin points at <owner>/<repo>`.

**Do.** In the repository root, on a branch, once `origin` points at the new repository (section 3, or `git remote set-url origin https://github.com/<owner>/<repo>.git` after a rename or a transfer).

1. Read the report. It writes nothing.

   ```bash
   just repo-setup name
   ```

   It prints one `file:line: text` line for every tracked line that names the old repository, then the paths it leaves alone on purpose with the reason for each, and ends with the count and the command of step 2. On 2026-10-03, run over a copy of the tree with a made-up origin, it found 15 lines in 13 files: two clone commands, the `cd` line below the one in `README.md`, one sentence in `docs/SERVICES-SETUP.md`, the runbook link form in two READMEs, three alert files, two dashboard links, the constant `RUNBOOK_URL_PREFIX` in `tools/observability/check.mjs` and three test fixtures. The `cd` line is listed only when the repository's name changes and not only its owner.

2. Rewrite them.

   > **Owner only.** Run it yourself, in a terminal no AI agent is attached to. It refuses inside an agent session.

   ```bash
   just repo-setup name --apply
   ```

3. Run step 1 again. It must end with `nothing to re-point`.

How it finds the lines: the old name is read from `RUNBOOK_URL_PREFIX` in `tools/observability/check.mjs`, and from the remote `old-origin` when section 3 created it. Links to other GitHub repositories never match. If an earlier hand edit already changed that constant and other lines still hold the old name, name it yourself: `just repo-setup name --from <old-owner>/<old-repo>`, then the same command with `--apply`. When the repository's name changed, the `cd <old-repo>` of each clone command is rewritten as well.

Left alone on purpose (the list is `tools/github/name-keep.txt`): the pull request and run links in `planning/PROGRESS.md`, and everything under `.claude/plans/` and `planning/research/`. They are history. The Linear links and the first line of `solo.yml`, which names another repository of the same account, do not match and stay as they are.

**It worked when** all four commands pass:

```bash
just repo-setup name
just observability-sync all --check
just test tooling
just format --check
```

The second one prints `observability-sync --check: grafana + posthog definitions OK (offline)`. The third one includes the fixture cases of `tools/observability/`.

**If it did not.**

- `just repo-setup name` answers `cannot read the name tracked files use`: the constant's line in `tools/observability/check.mjs` has changed. Pass the old name with `--from <old-owner>/<old-repo>`.
- It answers `origin is missing or is not a github.com remote`: `git remote -v` shows what `origin` is.
- `just observability-sync all --check` prints `annotations.runbook_url must start with …`: one alert file was edited by hand and no longer matches the constant. Run step 1 with `--from` to find the line.

Commit the change through a pull request on the new repository. Section 10.2 then pushes the new links into Grafana.

The command was run against a copy of the tree and against made-up checkouts (`just test tooling` repeats both on every run); it has not been run on a real repository move yet.
````

### B4. Section 5, whole section

````markdown
## 5. Repository settings

Mark: **one command**. **Owner only.** After a rename or a transfer, run only the report.

**What it achieves.** The new repository behaves like the documented one: Actions run with a read-only token, `main` is protected by the five checks of `pr-gate`, secret scanning and push protection are on where GitHub offers them, and the labels that Renovate uses exist. The declared state is one file, `tools/github/repo-settings.json`; `tools/github/README.md` explains each part of it.

**Do.** Needs `gh`, logged in as an account with admin rights on the repository (`gh auth status`).

1. Read the report. It only reads the repository.

   ```bash
   just repo-setup settings
   ```

   One line per setting: `ok`, `change`, `create`, `unavailable` or `manual`. It ends with the counts and, when something differs, the command of step 2.

2. Apply it.

   > **Owner only.** This changes the repository's settings, including the checks required to merge.

   ```bash
   just repo-setup settings --apply
   ```

3. Run step 1 again. It must report `0 to change`.

What it sets:

- **Actions permissions.** All actions are allowed; the workflow token defaults to read-only and cannot approve pull requests.
- **Protection of `main`** (a classic branch protection rule). A pull request is required, the branch must be up to date, force pushes and deletion are off, and the rule applies to administrators too. These five checks are required, spelled exactly as the jobs in `.github/workflows/pr-gate.yml` report them: `Gate · just ci-parity`, `Gate · Contracts (generate --check, spectral, oasdiff)`, `Gate · Secret scan (PR diff)`, `Gate · Clone detection (placeholder)` and `Report · PR gate summary`. No approval is required, because one person cannot approve their own pull request, and Code Owner review stays off until section 6 is merged; both are single values in the file. The `ios`, `android` and `nightly` checks are not required on purpose: they do not run on every pull request, and a required check that never runs blocks every other pull request.
- **Secret scanning and push protection.** Both switched on.
- **Labels.** `dependencies`, `needs-adr`, `android`, `ios`, `needs-deps-lock` and `security`, the six that `renovate.json` uses. Existing labels are left alone.

The check names are compared with the job names in `.github/workflows/pr-gate.yml` before anything is sent, so a renamed job cannot leave a required check that never reports. Unlike the GitHub screen, the command does not need the checks to have run once: it can protect `main` before the first pull request.

**What a plan does not offer.** A line marked `unavailable` quotes GitHub's answer and changes nothing. Expect it on a private repository under a personal account on the free plan: branch protection is answered with `Upgrade to GitHub Pro or make this repository public to enable this feature.`, and secret scanning is not offered for such a repository. These lines are not counted as differences, so the report can still say `0 to change`. Make the repository public or change the plan, then run step 2 again. Until then `main` is not protected (Appendix C item 6).

Not set by the command: auto-merge and "delete branch on merge" (both are off on the current repository; `renovate.json` has auto-merge rules, and how Renovate behaves without the repository option was not checked), rulesets (the report says when one exists; use branch protection or a ruleset, not both) and environments (none are needed before the deploy jobs of P03).

**It worked when** `just repo-setup settings` reports `0 to change` and exits without an error. The proof for the protection is section 12 step 3: the merge button of a pull request stays disabled until the five checks pass.

**If it did not.**

- `the GitHub CLI (gh) is not installed` or `gh has no login for github.com`: the line below the error is the fix (`mise use --global gh@latest`, `gh auth login`).
- `the gh account has no admin rights on <owner>/<repo>`: `gh auth status` shows which account is active.
- `manual  default branch: is …, not main`: change the default branch on the repository's **Settings** page first. Every link in section 4 assumes `main`.
- A line marked `failed` names the call and GitHub's answer. The other settings are still applied; fix the cause and run step 2 again.

The command was tested against a stand-in for the GitHub API with made-up repositories (`just test tooling`). It has not been run against a real repository yet, and what GitHub answers on each plan is taken from its documentation.
````

### B5. Section 8, whole section

````markdown
## 8. Actions secrets and variables

Mark: **one command**. **Owner only.** After a transfer, run only the report.

**What it achieves.** The workflows that run on `main` can upload debug symbols to PostHog and, if you want it, push CI metrics to Grafana. Which names exist, where each value comes from and which keys must never reach GitHub is one file, `tools/github/actions-secrets.txt`.

**Exactly these.** A secret's value cannot be read back from the old repository, so the source is `secrets/dev.enc.yaml`. Section 2 makes sure that file holds the values.

| Name                          | Kind     | Value comes from                                          | Read by                                           | Set by                                                 |
| ----------------------------- | -------- | --------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| `POSTHOG_CLI_API_KEY`         | secret   | `secrets/dev.enc.yaml`, same key                          | the `ios` and `android` workflows, on `main`      | the command                                            |
| `POSTHOG_CLI_PROJECT_ID`      | variable | `secrets/dev.enc.yaml`, same key                          | the same two workflows                            | the command                                            |
| `POSTHOG_CLI_HOST`            | variable | `secrets/dev.enc.yaml`, same key                          | the same two workflows                            | the command                                            |
| `SOPS_AGE_KEY`                | secret   | section 7                                                 | nothing before P03                                | you, in section 7                                      |
| `OTEL_EXPORTER_OTLP_HEADERS`  | secret   | a `ci-metrics` token of its own (section 10.3, last part) | the summary job of `pr-gate`, on pushes to `main` | you; optional                                          |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | secret   | `secrets/dev.enc.yaml`, same key                          | the same job                                      | the command, once the headers secret exists; optional  |
| `TURBO_TOKEN`, `TURBO_TEAM`   | secrets  | `secrets/dev.enc.yaml`, same keys (empty today)           | `pr-gate`, `affected`, `nightly`                  | the command, once the keys hold a value; optional      |
| `GITLEAKS_LICENSE`            | secret   | gitleaks                                                  | `pr-gate`, `portability`                          | you; only under an organization                        |

**Never set in GitHub.** The manifest lists them, the report fails when GitHub has one, and the command never sends them:

- `POSTHOG_API_KEY` and `POSTHOG_HOST`: apps built in CI carry no project key.
- `POSTHOG_SYNC_API_KEY` and `GRAFANA_SERVICE_ACCOUNT_TOKEN`: the sync runs on a developer machine only, and the Grafana token has the Admin role.
- The value that `secrets/dev.enc.yaml` holds as `OTEL_EXPORTER_OTLP_HEADERS`: that is the dev token. CI gets a token that can write metrics and nothing else, and you set it by hand.
- Never upload a whole file with `gh secret set -f .env`. It would send every key, including the four above.

**Do.** Needs `gh` with admin rights on the repository, and an age identity that decrypts the dev file. `just doctor` shows both.

1. Read the report. It compares names only and decrypts nothing.

   ```bash
   just repo-setup secrets
   ```

   `missing` is a name the repository lacks; the text after it says whether the command sets it or you do. `forbidden` is a name from the never list that exists on GitHub, with the command that removes it.

2. Send what is missing.

   > **Owner only.** This sets secrets and variables on the repository.

   ```bash
   just repo-setup secrets --apply
   ```

   Each value goes from sops to `gh` through a pipe: it is never printed, never part of a command line and never written to a file. A name the repository already has is left alone. After rotating a credential (section 10.4), send every value again with `just repo-setup secrets --apply --replace`.

3. Run step 1 again. It must end with `GitHub has every name tools/github/actions-secrets.txt asks for`.

On a brand-new repository step 2 ends with `1 still missing` until section 7 has stored `SOPS_AGE_KEY`: the command never creates or sends a private key.

**It worked when** step 3 shows no `missing` and no `forbidden` line. The real test is the next run of `ios` or `android` on `main`: the upload step runs instead of printing a notice that a value is empty.

**If it did not.**

- `secrets/dev.enc.yaml holds no value for <KEY>`: the shared file lacks it. Store it with `just secrets-push --set <KEY>` (section 10), then run step 2 again.
- `GitHub did not list the Actions secrets and variables`: the account that `gh auth status` shows has no admin rights on the repository, or `origin` names the wrong repository.
- `could not set the secret …`: the output of sops and `gh` is hidden on purpose. The line below the error names the three things to check.
- `no age private key found`: this machine has no developer identity (Appendix A.3).

The command was tested with a stand-in for `gh`, the real sops and made-up values (`just test tooling`). It has not been run against a real repository yet.
````

### B6. Smaller sentences that the three sections make stale

```text
Section 10.4 step 5:
old: Then set the GitHub secret and the two variables again (section 8),
new: Then send the GitHub secret and the two variables again with `just repo-setup secrets --apply --replace` (section 8),

Section 12 step 4:
old: 4. **Secrets and variables.** `gh secret list` and `gh variable list` show the names of section 8.
new: 4. **The GitHub side.** `just repo-setup` ends with `nothing to do`: tracked files, secrets and variables, and settings match.

Appendix A.7, after the code block: add
     `just doctor` also warns when tracked files still name another repository than `origin` points at (section 4).

Appendix C item 6: append
     Section 5 is now one command (`just repo-setup settings --apply`); on a private repository under a personal account on the free plan it reports the protection as unavailable.

Appendix C item 11:
old: **Bootstrap installs neither `jq` nor `gh`** (Appendix A.2),
new: **Bootstrap installs neither `jq` nor `gh`** (Appendix A.2; `just doctor` warns about a missing or logged-out `gh`),
```

## Part C: enforcement layer (`scripts/hooks/**`, `.claude/settings.json`: main session with the human)

The three `--apply` modes refuse inside an agent session by testing `CLAUDECODE`. That is a
seatbelt: an agent can unset a variable. The control is the Bash guard, which today knows the raw
`gh secret set` / `gh variable set` / `gh api …/protection` commands but not the recipe that runs
them. The reports stay allowed (they are read-only, like `just doctor`). **Not run:** agents cannot
execute or edit hooks, so the regex is untested; `just docs-check --fixtures` replays the two
fixtures below and is the proof.

`scripts/hooks/guard-bash.sh`, after the `secrets-sync` branch:

```diff
 elif [[ "$command" =~ just[[:space:]]+secrets-sync[[:space:]]+(staging|prod)([[:space:]]|$) ]]; then
   deny "Syncing secrets to staging/prod is a cloud/infra mutation prohibited without explicit human authorization (CLAUDE.md)."
+elif [[ "$command" =~ (just[[:space:]]+repo-setup|repo-setup\.sh|repo-name\.sh|github-secrets\.sh|repo-settings\.mjs)[^\&\|\;]*[[:space:]]--apply([[:space:]]|$) ]]; then
+  deny "just repo-setup --apply rewrites human-only files or changes the repository's secrets, variables and settings (required checks included): a human runs it (CLAUDE.md 'Prohibited without explicit human authorization'). Run it without --apply for the report."
```

`.claude/settings.json`, `permissions.deny`, after the `secrets-sync` lines:

```diff
       "Bash(just secrets-sync prod*)",
+      "Bash(just repo-setup * --apply*)",
```

New `tools/docs/fixtures/hooks/bash-repo-setup-apply.json`:

```json
{
  "session_id": "fixture-session",
  "transcript_path": "/tmp/fixture-transcript.jsonl",
  "cwd": "/home/arthur/Projects/app",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "just repo-setup settings --apply",
    "description": "fixture"
  }
}
```

New `tools/docs/fixtures/hooks/bash-repo-setup-report.json`: the same payload with
`"command": "just repo-setup settings"`.

Two rows for `tools/docs/fixtures/hooks/README.md`, after `bash-gh-secret-set.json`:

```text
| `bash-repo-setup-apply.json`           | `guard-bash.sh`            | deny     | `just repo-setup … --apply` changes secrets, settings or human-only files (human-run)  |
| `bash-repo-setup-report.json`          | `guard-bash.sh`            | allow    | the report only reads                                                                  |
```

The fixtures and rows must land in the same commit as the hook change (`.claude/rules/tooling-ci.md`
invariant 4): added alone, the deny row fails `just docs-check --fixtures`.

`.claude/rules/human-only.md`: one new invariant, or an addition to invariant 3:

```text
 The repository's Actions secrets and variables, branch protection, required checks and settings change only through `just repo-setup secrets --apply` and `just repo-setup settings --apply`, which a human runs — the Bash guard denies both and the raw `gh` commands.
```

## Part D: `.github/workflows/README.md` (path-guarded; human-applied)

"Shared pieces", the "Secrets and variables" bullet: append

```text
 Which names exist, where each value comes from and which keys must never be sent is `tools/github/actions-secrets.txt`; `just repo-setup secrets` compares it with the repository, and `just test tooling` fails when a workflow reads a `secrets.NAME` or `vars.NAME` that file lacks. The required checks of `main` are the job names of `pr-gate.yml`, declared in `tools/github/repo-settings.json` and checked the same way: renaming a `pr-gate` job means editing that file in the same change.
```

## Part E: `docs/SERVICES-SETUP.md` §1 (human-only)

After step 8 of "Steps", add:

```text
9. Steps 1, 3 to 6 and the labels are one command: `just repo-setup settings` reports the difference between the repository and `tools/github/repo-settings.json`, and `just repo-setup settings --apply` sets it (owner-run). The secrets and variables of step 7 that come from `secrets/dev.enc.yaml` are `just repo-setup secrets --apply`. `docs/NEW-REPO-SETUP.md` sections 5 and 8 walk through both.
```

"Verify": the sentence "the "Merge" button stays disabled until they pass" is true only once
`just repo-setup settings --apply` has protected `main`, which GitHub offers for a public
repository or on a paid plan.

## Part F: recommendation — pin `gh` in `mise.toml` (single-writer; not done)

`gh` comes from the owner's global mise configuration on the Linux machine and may be missing on
the Mac. The scripts check for it and print the fix, so nothing breaks without the pin. Pinning it
(`gh = "<latest stable>"` under `[tools]`) would make `just bootstrap` install it on both machines
and let Renovate keep it current. It was left out because `mise.toml` is a single-writer file and a
change to it re-triggers every workflow. The scripts need `gh secret list --json` (2.43 or later).

## Decisions the owner should confirm (both are one value in `tools/github/repo-settings.json`)

1. `required_approving_review_count: 0`. Doc 15 §7 says every PR gets one human review, and
   `docs/SERVICES-SETUP.md` §1 says to tick "Require a pull request before merging". With one
   person, a required approval would block every merge (nobody can approve their own pull request),
   so the file requires the pull request and not the approval. Set it to 1 when a second reviewer
   exists.
2. `enforce_admins: true`. `docs/SERVICES-SETUP.md` §1 says the merge button stays disabled until
   the checks pass; for the repository's owner that is only true when the rule applies to
   administrators. The cost: the owner cannot push to `main` directly in an emergency without
   changing the rule first. Set it to false to keep that door open.
