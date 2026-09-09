# secrets/

sops + age encrypted configuration, one file per environment (planning/15 §6):

| File               | Consumed by                                                                    |
| ------------------ | ------------------------------------------------------------------------------ |
| `dev.enc.yaml`     | `just secrets-sync` → gitignored `.env` on developer machines                  |
| `staging.enc.yaml` | CI deploy jobs (decrypted with the CI age key)                                 |
| `prod.enc.yaml`    | CI deploy jobs; source of truth that a sync script pushes to Railway variables |

**Status (P02 T01): no encrypted files exist yet.** No age keys have been generated;
`.sops.yaml` holds placeholder recipients.

## Rules

- Only `*.enc.yaml` is committed. `*.dec.*` and `.env` are gitignored.
- Keys in these files mirror `.env.example` exactly; `.env.example` is the exhaustive, zero-value catalogue.
- Never paste a decrypted value into a terminal shared with an AI agent, a log, or a screenshot; if it happens, rotate same-day (planning/11).
- GitHub Actions secrets hold only: the CI age private key, store signing credentials, deploy tokens.

## Onboarding a developer

```bash
age-keygen -o ~/.config/sops/age/keys.txt      # note the printed public key
# add the public key to every rule in .sops.yaml, then re-encrypt:
for f in secrets/*.enc.yaml; do sops updatekeys "$f"; done
just secrets-sync                              # writes .env
```

## Creating the first file (once keys exist)

```bash
sops --encrypt --input-type yaml --output-type yaml /dev/stdin > secrets/dev.enc.yaml <<'YAML'
DATABASE_URL: postgres://...
YAML
```
