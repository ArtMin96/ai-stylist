# Runbook 02: PostgreSQL incident and pgBackRest PITR restore

| Field                 | Value                                                                                                                                                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity              | SEV1 when the API is down because of the database, or data is lost or corrupted. SEV2 for backup or WAL-archive failures.                                                                                                                                                                                                   |
| Alerts that link here | `db.backup_age` (SEV2): `min by (stanza) (pgbackrest_backup_since_last_completion_seconds) > 93600` (26 h) for 15 min                                                                                                                                                                                                       |
| Responder             | role `on-call` in `packages/shared-kernel/registry/owners.json`                                                                                                                                                                                                                                                             |
| Operable today        | **No.** No staging or prod PostgreSQL, pgBackRest stanza, backup bucket or backup-age metric exists yet (P02-T07 is `PARTIAL`). The local docker-compose Postgres has no backups. This is the target procedure. The first restore drill (P02-T07 completion, `docs/SERVICES-SETUP.md` §3 step 9) proves it and corrects it. |

Setup this runbook assumes (`docs/SERVICES-SETUP.md` §3; planning/14 §13): self-managed PostgreSQL 18 +
pgvector on the owned host, pgBackRest stanza `ai-stylist` archiving WAL to the encrypted R2 bucket
`ai-stylist-pg-backups` (its own token), a 14-day PITR window, a nightly `pg_dump` to the same bucket,
and PgBouncer in front of the API. RPO: minutes (PITR) or 24 h (dump). RTO hypothesis: 4 h.

`db.backup_age` has `noDataState: OK`, because the metric does not exist until P02-T07 adds pgBackRest
and an exporter (`pgbackrest_exporter`, scraped into Grafana Cloud). Once it exists, switch the rule to
`Alerting` on no data (`docs/observability/grafana/alerts/db-backup-age.json`), so a dead exporter pages
too. A WAL-archive-lag alert (planning/14 §7) is not defined yet.

## Detection

- The `db.backup_age` email (stanza named).
- `GET /v1/health` answers 503 problem+json when the database check fails.
- Dashboard 01: 5xx spike. `platform_outbox.last_error` or logs show `PostgresError (pg …)`. In Loki:
  `{service_name=~"api|jobs"} |= "PostgresError"`.
- `host.disk` on the database host ([runbook 01](01-api-down.md)): WAL piles up when archiving fails.

## Triage

Run pgBackRest where P02-T07 installs it (in the PostgreSQL container or on the host). SQL runs over
the direct connection (not PgBouncer): `psql "$DATABASE_URL"`. Never select `pg_stat_activity.query`;
statement text can carry values.

```sh
pgbackrest --stanza=ai-stylist info    # newest backup per type, WAL range
pgbackrest --stanza=ai-stylist check   # archive_command works and the repository is reachable
df -h                                  # on the host
```

```sql
select archived_count, last_archived_time, failed_count, last_failed_time from pg_stat_archiver;
select pg_size_pretty(sum(size)) as wal_size from pg_ls_waldir();
select state, count(*) from pg_stat_activity group by state;
select pid, usename, application_name, state, wait_event_type, now() - xact_start as xact_age
from pg_stat_activity where state <> 'idle' order by xact_start nulls last limit 20;
```

| Symptom                                                           | Path                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Newest backup older than 26 h, archiver healthy                   | A                                                                |
| `failed_count` rising, WAL size growing                           | A (archiving is failing, and the disk will fill)                 |
| Connections exhausted or long `idle in transaction` sessions      | B                                                                |
| Disk nearly full                                                  | C                                                                |
| Data wrong or missing (bad migration, bad deploy, operator error) | D (PITR)                                                         |
| Host lost                                                         | D on a new host ([runbook 01](01-api-down.md), host replacement) |

## Mitigation

**A. Backups and archiving.** Take a backup now, then find why the schedule or archiving stopped.

```sh
pgbackrest --stanza=ai-stylist --type=diff backup
pgbackrest --stanza=ai-stylist info
```

Wrong or rotated R2 credentials: fix them with `just secrets-edit <env>` and re-apply the host
configuration the way P02-T07 sets it up. Never turn off `archive_mode` to free disk.

