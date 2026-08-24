# P03 — Identity, Consent, Onboarding

> File name: `phases/P03-identity-consent-onboarding.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); "None" is written explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P03 — Identity, Consent, Onboarding
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Ship the walking skeleton end-to-end on real devices: create an account (age-gated), record consents, complete progressive onboarding (units, presentation, measurements, preferences), land on a functional home tab, export everything, delete everything — with the 3-day trial entitlement granted server-side at signup and lying dormant behind a flag until P13.
- **User-visible outcome:** A person can install the app, sign in with Apple/Google/passkey, walk the onboarding flow skipping anything optional, see and edit every collected field in settings, export their data as an archive, and delete their account with a verified cascade. Before P03 there is no product; after P03 there is a thin but complete one.
- **Why now:** This is the tracer bullet through every layer P02 built (mobile → contract → module → DB → outbox → job) and the foundation every later phase writes into (`identity` principals, consent gating, profile data, entitlement resolution). Consent and deletion must exist **before** any sensitive data phase (P05 face, P06 photos) — privacy is load-bearing, not retrofit.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-ONB-010 | Progressive onboarding; app useful before optional fields complete | AC-1 |
| REQ-ONB-020 | Height/weight metric + imperial, lossless conversion, canonical SI storage | AC-2 |
| REQ-ONB-030 | Only genuinely useful measurements — every field maps to a consumer | AC-2 |
| REQ-ONB-040 | Optional body-shape/fit/proportion/sizing/accessibility fields, skippable + editable | AC-1, AC-2 |
| REQ-ONB-050 | Presentation decoupled from base-mesh geometry | AC-1 |
| REQ-ONB-060 | Style preferences incl. hard exclusions distinct from soft dislikes | AC-2 |
| REQ-ONB-070 | Climate tolerance captured (consumed by engine in P09) | AC-2 |
| REQ-ONB-080 | Lifestyle/occasion presets, zero calendar permission in v1 | AC-1 |
| REQ-ONB-090 | No budget/shopping fields in v1 | AC-1 |
| REQ-ONB-100 | Locale, language, units, timezone, region, accessibility prefs stored + respected | AC-2 |
| REQ-ONB-110 | Required vs optional separation; inline "why we ask"; skip never blocks | AC-1 |
| REQ-ONB-120 | Consent, correction, export, deletion reachable from settings | AC-4, AC-5 |
| REQ-ONB-130 | Every journey defines empty/loading/partial/failure/retry/recovery states (P03 journeys) | AC-6 |
| NFR-SEC-020 | better-auth: Apple + Google + passkeys, SecureStore-only tokens, revocation | AC-3 |
| NFR-SEC-030 | AuthZ + strict user isolation on every endpoint (matrix suite starts here) | AC-3 |
| NFR-SEC-070 | Rate limits on auth/signup/recovery; account recovery without support intervention | AC-3 |
| NFR-PRV-020 | Granular, auditable, per-purpose consent registry; withdrawal halts processing | AC-4 |
| NFR-PRV-030 | Full machine-readable export, every tier | AC-5 |
| NFR-PRV-040 | Deletion cascades across DB/R2/providers with verification (first full run) | AC-5 |
| NFR-OBS-070 | Audit trail live for consent changes + deletion steps (admin/audit scope grows later) | AC-4, AC-5 |
| NFR-TST-020 | Property-based suites for units/measurements live in CI | AC-2 |
| NFR-TST-050 | First E2E journey (onboarding incl. consent) on both platforms in nightly tier | AC-6 |

Contributing (primary delivery elsewhere): NFR-PRV-010 (classification enforced in P03 schema review; ratified P00) · NFR-PRV-070 (age gate **enforced** at signup here; policy decided P00/OQ-03) · **REQ-BIL-010 seam** (trial granted server-side at signup here; user-visible trial UX + enforcement is P13) · REQ-BIL-040/REQ-BIL-130 seam (entitlements table + resolver exist; enforcement points activate P06+) · NFR-PRV-110 (analytics consent gate turns on here; taxonomy from P02).

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P02** ([SPINE §5](../SPINE.md)) — module skeletons, contracts pipeline, CI, observability, signed-URL skeleton, secrets.
- External blockers:
  - **LR-02, LR-03, LR-04, LR-07, LR-09** ([11 §12](../11-security-privacy-and-compliance.md)) are due at P03: consent-basis mapping, DPAs/transfer mechanisms, consent-record retention, analytics-consent defaults per jurisdiction, age-policy confirmation. They gate P03 **exit** (`DONE`), not entry; counsel was engaged in P00. If unresolved at exit time → `BLOCKED` naming the LR items.
  - Apple "Sign in with Apple" capability + Google OAuth credentials on the developer accounts (created in P02's store setup).
  - Product owner decisions consumed: OQ-03 outcome (age floor), DO-SEC-01 (launch without passwords if store review allows — decide here, log DEC), deletion grace-window duration ([02 §11.3](../02-user-journeys-and-information-architecture.md) open item — decide here, log DEC).

## 4. In scope / out of scope

**In scope:**
- `identity`: better-auth mounted in NestJS (Apple, Google, passkeys; email+password only if DO-SEC-01 decides so), Postgres session store, age gate at signup (16+ per OQ-03 pending LR-09), session rotation + reuse-detection revocation, device list + sign-out-all, account recovery per [11 §15](../11-security-privacy-and-compliance.md), rate limits per [11 §14](../11-security-privacy-and-compliance.md) (auth/signup/recovery buckets), consent registry (`consents` append-only, purposes per [11 §7.2](../11-security-privacy-and-compliance.md)) + `identity.consent.changed.v1` events, `identity.account.created.v1`, deletion request + grace window + `identity.account.deletion_requested.v1`.
- `profile`: measurements (SI-canonical values with unit/provenance/confidence per [06 §3.1](../06-data-api-and-event-contracts.md); plausibility bounds from [07 §3.3](../07-3d-avatar-and-garment-pipeline.md), validation symmetric, never silent clamping — conflicts surfaced), presentation + base-model selection (decoupled fields), fit preferences, style preferences incl. hard exclusions vs soft dislikes, climate tolerance, occasion presets, locale/units/timezone/region/accessibility settings, `profile.measurements.updated.v1`.
- `shared-kernel`: unit converters finalized + property-tested; measurement definitions + bounds registry; preference/climate enums; error codes for this surface.
- `billing` (seam only): `entitlements` table + resolver ([12 §3](../12-pricing-entitlements-and-unit-economics.md)); consumer of `identity.account.created.v1` writes the **trial grant** (Pro-level payloads, `expires_at = signup + 72h`, `source = trial_grant` per [12 §2](../12-pricing-entitlements-and-unit-economics.md)); expiry resolver behavior implemented; `GET /v1/me/entitlements`. **Dormant:** flag `entitlement-enforcement` (owner BE, expiry P13) stays **off** — nothing is gated yet, no paywall, no trial UI beyond a settings line; RevenueCat not integrated (P13).
- Deletion cascade v1 (Trigger.dev chain per [06 §8](../06-data-api-and-event-contracts.md) / [11 §13.2](../11-security-privacy-and-compliance.md)): sessions revoked → grace window → provider steps (PostHog deletion, push-token no-op), R2 prefix delete (empty now, mechanism verified), Postgres cascade from the FK map + coverage test, retained-records set, audit per step, completion verification. Export job v1: async ZIP (profile, measurements, preferences, consent history) via signed URL 24 h TTL, 1-concurrent limit.
- Mobile onboarding flow ([02 §3.2](../02-user-journeys-and-information-architecture.md) steps 1–9 + 11): welcome, sign-in + age gate, core consents (granular ones deferred to point of use), units/locale, presentation + base model, height/weight, additional measurements, fit/style preferences, lifestyle/occasions, first-capture nudge → lands on a stub Today tab (honest empty state; capture arrives P06). Step 10 (selfie offer) renders as a "coming soon"-free skip — the step simply doesn't exist until P05. Server-side per-step progress persistence + resume; idempotent writes (client `Idempotency-Key`).
- Settings baseline ([02 §11](../02-user-journeys-and-information-architecture.md)): privacy & consent toggles (analytics + notifications purposes now; face/location arrive with their features), profile view/edit/clear-field for every collected field, units/locale, accessibility (reduced motion, non-3D preference stored), data export, delete account (re-auth + grace + store-subscription caveat text), subscription section showing trial status line (read-only).
- Analytics consent gate ON + P03 event set (`onboarding_*`, `consent_updated`, `profile_measurements_saved`, `data_export_requested`, `account_deletion_requested` per [14 §9](../14-observability-operations-and-analytics.md)); audit trail for consent + deletion (NFR-OBS-070); observability additions (§11); A12 measurement (Neon cold starts vs API p95).

**Out of scope / non-goals for this phase:**
- Avatar rendering/derivation (P04) — base-model selection stores an ID only; selfie/face + `face_processing` consent surface (P05); capture/closet/media pipeline (P06); location consent + weather (P08 — manual-city groundwork only as a settings stub); notifications sending (P09; the consent purpose + preference storage exist now).
- Trial expiry UX, paywall, Free-tier limits, RevenueCat, credits → P13 (REQ-BIL-010/020 delivery). The grant machinery must not leak user-visible gating while `entitlement-enforcement` is off.
- Passwords/MFA UI beyond the DO-SEC-01 decision; cert pinning (P14 decision DO-SEC-02).
- Offline account **creation** (impossible by design — [02 §3.3](../02-user-journeys-and-information-architecture.md)).

## 5. Product/UX behavior

Full journey spec: [02 §3 (onboarding)](../02-user-journeys-and-information-architecture.md) and [02 §11 (settings/data)](../02-user-journeys-and-information-architecture.md); accessibility per [02 §13](../02-user-journeys-and-information-architecture.md). Phase-specific state decisions:

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Sign-in + age gate | Apple/Google/passkey → account + trial grant + consents in one round-trip sequence; under-age → clear refusal, no data stored | New device → provider buttons + restore-session | Provider failure → other providers offered + retry; age-gate refusal is terminal, not retryable-by-reentry (rate-limited) | Blocked with plain-language "account creation needs a connection" (only steps 2–3 require it) | Consent text is real text; full screen-reader labels; no timed steps |
| Onboarding steps 4–9 | Each step saves server-side; Continue advances; Skip equal-weight for optional steps | Fresh account defaults (device locale/units pre-filled) | Per-step write failure blocks only that step, retry w/ backoff; implausible measurement → inline unit-aware validation ("Did you mean 176 cm?"), never silent clamp (REQ-AVA-070 groundwork) | Steps 4–9 buffer locally, sync when online, flow says which step needs connection | Measurement inputs support switch access/keyboard; units announced with values; skip reachable by screen reader in consistent position |
| Resume after quit/crash | Relaunch → first incomplete required step, or Today if required set done | n/a | Progress persisted per completed step server-side; no step re-required | Resumes from local buffer; syncs on connect | Focus lands on resumed step heading |
| Stub Today tab | Honest empty state: value framing + "capture arrives" messaging; profile summary visible | That *is* the state until P06 | n/a | Renders offline | Empty state readable, single primary action |
| Settings: consent | Toggle purpose → confirmation of effect → append-only record + audit row; withdrawal halts dependent processing immediately | All optional purposes default off | Write failure → toggle reverts visually + retry notice (never silently divergent from server) | Reads cached; writes queue with pending badge | Each toggle states what it enables + date granted |
| Data export | Request → async job → notification + signed link (24 h) | No prior export → simple request button | Job failure → retry + support contact; 1-concurrent limit explained | Request queues; link needs connection | Announced completion; link activities labeled |
| Delete account | Re-auth → plain-language cascade preview + store-subscription caveat → grace window → cascade → confirm at request and completion | n/a | Cascade step failure → server-side retries, surfaced to admin; user promise (≤ 30 d SLA) monitored | Cannot be requested offline (re-auth) — screen says so | Destructive action: confirmation not color-only; ≤ 3 taps from settings to reach ([11 §17.8](../11-security-privacy-and-compliance.md)) |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); each touched module's contract file in `docs/modules/` is updated in the same PR as the change.

| Module | Change | Contract update needed? |
|---|---|---|
| `identity` | better-auth integration; users/sessions/consents tables; age gate; recovery; rate limits; deletion orchestration entry; events (`account.created`, `consent.changed`, `account.deletion_requested`) | Yes |
| `profile` | profiles/measurements/preferences tables; SI-canonical value objects; plausibility validation; settings services; `measurements.updated` event | Yes |
| `billing` | entitlements table + resolver; trial-grant consumer; `GET /v1/me/entitlements`; **no enforcement activated** | Yes |
| `shared-kernel` | unit converters + measurement bounds registry finalized; enums (climate tolerance, presentation, purposes); error codes (`AGE_GATE_FAILED`, `CONSENT_REQUIRED`, `MEASUREMENT_IMPLAUSIBLE`, …) | Yes |
| `admin` | `audit_log` table live (consent + deletion + entitlement-grant entries); deletion-status query for support (metadata only per [11 §4.4](../11-security-privacy-and-compliance.md)) | Yes |
| `platform` | PostHog deletion-API adapter; export-archive builder + R2 upload via `StorageProvider`; email adapter stub for deletion/export notifications | Yes |
| `notifications` | Preference storage only (per-category opt-in rows, quiet hours schema) — no sending yet | Yes |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`, per [06 §2](../06-data-api-and-event-contracts.md) conventions): better-auth surface under `/v1/auth/*`; `GET|PATCH /v1/me/profile`; `GET|PUT /v1/me/measurements`; `GET|PATCH /v1/me/preferences`; `GET|POST /v1/me/consents`; `GET /v1/me/entitlements`; `POST /v1/me/exports` + `GET /v1/me/exports/{id}`; `POST /v1/me/deletion` + `DELETE /v1/me/deletion` (grace-window cancel); `GET|PATCH /v1/me/onboarding-progress`. All mutating routes take `Idempotency-Key`; profile carries `version` + `If-Match`.
- Event schemas added/changed: `identity.account.created.v1`, `identity.consent.changed.v1`, `identity.account.deletion_requested.v1`, `profile.measurements.updated.v1` (payloads per [06 §4](../06-data-api-and-event-contracts.md) catalog); P02's `platform.demo.requested.v1` retired.
- DB migrations (Drizzle, one module per file per [06 §7](../06-data-api-and-event-contracts.md)): `00xx_identity_users_sessions_consents`, `00xx_profile_profiles_measurements_preferences`, `00xx_billing_entitlements`, `00xx_admin_audit_log`, `00xx_notifications_prefs` — all expand-phase additive, each with down path, tested forward+rollback on a Neon branch; deletion-cascade coverage test extended to every new user-FK table.
- Generated clients to regenerate: TS client + TanStack hooks (mobile), event TS types, Python models — `just generate` in the same PR as each spec change (staleness gate enforces).

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Onboarding flow (11 steps minus selfie), resume logic, settings baseline (consent/profile-edit/units/accessibility/export/delete/subscription-line), SecureStore session handling, consent-gated PostHog wiring, stub Today tab, error/empty/offline states per §5 |
| Backend | `identity`/`profile`/`billing`-seam/`admin`-audit services + controllers; rate limits; deletion + export Trigger.dev chains; authz matrix middleware conventions |
| Workers (ML/media) | None (no ML in P03) |
| Data / migrations | Five module migrations above; FK cascade map regeneration; seed personas (synthetic) for staging |
| Infrastructure | Apple/Google OAuth credentials into sops; email provider account (transactional) behind `platform` port; staging test accounts per [15 §11](../15-team-workflow-and-ai-agent-operations.md) |
| 3D / assets | None (base-model choice stores an ID; assets arrive P04) |
| Admin / internal tools | `audit_log` + deletion-status query endpoint (support role, metadata only) |

