# New repository and new machine setup

This guide is for the day the code moves to another GitHub repository, or a new machine has to be set up, and you no longer remember how the pieces were connected. Follow it top to bottom. It lists every step that is tied to the repository or to a machine, gives the command where one exists, and gives the exact screens or the exact file and line where a step is manual. You need no other document unless a step sends you to one.

It complements the root [`README.md`](../README.md) (first-time machine setup), [`docs/SERVICES-SETUP.md`](SERVICES-SETUP.md) (every external account, in phase order) and [`secrets/README.md`](../secrets/README.md) (encrypted configuration). It was written on 2026-10-03, the day the observability credentials were set up for the first time. The Grafana Cloud and PostHog screens in section 10 were walked that day; if much time has passed, expect a label to have moved.

## How to use this guide

| Your situation                                                     | Read                                  |
| ------------------------------------------------------------------ | ------------------------------------- |
| The code moves to another repository (new, renamed or transferred) | Sections 1 to 13, in order            |
| Another machine has to work with the same repository               | Appendix A                            |
| A Grafana or PostHog credential expired, was lost, or is brand new | Section 10.3 or 10.4, then Appendix B |
| Something behaves differently from what this guide says            | Appendix C                            |

### Marks

Every step carries one of these marks, so you can see how much work it is before you start it.

- **auto**: a `just` recipe does the whole step.
- **one command**: one command that you paste.
- **manual**: a browser screen, a file edit, or a decision. Where a recipe for the step is planned, the step says so; until that recipe exists, the manual procedure here is the way.
- **Owner only**: you type the command yourself, in a terminal that no AI agent session is attached to. Agents must not run these. The repo's Bash guard (`scripts/hooks/guard-bash.sh`) refuses the GitHub secret, variable and repository-settings commands from an agent session, and `.claude/rules/human-only.md` reserves every write to `secrets/` and `.sops.yaml` for a human. The mark also covers commands that remove a container, a volume or a branch.

A value copied from a vendor screen never goes into a terminal that an agent can read, a log, a screenshot or a commit. If that happens, replace the credential the same day (`secrets/README.md`, "Rules").

### Placeholders

This guide names no account. Replace each placeholder with your own value.

| Placeholder                                | What it is                           | Where the real value is shown                                                                                      |
| ------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `<owner>/<repo>`                           | The repository after the move        | You choose it in section 1. Afterwards: `git remote get-url origin`                                                |
| `<old-owner>/<old-repo>`                   | The repository before the move       | `git remote get-url origin` before section 3; the constant `RUNBOOK_URL_PREFIX` in `tools/observability/check.mjs` |
| `<you>`                                    | Your GitHub username                 | `gh auth status`                                                                                                   |
| `<stack>`                                  | The name of the Grafana Cloud stack  | The title of the stack's card in the Grafana Cloud Portal; the host name in `GRAFANA_URL`                          |
| `<region>`                                 | Part of the OTLP gateway's host name | **OTLP Endpoint** on the stack's OpenTelemetry page (section 10.3 step 3)                                          |
| `<instance id>`                            | The stack's OTLP instance number     | **Instance ID** on the same page                                                                                   |
| `<project id>`                             | PostHog's numeric project id         | The **Project ID** box in PostHog's project settings (section 10.4 step 1); the value of `POSTHOG_CLI_PROJECT_ID`  |
| The PostHog organization and project names | Free text; no step depends on them   | PostHog's settings pages                                                                                           |

PostHog addresses are written for US Cloud (`https://us.posthog.com`), which is what `.env.example` and DEC-58 record for this project. On EU Cloud replace `us.` with `eu.` in every address. The **Region** box in PostHog's project settings shows which one applies.

### Before you start

1. One machine where the repository already works. `just doctor` ends with `all checks passed`, and its output contains `✔ secrets/dev.enc.yaml decrypts with your identity`. Sections 2, 7, 8 and 10 need the values that this machine holds.
2. The GitHub CLI, logged in as the account that owns the repository: `gh auth status`. `gh` is not pinned in `mise.toml` and `just bootstrap` does not install it; `just doctor` warns when it is missing or has no login, and prints the command. On the Linux machine it comes from the global mise configuration; `mise use --global gh@latest` reproduces that on another machine, and `gh auth login` logs in.
3. Your password manager, with the backup of the age identity and the GitHub, Grafana and PostHog logins.
4. A terminal that no AI agent session is attached to, for every **Owner only** step and for every step that handles a token.
5. bash, or zsh with comments switched on. Some code blocks end a line with a `#` comment that shows the expected output. zsh, the default shell on macOS, reads a pasted comment as part of the command until you run `setopt interactivecomments` in that terminal.
6. One habit: a command that asks for input (a password, a hidden prompt, `read`) is run on its own, never as part of a pasted block. Otherwise the prompt takes the next pasted line as its answer.

## The whole job on one screen

"New" means the step is needed for a brand-new repository. "Check" means that after a rename or a transfer you only confirm the result.

| #   | Step                                                                                | Mark                                             | Owner only | New | Rename or transfer |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------ | ---------- | --- | ------------------ |
| 1   | Choose: rename, transfer, or a new repository                                       | manual (a decision)                              | no         | yes | yes                |
| 2   | Confirm what carries over; make sure no value lives on one machine only             | one command (`just doctor`)                      | the fix    | yes | yes                |
| 3   | Create the repository and push `main` and the open branches with their full history | one command each                                 | yes        | yes | no                 |
| 4   | Re-point the repository name in tracked files                                       | one command (`just repo-setup name --apply`)     | yes        | yes | yes                |
| 5   | Repository settings: Actions permissions, protected `main`, scanning, labels        | one command (`just repo-setup settings --apply`) | yes        | yes | check              |
| 6   | Real handles in `CODEOWNERS`                                                        | manual: one file                                 | no         | yes | yes                |
| 7   | A new CI age identity                                                               | manual: six steps; recipe planned                | yes        | yes | no                 |
| 8   | Actions secrets and variables                                                       | one command (`just repo-setup secrets --apply`)  | yes        | yes | check              |
| 9   | GitHub Apps: Renovate, Linear                                                       | manual: browser                                  | yes        | yes | check              |
| 10  | Grafana Cloud and PostHog: run the sync again; a new token only when one expired    | one command (`just observability-sync`)          | the tokens | yes | yes                |
| 11  | Every machine: the new address, `just bootstrap`, `just doctor`, local leftovers    | auto, one command each                           | removals   | yes | yes                |
| 12  | Verify                                                                              | one command each                                 | no         | yes | yes                |
| 13  | Retire the old repository                                                           | manual                                           | yes        | yes | no                 |

A rename or a transfer is the short path: sections 1, 2, 4, 6, 10, 11 and 12, plus three checks. A new repository needs all thirteen.

At any point, `just repo-setup` runs the checks of steps 4, 8 and 5 without changing anything and lists the commands that are still needed. It ends with `nothing to do` once all three match.

## 1. Choose the path

Mark: **manual** (a decision).

**What it achieves.** It decides how many of the later sections you need.

**The three paths.**

- **Rename**: the repository keeps its owner and gets a new name.
- **Transfer**: the repository moves to another owner (another account or an organization).
- **New repository**: an empty repository receives the history; the old one is retired afterwards.

|                                                | Rename                 | Transfer                                            | New repository                             |
| ---------------------------------------------- | ---------------------- | --------------------------------------------------- | ------------------------------------------ |
| Commit history                                 | kept                   | kept                                                | kept only if pushed as section 3 describes |
| Issues, pull requests and their discussion     | kept                   | kept                                                | stay behind on the old repository          |
| Old addresses                                  | redirect               | redirect                                            | do not redirect                            |
| Actions secrets, webhooks, deploy keys         | kept (same repository) | kept                                                | set again (sections 7 and 8)               |
| Actions variables, branch protection, apps     | kept (same repository) | not stated by GitHub: check them (sections 5, 8, 9) | set again (sections 5, 8, 9)               |
| CI age identity                                | kept                   | kept                                                | a new one (section 7)                      |
| Repository name in tracked files               | re-point (section 4)   | re-point (section 4)                                | re-point (section 4)                       |
| Grafana Cloud, PostHog, Linear, encrypted file | untouched              | untouched                                           | untouched                                  |

The "Transfer" column comes from GitHub's page <https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository> (read 2026-10-03): secrets, webhooks, deploy keys, issues, pull requests and Git LFS objects stay with a transferred repository, and old addresses redirect. The page says nothing about variables, branch protection or installed apps, so treat those as unconfirmed and check them. The "Rename" column is an expectation, not something read on an official page that day: a renamed repository is the same repository. Both controls are on the repository's **Settings** page; their labels were not walked for this guide.

**Two more decisions to write down now.** They change later sections.

