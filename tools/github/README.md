# tools/github: `just repo-setup`

The GitHub side of this repository as commands, for the day the code moves to another repository or
account. Three things that used to be manual steps are now data files plus one recipe:

- **name**: the repository's own `<owner>/<repo>` in tracked files (clone commands, runbook links).
- **secrets**: the GitHub Actions secrets and variables, set from `secrets/dev.enc.yaml`.
- **settings**: Actions permissions, protection of `main`, secret scanning, Dependabot security
  updates, labels.

The step-by-step guide that uses them is [docs/NEW-REPO-SETUP.md](../../docs/NEW-REPO-SETUP.md).
This file covers what each command does, what it guarantees and how to change the data.

## Usage

```bash
just repo-setup                      # three read-only checks, in order, then the apply commands that are needed
just repo-setup name                 # report: tracked lines that still name the old repository
just repo-setup name --apply         # rewrite them to the repository origin points at
just repo-setup secrets              # report: names GitHub has against names the manifest asks for
just repo-setup secrets --apply      # send the missing ones from secrets/dev.enc.yaml
just repo-setup settings             # report: live repository settings against repo-settings.json
just repo-setup settings --apply     # send the calls that close the difference
```

Rules that hold for all three:

- The repository is always the one `origin` points at. There is no flag to name another one.
- Nothing changes without `--apply`. Every `--apply` can be run twice: the second run changes
  nothing.
- `--apply` is owner-run. It refuses inside an AI agent session (Claude Code exports `CLAUDECODE`
  in every shell it starts). The reports stay open to agents. That refusal is a seatbelt; the deny
  rule for agents belongs in `scripts/hooks/guard-bash.sh`, which a human applies.
- `secrets` and `settings` need the GitHub CLI, logged in as an account with admin rights on the
  repository. `gh` is not pinned in `mise.toml`; any version from 2.43 works. When it is missing or
  logged out, the command prints the fix (`mise use --global gh@latest`, `gh auth login`).
- Exit codes: 0 nothing to do, 1 something to do (or refused, or failed), 2 wrong usage. `name`
  also exits 3 when it cannot tell.

`just doctor` runs the `name` report (it is offline) and shows a mismatch as a warning with the
command. It also checks, offline, that `gh` is installed and has a login. It does not run the
`secrets` and `settings` reports, which need the network; it names `just repo-setup` instead.

## A brand-new repository, in order

After the repository exists and `origin` points at it (docs/NEW-REPO-SETUP.md sections 1 to 3):

```bash
just repo-setup                      # read what is missing
just repo-setup name --apply         # then commit the rewritten files
just repo-setup secrets --apply
just repo-setup settings --apply
just repo-setup                      # must end with "nothing to do"
```

Two secrets are never sent by `secrets --apply` and stay yours to set by hand: the CI age identity
`SOPS_AGE_KEY` (a private key made for one repository) and the CI-only metrics token
`OTEL_EXPORTER_OTLP_HEADERS`. Until `SOPS_AGE_KEY` exists the `secrets` report exits 1 and says so.

## name: `scripts/repo-name.sh`

Tracked files link to many third-party GitHub repositories, so "any `github.com/<owner>/<repo>`
that is not origin" would be the wrong rule. The names it looks for are:

- the one tracked files use today: the `<owner>/<repo>` in `RUNBOOK_URL_PREFIX` of
  `tools/observability/check.mjs`. `just observability-sync all --check` rejects an alert whose
  runbook link does not start with that prefix, so that line cannot drift from the alert files;
- the remote `old-origin`, when it exists;
- every `--from <owner>/<repo>` you pass, for a name an earlier, partial edit left behind.

A line matches when one of those names follows `github.com/`, `github.com:` or
`githubusercontent.com/` and ends there. `.git`, a `/`, punctuation or the end of the line may
follow; a longer name such as `<repo>-android` is a different repository and is left alone. Letter
case is ignored, as GitHub ignores it. When the repository's name changed, and not only its owner,
the `cd <old name>` of a clone command is rewritten too: on the `git clone` line and on the line
directly below it. Product names (the npm scope, bundle ids, host names, the compose project) are
never touched.

