# P14 — Hardening and Launch

> Amended 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — service consolidation: pg-boss jobs, owned server + Coolify, self-managed PostgreSQL, R2 delivery model).

> File name: `phases/P14-hardening-and-launch.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10). Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P14 — Hardening and launch
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Qualify the complete product for public launch — accessibility audit, security/privacy review with pen-test, performance ratified against every doc 13 budget on the device matrix, offline/reliability and backup/restore/DR drills, store readiness, minimum support/admin operations — then execute the staged beta → production rollout with crash gates.
- **User-visible outcome:** The app is publicly available on the App Store and Google Play (staged rollout), accessible with screen readers and reduced motion, stable within published performance budgets on low/mid/high-tier devices, and backed by working support, deletion, and export operations.
- **Why now:** Every capability phase (P03–P13) must be `ACCEPTED` before qualification is meaningful — hardening a moving target wastes the audit. P14 converts the budget/threshold hypotheses accumulated since P00 into measured, ratified release gates and executes the launch that P15 will learn from.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only. P14 is the completion/verification phase for many multi-phase requirements; "final" marks where P14 is the last delivery listed in doc 01.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| NFR-TST-080 (final) | Accessibility tests + manual screen-reader/dynamic-text/contrast/reduced-motion/touch-target checks | AC-1 |
| REQ-AVA-100 (final) | 3D budgets met on low-tier device or documented fallback | AC-2 |
| NFR-PERF-010 (final) | Budgets measured, hypotheses replaced with device-measured values | AC-2 |
| NFR-PERF-020 (final) | 3D budgets per device tier with low-end fallbacks | AC-2 |
| NFR-PERF-030 (final) | Backend SLOs tracked, error-budget alerts | AC-3 |
| NFR-PERF-060 | Load + real-device testing precede performance claims | AC-2, AC-3 |
| NFR-TST-070 (final) | Device-matrix performance runs | AC-2 |
| NFR-TST-050 (final) | Six E2E journeys gate release on both platforms | AC-4 |
| NFR-TST-040 (final) | Backup/restore drill executed and documented | AC-5 |
| NFR-SEC-010 (final) | Threat model re-reviewed pre-launch | AC-6 |
| NFR-SEC-030 (final) | Isolation suite + admin RBAC/audit verified | AC-6 |
| NFR-SEC-040 (final) | Encryption verified; secret-rotation drill executed | AC-6 |
| NFR-SEC-070 (final) | Rate limits + account recovery verified | AC-6 |
| NFR-SEC-080 | Incident-response plan + drill | AC-7 |
| NFR-SEC-090 (final) | Moderation across upload + content pipelines verified | AC-6 |
| NFR-SEC-100 (final) | Security suites gate release | AC-6 |
| REQ-FAC-080 (final) | Face-misuse protections enforced + reviewed | AC-6 |
| REQ-MED-030 (final) | Upload validation/moderation/quarantine verified | AC-6 |
| NFR-PRV-040 (final) | Deletion cascade verified end-to-end | AC-8 |
| NFR-PRV-050 (final) | Retention limits live, face-data strictest | AC-8 |
| NFR-PRV-060 (final) | GDPR/CCPA + store privacy disclosures addressed; legal register resolved or accepted | AC-9 |
| NFR-PRV-090 (final) | No body-shaming/attractiveness-scoring/health-inference; copy audit | AC-1, AC-9 |
| NFR-PRV-110 (final) | Analytics consent + taxonomy audit | AC-9 |
| REQ-EXP-020 (final) | Explanation sensitive-language audit | AC-1 |
| REQ-BIL-070 (final) | Store billing compliance sign-off; review passes | AC-10 |
| REQ-ONB-130 (final) | State coverage (empty/loading/partial/failure/retry/recovery) verified across journeys | AC-4 |
| NFR-OBS-050 (final) | Dashboards/alerts/runbooks/on-call live; incident review used | AC-7 |
| NFR-OBS-070 (final) | Audit trails demoed | AC-6 |
| NFR-OBS-100 (with P15) | Metric tree live with guardrail alerts | AC-3 |
| NFR-TEAM-140 (final) | Store CI/CD: signing, staged rollout, crash gates, rollback rehearsed | AC-11 |
| NFR-TEAM-160 | Phase completion = tests+evidence+docs+operability+demo | §20 |

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **all of P03–P13** (per SPINE §5). A descoped-but-accepted phase (e.g. P12 descoped per RISK-03) satisfies the dependency at its recorded scope.
- External blockers: **OQ-01** (final product name — store listing cannot ship without it), **OQ-08** (device floor ratification), legal-review register items due P14: **LR-01** (privacy labels), **LR-10** (EU AI Act), **LR-12** (wardrobe-data disclosure wording) — plus any still-open earlier LR items ([11 §12](../11-security-privacy-and-compliance.md)); pen-test vendor booking (or documented internal fallback); store review timelines; device-farm access for the matrix runs.

## 4. In scope / out of scope

**In scope:** full accessibility audit (automated + manual checklist for the six core journeys); security/privacy review — threat-model re-review, external pen-test (or structured internal with risk entry), full security suite, secret-rotation drill, recovery-flow tabletop; ethics/copy audit ([11 §17](../11-security-privacy-and-compliance.md)); performance qualification on the [13 §7](../13-testing-quality-and-performance.md) device matrix against every §12 budget, load tests, budget ratification (hypothesis → measured, DEC entries); offline/reliability drills (provider chaos, airplane-mode journeys); backup/restore + DR drill with post-restore re-deletion replay; store readiness — listing, privacy nutrition labels / Data safety form, review-guideline self-check, billing compliance final sign-off; support/admin minimum ([14 §14](../14-observability-operations-and-analytics.md)); on-call rota, alert-budget tuning, all runbooks, incident drill; staged rollout: internal → TestFlight/Play-internal beta → production staged % with crash gates → full availability.

**Out of scope / non-goals:** new features of any kind (feature freeze at phase start; only qualification-driven fixes); localization; marketing site/ASO copy beyond required store metadata; post-launch metric analysis and experiments (P15); resolving research bets (RB-1..3 remain dormant); scaling work beyond the 5k-user launch model (revisit on measured need).

## 5. Product/UX behavior

P14 introduces no new user journeys; it verifies the state coverage of all existing ones (REQ-ONB-130) and hardens degraded modes. The table lists the qualification surfaces this phase adds or finalizes.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Six core journeys (onboarding, capture, recommendation, purchase/restore, deletion, degraded-providers) | Nightly E2E green on both platforms | Each journey's empty state verified per [02](../02-user-journeys-and-information-architecture.md) | Failure+retry paths exercised per journey (chaos toggles in staging) | Offline behaviors verified: capture queue, cached recs + staleness banner, cached closet | Full manual pass: VoiceOver + TalkBack, dynamic type max, reduced motion, contrast, touch targets ([13 §7](../13-testing-quality-and-performance.md)) |
| Non-3D alternative | Complete onboarding→recommendation with 3D disabled, equivalent information ([02 §13.3](../02-user-journeys-and-information-architecture.md)) | — | — | Works offline like primary path | This *is* the accessibility surface; presence is an automated check |
| Degraded providers | Weather/holiday down → cached facts + freshness warning; AI providers down → kill-switch ladder rungs verified ([10 §6.3](../10-ai-usage-cost-and-evaluation.md)); RevenueCat down → entitlement grace behavior | — | Each provider chaos-toggled in staging; app never crashes, degrades per doc | Cached-context recommendation offline | Degradation messages announced, not color-only |
| Support contact + account recovery | Email support with templates; recovery flows per [11 §15](../11-security-privacy-and-compliance.md) | — | Uniform responses (no account enumeration) | Recovery requires connectivity, stated | Standard controls |
| Beta feedback (TestFlight/Play) | Beta testers can report issues; crash reports symbolicated | — | — | — | — |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); update each touched module's contract file.

| Module | Change | Contract update needed? |
|---|---|---|
| `admin` | Support/admin minimum completed: account lookup (role-limited), job/pipeline state + retry, moderation queue polish, deletion/export status + re-trigger, audit-log viewer | Yes |
| `platform` | Rate-limit tuning from load tests; cert-pinning decision DO-SEC-02 executed; alert routing + on-call escalation wiring | Yes (small) |
| `identity` | Account-recovery hardening outcomes; age-gate copy final per LR-09 | No (verification) |
| all modules | Qualification fixes only — no boundary or contract changes without ADR | Only if a fix forces one |
| `media`, `avatar` | Low-end fallback defaults ratified (LOD/quality tiers per device floor OQ-08) | Yes (config values) |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`): admin support endpoints completing [14 §14](../14-observability-operations-and-analytics.md) (account lookup, job retry, deletion/export status). No public-surface endpoint changes expected; any qualification fix touching contracts follows normal single-writer + regenerate flow.
- Event schemas added/changed: none planned.
- DB migrations (Drizzle): retention-enforcement jobs' bookkeeping if not already present (face-data retention per NFR-PRV-050); otherwise none. Forward + rollback per doc 06.
- Generated clients to regenerate: only if fixes touch contracts (`just generate --check` stays green throughout).

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | A11y fixes from audit; perf fixes from device runs; store build config (icons, name per OQ-01, permission strings); reduced-motion/non-3D verification; release-channel wiring |
| Backend | Security-review fixes; rate-limit tuning; SLO/error-budget ratification; retention jobs verification |
| Workers (ML/media) | Eval-suite freshness check; kill-switch ladder verification; no new capability work |
| Data / migrations | Restore-drill execution: pgBackRest PITR restore to a scratch host + R2 sample restore (RISK-17); retention bookkeeping if needed |
| Infrastructure | Production environment finalization (separate credentials per [15 §11](../15-team-workflow-and-ai-agent-operations.md)); WAF/bot rules; alert delivery + escalation app; store CI/CD lanes exercised end-to-end incl. rollback rehearsal |
| 3D / assets | Device-floor fallback defaults; asset-budget verification (`just assets-validate` across the full manifest) |
| Admin / internal tools | Support/admin minimum set complete and role-tested |

