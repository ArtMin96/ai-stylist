# 14 — Observability, Operations, and Analytics

**Status:** Draft for ratification · **Date:** 2026-08-24 · **Conforms to:** [SPINE.md](SPINE.md)
**Owns:** logging architecture (redaction *rules* owned by [11 §8](11-security-privacy-and-compliance.md)), tracing, metrics catalog, crash reporting, dashboards/alerts/on-call, runbooks, incident review process, product analytics event taxonomy, audit trails, feature-flag policy, backup/restore + DR, support/admin tooling minimum, per-phase observability rule.
**Requirement IDs delivered:** `NFR-OBS-*` (defined in [01-requirements-and-traceability.md](01-requirements-and-traceability.md)).
**Error budgets / perf thresholds:** numbers live in [13 §12](13-testing-quality-and-performance.md); this doc wires them to dashboards and alerts.

---

## 1. Stance

Two–three developers operate this system. Observability must be **cheap to run, honest, and quiet**: few tools, aggressive redaction, alerts only for things a human must act on. Every phase ships the observability for what it introduces (§15) — no "instrument it later."

**Tooling (per [r4](research/r4-backend-providers.md) + SPINE):**
- **PostHog** — product analytics, error tracking, session replay (mobile, off by default and consent-gated), feature flags.
- **OpenTelemetry SDK** everywhere for traces/metrics/logs — vendor-neutral instrumentation is the commitment; the export target is swappable.
- **Pragmatic trace/metric backend at launch:** OTel → **Grafana Cloud free tier** (Tempo traces, Prometheus-style metrics, Loki logs). Chosen over self-hosting (ops burden for 2 devs) and over PostHog-only (PostHog is not a distributed-tracing backend). Confirmed as **ADR-OBS-01 in P02**; fallback if free-tier limits bite: self-hosted Grafana stack on the Hetzner path.
- **Sentry (optional):** enable for RN crash symbolication only if PostHog error tracking proves insufficient for native crashes (decision point end of P03; keep the seam — crash reporter behind one init module).
- Railway/Neon/Cloudflare/Trigger.dev built-in dashboards are supplements, not the system of record.

## 2. Structured logging

- JSON logs everywhere (NestJS via pino; Python via structlog; Trigger.dev tasks via its logger + OTel bridge).
- **Required fields:** `ts`, `level`, `service`, `module`, `correlation_id`, `user_id` (pseudonymous id only), `event` (stable snake_case name), `duration_ms` where applicable, `job_id`/`trace_id` when in a job/request.
- **Correlation IDs:** minted at the mobile client per logical operation (UUIDv7), sent as `x-correlation-id`, propagated through API → outbox events → Trigger.dev jobs → Python workers → provider calls (as our own metadata, never as user data). One capture-to-catalog flow is traceable end-to-end by one ID.
- **Redaction enforced by the logger, not by discipline:** serializer allowlist per log schema — only declared fields are emitted; denylist backstop drops keys matching the forbidden list in [11 §8](11-security-privacy-and-compliance.md) (tokens, image data, measurements, coordinates, calendar text, emails, prompt payloads).
- **Forbidden-field lint (CI):** ESLint/Ruff rules ban `console.*`, logging of `req.body`/`request.json()` wholesale, and any identifier matching the forbidden-field patterns inside logging calls. The runtime canary test lives in [13 §8.1](13-testing-quality-and-performance.md).
- Retention: 30 d hot, 90 d archived (S1 data per 11 §6). Log access is itself restricted (logs are internal data, but treated as if a leak is possible — hence redaction at source).

## 3. Tracing

- OTel auto-instrumentation: NestJS HTTP + Drizzle/pg spans; fetch/undici spans for provider calls (URL path only, no query strings — signed URLs contain credentials); FastAPI + httpx on workers; manual spans around pipeline stages (validate, strip, segment, classify) and recommendation stages (context, candidates, score, validate).
- **Async continuity:** trace context serialized into outbox event envelopes and Trigger.dev payloads (`traceparent` field in the shared event envelope, `shared-kernel`), so a trace covers API request → enqueue → job → worker → completion webhook. Where a hard boundary breaks the trace, span links + the correlation ID recover the story.
- Span attributes carry ids and enums only — the same redaction rules as logs apply (no payloads).
- Sampling: 100% at launch volumes; head-sampling down (keep all errors + slow traces) when volume demands — revisit at 5k users.

