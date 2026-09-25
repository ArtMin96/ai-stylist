---
name: security-privacy-review
description: Review a diff or PR that touches auth, authorization, consent, sensitive data (measurements, selfies/face data, photos, location, wardrobe history, tokens), webhooks, uploads/signed URLs, deletion/export, logging, AI-provider data flows, or native-app token storage, network security and privacy declarations — use whenever asked "security review", "privacy review", "is this webhook safe", "does this leak PII", "is this safe to ship", or "consent flow review". Produces a written review, not code changes. Not for module-boundary or duplication findings on the same diff — use `architecture-review` for that lens — and not for writing the fix, which goes back to the owning engineer skill.
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: security-privacy-reviewer
---

# Security and Privacy Review

## Trigger

- Mandatory before PR (CLAUDE.md "Security and privacy rules") for: auth/authorization changes,
  consent flows, deletion flows, webhook handlers. Also for: `identity` session code, admin
  endpoints, media upload/signed URLs (`StorageProvider`), logging/analytics changes, prompts or
  payloads to AI providers, any table classified sensitive in doc 11, and native-app token storage,
  network security, backup rules or privacy declarations.
- A two-platform feature that touches consent, auth, tokens, analytics payloads or sensitive data
  (`cross-platform-feature` step 9), or `release-readiness` asking for the privacy-declaration check.
- Scheduled pass in P14 hardening.
- A reviewer asks "is this safe", "does this leak PII", "is this webhook safe", "redaction",
  "signed URL", or "consent".
- This skill reviews; fixes are made by the owning skill.

## Required reading

1. `planning/11-security-privacy-and-compliance.md`: threat model (incl. the P02 supply-chain/CI-secret
   appendix), §4.2 (sessions on device), data classification, retention/deletion, consent scopes,
   §8 logging redaction list, approved AI-provider list.
2. `CLAUDE.md` "Security and privacy rules" and "Prohibited without explicit human authorization".
3. The diff under review (scope: `git diff <base>...HEAD`, or `git diff HEAD` plus every untracked
   file from `git status --porcelain` read in full) and `docs/modules/<name>.md` for touched
   modules; `planning/14-observability-operations-and-analytics.md` for any log/event change.
4. `planning/15-team-workflow-and-ai-agent-operations.md` §6 (sops + age, `.env.example` rule) and §9
   (supply-chain policy).
5. `apps/api/src/platform/logger.ts` (`FORBIDDEN_LOG_KEYS`) for the mechanical floor this review
   checks by hand for anything the lint rule cannot see (indirect leakage, event payloads, prompts).
6. Native apps: `apps/ios/App/PrivacyInfo.xcprivacy`, `apps/ios/App/Info.plist`,
   `apps/android/app/src/main/AndroidManifest.xml`,
   `apps/android/app/src/main/res/xml/network_security_config.xml`,
   `apps/android/app/src/main/res/xml/backup_rules.xml`,
   `apps/android/app/src/main/res/xml/data_extraction_rules.xml`.

## Workflow

Walk the checklist against the actual code, not the PR description:

1. AuthN/AuthZ: every new endpoint/task authenticates; ownership checked at the data layer; admin
   surfaces audited; no IDOR.
2. Sensitive data flow: trace each field end to end (storage, retention, readers, deletion
   propagation across Postgres, R2, derived assets and the provider side); consent scope checked
   before processing face data.
3. Logging/analytics: no photos, tokens, measurements, precise location, or free text in logs,
   errors, traces, PostHog events; correlation ids instead of payloads; the logger denylist and
   forbidden-field lint are not bypassed; no `console.*`, no raw `req.body`.
4. AI-provider egress: payload minimised; provider on the approved list; no-training terms hold;
   prompts carry no unnecessary personal data.
5. Uploads/media: content-type + size + namespace constraints on presigned URLs, TTL ≤ 15 min, EXIF
   stripped at ingest, no public buckets; `*.sec.test.ts` cover expired / foreign-namespace /
   wrong-content-type.
