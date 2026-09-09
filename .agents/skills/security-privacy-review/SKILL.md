---
name: security-privacy-review
description: Review a diff or PR that touches auth, authorization, consent, sensitive data (measurements, selfies/face data, photos, location, wardrobe history, tokens), webhooks, uploads/signed URLs, deletion/export, logging, or AI-provider data flows. Produces a written review, not code changes.
---

# Security and Privacy Review

## Trigger

- Mandatory before PR (CLAUDE.md "Security and privacy rules") for: auth/authorization changes, consent flows, deletion flows, webhook handlers. Also for: `identity` session code, admin endpoints, media upload/signed URLs (`StorageProvider`), logging/analytics changes, prompts or payloads to AI providers, any table classified sensitive in doc 11.
- Scheduled pass in P14 hardening.
- This skill reviews; fixes are made by the owning skill.

## Required reading

1. `planning/11-security-privacy-and-compliance.md` — threat model (incl. the P02 supply-chain/CI-secret appendix), data classification, retention/deletion, consent scopes, §8 logging redaction list, approved AI-provider list.
2. `CLAUDE.md` "Security and privacy rules" and "Prohibited without explicit human authorization".
3. The diff under review and `docs/modules/<name>.md` for touched modules; `planning/14-observability-operations-and-analytics.md` for any log/event change.
4. `planning/15-team-workflow-and-ai-agent-operations.md` §6 (sops + age, `.env.example` rule) and §9 (supply-chain policy).

## Workflow

Walk the checklist against the actual code, not the PR description:

1. AuthN/AuthZ: every new endpoint/task authenticates; ownership checked at the data layer; admin surfaces audited; no IDOR.
2. Sensitive data flow: trace each field end to end — storage, retention, readers, deletion propagation (Postgres + R2 + derived assets + provider side); consent scope checked before processing face data.
3. Logging/analytics: no photos, tokens, measurements, precise location, or free text in logs, errors, traces, PostHog events; correlation ids instead of payloads; the logger allowlist/denylist and forbidden-field lint are not bypassed; no `console.*`, no raw `req.body`.
4. AI-provider egress: payload minimised; provider on the approved list; no-training terms hold; prompts carry no unnecessary personal data.
5. Uploads/media: content-type + size + namespace constraints on presigned URLs, TTL ≤ 15 min, EXIF stripped at ingest, no public buckets; `*.sec.test.ts` cover expired / foreign-namespace / wrong-content-type.
6. Webhooks/inputs: signature verification, replay protection (event-id dedup + timestamp window), rate limits, strict schema validation, idempotency.
7. Secrets/config: none in code, fixtures, or bundles; new keys in `.env.example` with empty values and comments; `.sops.yaml` updated for new envs; no security control disabled "temporarily".
8. Abuse cases: enumerate 2–3 for the feature and check mitigations.
9. Fixtures: synthetic only; no real personal data in fixtures or recorded cassettes.

## Validation commands

```bash
just security-scan                    # gitleaks + osv-scanner + pnpm audit + license gate (+ SBOM)
just lint                             # forbidden-field / console / req.body rules
just test <touched modules>           # authz, isolation, webhook-replay, *.sec.test.ts present and green
```

Missing security tests for a reviewed behaviour is itself a finding.

## Output

- Review note in the PR: Blocking findings (fix before merge), Non-blocking findings (issue + owner), Checked-and-clear list (which items were verified against which files). No finding silently dropped. Legal questions go to the doc 16 register labelled as needing counsel.

Done checklist: every checklist item has a verdict · `security-scan` output pasted · sensitive fields traced · abuse cases written · verdict posted.

## Stop / escalation

- An exposed secret or live vulnerability → stop the review, report immediately for same-day rotation (doc 15 §6) and incident handling.
- Design (not code) conflicts with doc 11, e.g. new sensitive collection without a consent flow → human + ADR; do not approve with caveats.
- Biometric/regional gating questions → OPEN — see planning/16 OQ-06; counsel input, not engineering judgment.

## Overlap

Adjacent: `architecture-review` (same PR, different lens), `entitlements-billing` and `backend-module` (produce the webhook/auth code reviewed here), `media-ml-pipeline` (provider egress, uploads), `db-migration` (sensitive columns), `release-readiness` (privacy declarations).