## 9. AI vs deterministic decisions

No new AI capabilities. P14 verifies existing ones:

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| All shipped AI features ([10 §1](../10-ai-usage-cost-and-evaluation.md)) | As classified in doc 10 | Verification only: every AI feature's eval suite re-run at release candidates; fallback/kill-switch rungs demonstrated live | Documented per feature (doc 10 §6.3 ladder) | Cost/latency regression gates re-armed as release gates ([13 §10](../13-testing-quality-and-performance.md)) |
| Explanation/copy ethics audit | Deterministic checklist + blocklist eval | [11 §17](../11-security-privacy-and-compliance.md) rules are release blockers | n/a | n/a |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification: none. This phase *verifies* the classification table ([11 §6](../11-security-privacy-and-compliance.md)) against reality (schema review sweep).
- Consent required / consent UI changes: consent-coverage audit — every sensitive processing path has a valid consent record (guardrail target 0 violations, [00 §8.4](../00-product-vision-and-scope.md)); analytics consent defaults verified per jurisdiction (LR-07 outcome).
- Retention, deletion, and export impact: deletion cascade end-to-end test on a fully-populated account incl. R2, provider-side, and post-restore re-deletion replay ([11 §13.3](../11-security-privacy-and-compliance.md)); retention limits (face data strictest) demonstrated live; export SLA measured.
- Threat/abuse cases added to the threat model: re-review sweep — every phase's additions (face misuse, webhook forgery, credit fraud, content abuse, denial-of-wallet, admin abuse) confirmed mitigated with a passing test or a risk-register entry; pen-test findings triaged (highs fixed pre-launch, mediums owned with deadline); secret-rotation drill + recovery-flow social-engineering tabletop executed ([13 §8.2](../13-testing-quality-and-performance.md)).