## 9. AI vs deterministic decisions

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Everything in P03 (auth, validation, conversion, consent, export, deletion) | **Deterministic** | Rules, schema validation, and unit math solve all of it reliably — the [10 §1](../10-ai-usage-cost-and-evaluation.md) "deterministic instead" class; measurement plausibility is bounds-checking, not inference | n/a | $0 product AI spend; any provider AI call in P03 is a defect (first product AI lands P06 per doc 10) |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11 §6](../11-security-privacy-and-compliance.md)): **S3** — body measurements, auth secrets/session tokens; **S2** — account email/name, preferences, style identity, consent records, locale/timezone. Schema review checks every new column against the classification table (NFR-PRV-010). No S3 value ever in logs/analytics/fixtures — redaction canary extended with measurement markers.
- Consent required / consent UI changes: consent registry live ([11 §7.1–7.2](../11-security-privacy-and-compliance.md)): `core_service` (contractual basis), `analytics` (off in GDPR/UK regions until opt-in per LR-07), `notifications` (off). `face_processing`, `location_precise`, `ai_generative`, `training_data` purposes exist in the registry enum but have **no UI until their features ship** — deferred-to-point-of-use per [02 §3.2](../02-user-journeys-and-information-architecture.md) step 3. Withdrawal emits `consent.changed` and halts dependent processing (analytics stop is testable now).
- Retention, deletion, and export impact: deletion cascade v1 + verification (retained set: consent + deletion-request records 3 y per LR-04, audit rows pseudonymized); export archive covers all P03 data; consent records append-only; session/idempotency TTLs enforced. Age gate: refused signups store nothing.
- Threat/abuse cases added to the threat model: account takeover controls (rotation reuse-detection, new-device notification, recovery delay per [11 §3.2/§15](../11-security-privacy-and-compliance.md)), signup/trial-recycling abuse (one trial per verified identity, heuristics per [12 §2](../12-pricing-entitlements-and-unit-economics.md) — best-effort, documented), enumeration resistance (uniform recovery responses, UUIDv7/ULID ids), deletion-during-takeover guard (grace window + cancel). **`security-privacy-review` skill run before merge** on auth, consent, and deletion PRs (CLAUDE.md rule).