Left alone on purpose: the paths in [`name-keep.txt`](name-keep.txt), one per line with its reason.
Today these are `planning/PROGRESS.md`, `.claude/plans/` and `planning/research/`: history that must
keep pointing at where a pull request or a workflow run really lives. The report names each kept
path that still holds the old name and counts its lines. To keep another path, add a line there.

`--apply` rewrites human-only documents among the files it finds (`README.md`,
`docs/SERVICES-SETUP.md`, `docs/DEVELOPING-ON-MACOS.md`), which is one reason it is owner-run. After
it, run `just observability-sync all --check`, `just test tooling` and `just format --check`, commit
the change, and run `just observability-sync` once so the runbook links stored in Grafana follow.

## secrets: `scripts/security/github-secrets.sh` and `actions-secrets.txt`

[`actions-secrets.txt`](actions-secrets.txt) is the manifest. One entry per line:

```text
secret    NAME  dev:KEY|manual  required|optional  [after=NAME] [unread]
variable  NAME  dev:KEY|manual  required|optional  [after=NAME] [unread]
automatic NAME          GitHub Actions provides it itself
never     NAME          must never exist on GitHub as a secret or a variable
never-from-dev KEY      the value secrets/dev.enc.yaml holds for KEY is never sent
```

- `dev:KEY` takes the value of `KEY` from `secrets/dev.enc.yaml`. `manual` is a value this command
  never sends; the comment above the entry says where it comes from.
- `after=NAME` holds an entry back until `NAME` exists on GitHub (the OTLP endpoint is useless, and
  warns on every push to `main`, without its token).
- `unread` marks a name no workflow reads yet.

The report compares names only: `gh secret list` and `gh variable list` against the manifest. It
decrypts nothing. Drift (exit 1) is a missing name the manifest asks for, or a `never` name that
exists on GitHub. `--apply` sends each missing `dev:KEY` name whose key holds a value. A name GitHub
already has is left alone, because a secret cannot be read back and compared; `--apply --replace`
sends every `dev:KEY` name again, which is what you run after rotating a credential. Nothing is
ever deleted: a forbidden name is reported with the `gh` command that removes it.

Where a value travels: from the standard output of `sops --decrypt --extract` into the standard
input of `gh secret set` or `gh variable set`, through one pipe. It is never a command argument,
never in a shell variable or the environment, never printed and never in a file. The output of
`sops` and `gh` is discarded on every send, because `sops` can format a value into an error; a
failed send prints the commands that show what is wrong instead.

The offline check runs before every report (and alone with `--offline`). It fails when:

- a workflow or composite action reads a `secrets.NAME` or `vars.NAME` that has no entry, or one
  on the `never` list;
- an entry's `dev:KEY` is on the `never` or `never-from-dev` list, is not a key of `.env.example`,
  or is tagged `[machine-local]` there;
- an entry is read by no workflow and is not flagged `unread`, or is flagged and is read.

So a workflow change that needs a new secret fails `just test tooling` until the manifest has it.

## settings: `repo-settings.mjs` and `repo-settings.json`

[`repo-settings.json`](repo-settings.json) is the declared state, mostly in the shape of the GitHub
REST API so that a section can be sent as it is:

- `branch` and `required_checks_workflow`: the protected branch, and the workflow whose job names
  are the required checks.
- `actions_permissions`, `actions_workflow_permissions`: sent with `PUT` to
  `repos/<owner>/<repo>/actions/permissions` and `.../actions/permissions/workflow`.
- `branch_protection`: sent with `PUT` to `repos/<owner>/<repo>/branches/<branch>/protection`
  (classic branch protection).