6. Webhooks/inputs: signature verification, replay protection (event-id dedup + timestamp window),
   rate limits, strict schema validation, idempotency.
7. Secrets/config: none in code, fixtures, or bundles; new keys in `.env.example` with empty values
   and comments; `.sops.yaml` updated for new envs; no security control disabled "temporarily".
8. Abuse cases: enumerate 2–3 for the feature and check mitigations.
9. Fixtures: synthetic only; no real personal data in fixtures or recorded cassettes.
10. Native apps: tokens only in the iOS Keychain (non-synchronizable, `WhenUnlockedThisDeviceOnly`)
    or Android Keystore-backed storage, never UserDefaults, SharedPreferences or plain files (doc 11
    §4.2); no ATS exception in `Info.plist` and `cleartextTrafficPermitted="false"` in the release
    network security config (the debug override stays debug-only); no exported Android component
    (`android:exported="true"` activity, service, receiver or provider) and no deep link or
    universal link that reaches user data without an authenticated session;
    `android:allowBackup="false"` and the backup / data-extraction rules exclude sensitive files;
    no PII in `os_log`/`Logger` or Logcat; analytics consent off by default; `PrivacyInfo.xcprivacy` and the Play data-safety
    answers match the data the diff actually collects.

## Validation commands

```bash
just security-scan                    # gitleaks + osv-scanner + pnpm audit + license gate (+ SBOM)
just lint                             # forbidden-field / console / req.body rules
just docs-check                       # data-classification doc drift caught at review time, not after merge
just test <touched modules>           # authz, isolation, webhook-replay, *.sec.test.ts present and green
```

Missing security tests for a reviewed behaviour is itself a finding.

## Output

The `agent-operating-contract` reviewer variant: the header with the verdict word, the `Agent:`
line, these sections (write `none` under an empty one), then its last three lines. Each finding is `file:line` + severity; no finding is
silently dropped; never quote the sensitive value itself. Legal questions go to the doc 16 register
labelled as needing counsel.

```
## Security and privacy review of <diff or PR> — APPROVE | CHANGES REQUESTED
Agent: security-privacy-reviewer · Base: <sha> · Worktree: <path | main checkout> · Branch: <name>
### Blocking findings
- <file:line> — checklist item <n> — <what is wrong> — fix: <…>
### Non-blocking findings
- <file:line> — checklist item <n> — <what> — issue + owner: <…>
### Checked and clear
- item <n> — <files verified>
### Abuse cases
- <case> — mitigation: <file:line | missing>
### Gates
- just security-scan → <actual>; just lint → <actual>; just test <modules> → <actual>
```

Done checklist: every checklist item has a verdict · `security-scan` output pasted or under
`Not run:` · sensitive fields traced · abuse cases written · verdict in the header.

## Stop / escalation

- An exposed secret or live vulnerability → stop the review, report immediately for same-day
  rotation (doc 15 §6) and incident handling.
- Design (not code) conflicts with doc 11, e.g. new sensitive collection without a consent flow →
  human + ADR; do not approve with caveats.
- Biometric/regional gating questions → OPEN — see planning/16 OQ-06; counsel input, not
  engineering judgment.
- The diff also adds a new symbol, mapper, or schema unrelated to the security lens → hand off to
  `architecture-review` for that finding rather than folding it into this report.

## Overlap

Adjacent: `architecture-review` (same PR, different lens; both use `just lint` as the mechanical
floor for `no-console` and no-log-request-body, while this skill still traces sensitive fields into
logs, events and PostHog payloads by hand, because lint only catches literal `console.*` /
`req.body`), `entitlements-billing` and `backend-module` (produce the webhook/auth code reviewed
here), `media-ml-pipeline` (provider egress, uploads), `db-migration` (sensitive columns),
`ios-feature` / `android-feature` (native storage, network and privacy files), `release-readiness`
(asks for item 10 before a release), `data-lifecycle` (deletion and export mechanics). This skill
owns no path; it reviews the output of every module-owning skill.