## 4. Metrics catalog

Namespace `stylist.*`; all metrics tagged `service`, `env`, and where relevant `module`, `provider`, `job_type`, `tier` (entitlement plan — for cost attribution, never for content). Budgets/thresholds referenced from [13 §12](13-testing-quality-and-performance.md).

| Metric | Type | Notes / alert link |
|---|---|---|
| `api.request.duration` (route, status) | histogram | p50/p95/p99 vs 13 §12.2; A-2 |
| `api.request.errors` (route, class) | counter | 5xx rate → error budget §12, A-1 |
| `queue.depth` (queue) | gauge | bounded-queue check; A-4 |
| `queue.job.age_oldest` (job_type) | gauge | 13 §12.2 job-age budget; A-4 |
| `queue.job.completions` / `failures` / `retries` / `dlq` (job_type) | counter | DLQ > 0 → A-3 |
| `pipeline.stage.duration` (stage) | histogram | capture→catalog budget |
| `pipeline.quarantine.count` (reason) | counter | abuse signal (11 §5.5); spike → A-6 |
| `provider.call.duration` / `errors` / `timeouts` (provider) | histogram/counter | per-port; failure rate → A-3 |
| `provider.circuit.state` (provider) | gauge | context providers degrade gracefully (doc 09) |
| `cache.hit_ratio` (cache: context, signed-url, cdn, prompt-cache) | gauge | 13 §12.2 CDN target |
| `reco.request.duration` / `reco.validity_rate` / `reco.no_valid_outfit.count` | histogram/gauge/counter | validity = share passing final validation; **hard-constraint violation count must be 0 — any >0 is A-1** (engine must fail closed; metric exists to prove it) |
| `reco.feedback.count` (kind) | counter | feeds doc 09 eval metrics |
| `asset.3d.load_failures` (asset_type, tier) | counter | 3D asset failure metric; A-5 |
| `asset.render.first_render_ms` (device_tier) | histogram (mobile) | 13 §12.1 |
| `mobile.cold_start_ms` / `mobile.frame_drop_rate` (screen) | histogram | perf budgets; sampled, consented clients only |
| `billing.webhook.lag` / `billing.reconciliation.drift` | histogram/gauge | drift = entitlement rows disagreeing with RevenueCat at daily reconcile; drift > 0 sustained → A-2 |
| `billing.credits.consumed` (op) | counter | metering integrity (doc 12) |
| `ai.call.count` / `ai.tokens` / `ai.cost_usd` (task, model, provider) | counter | rolls up to **`ai.cost_per_active_user`** (gauge, daily) — guardrail from doc 12/[r3](research/r3-ai-providers-costs.md); breach → A-2 |
| `ai.fallback.count` / `ai.invalid_output.count` (task) | counter | eval-gate online counterpart (13 §10) |
| `auth.signin.failures` / `auth.ratelimit.hits` (limit) | counter | 11 §14; anomaly → A-6 |
| `deletion.cascade.duration` / `deletion.cascade.incomplete` | histogram/gauge | incomplete > 0 for > 24 h → A-2 (privacy SLA, 11 §13) |
| `consent.changes` (purpose, direction) | counter | audit complement (§11) |
| `ci.pr_gate_duration` / `ci.flake_rate` | histogram/gauge | 13 §1, §13 |

## 5. Crash reporting

- **Mobile:** PostHog error tracking (JS) + native crash capture; source maps/dSYMs uploaded from EAS/CI per release. If native symbolication is inadequate → Sentry per §1 decision. Crash reports scrubbed: no screenshots, no view hierarchies containing user content, breadcrumbs limited to event names.
- **Backend/workers:** unhandled exceptions → PostHog error tracking with trace_id link; panics in jobs also surface as DLQ entries (§4).
- **Crash-free-sessions** is a release-gate metric (staged rollout halts below threshold — rollout policy in doc 15 §10; hypothesis ≥ 99.5%, ratified in P14).

## 6. Dashboards