## 11. Observability and analytics added in this phase

Per the [14 §15](../14-observability-operations-and-analytics.md) P03 row:

- Logs/metrics/traces: `auth.signin.failures`, `auth.ratelimit.hits`, `deletion.cascade.duration` / `deletion.cascade.incomplete` (alert: incomplete > 0 for > 24 h = SEV2), export SLA metric, `consent.changes` counter, entitlement-grant counter; traces across signup → outbox → trial-grant consumer and deletion chain; **A12 measurement:** API p50/p95 on profile CRUD under realistic idle patterns (Neon cold starts) vs the [13 §12.2](../13-testing-quality-and-performance.md) budget — outcome recorded (keep-warm decision if breached).
- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `onboarding_started/completed/step_skipped`, `consent_updated`, `profile_measurements_saved`, `data_export_requested`, `account_deletion_requested` — all consent-gated, enum/bool/bucket properties only (no measurement values).
- Alerts/dashboards/runbook entries: privacy-ops dashboard panels (deletion/export SLA, consent changes) started (dashboard 7 seed); auth-failure anomaly alert (SEV3); runbook #7 (deletion/export job failure) written; audit-log query demoed. Crash-reporting adequacy reviewed → **Sentry decision logged (DEC) at phase end** ([14 §1](../14-observability-operations-and-analytics.md)).

