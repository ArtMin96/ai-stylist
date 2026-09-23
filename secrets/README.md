# secrets/

sops + age encrypted configuration, one file per environment (planning/15 §6; step-by-step setup in
`docs/SERVICES-SETUP.md` §2):

| File               | Consumed by                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `dev.enc.yaml`     | `just secrets-sync` → merged into the gitignored `.env` on developer machines                     |
| `staging.enc.yaml` | CI deploy jobs (`CI=true just secrets-sync staging`, decrypted with the `SOPS_AGE_KEY` CI secret) |
| `prod.enc.yaml`    | CI deploy jobs; source of truth that a sync script pushes to Coolify environment variables (P03)  |

**Status (P02 T02): development is operational.** `.sops.yaml` contains the initial developer and
CI public recipients for every environment, and `dev.enc.yaml` contains all `.env.example` keys
with empty values ready to be filled as services are provisioned. The matching CI private identity
is stored as the GitHub repository secret `SOPS_AGE_KEY`. Staging and production files stay absent
until those environments exist.

**Pending cleanup (checked 2026-09-24):** `dev.enc.yaml` still carries four empty keys that left
`.env.example` when Neon and Trigger.dev were removed (ADR-0003): `NEON_API_KEY`, `NEON_PROJECT_ID`,
`TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`. `secrets-sync` skips them (empty), but they break the
"mirror `.env.example` exactly" rule below. Someone who can decrypt removes each with
`sops unset secrets/dev.enc.yaml '["<KEY>"]'`, as was done for the `EXPO_PUBLIC_*` keys.

## Mental model

- **sops** encrypts each value but leaves the YAML key names readable. A pull request can therefore
  show which configuration changed without exposing its value.
- An **age identity** is the private `AGE-SECRET-KEY-1...` material that decrypts files. It belongs to
  exactly one developer or to CI and must never enter Git, chat, logs, or screenshots.
- An **age recipient** is the matching public `age1...` value. It is safe to commit in `.sops.yaml`.
  Each environment rule lists everyone allowed to decrypt that environment.
- Each encrypted file has its own data key. sops encrypts the values with that data key, then wraps
  the data key once for every listed recipient. `just secrets-updatekeys` (`sops updatekeys`) re-wraps
  it when access changes; it does not expose or manually re-encrypt the configuration values.
- CI has a separate identity whose private material is the GitHub repository secret
  `SOPS_AGE_KEY`. No pull-request workflow receives it; deployment workflows will use it when they
  are introduced in P03.

The encrypted `*.enc.yaml` files are the shared source of truth. `.env` is a developer-local,
gitignored result that may also contain personal overrides.

## Daily workflow

After pulling changes, merge the latest shared development values into your local `.env`:

```bash
just secrets-sync
```

To change a shared value, edit through sops and commit only the encrypted file:

```bash
just secrets-edit dev
git add secrets/dev.enc.yaml
```

Review the diff for changed key names and sops metadata, open a pull request, and tell teammates to
run `just secrets-sync` after it merges. Do not edit ciphertext directly and do not commit `.env`.

## Commands

| Recipe                               | Script                                    | What it does                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `just secrets-edit dev`              | `scripts/security/secrets-edit.sh`        | Opens `secrets/<env>.enc.yaml` in `$EDITOR` through `sops`; on the first run creates it with every `.env.example` key and an empty value, encrypted for the `<env>` recipients in `.sops.yaml`                                                                                                              |
| `just secrets-sync` (default `dev`)  | `scripts/security/secrets-sync.sh`        | Decrypts `secrets/<env>.enc.yaml` and **merges** it into `.env`: each key with a non-empty value replaces its `KEY=` line or is appended; empty values and every other line (personal overrides, comments) are left alone                                                                                   |
| `just secrets-sync staging` / `prod` | same                                      | Refuses on a workstation unless `CI=true` or `--i-know-this-is-not-dev` is passed (no prod credentials on workstations, planning/15 §6)                                                                                                                                                                     |
| `just secrets-updatekeys [env ...]`  | `scripts/security/secrets-updatekeys.sh`  | Re-wraps every (or the named) `secrets/<env>.enc.yaml` for the current recipient list in `.sops.yaml` via `sops updatekeys -y`; needs an identity that can decrypt today; values are never written to disk or printed                                                                                       |
| `just secrets-approve <branch>`      | `scripts/security/secrets-approve.sh`     | Reviews a developer's onboarding branch: refuses (no file written, no `sops` invoked) unless it only adds `# developer:` comments and bare `age1...` recipients to `.sops.yaml`; otherwise re-wraps every `secrets/*.enc.yaml` for the new recipient list, commits, pushes, and prints the pull-request URL |
| `just secrets-backup-done`           | `scripts/security/secrets-backup-done.sh` | Records today's date in `<identity path>.backed-up` (mode 600) so `just doctor` stops warning that your identity is not backed up                                                                                                                                                                           |