Grafana (launch set — each phase adds its panel, §15):
1. **Service health** — API latency/errors, availability vs error budget burn (§12).
2. **Pipelines** — queue depth/age, per-stage durations, DLQ, quarantine, provider failures.
3. **Recommendation** — latency, validity rate, no-valid-outfit rate, feedback mix, engine version distribution.
4. **AI cost & quality** — cost/user/day by task+model, cache hit rates, fallback + invalid-output counts.
5. **Billing** — webhook lag, reconciliation drift, credits, entitlement changes.
6. **Mobile vitals** — crash-free, cold start, frame drops, 3D failures by device tier (PostHog + Grafana).
7. **Privacy ops** — deletion/export SLAs, consent changes, admin access counts (feeds the audit review, §10).

## 7. Alerts and on-call for two developers

**Reality:** no 24/7 rotation. Honest model: **best-effort out-of-hours**, strict in-hours response, and an **alert budget**.

- **Severity ladder:**
  - **SEV1 (page, any hour):** API hard-down > 5 min; data-exposure signal (11 §16); auth bypass indicator; hard-constraint violation count > 0; entitlement grants failing globally. Target ack 30 min.
  - **SEV2 (page in waking hours 08–23 local, else morning):** error-budget fast burn; DLQ growth; billing reconciliation drift; deletion SLA breach; AI cost guardrail breach; provider outage with failed fallback. Ack 4 h in-hours.
  - **SEV3 (ticket, no page):** single-provider degradation with working fallback, flake-rate rise, cache-ratio drop, slow-burn budget consumption. Reviewed next working day.
- **Alert budget:** ≤ 2 pages/week rolling average. Exceeding it triggers a mandatory tuning session — noisy alerts get fixed or demoted; an alert nobody acts on is deleted. Every page must map to a runbook (§9); an alert without a runbook cannot ship.
- **Quiet hours:** 23:00–08:00 local — only SEV1 pages. Store-release weeks may temporarily promote SEV2 to full paging (release-gate checklist, doc 15).
- Rotation: weekly primary swap between the two devs; vacation = documented degraded mode (SEV1 only, longer ack targets) — pretending otherwise would be fiction.
- Delivery: Grafana alerting → push/phone escalation app; provider status webhooks ingested (Railway, Neon, Cloudflare, Trigger.dev, fal.ai status pages).

## 8. Runbooks and incident reviews

**Runbook list (each ships with the phase that creates the risk; stored in `planning/runbooks/` → repo `docs/runbooks/` at implementation):**
1. API down / Railway incident (failover options, status comms).
2. Neon incident + PITR restore (with post-restore re-deletion replay, 11 §13.3).
3. R2/CDN incident (asset serving degradation, signed-URL fallback).
4. Queue stuck / DLQ drain / poison-message isolation.
5. Provider outage: weather/holiday (serve cached context facts with freshness warning), AI providers (fallback chain per doc 10), RevenueCat (entitlement grace behavior).
6. Security incident (expands 11 §16: containment commands, secret-rotation order, evidence preservation).
7. Deletion/export job failure (privacy-SLA recovery).
8. Billing reconciliation drift investigation.
9. Mobile bad release (halt staged rollout, OTA-fix constraints, store expedite request).
10. AI cost runaway (kill-switch flags per task, cap enforcement).

**Incident reviews:** blameless, within 5 working days for SEV1/SEV2, using the incident-review template — canonical file `templates/incident-review.md` (to be added to the templates set; sections: summary, timeline, impact incl. users/data affected, detection gap, root causes, what went well, action items with owners+deadlines, regression test added per 13 §1). Action items land in the tracker, not the document.

## 9. Product analytics event taxonomy