## 12. Ordered tasks

Small enough for one AI-assisted session each (~half-day). Task IDs `P03-T##` are referenced by handoff entries.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P03-T01 | `shared-kernel`: unit converters + measurement bounds registry + enums + error codes, with property tests (metric↔imperial round-trip, symmetric bounds) | — | 1 |
| P03-T02 | Contracts: author all §7 endpoints + the four event schemas; `just generate`; spectral/oasdiff green (single-writer task — lands before consumers) | P03-T01 | 2 |
| P03-T03 | `identity` core: better-auth mount (Apple/Google/passkey per DO-SEC-01 decision), Postgres sessions, age gate, `account.created` event + migration | P03-T02 | 2 |
| P03-T04 | `identity` hardening: session rotation + reuse revocation, device list/sign-out-all, recovery flow, rate limits + `*.sec.test.ts` | P03-T03 | 2 |
| P03-T05 | Consent registry: `consents` append-only + purposes, `consent.changed` event, audit rows, withdrawal-halts-processing wiring (analytics gate) | P03-T03 | 1 |
| P03-T06 | `profile`: schema + services (measurements w/ SI canonical + provenance + bounds validation, presentation/base-model, preferences incl. hard exclusions, settings values) + migration + unit/property tests | P03-T02 | 2 |
| P03-T07 | `billing` seam: entitlements table + resolver, trial-grant consumer of `account.created` (72 h Pro grant, `source=trial_grant`), `GET /v1/me/entitlements`, flag `entitlement-enforcement` off; idempotent grant (replay-safe) | P03-T02, P03-T03 | 1 |
| P03-T08 | AuthZ matrix harness: generated endpoint × principal (anon/userA/userB/support) suite over all §7 routes (NFR-SEC-030; the harness every later phase extends) | P03-T03…T07 | 1 |
| P03-T09 | Export job: Trigger.dev chain → ZIP (profile/measurements/preferences/consent history) → R2 signed link 24 h, 1-concurrent, notification stub | P03-T06, P03-T05 | 1 |
| P03-T10 | Deletion cascade v1: grace window + cancel, ordered chain per [06 §8](../06-data-api-and-event-contracts.md) (sessions → providers → R2 prefix → Postgres cascade → retained set → verification), per-step audit + idempotency, FK coverage test | P03-T09 | 2 |
| P03-T11 | Mobile: onboarding steps 1–5 (welcome, sign-in + age gate, core consents, units/locale, presentation + base model) with per-step server persistence + resume | P03-T02 (client), P03-T03, P03-T05 | 2 |
| P03-T12 | Mobile: onboarding steps 6–9 + 11 (height/weight, measurements, preferences, occasions, capture nudge) + stub Today tab; unit-aware inline validation UX | P03-T06, P03-T11 | 2 |
| P03-T13 | Mobile: settings baseline — consent toggles, profile edit/clear-field, units/accessibility, export, delete (re-auth + caveats), subscription trial line; consent-gated PostHog + P03 events | P03-T05…T07, P03-T09, P03-T10 | 2 |
| P03-T14 | Observability: §11 metrics/alerts/panels, deletion/export SLA wiring, A12 measurement run + record, runbook #7 | P03-T08…T10 | 1 |
| P03-T15 | E2E: Maestro onboarding journey (incl. consent choices, skip paths, resume-after-kill) + export + deletion flows on iOS and Android; nightly-tier wiring (NFR-TST-050) | P03-T11…T13 | 2 |
| P03-T16 | Close-out: LR-02/03/04/07/09 status verified (or `BLOCKED`); DO-SEC-01 + grace-window + Sentry DECs logged; device demo (§18) recorded; docs + PROGRESS + handoff | all | 1 |