**B. Connections.** End sessions stuck in a transaction:

```sql
select pg_terminate_backend(pid) from pg_stat_activity
where state = 'idle in transaction' and now() - xact_start > interval '10 minutes';
```

**C. Disk.** WAL that cannot be archived is the usual cause, so fix A. Free host space with
[runbook 01](01-api-down.md) (images, journal). Never delete files under the data directory or `pg_wal`
by hand, and never run `docker volume prune`.

**D. Point-in-time restore.**

Two rules first. A restore never brings back deleted users (planning/11 §13.3). The API, jobs and
workers stay stopped until step 6 is done.

1. Declare SEV1 and open the incident issue. Choose the target time `T` in UTC, just before the
   damage, and record it.
2. Stop every writer: the API, jobs and workers resources in Coolify. Keep the damaged cluster: restore
   into a new data volume or container. The old cluster holds deletion requests newer than `T` (step 6).
   Restore in place (`--delta`) only when the 4 h RTO leaves no choice.
3. Restore, with PostgreSQL stopped and the target data directory empty:

   ```sh
   pgbackrest --stanza=ai-stylist info
   pgbackrest --stanza=ai-stylist --type=time --target="2026-10-01 12:34:56+00" --target-action=promote restore
   ```

4. Start PostgreSQL. `select pg_is_in_recovery();` returns `false`, and `pgbackrest info` shows a new
   timeline.
5. Bring the schema up to the deployed code: `DATABASE_URL='<direct string>' just db-migrate`.
6. **Re-deletion replay (planning/11 §13.3).** Replay deletions before anything else runs:
   1. Collect every account deletion and face-consent withdrawal requested after `T`. Take them from
      the old cluster (preferred). If it is lost, use the audit trail and logs for the window (Loki
      keeps 14 days, the same as the PITR window). Cross-check users that exist in the restored
      database but whose R2 prefix `u/<user_id>/` is already empty.
   2. Re-run the deletion cascade for each (planning/11 §13.2), including per-user job cancellation
      (`PgBossQueue.cancelUser`). The restore also rewound the `platform.cancelled-users` markers, so
      without this, jobs of deleted users would run again.
   3. Write the count (never user data) into the incident issue.

   The deletion cascade, its request records and a re-trigger tool ship with P03 (identity). Before
   P03 there are no users, so record this step as a no-op.

7. **Repeated side effects.** Outbox rows, pg-boss jobs and effect-once keys (`platform_idempotency_keys`)
   are all back at `T`. Events still `pending` at `T` run again, and effects outside the database
   (push, email, paid provider calls) can repeat. Review the rows before starting the jobs process:

   ```sql
   select type, count(*) from platform_outbox where status = 'pending' group by type;
   ```

8. Take a full backup on the new timeline: `pgbackrest --stanza=ai-stylist --type=full backup`.
9. Start the workers, the jobs process, then the API.

## Verification

- `GET /v1/health` returns `{"status":"ok","checks":{"db":"ok"}}`.
- `pgbackrest --stanza=ai-stylist info` lists the new full backup, and `db.backup_age` is not firing.
- `select max(created_at) from platform_outbox;` is not later than `T`.
- The re-deletion replay count is in the incident issue.
- Dashboard 01: 5xx back to 0, queues draining ([runbook 04](04-queue-dlq.md) if dead letters appear).

## Escalation

- SEV1: acknowledge within 30 min and page the other `on-call` member. If the restore will not finish
  within the 4 h RTO hypothesis, say so in the incident issue with a new estimate.
- Suspected data exposure: treat it as a security incident (planning/11 §16; runbook 06 ships with
  P14) and start the 72 h regulatory-clock assessment.
- Vendors: the host provider and Cloudflare R2 (contacts in `docs/SERVICES-SETUP.md`).

## Follow-up

- Incident review within 5 working days (sections in planning/14 §8). Action items go to the tracker.
- Record the restore date in the `docs/SERVICES-SETUP.md` overview table. Correct this runbook in the
  same change when real steps differed.
- Restore drill every quarter (planning/14 §13). A backup that has never been restored is not a backup.