## 11. Observability and analytics added in this phase

Per [14 §15](../14-observability-operations-and-analytics.md) P14 row.

- Logs/metrics/traces: no new instrumentation classes — gap-closure sweep so every [14 §4](../14-observability-operations-and-analytics.md) metric has a live panel and owner; error budgets ratified (99.5 % availability hypothesis → measured); crash-free-session gate armed (≥ 99.5 % hypothesis ratified).
- Product analytics events: taxonomy audit (no sensitive payloads, schema-validated); funnels for launch monitoring (activation, capture, recommendation acceptance, trial→paid) verified live; metric tree (NFR-OBS-100) fully attributed (owner/source/privacy class/target/decision).
- Alerts/dashboards/runbook entries: alert-budget tuning (≤ 2 pages/week policy live); on-call rota + escalation delivery tested with a real page; **all ten runbooks** of [14 §8](../14-observability-operations-and-analytics.md) written and linked from alerts; incident drill executed with a blameless review using the template; restore-drill freshness green.

## 12. Ordered tasks

Small enough for one AI-assisted session each. Task IDs `P14-T##`. (Qualification tracks run as parallel lanes; fixes loop within each lane.)

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P14-T01 | Feature freeze + release-candidate branch + full `just ci-parity`/nightly green baseline; open the qualification tracking board | — | 1 |
| P14-T02 | Accessibility: automated sweep + manual checklist (VoiceOver/TalkBack, dynamic type, contrast, reduced motion, touch targets, non-3D alternative) across six core journeys; file fixes | T01 | 3 |
| P14-T03 | Ethics/copy audit: [11 §17](../11-security-privacy-and-compliance.md) checklist, explanation sensitive-language review (REQ-EXP-020), no digital-twin claims, provenance badges present | T01 | 1 |
| P14-T04 | Security review: threat-model re-review, full sec suite run, admin RBAC/audit verification, upload/moderation verification, rate-limit verification | T01 | 2 |
| P14-T05 | External pen-test engagement + finding triage/fixes (or structured internal test + risk entry) | T04 | 2 (+ vendor calendar) |
| P14-T06 | Drills: secret rotation, recovery-flow tabletop, incident drill + review | T04 | 1 |
| P14-T07 | Privacy: deletion/export end-to-end verification, retention jobs live, consent-coverage audit, DPIA/legal register closure (LR-01/10/12 + stragglers) with counsel | T01 | 2 |
| P14-T08 | Performance: device-matrix runs (low/mid/high, iOS+Android) against every [13 §12.1](../13-testing-quality-and-performance.md) budget; fix or invoke documented fallbacks; ratify budgets + device floor (OQ-08) as DEC entries | T01 | 3 |
| P14-T09 | Load tests (k6 profiles per [13 §12.3](../13-testing-quality-and-performance.md)) + backend SLO/error-budget ratification + rate-limit tuning | T01 | 2 |
| P14-T10 | Reliability drills: provider chaos (weather, AI, RevenueCat), kill-switch ladder live verification, offline journeys on device | T01 | 2 |
| P14-T11 | Backup/restore + DR drill: pgBackRest PITR restore to a scratch host + verification suite, R2 sample restore, post-restore re-deletion replay; document RTO/RPO measured | T01 | 1 |
| P14-T12 | Support/admin minimum complete ([14 §14](../14-observability-operations-and-analytics.md)) + support email templates + audit-log viewer demo | T01 | 2 |
| P14-T13 | Observability closure: metric-gap sweep, alert-budget tuning, on-call rota + paging test, all runbooks written | T09, T10 | 2 |
| P14-T14 | Store readiness: name (OQ-01) final, listings, privacy nutrition labels / Data safety (LR-01), permission strings, review-guideline self-check, billing compliance final sign-off (REQ-BIL-070), size gate | T02, T07 | 2 |
| P14-T15 | Release engineering: production env finalization, store CI/CD lanes exercised (signing, TestFlight + Play internal upload), staged-rollout config + crash-gate thresholds, **rollback rehearsal** | T01 | 2 |
| P14-T16 | Internal beta (team devices, `internal` channel) → fix loop → beta channel (TestFlight + Play closed testing) with entry/exit criteria | T14, T15, all fix loops closed | 2 (+ soak time) |
| P14-T17 | Store submission both platforms; respond to review; **staged production rollout** (Play staged %, iOS phased) with crash gates; monitor → full availability | T16 | 2 (+ review/rollout calendar) |
| P14-T18 | Launch retro checkpoint: evidence bundle assembled, budgets/thresholds recorded as measured, PROGRESS + docs updated | T17 | 1 |