## 13. Parallelization

- Can run in parallel (disjoint modules/files, one worktree per agent):
  - After T02 (contracts land first — single-writer): **{T03→T04→T05}** (`identity`) ∥ **{T06}** (`profile`) ∥ **{T07}** (`billing`).
  - Then **{T09→T10}** (jobs/platform) ∥ **{T11→T12}** (mobile onboarding) ∥ **{T13 prep}** — mobile consumes only the generated client, so it parallels backend once contracts are stable.
  - **{T08}** (authz harness) parallel with T09–T12 (test-only files).
- Must be serial: T01→T02 (kernel types feed contracts); T02 before every consumer (producers-before-consumers rule); T05 before T13's consent UI; T10 after T09 (deletion reuses export/R2 plumbing); T14 after the things it observes; T15→T16 last. `packages/contracts` + `shared-kernel` changes mid-phase are sequenced, never parallel (CLAUDE.md single-writer rule).

## 14. Test-first plan (by module and level)

Tooling per [13 §3](../13-testing-quality-and-performance.md); every feature lands test-first in its module's `tests/`.

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `shared-kernel` | converter/bounds units | **fast-check:** metric↔imperial round-trip within tolerance; validation accepts plausible range, rejects implausible symmetrically; no NaN/negative escapes (NFR-TST-020) | enums referenced by contracts stay in sync | — | — |
| `identity` | age-gate logic, session policy | consent registry append-only invariant (withdrawal = new record, history preserved) | auth + consent endpoints vs OpenAPI; event payloads vs schemas | Testcontainers: signup→trial-grant outbox flow; rotation-reuse revocation; rate-limit 429s; **sec suite:** authz matrix, recovery uniformity, consent-gating fail-closed | Maestro: sign-in, age-gate refusal |
| `profile` | validation messages, unit display | stored canonical value invariant under unit switching | profile/measurements/preferences endpoints vs OpenAPI; `If-Match` conflict behavior | CRUD + version conflicts on Testcontainers | Maestro: steps 4–9 incl. skip + resume |
| `billing` | resolver most-generous-wins; expiry resolution | grant resolution deterministic for any grant set | entitlements endpoint vs OpenAPI | replayed `account.created` → exactly one grant (idempotency) | settings trial line visible |
| `platform`/jobs | archive builder | — | export archive JSON schema | export job idempotency; **deletion cascade:** seeded account across all modules → zero non-retained rows/objects remain, idempotent + resumable mid-cascade ([13 §8.1](../13-testing-quality-and-performance.md)) | export + delete Maestro flows |
| `admin` | — | — | audit-row shape | append-only audit assertions; support-role metadata-only access in authz matrix | — |
| Mobile | step view-models, validation UX | — | generated-client handshake | RNTL flows w/ MSW: resume, offline buffering, consent toggles | **Maestro on both platforms, nightly tier**: full onboarding incl. kill-resume; redaction canary on mobile logs |

