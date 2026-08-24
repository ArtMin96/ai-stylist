---
name: security-privacy-review
description: Review a change (diff or PR) that touches auth, authorization, consent, sensitive data (measurements, selfies/face data, photos, location, wardrobe history), webhooks, uploads, deletion/export, logging, or AI-provider data flows. Produces a written review, not code changes.
---

# Security and Privacy Review

## Trigger

Run before merging any PR that touches: identity/auth/session code, authorization checks, consent records, deletion or export flows, media upload/signed URLs, webhook handlers, logging/analytics events, prompts or payloads sent to AI providers, admin endpoints, or any table classified sensitive in doc 11. Also run as a scheduled pass in P14 hardening.

**This skill reviews; it does not implement fixes.** Findings become issues or same-PR fixes by the owning skill.

## Required reading

1. `planning/11-security-privacy-and-compliance.md` — threat model, data classification, retention/deletion rules, consent scopes, logging redaction rules, approved AI-provider list.
2. The diff under review, plus the module contracts of touched modules.
3. `planning/14-observability-operations-and-analytics.md` §logging/redaction for any log/event changes.

## Workflow

Walk the checklist against the actual diff — read the code, do not review from the PR description:

1. **AuthN/AuthZ:** every new endpoint/job authenticates; authorization checks user/tenant ownership at the data layer, not just the route; admin surfaces audited; no IDOR (ids fetched are ownership-filtered).
2. **Sensitive data flow:** trace each sensitive field end to end — where stored, retention, who reads it, does deletion propagate (DB + R2 assets + derived assets + provider-side)? Consent scope checked before processing (esp. face data)?
3. **Logging/analytics:** no photos, tokens, measurements, precise location, or free-text personal data in logs, error messages, traces, or PostHog events; correlation ids instead of payloads.
4. **AI-provider egress:** payloads minimized; provider on approved list; no-training/retention terms hold for this data class; prompts contain no unnecessary personal data.
5. **Uploads/media:** content-type + size validation, signed short-lived URLs, EXIF stripping at ingest, malware/content-check state honored, no publicly-listable buckets.
6. **Webhooks/inputs:** signature verification, replay protection (event-id dedup + timestamp window), rate limits, strict schema validation, idempotency.
7. **Secrets/config:** no secrets in code, fixtures, or client bundles; new config keys added to `.env.example` without values.
8. **Abuse cases:** enumerate 2–3 for the feature (e.g., processing someone else's photo, entitlement bypass, scraping another user's closet) and check mitigations.
9. **Fixtures/tests:** test data synthetic; no real personal data in fixtures or recorded cassettes.

## Validation

```bash
just security-scan          # gitleaks + osv-scanner + audit + licenses
just test <touched-modules> # security-relevant tests exist and pass (authz, isolation, webhook replay)
```

Missing security tests for a reviewed behavior is itself a finding.

## Output

A review note in the PR: **Blocking findings** (must fix before merge), **Non-blocking findings** (issue links with owner), **Checked-and-clear list** (which checklist items were verified against which files). No finding may be silently dropped. Legal/compliance questions go to the doc-16 register, labeled as needing counsel.

## Stop / escalate

- Evidence of an actual exposed secret or live vulnerability in deployed code → stop review, report immediately for rotation/incident handling (doc 15 §6, doc 14 runbooks).
- The design itself (not the code) conflicts with doc 11 (e.g., new sensitive data collection without consent flow) → escalate to a human + ADR; do not approve with caveats.