## 13. Parallelization

- Can run in parallel: qualification lanes **{T02+T03}** (a11y/copy — mobile-heavy), **{T04→T05→T06}** (security), **{T07}** (privacy/legal), **{T08}** (device perf), **{T09+T10+T11}** (load/reliability/DR — staging-infra-heavy), **{T12}** (admin) — they touch disjoint file sets and different environments; coordinate staging usage for chaos vs load windows.
- Must be serial: T01 first (frozen baseline); T13 after T09/T10 (tuning needs their data); T14 needs a11y + privacy outcomes; T15 independent but must precede T16; T16 → T17 → T18 strictly serial; any fix touching `packages/contracts`/`shared-kernel` is single-writer and sequenced per [15 §12.3](../15-team-workflow-and-ai-agent-operations.md).

## 14. Test-first plan (by module and level)

P14 runs the accumulated suites as release gates rather than writing new feature tests; new tests appear only as regression tests for qualification findings (fail-first rule).

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| all backend modules | Full suite re-run per module | Full pbt suites (units, taxonomy, ranking) | Full contract tier + stale-generation gate | Full integration incl. idempotency/DLQ suites; migration up/down on release candidate | API-level E2E nightly green |
| `recommendation` | — | Invariant suites | — | **Full simulation suite (N≥10,000): zero hard-constraint violations is a release gate** ([13 §11](../13-testing-quality-and-performance.md)) | Latency evidence per budget |
| Security | Regression tests for every pen-test/audit finding (fail-first) | — | — | Full `*.sec.test.ts` suite: authZ matrix, signed URLs, webhook replay, rate limits, deletion, redaction canary, hostile uploads, consent gating | Rotation + recovery drills (manual, documented) |
| `media`/`avatar`/`outfit` | — | — | Asset-manifest schemas | `just assets-validate` full pass | Golden full matrix; device-matrix perf runs with archived raw traces (no hand-summarized numbers) |
| Mobile (all features) | — | — | Client handshake | RNTL suites | Maestro six journeys on both platforms (nightly + pre-release tier); manual a11y checklist archived; battery/thermal sessions |
| Workers / ML | Full pytest | hypothesis suites | Schemathesis | Pipeline goldens | `just ml-eval` all suites incl. cost/latency gates at release-candidate model/prompt versions |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