New bug fixes require a regression test that fails before the fix (failing run pasted in PR).

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | API CRUD p50/p95/p99 ≤ 80/250/600 ms ([13 §12.2](../13-testing-quality-and-performance.md), first real measurement — **A12** incl. Neon cold-start idle patterns); onboarding blocking calls < 2 s each ([02 §3.3](../02-user-journeys-and-information-architecture.md)); 5xx ≤ 0.5% | `api.request.duration` panels over the E2E + k6 smoke; results recorded in doc 13 with hypothesis labels flipped |
| Cost | Infra stays within the ~$35/mo envelope with real (team+beta) signups; transactional email in free tier | Provider billing screenshots at phase end |
| AI quality | n/a — no AI in P03 | n/a |
| Reliability | Deletion cascade completion 100% within SLA in tests (prod SLA ≤ 30 d, typical ≤ 8 d); export job success ≥ 99% in staging soak; signup→trial-grant loss rate 0 across outbox chaos tests | deletion/export SLA metrics + outbox suite runs |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): `entitlement-enforcement` (**off**; owner BE lead; expiry: P13 activation — permanent-until-P13, listed in registry with rationale); `onboarding-v1` rollout flag (owner MOB lead, expiry 30 d post-P03) for internal→beta staging of the flow. Flags gate rollout only — never entitlement semantics ([14 §11](../14-observability-operations-and-analytics.md)).
- Migration/backward-compatibility plan: all migrations expand-phase additive; `/v1` additive-only holds (oasdiff gate); mobile skeleton (P02) keeps working against the P03 API (spec-version handshake test). Trial grants written from P03 remain valid rows P13 reads — no re-grant migration later.
- Rollback plan: deploy rollback = code-first (expand-phase schema supports N−1); `just db-rollback` proven per migration on staging; `onboarding-v1` flag off returns internal builds to the P02 placeholder (safe-off verified); deletion/export jobs are idempotent — a rolled-back deploy mid-cascade resumes without duplication. Destructive rollback of user-holding tables is prohibited without human authorization (CLAUDE.md).

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); phase-local ones are added there, not here.

