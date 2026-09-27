# tools/flags — the expired-flag report (`just flags-report`)

`flags-report.mjs` reads the flag registry, `packages/shared-kernel/registry/feature-flags.json`,
and prints one row per flag: key, kind, owner, `expiresAt`, days left or overdue, and a status
(planning/14 §11, NFR-OBS-080, P02-T09 AC-10). Owner display names are resolved from
`packages/shared-kernel/registry/owners.json` at run time, never copied. Node built-ins only.

- `ok` / `expires today`: not past `expiresAt` (the flag is still valid on its expiry date).
- `EXPIRED`: a `rollout` or `experiment` flag past `expiresAt`, compared as UTC dates.
- `DEFECT`: more than 30 days overdue; the owner in the row fixes it.
- `exempt`: a `kill-switch` flag, permanent by policy (runbook 10).

Exit 0 when no flag is past expiry, 1 when at least one is (`EXPIRED` or `DEFECT`), 2 for a usage
error or a malformed registry (an unknown owner id, a missing or impossible `expiresAt`), so a
broken registry never reads as "expired".

`just flags-report` judges the real registry against today's UTC date; `--today YYYY-MM-DD` pins
the date (`--registry` and `--owners` point at other files). The nightly CI job runs it: the report
is a nightly verdict, not a PR gate, because a flag expiring is not a defect of the pull request that
happens to run that day. The registry itself is tested elsewhere: its schema in
`packages/contracts/tests/kernel-registries.test.ts`, owner ids and the 90-day rollout limit in
`packages/shared-kernel/tests/feature-flags.test.ts`.

## Fixtures (`just flags-report --fixtures`)

`check-fixtures.sh` runs in `just ci-parity`. Every case is judged at a pinned date with the
synthetic `fixtures/owners.json`, so its dates never rot:

- `expired/`: exit 1, with one expected row per status: 12 days left (`ok`), 0 days left
  (`expires today`), 5 and exactly 30 days overdue (`EXPIRED`), 31 days overdue (`DEFECT`), a
  kill-switch (`exempt`).
- `unknown-owner/`: exit 2, an owner id that `owners.json` does not declare.
- `--today 2026-02-30`: exit 2, an impossible date.
- The real registry must load and resolve every owner (exit 0 or 1); its expiry verdict belongs to
  the nightly report.