`secrets-edit`, `secrets-sync`, and `secrets-updatekeys` check that `sops` and `age` are on PATH
(mise), that `.sops.yaml` lists at least one `age1...` recipient for the environment, and (for
anything that decrypts) that a private key is reachable via `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, or
`~/.config/sops/age/keys.txt`. They print key names and counts only, never values. `.env` is written
with mode 600; if it does not exist it is first created from `.env.example`.

## Rules

- Only `*.enc.yaml` is committed. `*.dec.*` and `.env` are gitignored; `.gitleaks.toml` blocks age
  private keys and allowlists the encrypted files.
- Keys in these files mirror `.env.example` exactly (that is what `secrets-edit` seeds); an empty
  value means "no shared value, keep whatever the developer has locally".
- Never paste a decrypted value into a terminal shared with an AI agent, a log, or a screenshot; if
  it happens, rotate same-day (planning/11).
- GitHub Actions secrets hold only: the CI age private key (`SOPS_AGE_KEY`), store signing
  credentials, deploy and build tokens (e.g. the optional `TURBO_TOKEN`/`TURBO_TEAM`); the names
  are listed in `.github/workflows/README.md`.

## Onboarding a developer

**Developer side:**

```bash
just bootstrap
```

If you have no age identity yet, this generates one at the resolved path (mode 600, directory mode
700; the private key is never printed), adds a `# developer: <label>` comment and your recipient
under `# ADD RECIPIENTS` for `dev` in `.sops.yaml` on a new `onboard/<slug>` branch, pushes it, and
prints a compare URL — open that as your pull request. Running it again once your identity exists
and is already listed (for example, restored from the password manager) creates no branch; it runs
`just secrets-sync` for you, and bootstrap's closing summary says the shared values were synced. If the push fails (no remote access yet), bootstrap still exits 0
and prints the exact `git push -u origin onboard/<slug>` command to run later; the branch and commit
already exist locally. In CI, or with `SOPS_AGE_KEY` already set, this step is skipped entirely.

Back the identity up in the team password manager, then run `just secrets-backup-done` so
`just doctor` stops warning.

**Approver side**, once the pull request is open:

```bash
just secrets-approve onboard/<slug>
```

This refuses — no file written, no `sops` invoked — unless the branch changes only `.sops.yaml` and
only adds `# developer:` comments and bare `age1...` recipient lines. Otherwise it re-wraps every
`secrets/*.enc.yaml` for the new recipient list, commits, pushes, and prints the pull-request URL
again. Merge it.

**Developer side, after merge:**

```bash
just secrets-sync            # or re-run `just bootstrap`
```

Only the `dev` rule is automated this way. A deployer who needs `staging` or `prod` access still
adds their own recipient under that rule by hand and asks a teammate who can already decrypt to run
`just secrets-updatekeys`.

**Manual fallback**, only when `just bootstrap` cannot reach the remote at all:

```bash
mkdir -p ~/.config/sops/age && age-keygen -o ~/.config/sops/age/keys.txt   # note the printed public key
# add the public key under `# ADD RECIPIENTS` for dev (and staging/prod if you are a deployer) in .sops.yaml,
# then someone who already holds a key re-wraps the files for the new recipient list:
just secrets-updatekeys
just secrets-sync                                                          # merges dev values into .env
```

The new developer sends only the printed `age1...` recipient. A teammate who can already decrypt
the files must add that recipient and run `just secrets-updatekeys`; possession of a public recipient alone
does not grant access to existing ciphertext.

## Losing or rotating an identity

- **Lost but not exposed:** generate a replacement identity, have an authorized teammate add its
  recipient and run `just secrets-updatekeys`, then remove the lost recipient. If no authorized identity or
  backup remains, the encrypted values cannot be recovered.
- **Possibly exposed:** remove the recipient, run `just secrets-updatekeys`, and
  rotate the underlying service credentials immediately. Re-wrapping blocks future files but does
  not revoke ciphertext already copied from Git history.
- **Routine access removal:** remove the recipient from every environment it can access, run
  `just secrets-updatekeys`, and commit `.sops.yaml` together with the re-wrapped files.

Every developer must back up their identity outside the repository in the team's approved password
manager. CI recovery means replacing the `SOPS_AGE_KEY` repository secret with a newly generated CI
identity and re-wrapping all environment files for its new public recipient.

## Creating the file for a new environment

`dev.enc.yaml` exists. When staging and production arrive (P03), a deployer whose recipient is
listed under that environment's rule in `.sops.yaml` creates its file the same way `dev` was created:

```bash
just secrets-edit staging    # creates secrets/staging.enc.yaml from .env.example, opens it in $EDITOR
```

Only CI syncs it (`CI=true just secrets-sync staging`); workstations refuse.