- **Personal account or organization.** Under an organization, the workflows `pr-gate` and `portability` (the files are in `.github/workflows/`) need the secret `GITLEAKS_LICENSE`; under a personal account they do not.
- **Public or private.** On a private repository the macOS job of the `ios` workflow uses up the plan's Actions minutes much faster than the Linux jobs (`docs/SERVICES-SETUP.md` section 1, "Cost"). A private repository under a personal account on the free plan cannot protect `main` or use secret scanning: on 2026-10-04 GitHub answered `Upgrade to GitHub Pro or make this repository public to enable this feature.` (section 5). On a public repository everything committed is readable by anyone, including the ciphertext of `secrets/dev.enc.yaml`, which is then protected by the age keys alone.

To see what the current repository is:

```bash
gh repo view --json nameWithOwner,visibility,isInOrganization
```

**It worked when** you have written down the path, `<owner>/<repo>`, and the two decisions.

## 2. What carries over untouched

Mark: **one command** (a check). The fix, when the check finds something, is **Owner only**.

**What it achieves.** You know what you do not have to recreate, and you make sure no value is lost with the old checkout.

**Nothing to do for these.**

- **Grafana Cloud and PostHog.** Neither is tied to the repository. The stack, the dashboards and alerts that the sync wrote, the PostHog project and every token keep working. Section 10 only refreshes the links that point at the repository.
- **Cloudflare R2.** Not tied to the repository either. The dev bucket `ai-stylist-dev` (EU jurisdiction) and its bucket-scoped token exist since 2026-10-12 and keep working after a move. Their five values (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_JURISDICTION`) are shared values like every other: the check below tells you whether they are in the encrypted file or on one machine only. A new account, a new bucket or a lost token: [`docs/SERVICES-SETUP.md`](SERVICES-SETUP.md) section 6.
- **`secrets/dev.enc.yaml` and `.sops.yaml`.** They travel with the code. Your age identity belongs to you and your machines, not to a repository.
- **Linear.** The workspace, the team and every issue link stay valid.
- **The workflows.** No file under `.github/workflows/` names the repository.
- **Product names.** Bundle identifiers, the `@ai-stylist/*` package scope, the API host names, the compose project `ai-stylist`, the Grafana folder `ai-stylist` and the directory `~/.config/ai-stylist/` are product names, not the repository's name. A move changes none of them.
- **History.** Links to old pull requests and workflow runs in `planning/PROGRESS.md` and under `.claude/plans/` stay as written.
- **Git LFS.** There are no LFS objects yet (`git lfs ls-files` prints nothing). Once `assets/3d/**` exists, a new repository also needs `git lfs fetch --all` from the old one and `git lfs push --all origin` to the new one. This was not exercised.

**The one check.** The file `.env` is not tracked. A fresh clone starts with an empty one, and `just secrets-sync` can only deliver what the encrypted file holds. So before you leave an old checkout or an old machine:

```bash
just doctor
```

**It worked when** the output contains both of these lines:

```text
✔ secrets/dev.enc.yaml has exactly the keys of .env.example
✔ .env and secrets/dev.enc.yaml have a value for the same keys
```

**If it did not.** A line that begins `⚠ value(s) that exist only on this machine` lists key names whose values are in this machine's `.env` and nowhere else. This was the case for the observability keys on 2026-10-03, until they were pushed that day (Appendix C item 1). Push the listed values into the encrypted file. Start with the dry run, which lists key names and writes nothing:

> **Owner only.** The command that the dry run prints writes `secrets/dev.enc.yaml`.

```bash
just secrets-push
```

Read the plan before you write it. This is how the script labelled its lines on 2026-10-03; if a label differs, the usage text in `scripts/security/secrets-push.sh` is the reference.

- `add` and `fill` are values that this machine has and the shared file lacks. `--apply` writes these and nothing else.
- `differs` means `.env` and the shared file hold different values for one key. `--apply` leaves such a key alone. The dry run names the two ways on: `just secrets-sync` when the shared value is the newer one, for example after a rotation on the other machine, and `--apply --replace` when the value in `.env` is the newer one.
- `stale` is a key name that `.env.example` no longer has. An empty one is removed with `--prune`. One that still holds a value needs `--prune --prune-values`, which deletes the value with the name.
- `held back` lists keys tagged `[machine-local]` in `.env.example`, such as `DATABASE_URL`. They are never shared.
- An error that names a key and says its value is "not written the way dotenv reads" it means the line in `.env` has a comment after the value, stray quotes or padding. Fix that line; nothing was written.

The dry run ends with a line `to write it:` followed by the exact command, `just secrets-push dev --apply` when there is something to add or fill. Run the command it prints, then run `just secrets-push` once more: it must say `nothing to write`. Commit `secrets/dev.enc.yaml` through a pull request. The diff shows key names and sops metadata, never a value.

## 3. Create the repository and push the full history

Mark: **one command** each. **Owner only.** New repository only; skip this section for a rename or a transfer.

**What it achieves.** The new repository holds the same commits as the old one, so every check that reads history keeps passing.

**Why the full history matters.** `just docs-check` (check DC-03) compares the `**Last updated:**` date of each module contract in `docs/modules/` with the date of the last commit that touched that module's `index.ts` or `apps/api/src/modules/<name>/internal/schema.ts` (`scripts/docs/lib/common.sh` reads it with `git log`). If the code arrives as one imported snapshot, every module's code was "last changed" on the import day, and every contract with an older date fails. A shallow clone fails the same check, which is why `.github/workflows/pr-gate.yml` checks out with `fetch-depth: 0`. So never start the new repository from a zip, a squashed commit, a `--depth` clone or a fresh `git init`.

**Do.** Run these lines in the existing checkout, one at a time. `gh repo create` was not run for this guide; `gh repo create --help` shows its flags.

```bash
git fetch origin
gh repo create <owner>/<repo> --private
git remote rename origin old-origin
git remote add origin https://github.com/<owner>/<repo>.git
git push origin refs/remotes/old-origin/main:refs/heads/main
git push -u origin <branch>
git fetch origin
```

- Line 2 creates an empty repository; write `--public` instead of `--private` for a public one. It must stay empty: no README, no licence.
- Line 5 pushes `main` first, straight from the old remote's copy, so a stale local `main` cannot matter.
- Repeat line 6 for each branch that still has unmerged work.

Uncommitted changes in a checkout or in an agent worktree are not part of any push. Commit them first, or keep that checkout until they are.

Open pull requests do not move. Open each one again on the new repository from its pushed branch. Pull request numbers start again at 1; the old numbers in `planning/PROGRESS.md` stay as history.

**It worked when** both commands below print what the comment says:

```bash
git rev-parse old-origin/main origin/main                   # the same commit hash twice
gh repo view <owner>/<repo> --json defaultBranchRef         # "name":"main"
```

**If it did not.**

- `git push` answers that the repository was not found: the name is misspelled or `gh auth status` shows another account.
- The default branch is not `main`: change it on the repository's **Settings** page (label not walked) before anything else. Every link in section 4 assumes `main`.
- `just docs-check` later reports many `DC-03 … predates the module's last code change` lines: the repository was created from a snapshot. Start this section again with an empty repository.

## 4. Re-point the repository name in tracked files

Mark: **one command**. **Owner only**: it rewrites three human-only documents among others.

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

3. Run step 1 again. It must say `nothing to re-point`.

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

The command was run against a copy of the tree and against made-up checkouts (`just test tooling` repeats both on every run). On 2026-10-04 the report of step 1 was run on the real checkout and found nothing to re-point. A real repository move has not been done yet.

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
- **Protection of `main`** (a classic branch protection rule). A pull request is required, the branch must be up to date, force pushes and deletion are off, and the rule applies to administrators too. These five checks are required, spelled exactly as the jobs in `.github/workflows/pr-gate.yml` report them: `Gate · just ci-parity`, `Gate · Contracts (generate --check, spectral, oasdiff)`, `Gate · Secret scan (PR diff)`, `Gate · Clone detection` and `Report · PR gate summary`. No approval is required, because one person cannot approve their own pull request, and Code Owner review stays off until section 6 is merged; both are single values in the file. The `ios`, `android` and `nightly` checks are not required on purpose: they do not run on every pull request, and a required check that never runs blocks every other pull request.
- **Secret scanning and push protection.** Both switched on.
- **Labels.** `dependencies`, `needs-adr`, `android`, `ios`, `needs-deps-lock` and `security`, the six that `renovate.json` uses. Existing labels are left alone.

The check names are compared with the job names in `.github/workflows/pr-gate.yml` before anything is sent, so a renamed job cannot leave a required check that never reports. Unlike the GitHub screen, the command does not need the checks to have run once: it can protect `main` before the first pull request.

**What a plan does not offer.** A line marked `unavailable` gives the reason, with GitHub's own answer where a call was refused, and changes nothing. Expect it on a private repository under a personal account on the free plan: branch protection is answered with `Upgrade to GitHub Pro or make this repository public to enable this feature.`, and secret scanning is not offered for such a repository. These lines are not counted as differences, so the report can still say `0 to change`. Make the repository public or change the plan, then run step 2 again. Until then `main` is not protected (Appendix C item 6).

Not set by the command: auto-merge and "delete branch on merge" (both are off on the current repository; `renovate.json` has auto-merge rules, and how Renovate behaves without the repository option was not checked), rulesets (the report says when one exists; use branch protection or a ruleset, not both) and environments (none are needed before the deploy jobs of P03).

**It worked when** `just repo-setup settings` reports `0 to change` and exits without an error. The proof for the protection is section 12 step 3: the merge button of a pull request stays disabled until the five checks pass.

**If it did not.**

- `the GitHub CLI (gh) is not installed` or `gh has no login for github.com`: the line below the error is the fix (`mise use --global gh@latest`, `gh auth login`).
- `the gh account has no admin rights on <owner>/<repo>`: `gh auth status` shows which account is active.
- `manual  default branch: is …, not main`: change the default branch on the repository's **Settings** page first. Every link in section 4 assumes `main`.
- A line marked `failed` names the call and GitHub's answer. The other settings are still applied; fix the cause and run step 2 again.

The command was tested against a stand-in for the GitHub API with made-up repositories (`just test tooling`). On 2026-10-04 the report of step 1 was run against the real repository, a private repository under a personal account. It showed the Actions permissions and the workflow token as `ok`; the protection of `main`, secret scanning and push protection as `unavailable`, the protection with GitHub's answer `Upgrade to GitHub Pro or make this repository public to enable this feature.`; and the six labels as `create`. `--apply` was then run there the same day: it created the six labels (`6 changed, 0 failed`) and left the three unavailable settings alone. Applying the protection of `main` and secret scanning has not been exercised on a real repository, and what GitHub answers on other plans is taken from its documentation.

## 6. `CODEOWNERS`

Mark: **manual** (one file).

**What it achieves.** Review requests reach a real account. GitHub ignores an unknown owner without any message. Since 2026-10-12 every owner line of `CODEOWNERS` names one handle, the repository owner's; until that day the file held four placeholder handles (`@team`, `@dev-lead`, `@3d-owner` and `@ml-owner`). With one person, every handle is your own username.

**Do.** Only when the handle changes with the move: another account owns the repository, or a team takes over some paths. On a branch, put the new handle in place of the old one on every owner line (search and replace in an editor) and commit through a pull request.

**It worked when** this prints one line, the number of owner lines followed by the handle:

```bash
grep -vE '^(#|$)' CODEOWNERS | grep -oE '@[^[:space:]]+$' | sort | uniq -c
```

On 2026-10-12 it printed 25 owner lines for one handle.

## 7. The CI age identity

Mark: **manual** (six steps). **Owner only.** A recipe for this step is planned. New repository only: a renamed or transferred repository keeps its secrets.

**What it achieves.** The new repository has its own secret `SOPS_AGE_KEY`, and the encrypted files can be decrypted with it. CI's private key was deleted from disk right after it was stored as a secret, so it exists only inside the old repository and cannot be copied. No workflow reads the secret before the deploy jobs of P03, so this step is not urgent, but P03 fails without it.

**Do.** In the repository root, on a branch, in one terminal that no agent can read.

1. Create a new identity in a private temporary directory.

   ```bash
   ci_age_dir="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-ci-age.XXXXXX")"
   mise exec -- age-keygen -o "$ci_age_dir/ci.txt"
   ```

2. Put its public key in place of the old CI recipient. That is the line below each of the three `# ci:` comments in `.sops.yaml` (lines 22, 30 and 40 on 2026-10-03). The third command changes nothing while either key is empty. The last command shows the three comments, each followed by the new `age1…` line.

   ```bash
   OLD_CI="$(grep -A1 '# ci:' .sops.yaml | grep -o 'age1[0-9a-z]*' | head -n 1)"
   NEW_CI="$(mise exec -- age-keygen -y "$ci_age_dir/ci.txt")"
   [ -n "$OLD_CI" ] && [ -n "$NEW_CI" ] && sed "s/$OLD_CI/$NEW_CI/" .sops.yaml > .sops.yaml.tmp && cat .sops.yaml.tmp > .sops.yaml && rm .sops.yaml.tmp
   grep -n -A1 '# ci:' .sops.yaml
   ```

3. Re-wrap every encrypted file for the new recipient list. This needs your own identity.

   ```bash
   just secrets-updatekeys
   ```

4. Store the private key as the repository secret. The file goes in through standard input.

   ```bash
   gh secret set SOPS_AGE_KEY --repo <owner>/<repo> < "$ci_age_dir/ci.txt"
   ```

5. Remove the private key from disk.

   ```bash
   rm -rf "$ci_age_dir"
   unset ci_age_dir OLD_CI NEW_CI
   ```

6. Check that exactly two files changed, `.sops.yaml` and `secrets/dev.enc.yaml`, and commit them together through a pull request.

   ```bash
   git status --short
   ```

The edit in step 2 was tried on a copy of `.sops.yaml` with a made-up key: it changed the three CI lines and no developer line.

**It worked when** `just secrets-updatekeys` printed `secrets-updatekeys: secrets/dev.enc.yaml re-wrapped for 2 dev recipient(s) in .sops.yaml`, `gh secret list --repo <owner>/<repo>` shows `SOPS_AGE_KEY`, and `just doctor` still shows `✔ secrets/dev.enc.yaml decrypts with your identity`.

Whether the stored secret matches the recipient cannot be read back from GitHub. The first deploy job in P03 is the real test.

**If it did not.** `just secrets-updatekeys` stops with `no age private key found`: this machine has no developer identity. Restore it first (Appendix A.3).

## 8. Actions secrets and variables

Mark: **one command**. **Owner only.** After a transfer, run only the report.

**What it achieves.** The workflows that run on `main` can upload debug symbols to PostHog and, if you want it, push CI metrics to Grafana. Which names exist, where each value comes from and which keys must never reach GitHub is one file, `tools/github/actions-secrets.txt`.

**Exactly these.** A secret's value cannot be read back from the old repository, so the source is `secrets/dev.enc.yaml`. Section 2 makes sure that file holds the values.

| Name                          | Kind     | Value comes from                                          | Read by                                           | Set by                                                |
| ----------------------------- | -------- | --------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `POSTHOG_CLI_API_KEY`         | secret   | `secrets/dev.enc.yaml`, same key                          | the `ios` and `android` workflows, on `main`      | the command                                           |
| `POSTHOG_CLI_PROJECT_ID`      | variable | `secrets/dev.enc.yaml`, same key                          | the same two workflows                            | the command                                           |
| `POSTHOG_CLI_HOST`            | variable | `secrets/dev.enc.yaml`, same key                          | the same two workflows                            | the command                                           |
| `SOPS_AGE_KEY`                | secret   | section 7                                                 | nothing before P03                                | you, in section 7                                     |
| `OTEL_EXPORTER_OTLP_HEADERS`  | secret   | a `ci-metrics` token of its own (section 10.3, last part) | the summary job of `pr-gate`, on pushes to `main` | you; optional                                         |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | secret   | `secrets/dev.enc.yaml`, same key                          | the same job                                      | the command, once the headers secret exists; optional |
| `TURBO_TOKEN`, `TURBO_TEAM`   | secrets  | `secrets/dev.enc.yaml`, same keys (empty today)           | `pr-gate`, `affected`, `nightly`                  | the command, once the keys hold a value; optional     |
| `GITLEAKS_LICENSE`            | secret   | gitleaks                                                  | `pr-gate`, `portability`                          | you; only under an organization                       |

**Never set in GitHub.** The manifest lists them, the report fails when GitHub has one, and the command never sends them:

- `POSTHOG_API_KEY` and `POSTHOG_HOST`: apps built in CI carry no project key.
- `POSTHOG_SYNC_API_KEY` and `GRAFANA_SERVICE_ACCOUNT_TOKEN`: the sync runs on a developer machine only, and the Grafana token has the Admin role.
- The value that `secrets/dev.enc.yaml` holds as `OTEL_EXPORTER_OTLP_HEADERS`: that is the dev token. CI gets a token that can write metrics and nothing else, and you set it by hand.
- Never upload a whole file with `gh secret set -f .env`. It would send every key, including the four above.

**Do.** Needs `gh`, logged in as an account with admin rights on the repository, and an age identity that decrypts the dev file. `just doctor` shows the login and the identity; it does not check the admin rights.

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

On a brand-new repository step 2 reports `1 still missing` until section 7 has stored `SOPS_AGE_KEY`: the command never creates or sends a private key.

**It worked when** step 3 shows no `missing` and no `forbidden` line. The real test is the next run of `ios` or `android` on `main`: the upload step runs instead of printing a notice that a value is empty.

**If it did not.**

- `secrets/dev.enc.yaml holds no value for <KEY>`: the shared file lacks it. Store it with `just secrets-push --set <KEY>` (section 10), then run step 2 again.
- `GitHub did not list the Actions secrets and variables`: the account that `gh auth status` shows has no admin rights on the repository, or `origin` names the wrong repository.
- `could not set the secret …`: the output of sops and `gh` is hidden on purpose. The line below the error names the three things to check.
- `no age private key found`: this machine has no developer identity (Appendix A.3).

The command was tested with a stand-in for `gh`, the real sops and made-up values (`just test tooling`). On 2026-10-04 the report of step 1 was run against the real repository and found every required name present. `--apply` has not been run against a real repository yet.

## 9. GitHub Apps

Mark: **manual** (browser). **Owner only.** After a transfer, check whether the apps are still installed; GitHub's transfer page does not say.

**What it achieves.** Dependency updates arrive as pull requests, and pull requests link to Linear issues.

- **Renovate.** `renovate.json` is in the repository, and `.github/workflows/README.md` says Renovate keeps the pins current, but the app has never run on the current repository: no pull request, branch or "Dependency Dashboard" issue from it has ever existed (checked 2026-10-03). So this is new work on any repository, not a migration. Install the Renovate GitHub App (<https://github.com/apps/renovate>) and give it access to `<owner>/<repo>` only. The install screens were not walked for this guide. `renovate.json` schedules its work "before 6am on monday", so the first pull requests can take until the next Monday.

  It worked when this prints an issue:

  ```bash
  gh issue list --repo <owner>/<repo> --state all --search 'Dependency Dashboard in:title'
  ```

- **Linear.** Whether Linear's GitHub integration is connected to the current repository was not determined. If you want pull requests linked to issues, give the integration access to the new repository in Linear's settings (screens not walked). The Linear workspace, the team and the issue links do not change.

## 10. Grafana Cloud and PostHog

### 10.1 What does not need recreating

Neither service knows the repository. These objects stay as they are:

- **Grafana Cloud:** the stack; the folder `ai-stylist` (title "AI Stylist"); the contact point `ai-stylist-oncall`; the mute timings `quiet-hours` and `no-page`; the notification policy; the rule groups `database`, `host` and `queue`; the dashboard "01 Service health".
- **PostHog:** the project and its privacy settings; the disabled GeoIP transformation; the feature flag `demo-outbox-flow`.
- **Tokens:** every token works until its expiry date (Appendix B).

The only thing that names the repository is the runbook link stored in each alert and in the dashboard's header.

### 10.2 Refresh what the sync wrote

Mark: **one command**. The real run changes the vendor accounts: run it yourself, or authorize one session to run it.

**What it achieves.** The alerts and the dashboard in Grafana link to runbooks in the new repository.

**Do.** After section 4 is in the working tree. The sync needs seven keys in `.env`: `GRAFANA_URL`, `GRAFANA_SERVICE_ACCOUNT_TOKEN`, `GRAFANA_ALERT_EMAILS`, `GRAFANA_ONCALL_TIMEZONE`, `POSTHOG_CLI_HOST`, `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_SYNC_API_KEY`. `just doctor` prints `set` or `empty` for each, in its lines `Grafana sync` and `PostHog sync`.

```bash
just observability-sync all --check
just observability-sync --dry-run
just observability-sync
just observability-sync
```

The first command is offline. The second sends only GET requests and prints the plan. The third applies the plan. The fourth is the proof that nothing is left to change.

**It worked when** the offline check prints `observability-sync --check: grafana + posthog definitions OK (offline)` and the fourth command prints these two summary lines:

```text
grafana: done: 0 create, 0 update, 0 delete, 9 unchanged
posthog: done: 0 create, 0 update, 0 delete, 3 unchanged
```

After a repository move the third command is expected to print four `update` lines, one for each of the three alert rule groups and one for the dashboard, and `unchanged` for everything else. That run has not been done yet; the line format is the one the first sync printed on 2026-10-03, for example `grafana: update notification policy: PUT /api/v1/provisioning/policies`.

**If it did not.**

- A key is reported as missing by name: `just secrets-sync`, then `just doctor`. If the key is empty in the shared file too, go to 10.3 or 10.4.
- `401` from Grafana: the service account token is wrong or expired (10.3). `401` from PostHog: the sync key is gone (10.4).
- `403` from PostHog: a scope row or the selected project is missing on the sync key (10.4 step 3).
- The sync prints the method, the path and the status of a failed call, never a value.

### 10.3 Grafana Cloud: a token expired, or the account is new

Mark: **manual** (vendor screens), then **one command** to store each value. Storing is **Owner only**.

Grafana Cloud has two kinds of token, and this project uses one of each.

| Token                                         | Starts with | Feeds                           | Created on | Expires    |
| --------------------------------------------- | ----------- | ------------------------------- | ---------- | ---------- |
| Access-policy token `api-dev`                 | `glc_`      | `OTEL_EXPORTER_OTLP_HEADERS`    | 2026-10-03 | 2027-01-01 |
| Service account token of `observability-sync` | `glsa_`     | `GRAFANA_SERVICE_ACCOUNT_TOKEN` | 2026-10-03 | 2027-01-01 |

A `glc_` token can send telemetry and cannot call Grafana's HTTP API. A `glsa_` token is the reverse. After the expiry date the exporters and the sync are expected to be refused with `401` (not seen yet).

**Get in.**

1. Open <https://grafana.com/> and click **My account** in the page header. The Grafana Cloud Portal of your organization opens. For a new account, sign up first at <https://grafana.com/auth/sign-up/create-user> and create the stack in an EU region (DEC-58); the free plan allows one stack per account. Sign-up itself was not walked.
2. Under **Manage your Grafana Cloud stack**, the stack's card has two buttons, **Launch** and **Details**. Click **Details**. The page **Manage Stack: `<stack>`** opens.
3. On the **OpenTelemetry** tile click **Configure**. The page shows two values:
   - **OTLP Endpoint**: an address such as `https://otlp-gateway-prod-<region>.grafana.net/otlp`. This is `OTEL_EXPORTER_OTLP_ENDPOINT`. Copy it as shown and keep the `/otlp` ending. Never type it by hand: newer regions use a longer host name.
   - **Instance ID**: a number. It is the user-name half of the header built in step 8. It is not a secret.

   Do not click **Generate now** under **Password / API Token** on that page. The token it creates belongs to a ready-made policy whose eight scopes cannot be narrowed.

4. Go back to **Manage Stack** and click **Launch** on the **Grafana** tile. The stack's own Grafana opens at `https://<stack>.grafana.net`. That address, without a path, is `GRAFANA_URL`.

**The OTLP token (`glc_`).**

5. In the left menu choose **Administration**, **Users and access**, **Cloud access policies**.
6. If the card `api-dev` exists, go to step 7. For a new account click **Create access policy**. In the dialog **Create new access policy** type `api-dev` into **Display name** (**Name** fills in by itself). In the **Scopes** table tick **Write** on the rows `metrics`, `logs` and `traces`, and nothing else. Click **Create**.
7. On the `api-dev` card click **Add token**. In the dialog **Create new token** type a name into **Token name**, for example `api-dev-<yyyymmdd>`. Open **Expiration date** and choose **90 days**; the default is **No expiry**, and the other choices are **30 days**, **60 days** and **Choose an expiration date**. Click **Create**.
8. The dialog **Token successfully added.** shows the token once. Copy the **Token** field, then click **Close**. Now build the header and store it, without ever showing it. First run this line on its own; it waits for you to paste the token and press Enter, and shows nothing:

   ```bash
   read -rs GLC_TOKEN
   ```

   Then put the Instance ID from step 3 in place of the placeholder, keep the single quotes, and run the rest. The first command does nothing while the token is empty.

   > **Owner only.** This writes `secrets/dev.enc.yaml`.

   ```bash
   [ -n "$GLC_TOKEN" ] && printf 'Authorization=Basic%%20%s' "$(printf '%s:%s' '<instance id>' "$GLC_TOKEN" | base64 | tr -d '\n')" |
     just secrets-push --set OTEL_EXPORTER_OTLP_HEADERS
   unset GLC_TOKEN
   just secrets-sync
   ```

   The stored value has the form `Authorization=Basic%20<base64 of instance id:token>`, on one line, with no space and no quotes. `%20` stands for the space after `Basic`; the API, the jobs process, the Python worker and the CI metrics push all read this spelling. The header assembly was tried with a made-up token. Piping it into `just secrets-push --set` was read from the script and its tests, not run for this guide. Do not skip the last line: until `just secrets-sync` has run, `.env` still holds the old value, the dry run of section 2 lists the key as `differs`, and `--apply --replace` would put the old value back.

   For a new account also store the endpoint: `just secrets-push --set OTEL_EXPORTER_OTLP_ENDPOINT`, paste the address at the hidden prompt, then `just secrets-sync`.

9. Test it. Open a new terminal in the repository, so direnv loads the new `.env`:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
     -H 'Content-Type: application/json' \
     -H "Authorization: Basic ${OTEL_EXPORTER_OTLP_HEADERS#Authorization=Basic%20}" \
     -d '{"resourceSpans":[]}' "$OTEL_EXPORTER_OTLP_ENDPOINT/v1/traces"
   ```

   Expected: `200`. `401` means the header or the token is wrong. On 2026-10-03 the real token answered `200` and a made-up one answered `401`.

**The service account token (`glsa_`).**

10. In the stack's Grafana choose **Administration**, **Users and access**, **Service accounts**. If the account `observability-sync` exists, open it and go to step 11. For a new account click **Add service account**. On the page **Create service account** type `observability-sync` into **Display name**. Click **Role** (it shows **No roles assigned**), choose **Admin** under **Basic roles**, click **Apply**, then **Create**. Admin is the only basic role that may list data sources, which the sync does first; whether Editor would be enough was not tested.
11. On the account's page, under **Tokens**, click **Add service account token**. In the dialog of the same name fill in **Display name**, for example `observability-sync-<yyyymmdd>`. Under **Expiration** click **Set expiration date**: the default is **No expiration** and there is no 90-day choice. Click the **Expiration date** field, press **›** in the calendar until you reach the month, and click the day 90 days from today (`date -d '+90 days' +%F` on Linux, `date -v+90d +%F` on macOS). Click **Generate token**.
12. The dialog **Service account token created** shows the token. Copy the **Token** field, then click **Close**. Treat it as shown once.
13. Store it. Run this command on its own; it asks for the value at a hidden prompt, and you paste it there.

    > **Owner only.** This writes `secrets/dev.enc.yaml`.

    ```bash
    just secrets-push --set GRAFANA_SERVICE_ACCOUNT_TOKEN
    ```

    Then run `just secrets-sync`, which brings the value into this machine's `.env`.

    For a new account store three more values the same way: `GRAFANA_URL` (step 4), `GRAFANA_ALERT_EMAILS` (the on-call address; it is personal data, and one address avoids the open question of which separator Grafana accepts) and `GRAFANA_ONCALL_TIMEZONE` (an IANA zone name such as Europe/Berlin; an offset such as `+01:00` is refused).

14. Test it, in a new terminal in the repository:

    ```bash
    curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $GRAFANA_SERVICE_ACCOUNT_TOKEN" "$GRAFANA_URL/api/datasources"
    ```

    Expected: `200`. Then run section 10.2.

15. Commit `secrets/dev.enc.yaml` through a pull request, run `just secrets-sync` on every other machine, and write the new expiry date into Appendix B and your calendar.

**A new stack: what the first sync looks like.** On 2026-10-03 the first run against an empty stack printed this, and the second run printed nine `unchanged` lines:

```text
grafana: create folder ai-stylist: POST /api/folders
grafana: create contact point ai-stylist-oncall: POST /api/v1/provisioning/contact-points
grafana: create mute timing quiet-hours: POST /api/v1/provisioning/mute-timings
grafana: create mute timing no-page: POST /api/v1/provisioning/mute-timings
grafana: update notification policy: PUT /api/v1/provisioning/policies
grafana: create alert rule group database: PUT /api/v1/provisioning/folder/ai-stylist/rule-groups/database
grafana: create alert rule group host: PUT /api/v1/provisioning/folder/ai-stylist/rule-groups/host
grafana: create alert rule group queue: PUT /api/v1/provisioning/folder/ai-stylist/rule-groups/queue
grafana: create dashboard ai-stylist-service-health: POST /api/dashboards/db
grafana: done: 8 create, 1 update, 0 delete, 0 unchanged
```

The one `update` replaces the stack's default notification policy. From then on an alert without a severity label goes to the on-call address.

**The CI token `ci-metrics` (optional, never created so far).** It feeds only the two optional GitHub secrets of section 8. Repeat steps 6 to 8 with a policy named `ci-metrics` on which **Write** is ticked on the `metrics` row only. Build the header with the same Instance ID, and send it to GitHub instead of the encrypted file. Run `read -rs CI_TOKEN` on its own first and paste the token, as in step 8. Then:

> **Owner only.**

```bash
[ -n "$CI_TOKEN" ] && printf 'Authorization=Basic%%20%s' "$(printf '%s:%s' '<instance id>' "$CI_TOKEN" | base64 | tr -d '\n')" |
  gh secret set OTEL_EXPORTER_OTLP_HEADERS --repo <owner>/<repo>
unset CI_TOKEN
[ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ] && printf '%s' "$OTEL_EXPORTER_OTLP_ENDPOINT" | gh secret set OTEL_EXPORTER_OTLP_ENDPOINT --repo <owner>/<repo>
```

Unconfirmed: no official page states that the gateway accepts a metrics-only token on `/v1/metrics`. The test is the next push to `main`: the summary job of `pr-gate` prints a line that contains `pushed` and `(HTTP 2…)`, or a warning that begins `push failed`. A failed push never fails the gate.

### 10.4 PostHog: a key is gone, or the account is new

Mark: **manual** (vendor screens), then **one command** to store each value. Storing is **Owner only**.

| Key              | Kind                                 | Label in PostHog     | Feeds                                              |
| ---------------- | ------------------------------------ | -------------------- | -------------------------------------------------- |
| Project token    | public by design, starts with `phc_` | none                 | `POSTHOG_API_KEY`                                  |
| Personal API key | secret, starts with `phx_`           | `symbol-upload`      | `POSTHOG_CLI_API_KEY`, here and as a GitHub secret |
| Personal API key | secret, starts with `phx_`           | `observability-sync` | `POSTHOG_SYNC_API_KEY`, never in GitHub            |

Whether a personal API key expires by itself is unconfirmed. PostHog allows at most 10 personal API keys, and a `phx_` key that GitHub's secret scanning finds in a public repository is rolled by PostHog.

1. **The project values.** Open <https://us.posthog.com/settings/project>. It redirects to `https://us.posthog.com/project/<project id>/settings/project-details`. The page is **Settings - General**, and its section **Project token & ID** has three boxes:
   - **Project token**: `POSTHOG_API_KEY`. Do not click the **Reset token** icon next to it; it is expected to invalidate the current token at once (not tried).
   - **Project ID**: digits only, the same number as in the address bar. This is `POSTHOG_CLI_PROJECT_ID`.
   - **Region**: `US Cloud` or `EU Cloud`. It decides the two hosts: `POSTHOG_HOST` is the ingestion host (`https://us.i.posthog.com`), and `POSTHOG_CLI_HOST` is the app host (`https://us.posthog.com`, no path and no trailing slash). With the two swapped, events are lost or the symbol upload and the sync fail.

   For a new account, sign up at <https://posthog.com/signup> and use the organization and the project the account gets. Their names do not matter. The free plan allows one project, and a project changes region only for Scale or Enterprise customers. Sign-up itself was not walked.

2. **Open the key page.** <https://us.posthog.com/settings/user-api-keys>; in the settings sidebar this is **Account**, **Personal API keys**. Click **Create personal API key**. A dialog of the same name opens.

3. **The sync key.**
   - **Label**: `observability-sync`. If a key with that label already exists, add a date to the label; whether two keys may share a label was not checked.
   - **Organization & project access**: the choices are **All access**, **Organizations** and **Projects**. Choose **Projects**, click **Select projects…** and tick the project.
   - **Scopes**: every scope is a row with **No access**, **Read** and **Write**. No preset fits this key. Type into **Search scopes…** to find the rows **Project**, **Feature flag** and **Hog function**, and set each to **Write**. Leave every other row on **No access**.
   - Click **Create key**. The dialog **Personal API key ready** shows the value once. Copy it, then click **Okay**.

   Your account must be a project admin, because the sync changes admin-only settings. Organization owners and admins are project admins automatically.

4. **The symbol-upload key.** In the same dialog:
   - **Label**: `symbol-upload`.
   - **Organization & project access**: choose **Organizations**, click **Select organizations…**, tick the organization, and click the dialog's title to close the list. Do not choose **Projects** for this key: the **Organization** scope it needs is not offered on a key limited to projects.
   - **Scopes**: click **Select preset** and choose **Source map upload**. It sets **Error tracking** to **Write** and **Organization** to **Read**.
   - Click **Create key**, copy the value, click **Okay**.

5. **Store them.** Run the three commands one at a time. Each of the first two asks for its value at a hidden prompt.

   > **Owner only.** The first two write `secrets/dev.enc.yaml`.

   ```bash
   just secrets-push --set POSTHOG_SYNC_API_KEY
   just secrets-push --set POSTHOG_CLI_API_KEY
   just secrets-sync
   ```

   For a new account store `POSTHOG_API_KEY`, `POSTHOG_HOST`, `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST` the same way. Then send the GitHub secret and the two variables again with `just repo-setup secrets --apply --replace` (section 8), commit `secrets/dev.enc.yaml` through a pull request, and run `just secrets-sync` on every other machine.

6. **Test them**, in a new terminal in the repository:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $POSTHOG_CLI_API_KEY" "$POSTHOG_CLI_HOST/api/organizations/@current/"
   curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $POSTHOG_CLI_API_KEY" "$POSTHOG_CLI_HOST/api/projects/$POSTHOG_CLI_PROJECT_ID/feature_flags/"
   just observability-sync posthog --dry-run
   ```

   Expected: `200` (the upload key works), then `403` (it cannot read flags, so it holds nothing beyond its two scopes), then the plan of the dry run. Both status codes were seen on 2026-10-03. Then run section 10.2.

**A new project: what the first sync does.** It sets the privacy settings of `docs/observability/posthog/project-settings.json`, disables the GeoIP transformation and creates the flag `demo-outbox-flow` switched off. On 2026-10-03 that run ended with `posthog: done: 1 create, 2 update, 0 delete, 0 unchanged`.

One consequence surprises: while `POSTHOG_API_KEY` is set and the flag is off, the local demo route `POST /v1/dev/demo-events` answers `404`. To switch the flag on, open it from <https://us.posthog.com/feature_flags>, click **Edit**, and under **Release conditions**, in condition set 1, set **Rollout percentage** to **100%**; switch **Enabled** on and click **Save**. To switch it off again, use the switch **Enable feature flag** on the flag's Overview tab and choose **Disable only** in the dialog "Disable this flag?", never **Disable and archive**. The sync never changes whether an existing flag is on.

## 11. Every machine

Mark: **auto**, one command each. Removing a container, a volume, a worktree or a branch is **Owner only**.

**What it achieves.** Each machine talks to the new repository and passes its own health check.

**Do**, on every machine and in every clone. Agent worktrees share their clone's configuration, so one command per clone covers them. The first line is not needed where section 3 already renamed the remotes.

```bash
git remote set-url origin https://github.com/<owner>/<repo>.git
git fetch origin
just bootstrap
just doctor
```

For a fresh clone in a new directory, or a machine that never had the repository, use Appendix A instead.

**It worked when** `git remote get-url origin` prints the new address and `just doctor` ends with `all checks passed`.

**Leftovers that live outside the repository.** A move does not carry these; look at each once per machine.

- **The local Postgres container.** Every `just` recipe uses the compose project `ai-stylist`, whatever the checkout directory is called, so a new directory no longer creates a second project. `docker-compose.yml` names the same project (`name: ai-stylist`), so a `docker compose` command typed outside `just` uses it too. If `just doctor` prints `✘ local Postgres: container ai-stylist-postgres … belongs to compose project …`, the container was created by another checkout. Doctor prints the fix, which is the four steps below. The local database holds synthetic seed data only, and doctor also names the alternative that keeps the old container and its data. The steps are **Owner only**: step 1 removes a container, and step 4 deletes a database for good.
  1. Remove the container. Its data volume is kept.

     ```bash
     docker stop ai-stylist-postgres && docker rm ai-stylist-postgres
     ```

  2. Create it again, with a new and empty database: `just dev-api`.
  3. In a second terminal, load the schema and the seed data: `just db-migrate && just db-seed`.
  4. Later, once nothing in the old database is needed, delete the volume that doctor named: `docker volume rm <old project>_postgres-cluster`.

- **`.env`.** An existing clone keeps its file. A fresh clone gets an empty one from `just bootstrap`, which also fills `DATABASE_URL` and sets an empty `APP_ENV` to `local`; `just secrets-sync` adds the shared values.
- **The Xcode-only settings file** (Mac only, not tracked): `Local.xcconfig` in `apps/ios/Config/`. It is needed only for builds started from the Xcode window. Write it again in a fresh clone; `apps/ios/README.md` shows the two lines.
- **Agent worktrees.** They live under `.claude/worktrees/` inside the clone, so a fresh clone has none. In the old clone, list them with `git worktree list`. Remove one with `git worktree remove <path>` and its branch with `git branch -d <branch>`; both refuse when work would be lost, so never add `--force` or use `-D` without looking. On 2026-10-03 the Linux machine held about 10 GB of them, and `just doctor` fails below 10 GB of free disk. A clean-up recipe is planned.
- **Claude Code's notes.** Its memory folder is keyed to the checkout's path: `~/.claude/projects/<the absolute path with every / replaced by ->/memory/`. A clone at another path starts without it. Copying the folder to the new path's name is the obvious fix; it was not tried. The personal settings file `settings.local.json` under `.claude/` is local to a clone as well.
- **Per-machine files that do not depend on the path.** The age identity, `~/.config/ai-stylist/env.sh` and the Linear API key stay valid. Nothing to do.

## 12. Verify

Mark: **one command** each.

1. **The machine.** `just doctor` ends with `all checks passed`.
2. **The local gate.** `just ci-parity`. Every step must pass, also on a machine whose `.env` holds real keys: the working-tree secret scan skips the gitignored repo-root `.env` (Appendix C item 3). Just before that scan, `just security-scan` runs `scripts/security/env-untracked-check.sh`, which fails when the repo-root `.env` is tracked or staged.
3. **The pull request gate.** Open a pull request with any small change. Its checks list shows the four `Gate · …` jobs and `Report · PR gate summary`. If section 5 protected `main`, the merge button stays disabled until the five checks pass.
4. **The GitHub side.** `just repo-setup` ends with `nothing to do`: tracked files, secrets and variables, and settings match.
5. **`main`.** After the first merge, `pr-gate` runs on the push. `ios` and `android` run when their paths changed, and on `main` they upload symbols.
6. **Grafana.** Open `https://<stack>.grafana.net/alerting/grafana/queue-job-dlq/view`. The rule's runbook link names the new repository. The same rule is under **Alerts & IRM**, **Alerting**, **Alert rules** (menu labels from Grafana's documentation, not seen live). The link opens only for someone who may read the repository, and only once the runbook file is on the new repository's `main`.
7. **The other machine.** Appendix A, then `just doctor` there.

**If a step fails**, `just doctor` is the first thing to read; the root `README.md` section "When something is red" lists the usual causes.

## 13. Retire the old repository

Mark: **manual**. **Owner only.** New repository only. Wait until the new repository has been green for a while.

**What it achieves.** Nothing can be pushed to the old place by mistake, and its credentials are gone.

1. Delete its Actions secrets and variables. On 2026-10-03 these were the secrets `SOPS_AGE_KEY` and `POSTHOG_CLI_API_KEY` and the variables `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST`. The `delete` commands were not run for this guide.

   ```bash
   gh secret list --repo <old-owner>/<old-repo>
   gh secret delete SOPS_AGE_KEY --repo <old-owner>/<old-repo>
   gh secret delete POSTHOG_CLI_API_KEY --repo <old-owner>/<old-repo>
   gh variable delete POSTHOG_CLI_PROJECT_ID --repo <old-owner>/<old-repo>
   gh variable delete POSTHOG_CLI_HOST --repo <old-owner>/<old-repo>
   ```

2. Remove the access of any GitHub App installed on it.
3. Archive it, so it becomes read-only: `gh repo archive <old-owner>/<old-repo>` (not run for this guide), or the **Settings** page. Do not delete it: its issues, its pull requests and every old link live there.
4. On each machine: `git remote remove old-origin`.

**What stays true afterwards.** Every old version of `secrets/dev.enc.yaml` is still in the old repository's history. Anyone who can read that history and holds an age identity that was a recipient at the time can decrypt it. If an identity is ever exposed, replace the vendor credentials themselves (`secrets/README.md`, "Losing or rotating an identity"); re-wrapping the file does not help for old history.

## Appendix A. Setting up another machine

Mark: **auto** after the manual prerequisites. The same commands work on Arch Linux (Docker Engine) and macOS (OrbStack).

### A.1 On the machine you already have

`just secrets-sync` can only deliver what the encrypted file holds. Do the check of section 2 first and merge the result to `main`. Otherwise the new machine gets a `.env` without the values you need.

### A.2 Prerequisites that bootstrap does not install

| What                    | Linux                                                      | macOS                                                      |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Basics                  | `git`, `curl`, `sudo`, 10 GB of free disk                  | Xcode Command Line Tools: `xcode-select --install`         |
| Package manager         | pacman or apt, already there                               | Homebrew, with the official command from <https://brew.sh> |
| Git identity            | `git config --global user.name` and `user.email`, both set | the same                                                   |
| `jq`                    | `sudo pacman -S jq` (or `sudo apt-get install jq`)         | ships with macOS 15 and later                              |
| `gh` (sections 5, 7, 8) | `mise use --global gh@latest`, then `gh auth login`        | the same                                                   |

`jq` matters more than it looks: `just doctor` fails without it, and every Claude Code guard in `scripts/hooks/` refuses all edits and commands without it. The git identity matters too: without a name and an email, bootstrap's secrets step stops before it syncs anything and prints the two `git config` commands.

### A.3 The age identity: restore it, or make a second one

Decide before you run bootstrap, because bootstrap creates a new identity when it finds none.

- **Restore the same identity (the short way for your own second machine).** Copy the backed-up file from the password manager to `~/.config/sops/age/keys.txt`, the same path on Linux and macOS. First create the directory:

  ```bash
  mkdir -p ~/.config/sops/age && chmod 700 ~/.config/sops/age
  ```

  Put the backed-up content into `keys.txt` in that directory with an editor, then close the file to everyone else:

  ```bash
  chmod 600 ~/.config/sops/age/keys.txt
  ```

  Bootstrap then prints `age identity present at …` and `your age recipient is already listed in .sops.yaml (dev) — nothing to do`, syncs the shared values, and says so in its closing summary. No pull request and no approval are needed. The cost: the private key travels through the password manager, and one key now opens the secrets from two machines.

- **Make a second identity.** Run bootstrap without restoring anything. It generates a key, adds its public half to `.sops.yaml` on a branch `onboard/<slug of your git user name>`, pushes the branch and prints a link for a pull request. On the first machine run `just secrets-approve onboard/<slug>` (**Owner only**: it re-wraps the encrypted files and pushes), merge the pull request, then run `just secrets-sync` on the new machine. The cost: a round trip through the first machine. There is also a trap today: the branch name comes from the git user name alone, and the branch from the first onboarding was never deleted on the current repository, so the push from a second machine with the same name is expected to be rejected (Appendix C item 9).

On macOS sops itself would look for the key in `~/Library/Application Support/sops/age/keys.txt`. The repo's scripts export `SOPS_AGE_KEY_FILE` for the path above, so every `just` recipe finds it. A `sops` command typed by hand on a Mac needs `export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"` first. A test with made-up keys covers the scripts' side; it has not been confirmed on a real Mac yet.

### A.4 The commands

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
./scripts/bootstrap.sh --system
./scripts/bootstrap.sh
```

Then open a new terminal, so mise and direnv load, and run `just doctor` in the repository.

- Run the four commands one at a time. The third runs once per machine and asks for your password (sudo). The fourth is safe to repeat at any time.
- `--system` on Linux installs Docker Engine with Compose, git-lfs, a C toolchain and the Android udev rules, starts Docker and adds you to the `docker` group. **Log out and back in** before the fourth command.
- `--system` on macOS installs git-lfs and OrbStack and starts OrbStack, which asks for an admin password once. It installs the Xcode version pinned in `apps/ios/.xcode-version` with `xcodes` when that version is missing; that asks for your Apple ID and downloads about 10 GB.
- On both it installs the Android SDK packages and writes `ANDROID_HOME` to `~/.config/ai-stylist/env.sh`. Only `--system` writes that file.
- The fourth command installs the pinned tools, the JavaScript and Python dependencies and the git hooks, creates `.env`, writes the mise and direnv block into your shell's rc file, takes care of the age identity (A.3) and ends with `just doctor`.
- If `mise install` stops with a GitHub rate-limit message, give it a token for that run: `MISE_GITHUB_TOKEN="$(gh auth token)" ./scripts/bootstrap.sh`. CI passes the same variable. This was not needed on the Linux machine and was not tried.

**It worked when** `just doctor` ends with `all checks passed`. A `⚠` line is a warning with a hint; a `✘` line comes with its fix.

### A.5 After bootstrap

1. Once per machine, after the identity is in the password manager: `just secrets-backup-done`.
2. Now, and again after every pull that changed `secrets/dev.enc.yaml`: `just secrets-sync`.
3. Start Postgres, the migrations, the API and the workers: `just dev backend` (or `just dev` to open the apps as well).
4. `curl localhost:3000/v1/health` answers `{"status":"ok","checks":{"db":"ok"}}`.

### A.6 What differs between the two systems

| Topic                        | Linux (Arch, Docker Engine)                                             | macOS (OrbStack)                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Docker                       | Docker Engine; you must be in the `docker` group                        | OrbStack; `orb start` when the daemon is not reachable                                                 |
| Shell rc file                | `~/.bashrc` or `~/.zshrc`                                               | `~/.bash_profile` or `~/.zshrc`                                                                        |
| Android SDK                  | `~/Android/Sdk`                                                         | `~/Library/Android/sdk`                                                                                |
| `adb`                        | A distro package can put its own `adb` ahead of the SDK's; doctor warns | The SDK's                                                                                              |
| Swift                        | The Docker image `swift:6.4`                                            | Xcode                                                                                                  |
| iOS app                      | Checks only: `just ios-check`                                           | Builds and runs: `just ios-build`, `just ios-test`                                                     |
| Android dependency checksums | `just android-deps-lock` writes the Linux ones                          | Run `just android-deps-lock` once after a Gradle plugin bump and commit the result (Appendix C item 4) |
| Age identity                 | `~/.config/sops/age/keys.txt`                                           | The same path (A.3)                                                                                    |

### A.7 Keeping two machines in step

After every pull on the other machine:

```bash
just bootstrap
just secrets-sync
just doctor
```

`just bootstrap` repairs tools and dependencies and changes nothing that is already right. Doctor names the three kinds of drift and the command for each: `.env missing N key(s)` (copy the lines from `.env.example`; bootstrap does not add them to an existing `.env`), `shared value(s) not in .env yet` (`just secrets-sync`) and `value(s) that exist only on this machine` (section 2). `just doctor` also warns when tracked files still name another repository than `origin` points at (section 4).

### A.8 Optional, per machine

- **Linear API key**, only for `templates/linear/create-templates.sh`: the file `~/.config/ai-stylist/linear-api-key` with mode 600, or the variable `LINEAR_API_KEY`.
- **Linear login for Claude Code**: `.mcp.json` defines the server `linear-ai-stylist`, used only in this repository. Run `claude mcp login linear-ai-stylist` once per machine and pick the Linear account that holds the AI Stylist team. The login stays separate from Linear servers in other projects. To skip the approval prompt in each new worktree, add `"enabledMcpjsonServers": ["linear-ai-stylist"]` to `~/.claude/settings.json`.
- **An Android emulator**, for `just dev`, `just android-run` and `just android-e2e`: `just dev` (or `just android-run`) installs the emulator and a system image and creates the AVD `aistylist-dev` the first time no device is online. Bootstrap installs no emulator image.
- **The Xcode-only settings file**, only for builds started from the Xcode window (section 11).

## Appendix B. Where each credential lives

Dates are as of 2026-10-03. `.env` is readable by you and by the processes you start; agent sessions are denied reading it (`.claude/settings.json`). In `secrets/dev.enc.yaml` everyone with access to the repository sees the key names; the values open only with an age identity listed in `.sops.yaml`.

| Credential                                            | Key it feeds                          | Stored in                                                           | Read by                                               | Expires             | Renew with          |
| ----------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- | ------------------- | ------------------- |
| Your age identity                                     | none                                  | `~/.config/sops/age/keys.txt` on each machine; the password manager | the `just secrets-*` recipes, `just doctor`           | never               | `secrets/README.md` |
| CI age identity                                       | GitHub secret `SOPS_AGE_KEY`          | GitHub only; the private key was deleted from disk                  | nothing before P03                                    | never               | section 7           |
| Grafana access-policy token `api-dev`                 | `OTEL_EXPORTER_OTLP_HEADERS`          | `.env`; `secrets/dev.enc.yaml`                                      | the API, the jobs process, the segmentation worker    | 2027-01-01          | section 10.3        |
| Grafana service account token of `observability-sync` | `GRAFANA_SERVICE_ACCOUNT_TOKEN`       | the same                                                            | `just observability-sync` only                        | 2027-01-01          | section 10.3        |
| Grafana token `ci-metrics`                            | GitHub secrets `OTEL_EXPORTER_OTLP_*` | not created yet                                                     | the summary job of `pr-gate`                          | not applicable      | section 10.3        |
| PostHog project token                                 | `POSTHOG_API_KEY`                     | `.env`; `secrets/dev.enc.yaml`                                      | the apps you build locally; the API's flag evaluation | not known to expire | section 10.4        |
| PostHog personal key `symbol-upload`                  | `POSTHOG_CLI_API_KEY`                 | `.env`; `secrets/dev.enc.yaml`; GitHub secret                       | local app builds; `ios` and `android` on `main`       | unconfirmed         | section 10.4        |
| PostHog personal key `observability-sync`             | `POSTHOG_SYNC_API_KEY`                | `.env`; `secrets/dev.enc.yaml`                                      | `just observability-sync` only                        | unconfirmed         | section 10.4        |
| GitHub CLI login                                      | none                                  | the GitHub CLI's own store, per machine                             | every `gh` command in this guide                      | unconfirmed         | `gh auth login`     |
| Linear API key                                        | `LINEAR_API_KEY`                      | `~/.config/ai-stylist/linear-api-key`, per machine                  | `templates/linear/create-templates.sh`                | unconfirmed         | Linear's settings   |

Not credentials, but stored the same way: `OTEL_EXPORTER_OTLP_ENDPOINT`, `GRAFANA_URL`, `GRAFANA_ONCALL_TIMEZONE`, `POSTHOG_HOST`, `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST`, and `GRAFANA_ALERT_EMAILS`, which is personal data.

The repo's policy is 90 days for provider keys (`planning/11-security-privacy-and-compliance.md` §5.3). Nothing reminds you of a date today; a report that does is planned. Until then, these dates are yours to keep in a calendar:

| Date       | What happens                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-11 | The Grafana Cloud trial ends, according to the portal's banner. What changes on that day is unconfirmed; check that the stack is on the free plan. |
| 2026-12-03 | The one `ignoreUntil` entry in `osv-scanner.toml` runs out, and the vulnerability scan reports that advisory again.                                |
| 2026-12-26 | The feature flag in `packages/shared-kernel/registry/feature-flags.json` reaches its `expiresAt`; `just flags-report` already reports this one.    |
| 2027-01-01 | Both Grafana tokens expire (section 10.3).                                                                                                         |
| 2027-03-25 | `just docs-check` starts to fail for the skills and agents last reviewed on 2026-09-25, the oldest review date: its limit is 180 days.             |

## Appendix C. Known wrong or fragile on 2026-10-03

Each item was checked against the working tree, GitHub or the machine on that day. An item that no longer matches what you see has probably been fixed.

1. **Fixed on 2026-10-03: seven observability values existed on one machine only.** During the day `secrets/dev.enc.yaml` lacked five key names that `.env.example` has (`GRAFANA_SERVICE_ACCOUNT_TOKEN`, `GRAFANA_ALERT_EMAILS`, `GRAFANA_ONCALL_TIMEZONE`, `POSTHOG_CLI_API_KEY`, `POSTHOG_SYNC_API_KEY`), held `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` empty, and still carried four names that left `.env.example` (`NEON_API_KEY`, `NEON_PROJECT_ID`, `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`). The values were in the Linux machine's `.env`. By the evening all seven values were in the file, on `main` too, and the four stale names were gone: the file has exactly the key names of `.env.example`. `just doctor` warns when any of the three conditions comes back, and section 2 is the fix. One document still words this the old way: the status paragraph and the "Pending cleanup" paragraph of `secrets/README.md`, which only a human may edit.
2. **Fixed on 2026-10-03: `docs/SERVICES-SETUP.md` sections 10 and 11 described older vendor screens.** They were rewritten that day from the proposal `.claude/plans/2026-10-03-services-setup-observability-proposal.md` and now give the same screens as section 10 of this guide.
3. **Fixed on 2026-10-12: `just ci-parity` could not pass on a machine whose `.env` holds real keys.** Its last stage, `just security-scan`, scans the working tree with gitleaks, which does not honour `.gitignore`, and `.gitleaks.toml` allows `.env.example` but not `.env`. By the decision of 2026-10-09 (DEC-77) that one scan now reads `tools/security/gitleaks-worktree.toml`, which extends `.gitleaks.toml` and skips one more path: the `.env` in the repository root. A `.env` in any other directory and every other name (`.env.local`) are still reported. The pre-commit hook, the pull-request scan and the history scans read `.gitleaks.toml` alone, so a `.env` that someone force-adds is reported before it is committed. `scripts/security/gitleaks-fixtures.sh` proves both. Since 2026-10-13 `just security-scan` also runs `scripts/security/env-untracked-check.sh` before the working-tree scan: it fails when the repo-root `.env` is tracked or staged, the one case that scan cannot see because it skips that file.
4. **Android builds on the Mac are expected to fail dependency verification.** `apps/android/gradle/verification-metadata.xml` has a macOS checksum for the `aapt2` build tool in version 9.3.3 and none for 9.4.1. Fix: `just android-deps-lock` on the Mac, then commit. No CI job covers this; the `android` workflow runs on Linux only. Derived from the file, not reproduced.
5. **Fixed on 2026-10-03: the `nightly` workflow failed on `main` on 2026-09-30, 10-01, 10-02 and 10-03**, in the vulnerability scan. The commit that addresses the scan was merged that day, and the `nightly` run on `main` after the merge was green, the vulnerability scan included.
6. **`main` is not protected.** The merge button that `docs/SERVICES-SETUP.md` section 1 describes as disabled until the gates pass behaves that way only after section 5 of this guide is done; that section now says so too. Section 5 is now one command (`just repo-setup settings --apply`); on a private repository under a personal account on the free plan it reports the protection as unavailable. Since 2026-10-12 the repository is public (item 7), and GitHub's refusal named a public repository as one way to get the feature, so that command is expected to protect `main` now (not run). By DEC-77 and DEC-82 branch protection still waits for the move to an organization, so whether to run section 5 before that move is the owner's decision. The other half of this item is fixed: until 2026-10-12 `CODEOWNERS` held placeholder handles, and every owner line now names the owner's handle (section 6).
7. **The repository's visibility changed during the day.** In the afternoon it was recorded as public, with secret scanning and push protection off. Around 18:00 UTC GitHub answered that it is private, and an anonymous request for its page got `404`. Its history may have been readable by anyone for some time. **Since 2026-10-12 it is public again, by the owner's decision (DEC-82): temporarily, so that GitHub Actions runs free, with no end date set.** Switched on that day: secret scanning, push protection, Dependabot alerts, private vulnerability reporting, interaction limits set to collaborators only, and approval required for the workflow runs of all outside contributors. Everything committed is readable by anyone while it is public (section 1), and a clone or fork made in that time stays public after the repository is private again.
8. **Three tracked files name the live vendor accounts** (the stack's name and region, the PostHog project id): `.agents/skills/observability-analytics/references/grafana-cloud.md`, `.agents/skills/observability-analytics/references/posthog.md` and the proposal named in item 2. ADR-0007 says the region and the project id are not recorded in the repository. They are identifiers, not secrets. Decide before the repository is public again. The repository is public again since 2026-10-12 (item 7) and this was not decided first, so what the three files name is readable by anyone while it is public.
9. **A second machine with a new identity is expected to fail onboarding.** `scripts/security/secrets-onboard.sh` names its branch after the git user name only, and the branch from the first onboarding is still on the current repository, unmerged. The push is then rejected, and the script reports it as `could not push … (no remote access?)`. Use the restore path of Appendix A.3, or delete the stale remote branch first (**Owner only**). Derived from the script, not reproduced.
10. **Renovate is not installed**, although `.github/workflows/README.md` says it keeps the action pins current (section 9).
11. **Bootstrap installs neither `jq` nor `gh`** (Appendix A.2; `just doctor` warns about a missing or logged-out `gh`), and it does not add new `.env.example` keys to an existing `.env` (Appendix A.7).
12. **On the Linux machine, `~/.config/ai-stylist/env.sh` does not exist**, because only `./scripts/bootstrap.sh --system` writes it. That is why doctor warns that `adb` on PATH is not the SDK's. Running the `--system` step again writes the file.
13. **On the Linux machine, the Postgres container belongs to another checkout's compose project.** `just doctor` reports it as a failure with the fix (section 11). Two empty leftovers of an earlier failed start can be removed at the same time: a network and a volume named after the checkout directory, `<directory>_default` and `<directory>_postgres-cluster`. List them with `docker network ls` and `docker volume ls`; removing them is **Owner only**.
14. **The macOS path of the age identity is fixed in the scripts and not yet confirmed on a real Mac** (Appendix A.3).
15. **A process started outside `just dev-api` and `just dev-workers` with an empty `APP_ENV` sends telemetry without an environment name.** Bootstrap now fills an empty `APP_ENV` with `local`, the two recipes pass it themselves, and doctor warns while it is empty.
16. **`planning/15-team-workflow-and-ai-agent-operations.md` §4 lists two doctor checks that do not exist**: `adb devices` and `just generate --check`.
17. **In Grafana, one leftover token from an earlier attempt should be deleted.** It sits under the ready-made policy that the OpenTelemetry tile created (its name starts with `stack-` and ends with `-otlp-write`): never used, no expiry, eight scopes. This is from the screens walked that day.
18. **Grafana marks the alerting API that the sync uses as deprecated**, with no removal date (`docs/observability/grafana/README.md`). When a sync call starts to fail after a Grafana upgrade, look there first.
19. **PostHog's free plan allows one project.** The production project planned for P03 needs the pay-as-you-go plan or a second organization.
