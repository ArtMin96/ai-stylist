# Runbook 04: queue stuck, DLQ drain, poison-message isolation

| Field                 | Value                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Severity              | SEV2 (planning/14 §7: DLQ growth). A stuck queue with no DLQ is SEV2 too once users depend on it.                         |
| Alerts that link here | `queue.job.dlq` (SEV2): `sum by (job_type, deployment_environment_name) (increase(stylist_queue_job_dlq_total[10m])) > 0` |
| Responder             | role `on-call` in `packages/shared-kernel/registry/owners.json`                                                           |
| Operable today        | Local and dev: yes. Staging and prod: no host exists yet (first deploy P03); the SQL is the same there.                   |

## How the pipeline fails (P02-T08 implementation)

- Outbox row (`platform_outbox`) → relay (API process) → pg-boss queue → job handler (jobs process) →
  worker. Queues and routes are declared only in `apps/api/src/jobs/queues.ts`. Today: queue
  `demo.outbox-flow`, its worked DLQ `demo.outbox-flow.dlq`, and the unworked `demo.outbox-flow.dlq.dlq`.
- **Consumer path.** A job gets 5 attempts with 1–60 s jittered backoff. The exhausted job ends `failed`,
  and a copy lands in `<queue>.dlq` (`source_id` = the failed job id). The DLQ worker then marks the
  outbox row `failed` with `last_error = 'job exhausted: <queue>'`. This path increments
  `stylist.queue.job.dlq` and fires the alert.
- **Relay path.** The relay could not enqueue the row 5 times. The row ends `failed` with the error class
  in `last_error` (`Error`, `PostgresError (pg 57P01)`, `TimeoutError: …`, `UnroutedEventError: …`,
  `InvalidEnvelopeError: …`). No pg-boss job exists. **This path does not fire `queue.job.dlq`**. Only
  the SQL below finds it until relay-lag and outbox-depth metrics exist (`apps/api/src/platform/outbox/README.md`).
- A `failed` outbox row is never re-dispatched, and a `failed` job is never retried. Both paths already
  isolate the event. Nothing is dropped. The nightly DLQ sweep into an `admin` ops queue
  (planning/04 §9.2) is not built yet, so a human drains the DLQ with this runbook.

## Detection

1. The `queue.job.dlq` email names `job_type` and `deployment_environment_name`. An empty
   environment in that email means the process started with an empty `APP_ENV`: `just doctor` warns
   about it and `just bootstrap` sets it to `local`.
2. Dashboard **01 Service health**, row **Queues**: dead-lettered jobs, queue depth, oldest job age
   (budget 15 min), job outcomes.
3. The SQL below. It is the only detector for relay-path failures.

## Triage

Open a SQL shell. There is no `just` recipe for this yet.

- Local: `docker exec -it ai-stylist-postgres psql -U ai_stylist -d ai_stylist` (by container name,
  so it works from any checkout or worktree)
- Staging/prod (after P03): `psql "$DATABASE_URL"`, with the direct string (not PgBouncer) from
  `secrets/<env>.enc.yaml`, run from a machine on the private network.

Select ids, states and error classes only. Never select `payload` (outbox), `data` (pg-boss) or
`data->'payload'`: they can hold user data (planning/11 §8).

```sql
-- 1. Unfinished and failed jobs per queue (dead-letter queues included).
select name, state, count(*), min(created_on) as oldest
from pgboss.job
where state <> 'completed'
group by name, state
order by name, state;

-- 2. Failed source jobs: event id, error summary ({errorName, pgCode?}, never a message).
select id, retry_count, output, completed_on,
       data->>'id' as event_id, data->>'type' as event_type, data->>'correlationId' as correlation_id
from pgboss.job
where name = 'demo.outbox-flow' and state = 'failed'
order by completed_on desc
limit 50;

-- 3. Failed outbox rows, grouped by cause (covers both paths).
select type, last_error, count(*), min(created_at) as first, max(created_at) as last
from platform_outbox
where status = 'failed'
group by type, last_error
order by count(*) desc;

-- 4. Dead letters the DLQ worker could not handle (should be empty).
select name, id, source_id, created_on, data ? 'id' as has_event_id
from pgboss.job
where name like '%.dlq.dlq';

-- 5. Stuck: active jobs past their expiry (supervision should fail them back into retry within 60 s).
select name, id, started_on, expire_seconds
from pgboss.job
where state = 'active' and started_on < now() - make_interval(secs => expire_seconds);
```