Rules: PostHog only; **consent-gated** (`analytics` purpose, 11 §7.2 — no events before opt-in where required; pseudonymous `user_id`; **no sensitive payloads ever** — no free text, no measurements, no image data, no city names (region bucket only), no calendar data. Properties are enums/booleans/counts/ids. New events require review against this table (schema in `packages/contracts` so mobile/backend can't drift); the forbidden-field lint applies to analytics calls too (§2).

Core events (~30, launch set — names are canonical `snake_case`):

| Event | Key properties | Phase |
|---|---|---|
| `onboarding_started` / `onboarding_completed` | `steps_completed`, `duration_bucket` | P03 |
| `onboarding_step_skipped` | `step` | P03 |
| `consent_updated` | `purpose`, `granted` (bool) | P03 |
| `profile_measurements_saved` | `fields_count`, `units` | P03 |
| `avatar_created` | `base_model`, `capability` (A0/A1/A2) | P04 |
| `avatar_calibration_adjusted` | `params_changed_count` | P04 |
| `avatar_pose_changed` | `pose_id` | P04 |
| `selfie_face_enrolled` | `capability: A2`, `quality_bucket` | P05 |
| `selfie_face_removed` | — | P05 |
| `capture_started` | `mode` (single/batch) | P06 |
| `item_captured` | `mode`, `retake_count` | P06 |
| `item_processing_completed` | `duration_bucket`, `auto_category_confidence_bucket` | P06 |
| `item_processing_failed` | `stage`, `reason_code` | P06 |
| `item_attributes_corrected` | `fields_corrected_count`, `field_types` | P06 |
| `item_view_replaced_with_real` | `view` | P11 |
| `closet_search_used` | `filter_types`, `result_count_bucket` | P07 |
| `item_availability_changed` | `state` (SPINE §8 enum) | P07 |
| `collection_created` | `type` | P07 |
| `context_location_mode_set` | `mode` (manual_city/coarse_geo) | P08 |
| `context_override_applied` | `fact_type` | P08 |
| `recommendation_requested` | `trigger` (daily/future_day/occasion), `context_kinds`, `closet_size_bucket` | P09 |
| `recommendation_shown` | `engine_version`, `alternatives_count`, `confidence_bucket`, `had_missing_data_note` (bool) | P09 |
| `recommendation_feedback` | `kind` (like/dislike/too_warm/too_formal/…), `scope` (outfit/item) | P09 |
| `outfit_saved` / `outfit_worn` | `source` (recommended/manual) | P09 |
| `item_replaced_in_outfit` | `slot` | P09 |
| `never_pair_rule_created` | — | P09 |
| `outfit_rendered_on_avatar` | `mode` (G0/G2), `poses_viewed_count` | P10 |
| `tryon_generated` | `type` (tryon/missing_view), `latency_bucket`, `provenance_shown: true` | P11 |
| `trend_item_viewed` / `trend_item_hidden` | `content_type`, `reason_shown` (bool) | P12 |
| `paywall_viewed` | `surface`, `trial_state` | P13 |
| `subscription_started` / `subscription_restored` | `plan`, `period` | P13 |
| `credits_exhausted_prompt_shown` | `op` | P13 |
| `data_export_requested` / `account_deletion_requested` | — | P03 |

Funnels/metrics built on these (owners in doc 00 metric tree): time-to-first-value, capture funnel, recommendation acceptance, trial→paid conversion.

## 10. Audit trails (append-only, `admin` module owns `audit_log`; 11 §4.4)

Audited with actor, target, reason, timestamp, before/after refs (ids, not payloads):
- **Admin access:** every support/moderator/break-glass read or write of user data (break-glass additionally pages the other dev).
- **Consent changes:** every grant/withdrawal with policy version (mirrors the consent registry, 11 §7.1).
- **Deletions:** deletion/export requests, each cascade step, completion verification (11 §13).
- **Recommendation versions:** engine rule/model version activations and rollbacks — required to reproduce any past recommendation (doc 09).
- **Entitlement changes:** grants, revocations, plan changes, credit adjustments, reconciliation corrections, manual overrides (doc 12).
- Also: feature-flag changes (§11), secret rotations (11 §5.3), moderation decisions (11 §16).
Retention: 2 years; user-targeted entries pseudonymized on account deletion (11 §13.2). Quarterly audit review: scan admin-access log for anomalies (privacy-ops dashboard §6.7).

## 11. Feature-flag policy (PostHog flags)

Every flag declares at creation: **owner** (a person), **purpose**, **expiry date** (≤ 90 d for rollout flags; permanent flags must be reclassified as entitlements or config), **rollout plan** (default staged: internal → 5% → 25% → 100% with metric guardrails named per flag), **rollback** = flag off must always be safe (no flag whose "off" state is broken).
- Flags are **not** entitlements: paid capability gating uses the server-side entitlements table (SPINE, doc 12); flags gate rollout/experiments only. A flag check on a premium feature sits *behind* the entitlement check, never instead of it.
- Expired flags fail a weekly CI report; > 30 d overdue = defect with owner. Flag changes in prod are audited (§10).
- Kill-switch flags (per AI task, per provider, per pipeline) are permanent operational flags, exempt from expiry, listed in runbook 10 (§8).
- Experiments must not touch deterministic safety constraints (brief §3.3): the engine's hard-constraint layer is not flag-gated or experimented on, enforced by module boundaries + simulation gate (13 §11).

## 12. Error budgets

Availability target 99.5% monthly (hypothesis, 13 §12.2) ⇒ budget 3.6 h/mo. Burn-rate alerts: fast burn (>14× over 1 h) = SEV2 page; slow burn (>2× over 24 h) = SEV3. Budget exhausted ⇒ feature freeze on the affected service until reliability work restores headroom (policy, enforced by the two of us honestly — it only works if written down, so it is). Same mechanism for recommendation-validity and crash-free-session budgets once ratified in P14.

## 13. Backup, restore, disaster recovery

- **Neon:** PITR window per plan (7–30 d) is the primary DB recovery; weekly logical dump (pg_dump) to a separate R2 bucket (different credentials than app storage) for provider-failure independence. RPO: ≤ 24 h (dump) / minutes (PITR); RTO hypothesis: ≤ 4 h — proven, not asserted, via drills.
- **R2:** originals bucket with object versioning + 30 d retention on deletes (aligned with the deletion caveat 11 §13.3 — versions of deleted users' objects are purged by the cascade's verification step after the window); derived assets are reproducible from originals (lineage, doc 07) so they are *not* backed up — the reprocessing path is the recovery.
- **Config/infra:** Terraform state + Railway/Cloudflare config exported; secrets inventory (11 §5.3) means rotation, not recovery, of secrets.
- **Restore drill cadence: quarterly**, verification assertions owned by [13 §9](13-testing-quality-and-performance.md); drill freshness is a pre-release gate item. DR scenario doc (region loss, provider account loss) = runbooks 1–3 (§8).

## 14. Support and admin tooling (minimum viable, `admin` module)

Launch set (P13/P14): account lookup by email/id (metadata only — role limits per 11 §4.4); subscription/entitlement state + reconcile-now button; job/pipeline state per user with retry/requeue; moderation queue (11 §16); deletion/export status + manual re-trigger; audit-log viewer; flag dashboard (PostHog). Explicit non-goals at launch: in-app support chat, CRM — email support with templates (doc 15 owns support workflow).

## 15. Per-phase observability rule (binding)

**A phase is not done until the capability it introduces is observable and operable** (brief §7; phase Definition-of-Done sections reference this doc):
- P02: logging/OTel/PostHog skeleton, correlation IDs end-to-end, dashboards 1, CI metrics, redaction lint live.
- P03: auth metrics, consent audit trail, analytics consent gate + first events, deletion/export SLA metrics.
- P04–P05: 3D asset failure + render metrics, avatar events; face-processing audit + deletion verification metrics.
- P06–P07: pipeline dashboard 2, queue/DLQ alerts, quarantine metrics, capture funnel events.
- P08: provider-port metrics, circuit-state, context cache/freshness metrics.
- P09–P10: dashboard 3, validity/violation metrics (violation alert **on before launch of the engine**), engine-version audit.
- P11: AI cost dashboard 4 fully live, invalid-output/fallback metrics, kill-switch flags.
- P12: ingestion job metrics, content-provenance audit.
- P13: billing dashboard 5, reconciliation-drift alert, entitlement audit, paywall funnel.
- P14: alert-budget tuning, error-budget ratification, on-call rota live, all runbooks written, restore drill #1 executed.
- P15: calendar-context minimization metrics (11 §7.6) if/when built.

---

**Cross-references:** redaction rules → [11 §8](11-security-privacy-and-compliance.md) · security/deletion/consent mechanics → doc 11 · budgets/thresholds & drill verification → [13 §12/§9](13-testing-quality-and-performance.md) · AI cost model → [doc 10](10-ai-usage-cost-and-evaluation.md)/[doc 12](12-pricing-entitlements-and-unit-economics.md) · rollout/release gates & support workflow → [doc 15](15-team-workflow-and-ai-agent-operations.md).
