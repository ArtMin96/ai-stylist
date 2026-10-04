# Runbook 01: API down, host or Coolify incident

| Field                 | Value                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Severity              | SEV1: API hard-down for more than 5 min (planning/14 §7). SEV2: `host.disk`, or error-budget fast burn (burn rate above 14 over 1 h).                                                                                                                                                                                                                                    |
| Alerts that link here | `host.disk` (SEV2): less than 15 % free on a filesystem for 10 min (`node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.15`)                                                                                                                                                                                                                                   |
| Responder             | role `on-call` in `packages/shared-kernel/registry/owners.json`                                                                                                                                                                                                                                                                                                          |
| Operable today        | **Partly.** No staging or prod host is provisioned and no API is deployed (first deploy P03, `docs/SERVICES-SETUP.md` §4). `host.disk` has `noDataState: OK` and stays silent until a host runs node exporter plus a collector that sends to Grafana Cloud. No API-down alert exists yet: it needs a deployed API and an external probe, a follow-up for the P03 deploy. |

Hostnames: `staging-api.ai-stylist.app` and `api.ai-stylist.app` (not provisioned yet). `<host>` below
is the server from `docs/SERVICES-SETUP.md` §4.

## Detection

- Users, the other developer, or the Coolify health check report the API down.
- Dashboard 01: 5xx rate, requests per second falling to 0, availability and burn-rate panels.
- The `host.disk` email (instance and mount point named).
- From outside:

  ```sh
  curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' https://api.ai-stylist.app/v1/health
  ```

  `200` is healthy. `503` means a dependency is down, usually the database: go to
  [runbook 02](02-postgresql-incident.md). A timeout or connection error means the container, host,
  proxy or DNS.

## Triage

1. Is it only us? Check the Cloudflare and Grafana Cloud status pages.
2. Was there a deploy in the last hour? Check the API resource's deployments in Coolify. A deploy
   right before the outage goes to Mitigation A.
3. Host health, over SSH on `<host>`:

   ```sh
   uptime; free -m; df -h
   docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'
   docker system df
   ```

4. API logs in Loki: `{service_name="api"} | severity_text = "error"` for the last 15 min. An error
   line carries the error class and code only (`err.type`, `err.code`, and the same per `err.cause`),
   never a message or stack; `msg="unhandled error"` marks a 5xx. Follow the line's `trace_id` in
   Tempo for the failing span. Traces: Tempo, `{ resource.service.name = "api" && status = error }`.

## Mitigation

**A. Bad deploy.** In Coolify, open the API resource, then Deployments, and redeploy the previous
image. Run `just db-rollback` only for a migration that is safe to reverse (expand–contract,
`.agents/skills/db-migration/SKILL.md`), never by reflex. Deploy tooling (Dockerfile, deploy workflow,
Coolify sync) lands in P03. Until then there is nothing to roll back.

**B. Container crash loop or hang.** Restart the API resource in Coolify. If it keeps crashing, read
the last error in Loki, then roll back (A).

**C. Disk low (`host.disk`).** Free space without touching data:

```sh
docker image prune -a --filter "until=168h"
docker builder prune --filter "until=168h"
sudo journalctl --vacuum-size=500M
```

Never run `docker volume prune` and never delete files in the PostgreSQL data volume or `pg_wal`.
If PostgreSQL data or WAL is what grows, go to [runbook 02](02-postgresql-incident.md) (WAL archiving
may be failing).

**D. Host lost or unrecoverable.** Provision a new host (`docs/SERVICES-SETUP.md` §4). Restore the
database ([runbook 02](02-postgresql-incident.md), path D). Redeploy from the last good image. Point
Cloudflare DNS at the new host.

**E. Status updates.** None are needed before launch (no users). From P14, post status to users
through the channel the launch plan defines.

## Verification

- `curl https://api.ai-stylist.app/v1/health` returns `{"status":"ok","checks":{"db":"ok"}}`.
- Dashboard 01: 5xx back to 0, 1 h burn rate below 14, requests back at the usual rate.
- `df -h` shows more than 15 % free, and `host.disk` resolves after its 10 min window.
- Queues drain ([runbook 04](04-queue-dlq.md) if dead letters appeared during the outage).

## Escalation

- SEV1: acknowledge within 30 min, at any hour. If not mitigated within 30 min, page the other
  `on-call` member.
- SEV2 (`host.disk`): acknowledge within 4 h in waking hours. Quiet hours (23:00–08:00) mute it until
  morning. At less than 5 % free, treat it as SEV1: a full disk stops PostgreSQL.
- Vendors: the host provider, Cloudflare. Coolify is self-hosted, so its GitHub issues are the only
  support.

## Follow-up

- Incident review within 5 working days for SEV1/SEV2 (sections in planning/14 §8;
  `templates/incident-review.md` is not in the repo yet). Action items go to the tracker.
- A regression test for a code cause (`just test-regression <file>`).
- If the outage had no alert, add one with a runbook link (planning/14 §7) through
  `docs/observability/grafana/`.
