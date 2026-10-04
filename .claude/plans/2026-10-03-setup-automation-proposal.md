# Proposal: human-applied changes for `just secrets-push`, doctor's shared-file parity and the macOS age-identity path (setup automation, pass 1)

> Status: PARTLY APPLIED (2026-10-03). The `secrets-push` flags changed after this file was written
> (`--replace` and `--prune-values` were added; a bare `--apply` no longer overwrites a shared value
> that differs), so the wording of Parts A, B3, B4, B6, C4, C6 and E3 below is superseded. The
> corrected wording is what was applied, and for the parts not applied it is in the applying agent's
> report to the lead.
> Applied, by a docs agent in a session for which the owner authorized agents to edit the human-only
> docs: Part C (`docs/SERVICES-SETUP.md`, C1 to C6) and Part D (`docs/DEVELOPING-ON-MACOS.md`); C3
> and D say that the macOS identity path is not confirmed on a real Mac yet. Part F "Today, on the
> Linux machine" is done: the seven values are in `secrets/dev.enc.yaml` and the four stale names
> are gone.
> Not applied: Part A (`planning/15-team-workflow-and-ai-agent-operations.md` §5; until it lands,
> `just docs-check --strict` fails on DC-15), Part B (`secrets/README.md`: the path guard refused
> the edit; B2 is now "delete the paragraph"), Part E (enforcement layer) and Part F "On the Mac".
> Proposed 2026-10-03 by tooling-engineer (main checkout, base 1655729).