This phase converts hypotheses to measured, ratified gates (DEC entries for each ratification/revision).

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Every row of [13 §12.1–12.2](../13-testing-quality-and-performance.md): cold start ≤ 4.0/2.5/1.8 s by tier, rec-request→render ≤ 3.5/2.5/2.0 s, 3D ≥ 30/60/60 fps, memory ≤ 700 MB low-tier 3D, app ≤ 150 MB target/200 MB cap, API p95 250 ms, availability ≥ 99.5 %, etc. | Device-matrix runs + k6 load tests, raw traces archived; dashboards |
| Cost | AI cost/user/mo within SPINE §6 anchors at beta traffic; per-plan guardrails quiet; infra within $60–85/mo launch fixed ([12 §7.4](../12-pricing-entitlements-and-unit-economics.md)) | Provider bills + `ai.cost_per_active_user`; server-provider invoice + R2/PostHog/Grafana usage pages |
| AI quality | All doc 10 eval thresholds green at RC versions; no slice regression ([13 §10](../13-testing-quality-and-performance.md)) | `just ml-eval` reports |
| Reliability | Crash-free sessions ≥ 99.5 % (gate); error budget 3.6 h/mo armed; RTO ≤ 4 h / RPO ≤ 24 h proven by drill; zero hard-constraint violations; deletion SLA 100 % | PostHog/Grafana; drill reports; simulation + auditor job |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): no new feature flags; expired-flag sweep executed (CI report clean — [14 §11](../14-observability-operations-and-analytics.md)); permanent kill-switch flags verified live; `staged-rollout` configuration is store-native, not a PostHog flag.
- Migration/backward-compatibility plan: release candidate carries no pending destructive migrations; store builds pinned to contract version; OTA policy honored (JS/assets only; native changes require full build — [15 §10](../15-team-workflow-and-ai-agent-operations.md)).
- Rollback plan (rehearsed in T15, executed if crash gate trips): halt staged rollout (Play console / iOS phased-release pause) → triage with runbook 9 → fix-forward via expedited build or OTA (JS-only fixes) → if server-side cause, revert deploy in Coolify (previous image) + `just db-rollback` only for contract-phase-safe migrations → post-incident review. Store rollback limitations documented honestly (Play allows halting, not un-shipping; iOS requires new build).

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); add phase-local ones there, not here.

