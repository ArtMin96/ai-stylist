# secrets/

sops + age encrypted configuration, one file per environment (planning/15 §6; step-by-step setup in
`docs/SERVICES-SETUP.md` §2):

| File               | Consumed by                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `dev.enc.yaml`     | `just secrets-sync` → merged into the gitignored `.env` on developer machines                     |
| `staging.enc.yaml` | CI deploy jobs (`CI=true just secrets-sync staging`, decrypted with the `SOPS_AGE_KEY` CI secret) |
| `prod.enc.yaml`    | CI deploy jobs; source of truth that a sync script pushes to Railway variables (P03)              |

**Status (P02 T02): development is operational.** `.sops.yaml` contains the initial developer and
CI public recipients for every environment, and `dev.enc.yaml` contains all `.env.example` keys
with empty values ready to be filled as services are provisioned. The matching CI private identity
is stored as the GitHub repository secret `SOPS_AGE_KEY`. Staging and production files stay absent
until those environments exist.

## Commands

| Recipe                               | Script                             | What it does                                                                                                                                                                                                              |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `just secrets-edit dev`              | `scripts/security/secrets-edit.sh` | Opens `secrets/<env>.enc.yaml` in `$EDITOR` through `sops`; on the first run creates it with every `.env.example` key and an empty value, encrypted for the `<env>` recipients in `.sops.yaml`                            |
| `just secrets-sync` (`env=dev`)      | `scripts/security/secrets-sync.sh` | Decrypts `secrets/<env>.enc.yaml` and **merges** it into `.env`: each key with a non-empty value replaces its `KEY=` line or is appended; empty values and every other line (personal overrides, comments) are left alone |
| `just secrets-sync staging` / `prod` | same                               | Refuses on a workstation unless `CI=true` or `--i-know-this-is-not-dev` is passed (no prod credentials on workstations, planning/15 §6)                                                                                   |

Both scripts check that `sops` and `age` are on PATH (mise), that `.sops.yaml` lists at least one
`age1...` recipient for the environment, and (for anything that decrypts) that a private key is
reachable via `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, or `~/.config/sops/age/keys.txt`. They print key
names and counts only, never values. `.env` is written with mode 600; if it does not exist it is
first created from `.env.example`.

## Rules

- Only `*.enc.yaml` is committed. `*.dec.*` and `.env` are gitignored; `.gitleaks.toml` blocks age
  private keys and allowlists the encrypted files.
- Keys in these files mirror `.env.example` exactly (that is what `secrets-edit` seeds); an empty
  value means "no shared value, keep whatever the developer has locally".
- Never paste a decrypted value into a terminal shared with an AI agent, a log, or a screenshot; if
  it happens, rotate same-day (planning/11).
- GitHub Actions secrets hold only: the CI age private key (`SOPS_AGE_KEY`), store signing
  credentials, deploy tokens.

## Onboarding a developer

```bash
mkdir -p ~/.config/sops/age && age-keygen -o ~/.config/sops/age/keys.txt   # note the printed public key
# add the public key under `# ADD RECIPIENTS` for dev (and staging/prod if you are a deployer) in .sops.yaml,
# then someone who already holds a key re-wraps the files for the new recipient list:
for f in secrets/*.enc.yaml; do sops updatekeys "$f"; done
just secrets-sync                                                          # merges dev values into .env
```

## Creating the first file (once at least one recipient is listed)

```bash
just secrets-edit            # creates secrets/dev.enc.yaml from .env.example, opens it in $EDITOR
just secrets-sync            # .env now carries the shared dev values
```