What the change itself contains (already in the working tree, tooling-engineer's write set):

- `scripts/security/secrets-push.sh` and the recipe `just secrets-push` (new);
- `scripts/security/secrets-lib.sh`: the library exports `SOPS_AGE_KEY_FILE` for the default keys
  file (`${XDG_CONFIG_HOME:-~/.config}/sops/age/keys.txt`) when that file exists and neither
  `SOPS_AGE_KEY` nor `SOPS_AGE_KEY_FILE` is set, plus the key-catalogue helpers;
- `scripts/security/secrets-doctor.sh`: four parity warnings in `just doctor`;
- `.env.example`: the `[machine-local]` tag on 12 keys;
- `scripts/security/tests/secrets.test.sh`: 12 new cases (`just test secrets`);
- `tools/observability/README.md` step 2 of "First run".

Until Part A lands, `just docs-check --strict` reports exactly this and nothing else:

```
ERROR DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'secrets-push' (just --summary) missing from the §5 catalog
```

## Part A: `planning/15-team-workflow-and-ai-agent-operations.md` §5 (human-only, required)

Insert one row directly after the `just secrets-sync` row (line 149 at base 1655729):

```diff
 | `just secrets-sync` | Decrypt sops dev secrets into the gitignored `.env` (§6) |
+| `just secrets-push` | `[dev] [--apply] [--prune]` or `--set KEY`: copy the values `.env` holds for the `.env.example` keys into `secrets/dev.enc.yaml` through sops, no editor. Bare = dry run (key names only); `--apply` writes and creates missing key names; `--prune` also removes names `.env.example` no longer has; `--set KEY` stores one value from a hidden prompt or stdin. Keys tagged `[machine-local]` in `.env.example` are never copied; staging/prod are refused (§6) |
 | `just secrets-edit <env>` | Edit `secrets/<env>.enc.yaml` through sops; first run creates it from the `.env.example` key list (§6) |
```

Optional, §6, the `.env.example` bullet (line 166): append

```text
 A comment line starting with `# [machine-local]` marks the key(s) below it as per-machine: `just secrets-push` never copies them into a shared file.
```

Check after applying: `just docs-check --strict` prints `docs-check: ok`.

## Part B: `secrets/README.md` (human-only: `secrets/**`)

Line numbers are at base 1655729. Run `just format` afterwards (the Commands table is
width-aligned), then `just format --check`.

### B1. Status paragraph, lines 12–16

```text
old: **Status (P02 T02): development is operational.** `.sops.yaml` contains the initial developer and
     CI public recipients for every environment, and `dev.enc.yaml` contains all `.env.example` keys
     with empty values ready to be filled as services are provisioned. The matching CI private identity
     is stored as the GitHub repository secret `SOPS_AGE_KEY`. Staging and production files stay absent
     until those environments exist.
new: **Status (P02 T02): development is operational.** `.sops.yaml` contains the initial developer and
     CI public recipients for every environment. `dev.enc.yaml` was created with every key
     `.env.example` had at that time; `just secrets-push --apply` adds the key names `.env.example`
     gained since, and `just doctor` warns while the two differ. The matching CI private identity
     is stored as the GitHub repository secret `SOPS_AGE_KEY`. Staging and production files stay absent
     until those environments exist.
```

### B2. "Pending cleanup" paragraph, lines 18–22

Delete the paragraph once the owner has run and committed step 3 of Part F (it removes the four
stale names). If the README is updated before that, replace the paragraph's last sentence:

```text
old: "mirror `.env.example` exactly" rule below. Someone who can decrypt removes each with
     `sops unset secrets/dev.enc.yaml '["<KEY>"]'`, as was done for the `EXPO_PUBLIC_*` keys.
new: "mirror `.env.example` exactly" rule below. `just doctor` lists them; someone who can decrypt
     removes them with `just secrets-push --apply --prune`.
```

### B3. "Daily workflow", lines 50–58

````text
old: To change a shared value, edit through sops and commit only the encrypted file:

     ```bash
     just secrets-edit dev
     git add secrets/dev.enc.yaml
     ```

new: To share a value, put it in your `.env`, push it, and commit only the encrypted file:

     ```bash
     just secrets-push            # dry run: lists the key names it would add, fill or replace
     just secrets-push --apply    # writes them; with --prune it also drops names .env.example no longer has
     git add secrets/dev.enc.yaml
     ```

     A value that should not pass through `.env` is typed at a hidden prompt, or piped in:
     `just secrets-push --set KEY`. `just secrets-edit dev` still opens the whole file in `$EDITOR`.
     Keys tagged `[machine-local]` in `.env.example` (for example `DATABASE_URL`) are never pushed;
     an empty `.env` value never overwrites a shared one.
````

### B4. Commands table: two new rows after the `just secrets-sync staging` / `prod` row

```text
| `just secrets-push [--apply] [--prune]` | `scripts/security/secrets-push.sh` | Copies the values `.env` holds for the `.env.example` keys into `secrets/dev.enc.yaml` through `sops set`: adds a missing key name, fills an empty shared value, replaces a different one. Without `--apply` it is a dry run that lists key names and writes nothing; `--prune` also removes names `.env.example` no longer declares. Never pushes a `[machine-local]` key or an empty `.env` value. `dev` only: `staging` and `prod` are refused |
| `just secrets-push --set KEY`           | same                               | Stores one value read from a hidden prompt, or from standard input when that is not a terminal                                                                                                                                                                                                                                                                                                                                              |
```

### B5. The paragraph under the table, lines 71–75

```text
old: `secrets-edit`, `secrets-sync`, and `secrets-updatekeys` check that `sops` and `age` are on PATH
     (mise), that `.sops.yaml` lists at least one `age1...` recipient for the environment, and (for
     anything that decrypts) that a private key is reachable via `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, or
     `~/.config/sops/age/keys.txt`. They print key names and counts only, never values. `.env` is written
     with mode 600; if it does not exist it is first created from `.env.example`.
new: `secrets-edit`, `secrets-sync`, `secrets-push`, and `secrets-updatekeys` check that `sops` and
     `age` are on PATH (mise), that `.sops.yaml` lists at least one `age1...` recipient for the
     environment, and (for anything that decrypts) that a private key is reachable via `SOPS_AGE_KEY`,
     `SOPS_AGE_KEY_FILE`, or `~/.config/sops/age/keys.txt` (`$XDG_CONFIG_HOME/sops/age/keys.txt` when
     that variable is set). That file is the default on Linux and macOS alike: on macOS sops alone
     would look in `~/Library/Application Support/sops/age/keys.txt`, so the scripts export
     `SOPS_AGE_KEY_FILE` for it. A bare `sops` command on a Mac needs the same variable. They print
     key names and counts only, never values. `.env` is written with mode 600; if it does not exist it
     is first created from `.env.example`.
```

### B6. "Rules", lines 81–82

```text
old: - Keys in these files mirror `.env.example` exactly (that is what `secrets-edit` seeds); an empty
       value means "no shared value, keep whatever the developer has locally".
new: - Keys in these files mirror `.env.example` exactly (`secrets-edit` seeds them when it creates a
       file, `secrets-push --apply` adds later ones and `--prune` removes dropped ones; `just doctor`
       warns when they differ); an empty value means "no shared value, keep whatever the developer
       has locally".
```

## Part C: `docs/SERVICES-SETUP.md` §2 and "When something goes wrong" (human-only)

Line numbers are at base 1655729.

### C1. Line 93

```text
old: `secrets/dev.enc.yaml` contains every `.env.example` key with an empty value ready to be filled as services are provisioned,
new: `secrets/dev.enc.yaml` holds the shared dev values (`just secrets-push --apply` keeps its key names in step with `.env.example`, and `just doctor` warns when they differ),
```

### C2. Line 97

```text
old: the two recipes below run them through `scripts/security/secrets-edit.sh` and `scripts/security/secrets-sync.sh`.
new: the recipes below run them through `scripts/security/secrets-edit.sh`, `scripts/security/secrets-sync.sh` and `scripts/security/secrets-push.sh`.
```

### C3. Line 103, the identity path (apply after the Mac check in Part F passes)

```text
old: else `SOPS_AGE_KEY_FILE`, else the default sops looks in on Linux: `$XDG_CONFIG_HOME/sops/age/keys.txt`, falling back to `~/.config/sops/age/keys.txt`, Checked 2026-09-10 at <https://getsops.io/docs/usage/identities/age/>; that order — `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, the default file — is the precedence)
new: else `SOPS_AGE_KEY_FILE`, else the default keys file `$XDG_CONFIG_HOME/sops/age/keys.txt`, falling back to `~/.config/sops/age/keys.txt`, on Linux and macOS alike. That is where sops itself looks on Linux; on macOS sops alone would look in `~/Library/Application Support/sops/age/keys.txt`, so `scripts/security/secrets-lib.sh` exports `SOPS_AGE_KEY_FILE` for the path above in every recipe. Checked 2026-09-10 at <https://getsops.io/docs/usage/identities/age/>; that order — `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, the default file — is the precedence)
```

### C4. Step 8, line 155

```text
old: 8. Edit values later with `just secrets-edit` (or `just secrets-edit staging`); commit the encrypted file through a pull request like any other change, then everyone runs `just secrets-sync` again.
new: 8. Add or change shared dev values later without an editor: put them in `.env`, run `just secrets-push` (a dry run that lists the key names it would add, fill or replace), then `just secrets-push --apply`. It also creates the key names `.env.example` gained since the file was created, and with `--prune` removes the names it dropped. `just secrets-push --set KEY` reads one value from a hidden prompt instead of `.env`. Keys tagged `[machine-local]` in `.env.example` (`DATABASE_URL`, `POSTGRES_HOST_PORT` and the other per-machine settings) are never pushed. `just secrets-edit` (or `just secrets-edit staging`) still opens a file in `$EDITOR` and is the only way to change `staging` or `prod`. Commit the encrypted file through a pull request like any other change, then everyone runs `just secrets-sync` again.
```

### C5. "Do not", line 172

```text
old: - Do not put values into `secrets/*.enc.yaml` that are not keys in `.env.example`; the file must mirror it (`secrets/README.md`). `secrets-edit` seeds exactly that key list.
new: - Do not put values into `secrets/*.enc.yaml` that are not keys in `.env.example`; the file must mirror it (`secrets/README.md`). `just doctor` warns when it does not and names the command that fixes it.
```

### C6. "When something goes wrong", item 2 (line 650) and one new item

```text
old: or your private key is not at `~/.config/sops/age/keys.txt`. Ask a developer who can decrypt to add your key to `.sops.yaml` and run `just secrets-updatekeys`. Check `SOPS_AGE_KEY_FILE` if you keep the key elsewhere.
new: or your private key is not at `~/.config/sops/age/keys.txt` (the same path on macOS: the recipes point sops at it, a bare `sops` command there needs `SOPS_AGE_KEY_FILE` set to it). Ask a developer who can decrypt to add your key to `.sops.yaml` and run `just secrets-updatekeys`. Check `SOPS_AGE_KEY_FILE` if you keep the key elsewhere.
```

New item after item 3:

```text
4. `just doctor` warns that values exist only on this machine, or that `secrets/dev.enc.yaml` lacks or has stale key names. Run `just secrets-push` to read the plan, then `just secrets-push --apply` (add `--prune` for the stale names) and commit `secrets/dev.enc.yaml`. A warning that shared values are not in `.env` yet means `just secrets-sync`.
```

(renumber the two items that follow).

### Interplay with `.claude/plans/2026-10-03-services-setup-observability-proposal.md` (OPEN)

That proposal was written before `just secrets-push` existed. If it is applied, these sentences in
it are superseded by this change:

- its §2 step 8 addition ("`secrets-edit` writes the key names only when it first creates the
  file …"): use C4 above instead;
- "(type the line if the file does not have it, section 2 step 8)" in its §10 steps for
  `POSTHOG_SYNC_API_KEY` and `POSTHOG_CLI_API_KEY`, and "type the line for any key the file does not
  have, section 2 step 8" in its §11 step for the Grafana keys: replace each with "(put it in `.env`,
  then `just secrets-push --apply`, section 2 step 8)";
- its Part E entry for `tools/observability/README.md` line 41: that line is already rewritten in
  this change (the `old:` text no longer exists);
- its Part E entries for `secrets/README.md` lines 13–14 and `docs/SERVICES-SETUP.md` line 93: use B1
  and C1 above instead.

Its three `.env.example` comment corrections (lines 50, 68 and 74 at base) are not applied here:
they wait for that proposal's Part F answers.

## Part D: `docs/DEVELOPING-ON-MACOS.md` (human-only; apply after the Mac check in Part F passes)

Add one bullet to "What differs from Linux", after the `Bash users:` bullet:

```text
- The age identity for sops lives at `~/.config/sops/age/keys.txt`, the same path as on Linux. sops's own default on macOS is `~/Library/Application Support/sops/age/keys.txt`, so `scripts/security/secrets-lib.sh` exports `SOPS_AGE_KEY_FILE` for the `just secrets-*` recipes, `just bootstrap` and `just doctor`. A bare `sops` command in a terminal needs `export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"` first.
```

## Part E: enforcement layer (`.claude/**`, `.agents/**`, `scripts/hooks/**`: main session with the human)

### E1. `.claude/rules/human-only.md`, invariant 3 (lines 39–40)

```text
old: 3. `secrets/**` and `.sops.yaml` change only through the secrets recipes a human runs (`just secrets-edit`,
        `just secrets-updatekeys`, `just secrets-approve`) — the path guard denies direct edits.
new: 3. `secrets/**` and `.sops.yaml` change only through the secrets recipes a human runs (`just secrets-edit`,
        `just secrets-push --apply`, `just secrets-push --set`, `just secrets-updatekeys`,
        `just secrets-approve`) — the path guard denies direct edits.
```

### E2. `.agents/skills/tooling-ci/SKILL.md`

Lines 22–23:

```text
old: - A new or renamed key in `.env.example`, or how to use the `just secrets-*` recipes. Human-only:
       `just secrets-approve`, editing or syncing staging/prod secrets, and key rotation.
new: - A new or renamed key in `.env.example`, or how to use the `just secrets-*` recipes. Human-only:
       `just secrets-approve`, `just secrets-push` with `--apply` or `--set`, editing or syncing
       staging/prod secrets, and key rotation.
```

Lines 87–89 (Workflow step 9):

```text
old: 9. Env keys: add the key to `.env.example` with an empty value and a comment; secret values live
        only in `secrets/*.enc.yaml` via `just secrets-edit dev` (a human for staging/prod). Engineers
        report the exact key line; only this skill edits `.env.example`.
new: 9. Env keys: add the key to `.env.example` with an empty value and a comment; a key every machine
        keeps for itself also gets a `# [machine-local]` comment line directly above it. Secret values
        live only in `secrets/*.enc.yaml`: a human copies them from `.env` with
        `just secrets-push --apply` (dev) or edits them with `just secrets-edit <env>` (the only way
        for staging/prod). After a new key, `just doctor` warns until that has run. Engineers report
        the exact key line; only this skill edits `.env.example`.
```

Both files carry a review date (`metadata.last-reviewed`); bump it with the edit (DC-05).

### E3. Optional: deny `--apply` and `--set` for agents in the Bash guard

Not needed for the recipe to work. It closes the gap that an agent in the main session could run
`just secrets-push --apply`: today the guard only knows `just secrets-sync staging|prod`. The dry
run stays allowed (it prints key names only, like `just doctor`). **Not run:** agents cannot
execute or edit hooks, so this regex is untested; `just docs-check --fixtures` replays the two
fixtures below and is the proof.

`scripts/hooks/guard-bash.sh`, after the `secrets-sync` branch (line 56):

```diff
 elif [[ "$command" =~ just[[:space:]]+secrets-sync[[:space:]]+(staging|prod)([[:space:]]|$) ]]; then
   deny "Syncing secrets to staging/prod is a cloud/infra mutation prohibited without explicit human authorization (CLAUDE.md)."
+elif [[ "$command" =~ just[[:space:]]+secrets-push${words}(--apply|--set)([[:space:]]|$) ]]; then
+  deny "Writing secrets/dev.enc.yaml is a step a human runs (.claude/rules/human-only.md invariant 3). Run 'just secrets-push' without --apply for the plan (key names only), then ask the human to run it."
```

`.claude/settings.json`, `permissions.deny`, after the two `secrets-sync` lines:

```diff
       "Bash(just secrets-sync prod*)",
+      "Bash(just secrets-push * --apply*)",
+      "Bash(just secrets-push --apply*)",
+      "Bash(just secrets-push * --set*)",
+      "Bash(just secrets-push --set*)",
```

New `tools/docs/fixtures/hooks/bash-secrets-push-apply.json`:

```json
{
  "session_id": "fixture-session",
  "transcript_path": "/tmp/fixture-transcript.jsonl",
  "cwd": "/home/arthur/Projects/app",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "just secrets-push dev --prune --apply",
    "description": "fixture"
  }
}
```

New `tools/docs/fixtures/hooks/bash-secrets-push-dry-run.json`: the same payload with
`"command": "just secrets-push dev --prune"`.

Two rows for `tools/docs/fixtures/hooks/README.md`, after `bash-gh-secret-set.json`:

```text
| `bash-secrets-push-apply.json`         | `guard-bash.sh`            | deny     | `just secrets-push --apply` writes `secrets/dev.enc.yaml` (human-run)                  |
| `bash-secrets-push-dry-run.json`       | `guard-bash.sh`            | allow    | the dry run prints key names only                                                      |
```

The fixtures and rows must land in the same commit as the hook change
(`.claude/rules/tooling-ci.md` invariant 4): added alone, the deny row fails
`just docs-check --fixtures`.

### E4. Optional: `.envrc` (human-only), so a bare `sops` works on the Mac

```diff
 dotenv_if_exists .env
+# sops's own default keys file differs on macOS; point a bare `sops` at the file the recipes use
+# (same rule as secrets_pin_identity_file in scripts/security/secrets-lib.sh: only when it exists).
+_age_keys="${XDG_CONFIG_HOME:-$HOME/.config}/sops/age/keys.txt"
+if [ -z "${SOPS_AGE_KEY_FILE:-}" ] && [ -f "$_age_keys" ]; then export SOPS_AGE_KEY_FILE="$_age_keys"; fi
+unset _age_keys
```

Only for interactive use of `sops`; every recipe already does this itself. Not run (no agent may
edit `.envrc`).

## Part F: what the owner runs

### Today, on the Linux machine (it holds the seven values)

```bash
just secrets-push                    # 1. dry run: names only, nothing written
```

Expected plan, if `.env` is as described on 2026-10-03:

- `add` (5): `GRAFANA_SERVICE_ACCOUNT_TOKEN`, `GRAFANA_ALERT_EMAILS`, `GRAFANA_ONCALL_TIMEZONE`,
  `POSTHOG_CLI_API_KEY`, `POSTHOG_SYNC_API_KEY`;
- `fill` (2): `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`;
- `stale` (4): `NEON_API_KEY`, `NEON_PROJECT_ID`, `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY`;
- one `held back` line naming the `[machine-local]` keys `.env` has a value for (`DATABASE_URL` at
  least).

Stop and read before step 2 if it lists anything else: a `replace` line means `.env` and the shared
file hold different values for a key that already had one (`.env` would win), and any other `add` or
`fill` line is a value this machine has that was not expected to be shared. To keep such a key out
for good, add a `# [machine-local]` comment line directly above it in `.env.example`.

```bash
just secrets-push --apply --prune    # 2. writes the 7 values, creates the 5 names, removes the 4 stale names
just secrets-push                    # 3. must end with "nothing to write"
just doctor                          # 4. no "lacks key(s)", "stale key name(s)" or "only on this machine" warning is left
git diff --stat secrets/dev.enc.yaml # 5. one file; the diff shows key names and sops metadata, never a value
git add secrets/dev.enc.yaml         #    then commit it and get it to the Mac (push, pull request, merge)
```

### On the Mac, after pulling that commit (this also confirms the identity-path fix)

```bash
just doctor          # expect ✔ "age identity present (~/.config/sops/age/keys.txt, mode 600)"
                     #    and ✔ "secrets/dev.enc.yaml decrypts with your identity"
just secrets-sync    # the seven values arrive in .env
just doctor          # no "shared value(s) not in .env yet" warning is left
just test secrets    # 36 cases, all PASS; "real sops: an identity at the default path decrypts
                     # with HOME as the only hint" is the macOS proof with synthetic data
```

To see the sops behaviour the fix works around (optional, prints nothing secret):

```bash
ls -l ~/.config/sops/age/keys.txt "$HOME/Library/Application Support/sops/age/keys.txt"
env -u SOPS_AGE_KEY_FILE -u XDG_CONFIG_HOME mise exec -- sops --decrypt --output-type dotenv secrets/dev.enc.yaml >/dev/null \
  && echo "bare sops finds the key" || echo "bare sops does not find the key (expected on macOS without the export)"
```

If the first `just doctor` says `your age recipient is not listed in the dev rule of .sops.yaml`,
the Mac has its own identity that was never approved (the stale `onboard/arthur-minasyan` branch).
Either copy the Linux identity file from the password manager to `~/.config/sops/age/keys.txt`
(mode 600), or approve the Mac's recipient from Linux; that is outside this change.