- Risks in play: **RISK-07** (compliance groundwork — consent registry correctness), **RISK-11** (better-auth self-hosting patch burden — Clerk fallback documented), **RISK-16** (capacity). Assumptions under test: **A12** (Neon cold starts within API budget), **ASM-10** (users grant data given honest consent UX — first funnel data from beta signups), **ASM-06** (cadence).
- **Stop/kill criteria for this phase:**
  - A12 fails (API p95 over budget from cold starts after tuning) → execute the recorded fallback: Neon keep-warm compute floor or Railway Postgres ([05 §8](../05-technology-decisions.md)); log DEC. Do not silently raise the latency budget.
  - LR-02/07/09 unresolved at exit → phase goes `BLOCKED` (not `DONE`) naming the items; no sensitive-data phase (P05/P06) may start meanwhile.
  - better-auth reveals a security defect without timely upstream fix → stop, assess Clerk fallback per RISK-11, ADR before proceeding.
  - Onboarding-completion beta funnel signals are collected but **not** a kill gate here (baseline-first per [00 §8.1](../00-product-vision-and-scope.md)).

## 18. Demo script

Exact steps proving the vertical slice end-to-end on a real device (fresh install, staging backend):

1. Install the internal build (iOS TestFlight or Play internal). Launch → welcome.
2. Sign in with Apple (or Google on Android). Enter an under-age birth year → refusal screen, nothing stored (show empty users table for that attempt). Re-attempt with a valid year → account created.
3. Show server state: `entitlements` row with Pro-level trial grant, `expires_at` +72 h, `source=trial_grant`; settings show the trial line; **no paywall anywhere** (flag off).
4. Accept core consents; decline analytics → show PostHog receives **zero** events; flip analytics on in settings → `consent_updated` appears; audit row visible.
5. Walk steps 4–9: switch imperial→metric on height (5′10″ ↔ 177.8 cm shown losslessly); enter an implausible weight → inline unit-aware validation; skip measurements step entirely; set a hard exclusion (wool) and climate tolerance.
6. Force-kill the app mid-flow → relaunch → resumes at the first incomplete required step; previously entered data intact.
7. Finish → stub Today tab with honest empty state. Open You → Profile: every field visible, edit one, clear one.
8. Airplane mode: edit a preference → pending badge; reconnect → syncs; server value updated.
9. Settings → Data → Export → job completes → open the signed link → ZIP contains profile/measurements/preferences/consent history JSON.
10. Settings → Delete account → re-auth → cascade preview incl. store-subscription caveat → confirm. Sign in during grace window → cancel offer shown. Re-request, let the (staging-shortened) window lapse → show verification: zero user rows outside the retained set, R2 prefix empty, PostHog deletion issued, audit chain complete.

## 19. Acceptance criteria

Objectively verifiable statements — no "works well".

