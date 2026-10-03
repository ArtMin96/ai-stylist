# Runbooks

One runbook per operational risk, numbered as in planning/14 §8. Each runbook ships with the phase
that creates its risk, and every alert links to one through its `runbook_url` annotation
(planning/14 §7: an alert without a runbook cannot ship). All ten exist by P14.

| #   | Runbook                                                                      | Alerts that link here | Status                                                                              |
| --- | ---------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| 01  | [API down, host or Coolify incident](01-api-down.md)                         | `host.disk`           | Written in P02. Needs a deployed host (P03) to be fully operable.                   |
| 02  | [PostgreSQL incident and pgBackRest PITR restore](02-postgresql-incident.md) | `db.backup_age`       | Written in P02. Operable once P02-T07's database environments and pgBackRest exist. |
| 03  | R2 and custom-domain cache incident                                          | none yet              | Ships with P06 (first user media in R2)                                             |
| 04  | [Queue stuck, DLQ drain, poison-message isolation](04-queue-dlq.md)          | `queue.job.dlq`       | Written in P02. Operable now (local and dev).                                       |
| 05  | Provider outage (weather and holidays, AI providers, RevenueCat)             | none yet              | Ships with P08 (weather/holiday). AI providers added in P06/P11, RevenueCat in P13. |
| 06  | Security incident (planning/11 §16)                                          | none yet              | Ships with P14                                                                      |
| 07  | Deletion or export job failure                                               | none yet              | Ships with P03                                                                      |
| 08  | Billing reconciliation drift                                                 | none yet              | Ships with P13                                                                      |
| 09  | Mobile bad release                                                           | none yet              | Ships with P14                                                                      |
| 10  | AI cost runaway (kill-switch flags)                                          | none yet              | Ships with P11                                                                      |

## Conventions

- File name `NN-slug.md`. Alert rules link to
  `https://github.com/ArtMin96/ai-stylist/blob/main/docs/runbooks/NN-slug.md`, so never rename a file
  without updating the alerts in `docs/observability/grafana/alerts/`.
- Every runbook has these sections: severity, alerts that link here, detection, triage, mitigation,
  verification, escalation, follow-up. It also says honestly what is not operable yet.
- Commands carry ids, states and error classes only. Never paste user data, payloads or email addresses
  into a terminal session that gets shared, or into an incident issue (planning/11 §8).
- SEV1 and SEV2 incidents get a blameless review within 5 working days, using the sections listed in
  planning/14 §8. The template `templates/incident-review.md` is not in the repo yet. Action items go
  to the tracker, not the document.
- Severity ladder, quiet hours and paging: [docs/observability/grafana.md](../observability/grafana.md#sev-ladder-and-paging).