- Risks in play: **RISK-09** (low-end Android performance — gate here), RISK-04 (store review outcome — final), RISK-12 (iOS CI lane during release), RISK-16 (team capacity — qualification workload), plus residual pen-test findings; OQ-01, OQ-08; LR-01/10/12.
- **Stop/kill criteria for this phase:**
  - Low-tier devices cannot hold ratified budget floors after the fix loop → **set a documented device floor + serve the non-3D experience below it** (RISK-09 criterion), log DEC — this unblocks launch, it does not kill it.
  - Any SEV1-class security finding (auth bypass, cross-user data access, S3 exposure) unfixed → **launch blocked**, no override.
  - Hard-constraint violation count > 0 in simulations or production traces → launch blocked until zero (invariant, [13 §11](../13-testing-quality-and-performance.md)).
  - Crash-free sessions below gate during staged rollout → **promotion halts automatically**; resume only after fix + fresh gate pass.
  - Store rejection on billing model → execute the P13/RISK-04 fallback (store-managed intro offer) and resubmit; log DEC.
  - Blocking legal-register item unresolved with counsel → geo-gate or disable the affected feature (e.g. A2 per RISK-07) rather than launching non-compliant.

## 18. Demo script

The P14 "demo" is the launch-readiness review, executed with the product owner on real hardware:

1. `just ci-parity` and the pre-release qualification tier green on the release candidate (show CI run).
2. On a **low-tier Android** device: full journey — onboarding → avatar → capture 3 items → recommendation with reasons → mark worn — within measured budgets (show live metrics overlay); repeat key steps with TalkBack and reduced motion; switch to non-3D mode and complete the same journey.
3. On an **iPhone**: purchase (sandbox → then a real staged-rollout build), restore on second device; VoiceOver pass of paywall.
4. Chaos: kill weather provider in staging → recommendation degrades with staleness warning; trip an AI kill-switch → G2 falls back to G0, credit not consumed; replay a RevenueCat webhook → no state change.
5. Deletion: delete a fully-populated staging account → show cascade completion evidence (zero orphan scan) and audit entries; run an export on a Free account.
6. Ops: trigger a test SEV2 page → show it reaching the on-call phone with runbook link; show restore-drill report (RTO/RPO measured); show alert-budget dashboard.
7. Store: show approved listings, privacy labels, staged-rollout config with crash-gate thresholds; then execute/verify staged rollout state (internal → beta cohort stats → production %).
8. Sign-off: walk the evidence bundle (§20) and the ratified-budgets DEC entries; product owner accepts launch.

## 19. Acceptance criteria

Objectively verifiable statements — no "works well".