- AC-1: Maestro run (both platforms, archived) completes onboarding twice: (a) skipping every optional step — reaching the Today tab having entered only the required set {sign-in, age, core consents, units, presentation/base-model}; (b) filling everything. Zero calendar/budget/shopping fields exist anywhere (`grep` over contracts + mobile source clean); every optional field edited later from settings in the same run; each sensitive field shows its inline "why we ask" (screenshot set).
- AC-2: `just test shared-kernel profile` green including property suites; entering 5′10″ then switching units shows 177.8 cm with the stored canonical value unchanged (assertion in test + demo step 5); every measurement field in the contract maps to a named consumer in [doc 03](../03-domain-model-and-glossary.md)/[07 §3.3](../07-3d-avatar-and-garment-pipeline.md) (review-checklist cross-walk in the PR); hard exclusions stored distinctly from soft dislikes (schema assertion); all six locale/settings values persist and are respected by formatting (tests).
- AC-3: security suite green: authz matrix covers 100% of P03 endpoints (a new uncovered endpoint fails CI); user B cannot read/write any user A row (isolation tests); tokens present only in SecureStore (repo lint + device check — no AsyncStorage/API persistence of tokens); rotated-refresh reuse revokes the session family (test); rate limits return structured 429s on auth/signup/recovery drives; recovery flow completes without support intervention on a real device; age gate blocks signup below the OQ-03 floor storing nothing (test asserts empty tables).
- AC-4: consent registry: append-only proven (withdrawal creates a record, history retained); declining analytics results in zero PostHog events during a full instrumented session (captured network log); granting emits taxonomy-valid events only; every consent change writes an audit row (query pasted); withdrawal halts dependent processing in the integration test (NFR-PRV-020 fail-closed check).
- AC-5: deletion-cascade test: account seeded with data in every P03 module + an R2 object + PostHog stub → cascade → zero remaining user-linked artifacts outside the documented retained set; idempotent + resumable mid-cascade; grace-window cancel works; export produces a machine-readable archive containing all P03 data classes, on a signed 24 h URL, works for any account state (NFR-PRV-030/040). SLA metrics + alert live (screenshot).
- AC-6: the six P03 journey surfaces each demonstrate empty/loading/partial/failure/retry/recovery/offline per §5 (Maestro + RNTL coverage map linked; failure+retry covered in E2E per REQ-ONB-130); onboarding E2E runs in the nightly tier on both platforms (CI links).
- AC-7: trial seam: replaying `identity.account.created.v1` produces exactly one grant (idempotency test); `GET /v1/me/entitlements` returns the Pro trial payload pre-expiry and Free resolution post-expiry (clock-advanced test); with `entitlement-enforcement` off, no P03 surface denies anything (sweep test) — REQ-BIL-010's P13 delivery finds the grant machinery already proven.
- AC-8: A12 recorded: API p50/p95 on profile CRUD with realistic idle gaps measured and pasted into [doc 13 §12.2](../13-testing-quality-and-performance.md) (pass, or the keep-warm DEC logged); `just ci-parity` green on the final commit.

## 20. Definition of done

Exact commands and evidence required:

```bash
just test identity profile billing admin platform   # scoped suites, no skips
just test                                           # full suite green
just lint && just typecheck && just arch-check      # clean (boundaries hold)
just generate --check                               # contracts fresh
just security-scan                                  # green
just db-migrate && just db-rollback                 # each P03 migration proven on Neon branch
just ci-parity                                      # exact PR gate, locally green
# nightly tier run link with the onboarding E2E green on iOS + Android
```

Evidence to attach/link: Maestro recordings (both platforms), demo-script video or annotated screenshot set (§18), authz-matrix + deletion-cascade + redaction-canary test outputs, PostHog consent-gate network capture, A12 latency panels, audit-log queries, LR-item status notes — real outputs only, never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: module contracts for all seven touched modules (`docs/modules/`); [doc 16](../16-risks-open-questions-and-decision-log.md) (DECs: DO-SEC-01, grace-window duration, Sentry decision, A12 outcome; LR statuses); [doc 13 §12.2](../13-testing-quality-and-performance.md) (measured API latencies); [doc 14](../14-observability-operations-and-analytics.md) (dashboard-7 seed + runbook #7 links); [doc 11](../11-security-privacy-and-compliance.md) (consent-registry implementation notes, any threat-model deltas); [doc 02 §15](../02-user-journeys-and-information-architecture.md) open items resolved.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence; `ACCEPTED` (by a different session or the PO re-running §18) unblocks P04, P06, P08, and P13's dependency line.

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md).

Next session starts: with P03 `ACCEPTED`, three phases unblock — **P04** (needs P01 GO + P03; start at P04-T01, measurement→morph mapping over the now-real `profile` data), **P06** (needs P03 only; start at P06-T01, media pipeline state machine), **P08** (needs P03 only). Pick per PROGRESS.md priority note (default: P04 if P01 was GO, else P06). First command in any case: `just doctor && just ci-parity`, then read the target phase file + its module contracts. Open threads to carry: LR-05/LR-06 must be closed **before P05 ships** (RISK-07); `entitlement-enforcement` stays off until P13; trial grants in staging accumulate — expiry resolver behavior is already live, verify test accounts reflect it.