- `repository`: sent with `PATCH` to `repos/<owner>/<repo>`, one call per setting.
  `security_and_analysis` holds secret scanning, push protection and Dependabot security updates
  (`dependabot_security_updates`: Dependabot opens a pull request only for a dependency with a
  known vulnerability; Renovate, `renovate.json`, keeps every other version update, so there is no
  `.github/dependabot.yml`). Any other repository field can be added here without a code change.
- `labels`: created with `POST` when missing. An existing label is never changed or removed.

The report reads the live repository with `GET` calls and prints one line per setting: `ok`,
`change`, `create`, `unavailable`, `manual` or `failed`. A comparison looks only at the keys the
file declares, because GitHub adds keys of its own. `--apply` sends one call per difference, with
the body on standard input.

`unavailable` means GitHub does not offer the setting for this repository. A private repository
under a personal account on the free plan has neither protected branches nor secret scanning: the
protection call is answered with HTTP 403 and "Upgrade to GitHub Pro or make this repository public
to enable this feature.", and the repository carries no `security_and_analysis` entry for the
feature. Such a line quotes GitHub's answer, is never sent, and is not counted as a difference, so
the command can end with exit 0 on such a repository.

The offline check runs before every report (and alone with `--offline`). It fails when a required
check is not the `name:` of a job in `.github/workflows/pr-gate.yml`, when a job of that workflow is
not a required check, or when `renovate.json` uses a label that `labels` does not declare. Renaming
a job therefore fails `just test tooling` instead of leaving a required check that never reports.

Two values in the file are decisions for one person working alone, and are yours to change:
`required_approving_review_count` is 0 (a pull request is required, an approval is not, because
nobody can approve their own pull request), and `enforce_admins` is true (the merge button stays
disabled for the owner as well until the checks pass). `require_code_owner_reviews` stays false
while `CODEOWNERS` holds placeholder handles.

Not managed: rulesets (the report only says when one exists), auto-merge, "delete branch on merge",
Dependabot alerts, environments, GitHub Apps and `CODEOWNERS`. Dependabot alerts are a separate
endpoint (`PUT repos/<owner>/<repo>/vulnerability-alerts`), and Dependabot security updates need
them switched on first: GitHub does not switch security updates on while alerts are off. Switch
the alerts on by hand under Settings → Code security before `--apply` (on this repository since
2026-10-12, DEC-82). When they are off, the security-updates line says so: `failed` with GitHub's
answer, or `unavailable` with the alerts named as a possible reason.

## Files

- `scripts/repo-setup.sh`: the entry point (subcommands, the three checks in order).
- `scripts/github-lib.sh`: origin to `<owner>/<repo>`, the `gh` checks, the owner-run guard, the
  two doctor lines.
- `scripts/repo-name.sh` with `name-keep.txt`.
- `scripts/security/github-secrets.sh` with `actions-secrets.txt`.
- `repo-settings.mjs` (the plan and the calls), `settings-file.mjs` (loading and the offline
  check), `gh.mjs` (one `gh api` call), with `repo-settings.json`.
- `tests/gh-stub.mjs`: a stand-in for `gh` that keeps its state in a JSON file.

## Tests

`just test tooling` runs `scripts/test/repo-setup.test.sh`. Every case runs in a throwaway git
checkout with a made-up origin, the stub `gh`, the real `sops` and `age` with a throwaway identity,
and synthetic values. The commands run with recording wrappers as their entire `PATH`
(`scripts/test/recording.sh`, shared with `just test secrets`), so every argument list is on record
and a value in any of them, in a file or in an environment fails the suite. The stub keeps what it
receives on standard input byte for byte.

The suite copies the committed manifest, settings file, workflows, `renovate.json` and
`.env.example` into each checkout, so both offline checks run against the real files on every run.

Not covered by any test: the real GitHub API. The calls follow GitHub's REST reference
(<https://docs.github.com/en/rest>, version `2022-11-28`); re-check them there when one starts to
fail.