- AC-1: The manual accessibility checklist ([13 §7](../13-testing-quality-and-performance.md)) is executed and archived for all six core journeys on both platforms with zero open blocker-severity findings; automated a11y checks green in CI; the non-3D alternative completes the onboarding→recommendation journey with equivalent information (automated presence check + manual run); ethics/copy audit checklist signed with zero violations of [11 §17](../11-security-privacy-and-compliance.md).
- AC-2: Device-matrix performance runs on low/mid/high iOS + Android record every [13 §12.1](../13-testing-quality-and-performance.md) metric with archived raw traces; every budget is met or its documented fallback is active and demonstrated; budgets + device floor (OQ-08) ratified via DEC entries. No fabricated numbers — evidence is the trace archive.
- AC-3: k6 load profiles pass with [13 §12.2](../13-testing-quality-and-performance.md) budgets held and bounded queues; SLO dashboards + error-budget burn alerts live; metric tree (NFR-OBS-100) complete with owner/source/privacy/target/decision per metric and guardrail alerts armed.
- AC-4: The six E2E journeys (onboarding, capture, recommendation, purchase/restore, deletion, degraded providers) pass in the pre-release tier on both platforms; state-coverage spot-audit (empty/loading/partial/failure/retry/recovery) finds no missing state in the core journeys.
- AC-5: The backup/restore drill is executed: pgBackRest PITR restore to a scratch host verified by the migration/invariant suite, R2 sample restore resolves manifests, post-restore re-deletion replay passes; measured RTO/RPO documented.
- AC-6: Full security suite green (authZ matrix, isolation, signed URLs, webhook replay, rate limits, deletion, redaction canary, hostile uploads, consent gating); pen-test complete with all high findings fixed (regression tests attached) and mediums owned with deadlines; threat-model re-review recorded; audit-trail query demo executed; moderation verified across upload + content pipelines.
- AC-7: All ten runbooks exist and are linked from their alerts; on-call rota live; a real test page was delivered and acknowledged; one incident drill completed with a blameless review artifact; secret-rotation drill completed.
- AC-8: Deletion of a fully-populated account leaves zero user-linked queryable artifacts outside the documented retained set (automated verification job output); retention jobs live with face data on the strictest schedule; export completes within the documented SLA on Free tier.
- AC-9: Privacy nutrition labels / Data safety forms submitted and consistent with actual data flows (LR-01 signed); analytics audit shows zero sensitive payloads; every P14-due legal-register item is closed or has a counsel-accepted disposition recorded; NFR-PRV-090 audit finds no prohibited feature/language.
- AC-10: Both store reviews passed; billing compliance checklist counter-signed (REQ-BIL-070); the shipped trial variant matches the OQ-02 decision.
- AC-11: Store CI/CD executed the full path (build → sign → TestFlight/Play internal → staged rollout) from CI; crash-gate thresholds configured and demonstrated (simulated breach halts promotion in a dry run); rollback rehearsal completed and documented.
- AC-12: Staged production rollout reached 100 % with crash-free sessions ≥ the ratified gate throughout, or is holding at a documented stage with an active fix plan (launch = phase `DONE` only at 100 % or an explicit product-owner-accepted stage).

## 20. Definition of done

Exact commands and evidence required:

```bash
just test                    # full suite, all modules, no skips
just lint && just typecheck  # clean
just arch-check              # module boundaries hold
just generate --check        # contracts fresh
just assets-validate         # full 3D asset gate
just ml-eval                 # all eval suites at RC versions, gates green
just security-scan           # clean
just ci-parity               # green
# phase-specific: pre-release qualification CI tier green; device-matrix perf
# artifacts archived; k6 reports; restore-drill report; pen-test report + fixes;
# manual a11y checklist archive; store review approvals; staged-rollout record
```

Evidence to attach/link: qualification evidence bundle — device trace archives, load-test reports, drill reports (restore, rotation, incident, recovery tabletop), pen-test report + regression tests, a11y checklist scans, ethics audit, legal-register dispositions, store approvals + labels, rollout timeline with crash-gate readings, ratification DEC entries. Never fabricated — every number traces to a stored artifact.

## 21. Documentation and PROGRESS.md updates

- Docs to update: [13 §12](../13-testing-quality-and-performance.md) budgets marked *measured* with values + dates; doc 16 — DEC entries for budget ratifications, device floor (OQ-08), name (OQ-01), store outcomes; doc 11 legal register statuses; doc 14 runbooks + on-call final; doc 12 `[VERIFY-P13]` closure notes; module contracts touched by fixes; brief-§14 audit re-run recorded in doc 01 terms.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence; the launch date and rollout state noted.

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md). Expected content: next phase is **P15 — Post-launch learning** (`phases/P15-post-launch-learning.md`, start at P15-T01 after ≥ 2 weeks of production data unless an incident forces earlier review; first command: `just doctor`, then open the metric-tree dashboards). Hand P15: the baseline metric readouts at launch, the list of "baseline first" metrics now collecting, deferred decide-by-data items (pricing experiments, notification defaults, over-cap behavior), and any rollout-stage residue or pen-test medium findings still on deadline.
