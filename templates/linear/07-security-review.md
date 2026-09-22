Fill every section; delete nothing; if a section truly does not apply write `N/A — <reason>`.

- **Phase / task:** P##-T## · **Requirements:** NFR-SEC / NFR-PRIV IDs
- **Type:** security · **Skill:** `.agents/skills/security-privacy-review/SKILL.md` (mandatory before PR for auth, consent, deletion, webhooks)
- **Labels:** `type:security`, `mod:<owner>`, `phase:P##` · **Reviewed change:** <PR / issue ID>

## Context

What is being reviewed (diff, PR, design) and which trigger applies: auth/authorization, consent flow, deletion/export, webhook handler, `identity` session code, admin endpoint, upload/signed URL, logging/analytics, AI-provider payload, sensitive table.

<Trigger: <…>. Links: PR #… · `planning/phases/P##-*.md` §T## · doc 11 §<n> · ADR-NNNN>

## Scope

- In scope: <files / endpoints / flows reviewed>
- Out of scope: <…> (tracked in <issue>)
- Non-goals: <this issue produces a written review, not code; fixes go to Bug/Feature issues>

## Modules touched

- Modules under review: <SPINE §3 names> · Single-writer packages involved: <contracts | shared-kernel | CI | none>

## Threat model

Answer the doc 11 §2 STRIDE-lite prompts for each asset the change touches. Cite the mitigating section.

- Assets touched: <selfies/face geometry | body measurements | location | wardrobe & wear history | auth tokens/sessions | entitlements/credits | media pipeline | admin/audit | secrets/provider keys | backups/DB>
- Spoofing: <who can pretend to be whom; mitigation §…>
- Tampering: <what can be altered cross-user or client-side; mitigation §…>
- Repudiation: <what is audited; append-only?; mitigation §…>
- Information disclosure: <URLs, logs, over-fetch, provider retention, EXIF; mitigation §…>
- Denial of service / wallet: <quotas, rate limits (§14), credit draining; mitigation §…>
- Elevation of privilege: <isolation guard, RBAC, step-up auth (§4); mitigation §…>
- Abuse cases (§3) applicable: <3.1 unauthorized face | 3.2 ATO | 3.3 scraping | 3.4 credit fraud | 3.5 upload abuse | 3.6 denial of wallet>

## Approved-provider check

Any provider receiving S2/S3 data must pass doc 11 §7.5; face/body media only to providers on the doc 10 approved list.

- Providers in the data flow: <none | provider> · On approved list: <yes/no> · Data categories sent · retention · training excluded (contractual for S3) · sub-processors · region · deletion API/SLA · DPA · breach terms: <…>
- Payload minimised (no unnecessary personal data in prompts): <yes/no — detail>

## Acceptance criteria

1. AC-1: written review delivered at `<path or PR review link>` covering every prompt above — proof: link
2. AC-2: each finding has severity + owner + follow-up issue — proof: issue IDs
3. AC-3: sensitive-data flow traced end to end (storage, retention, readers, deletion incl. R2 + derived assets + provider side) — proof: table in review
4. AC-4: automated security tests exist for testable abuse cases (doc 13 §8) — proof: `just test <module>` → `<names>`; `just security-scan` → `<clean>`

## Architecture guardrails

- [ ] Auth, isolation and consent checks live in the owning module, not only in an adapter (controller/hook)
- [ ] No security control disabled or weakened (rate limit, signature check, RLS/isolation guard), even temporarily
- [ ] Domain never imports provider SDKs; secrets only via environment; nothing in the app bundles
- [ ] Entitlements enforced server-side; webhooks verify signature + idempotency key
- [ ] Explanations from reason codes only; honesty invariants (provenance + confidence; real photo never replaced)
- [ ] Single source of truth for consent purposes / entitlement names (`shared-kernel`, `identity` consents)
- [ ] `just arch-check`, `just lint --fixtures` (forbidden-field + no-console rules) and `just security-scan` green

## Search-before-write

Existing guard, middleware, redaction schema, or consent check that already covers this? Name it and why a new one is (not) needed.

- Candidates checked: `<path>` — sufficient / gap because <…>

## Data, security, privacy

- Sensitive classes (doc 11 §6): <S1 | S2 | S3 — which fields>
- Logging: forbidden fields (§8) verified absent; canary test present: <yes/no> · New env keys (`.env.example`): <none | KEY (name only)>
- Consent purpose(s) checked before processing (§7): <purpose | N/A>
- Regulatory / legal-review register items (§12) triggered: <none | item>

## Risks and rollback

- Residual risk after review: <…> · Severity of open findings: <P1/P2/P3>
- Kill switch for the reviewed capability: <flag / entitlement off / endpoint disabled>
- Rollback / incident path: <doc 11 §16; rotate secret same day if leaked (doc 15 §6)>

## Test plan

- Security tests location: `apps/api/src/modules/<name>/tests/` (isolation, signature, rate limit, redaction canary) · Maestro flow for consent UI: `e2e/<…>`
- Fixtures: synthetic only, from `packages/test-support` / `packages/seed-data` · Skips: none, or `<test> — issue <ID>`

## Dependencies / blocked by

- Reviewed PR/issue: <ID> · Legal review (doc 11 §12): <N/A | item> · Accounts (`docs/SERVICES-SETUP.md` §<n>): <…> · P00 gates: <…>

## Definition of done

- [ ] Written review posted (PR review or `docs/security/…`); every prompt answered, none skipped
- [ ] Findings → issues with owner + severity; P1 findings block the reviewed PR
- [ ] No sensitive data pasted into this issue, the review, or logs
- [ ] `just security-scan` · `just lint` · `just arch-check` green on the reviewed branch; `just ci-parity` green before PR
- [ ] doc 11 / module contract / `PROGRESS.md` updated if the review changed a rule
- [ ] `security-privacy-review` skill followed; human sign-off recorded