Classify what you see:

| Pattern                                                                                | Meaning                                                                                                                                                              | Go to                |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Many dead letters, one `errorName`, same window                                        | Dependency down (worker, provider, database). The segmentation client's circuit opens after 5 failures, so a dead worker dead-letters a batch within about a minute. | Mitigation A, then B |
| One event id keeps failing with `InvalidJobDataError` or the same error after a replay | Poison message: the data breaks the contract or the handler                                                                                                          | Mitigation C         |
| `last_error` `UnroutedEventError`                                                      | An event type has no route in `queues.ts`                                                                                                                            | Code fix, then B     |
| Queue depth grows, no failures, oldest age rising                                      | No jobs process is working the queue                                                                                                                                 | Mitigation D         |
| Rows in `<queue>.dlq.dlq`                                                              | The DLQ worker failed to mark the outbox row                                                                                                                         | Mitigation E         |

Find the trace for one event: take its `correlation_id` and follow
[grafana.md, "Find one flow by correlation id"](../observability/grafana.md#find-one-flow-by-correlation-id).

## Mitigation

Every statement that changes data is run by the on-call human. Paste the event ids and the statement
into the incident issue first. Never replay an event older than 90 days: the effect-once keys
(`platform_idempotency_keys`) last 90 days, so an older replay could repeat a side effect.

**A. Stop the bleeding.** Fix or restart the failing dependency first, or new jobs keep dead-lettering.
Locally, restart `just dev-workers` (it runs the jobs process and the segmentation worker). If the
cause is one feature, turn its flag off in PostHog, for example `demo-outbox-flow`, which makes
`POST /v1/dev/demo-events` answer 404. Stopping the jobs process is safe: unfinished jobs wait in
pg-boss and keep their attempt counts.

**B. Replay after the fix.** Replay goes through the outbox with the original event id (planning/04
§9.2). The relay re-enqueues with job id = UUIDv5(event id). pg-boss still holds the old `failed` job
under that id, so the job has to be removed first, or the enqueue is a silent no-op
(AC-3 in `apps/api/src/jobs/tests/acceptance-dispatch.docker.test.ts`). The handler's
`PgIdempotencyGuard` (key = event id) stops a second effect if the first one had committed.

```sql
-- Replay up to 100 consumer-exhausted events of one queue since the incident started.
begin;
create temp table replay on commit drop as
  select id from platform_outbox
  where status = 'failed'
    and last_error = 'job exhausted: demo.outbox-flow'
    and created_at >= '2026-10-01T12:00:00Z'   -- incident start
  order by created_at
  limit 100;
delete from pgboss.job j using replay r
  where j.name = 'demo.outbox-flow' and j.state = 'failed' and j.data->>'id' = r.id;
update platform_outbox o
  set status = 'pending', attempts = 0, next_attempt_at = null, dispatched_at = null
  from replay r
  where o.id = r.id and o.status = 'failed';
commit;
```

- For chosen ids, replace the temp-table query with `select unnest(array['evt_…', 'evt_…']) as id`.
- Relay-path rows need only the `update`; the `delete` matches nothing.
- `last_error` keeps the original cause until a new failure overwrites it.
- Replay in batches of 100 (the relay batch size) and watch queue depth between batches.
- An event of a user whose jobs were cancelled (account deletion) is not enqueued again: the relay
  marks it `dispatched` and nothing runs. That is correct, because deletion wins.

**C. Poison message.** Do not replay it. It is already isolated: the job is `failed`, the outbox row is
`failed`, and no other event waits on it (there is no global ordering). Record the event id, type
and `errorName` in a tracker issue. Fix the code or the contract with a regression test first
(`just test-regression <file>`), then replay it with B.

**D. Stuck queue.** Check that a jobs process is running (locally `just dev-workers`; staging and prod:
the jobs resource in Coolify, after P03). Query 5 above shows active jobs past expiry that
supervision has not failed back into retry. That also means no live jobs process. Restart it: pg-boss
resumes `created` and `retry` jobs with their attempt counts.

**E. `.dlq.dlq` rows.** When `has_event_id` is true, do by hand what the DLQ worker failed to do, then
decide on B:

```sql
update platform_outbox
set status = 'failed', next_attempt_at = null, last_error = 'job exhausted: demo.outbox-flow'
where id = 'evt_…' and status <> 'failed';
```

When `has_event_id` is false, the job never came from the outbox. Find its producer. The row
expires by pg-boss retention.

## Verification

```sql
select status, count(*) from platform_outbox where id in ('evt_…') group by status;  -- all 'dispatched'
select name, state, count(*) from pgboss.job
where data->>'id' in ('evt_…') group by name, state;                                  -- new jobs 'completed'
```

On dashboard 01, dead-lettered jobs are back to 0, and depth and oldest age are back to baseline.
`queue.job.dlq` resolves once 10 minutes pass without a new dead letter, and Grafana sends a
resolved email.

## Escalation

- SEV2: acknowledge within 4 h in waking hours. Quiet hours (23:00–08:00) mute SEV2 until morning.
- Not resolved within a working day, or data loss suspected: page the other `on-call` member.
- Provider or worker outage outside our code: runbook 05 (ships with P08).
- The database itself is failing (connections, disk, `57P01`): [runbook 02](02-postgresql-incident.md).

## Follow-up

- Incident review within 5 working days for SEV1/SEV2. Use the sections listed in planning/14 §8;
  `templates/incident-review.md` does not exist yet. Action items go to the tracker.
- A regression test for every poison message (`just test-regression <file>`).
- If an alert fired without a real problem, tune or demote it (alert budget ≤ 2 pages/week).

## Proof run: injected failure fires the alert (P02 AC-6)

Run this once per stack after `just observability-sync`. `.env` must have `OTEL_EXPORTER_OTLP_ENDPOINT`
and `OTEL_EXPORTER_OTLP_HEADERS` (`just secrets-sync`).

1. `just db-migrate`, then in one terminal `just dev-api`.
2. In a second terminal, `just dev-workers --port 8011`. The worker listens on 8011, but the jobs
   process calls the fixed `http://127.0.0.1:8001` (`apps/api/src/jobs/main.ts`), so every call fails.
   Wait about 70 s after it starts before step 3. The jobs process exports its metrics every 60 s,
   and the alert needs one export of the dead-letter counter at 0 before the dead letter: a counter
   first seen at 1 gives `increase()` nothing to count. The drill of 2026-10-03 waited; sending the
   request at once was not tried.
3. `curl -sS -X POST http://localhost:3000/v1/dev/demo-events -H 'content-type: application/json' -H 'x-correlation-id: dlq-drill-1' -d '{"note":"dlq drill"}'`
   returns 202 with the envelope. Its `correlationId` is `dlq-drill-1`, known in advance, so the
   drill's logs and trace are found by that id
   ([grafana.md](../observability/grafana.md#find-one-flow-by-correlation-id)). Note the envelope's
   `id` for the replay. A 404 means either `APP_ENV` is not `local` or `dev` (the route is not
   registered), or the `demo-outbox-flow` flag reads as off. With a `POSTHOG_API_KEY` set, a flag
   that does not exist yet (before the first `just observability-sync`) reads as off, and the sync
   creates it off and at 0 % rollout. Turn it on in the PostHog project: on the flag's page click
   **Edit**, set **Rollout percentage** to **100%** under **Release conditions**, switch
   **Enabled** on and click **Save**
   ([posthog.md, "Feature flags"](../observability/posthog.md#feature-flags)). With an empty
   `POSTHOG_API_KEY` the registry default (on) applies.
4. Within about 2 minutes: 5 attempts, one `demo.outbox-flow.dlq` job, the outbox row `failed`. The
   dashboard shows 1 dead letter, and `queue.job.dlq` fires on its next evaluation (the email is held
   during quiet hours). In the drill of 2026-10-03 the row was `failed` about 30 s after the request
   and the rule was firing about a minute after it.
5. Restart `just dev-workers` without arguments, replay the id with B, and verify.
