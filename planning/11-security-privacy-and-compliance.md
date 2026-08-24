# 11 — Security, Privacy, and Compliance

**Status:** Draft for ratification · **Date:** 2026-08-24 · **Conforms to:** [SPINE.md](SPINE.md)
**Owns:** threat model, abuse cases, authN/authZ design, encryption & key management, data classification, consent registry, logging redaction rules, privacy/regulatory mapping, legal-review register, age policy, export/deletion flows, incident response, abuse prevention, product-ethics rules.
**Requirement IDs delivered:** `REQ-SEC-*`, `REQ-PRV-*` (defined in [01-requirements-and-traceability.md](01-requirements-and-traceability.md)).
**Security tests that verify this design:** [13-testing-quality-and-performance.md](13-testing-quality-and-performance.md) §8. **Audit trails, alerting, and monitoring:** [14-observability-operations-and-analytics.md](14-observability-operations-and-analytics.md).

> **NOT LEGAL ADVICE.** Every statement in §9–§12 about GDPR, UK GDPR, CCPA/CPRA, biometric laws, the EU AI Act, app-store policy, or age rules is an engineering-planning interpretation and **requires qualified legal review** before launch. All such items are collected in the legal-review register (§12). Do not treat this document as compliance sign-off.

---

## 1. Security posture and principles

The app handles data most products never touch: body measurements, selfies and face-derived geometry, location, and a longitudinal record of what a person owns and wears. Principles, in priority order:

1. **Minimize first.** Don't collect it, don't derive it, don't retain it unless a shipped feature needs it. On-device processing preferred (SPINE: on-device background removal, on-device face landmarks).
2. **Consent is per-purpose and revocable**, never bundled (§7).
3. **Least privilege everywhere** — per-user isolation in every query, scoped tokens, admin RBAC, provider keys with minimal scopes.
4. **Sensitive data never leaves controlled paths**: no sensitive payloads in logs (§8), analytics ([14 §9](14-observability-operations-and-analytics.md)), crash reports, prompts to AI providers beyond what the privacy review allows (SPINE AI data policy), or test fixtures (13 §2).
5. **Deletion is a product feature** with a verifiable cascade (§13), not a support ticket.
6. **Honesty over polish**: provenance markers on generated content, confidence indicators, no "exact digital twin" claims (SPINE §10.5).

## 2. Threat model (STRIDE-lite, by asset)

Scope: mobile apps (iOS/Android), NestJS API on Railway, Python ML workers, Trigger.dev jobs, Neon Postgres, Cloudflare R2/CDN, third-party providers (fal.ai, LLM APIs, RevenueCat, PostHog, Open-Meteo, Nager.Date).

Threat classes per asset (S=Spoofing, T=Tampering, R=Repudiation, I=Information disclosure, D=Denial of service, E=Elevation of privilege). Sensitivity classes are defined in §6.

| Asset | Class | Top threats | Primary mitigations (owning section) |
|---|---|---|---|
| **Selfies & face-derived geometry** | S3 | I: leak via public URL, provider retention, logs. S: enrolling someone else's face. T: swapping face assets between accounts. | Signed short-lived URLs (§5.4); private-by-default R2 buckets; provider privacy review + no-training contracts (SPINE AI data policy); explicit consent gate (§7); self-capture attestation + moderation (§3.1); per-user object key namespace + authz checks (§4.3); log redaction (§8); deletion cascade (§13). |
| **Body measurements** | S3 | I: exposure via API over-fetch, analytics, logs. T: another user modifying profile. I: inference exposure (e.g., surfacing weight in UI copy sent to push). | Field-level API contracts (no measurement fields in list endpoints); user-isolation middleware (§4.3); redaction lint (§8); measurements never in push payloads or analytics events (14 §9); at-rest encryption (§5.2). |
| **Location (weather context)** | S2–S3 | I: precise location stored or logged; correlation over time builds a movement profile. | Coarse-by-default design (§7.4): city-level geocode or manual city entry; precise coordinates never persisted server-side, only rounded (~0.1°) for the weather call; freshness-limited `context_facts` cache; no location in analytics. |
| **Wardrobe items & wear history** | S2 | I: scraping a user's closet (what they own, brands, value); T: cross-user item injection; I: inventory reveals income/religion/size — treat as personal data. | User isolation (§4.3); rate limits + enumeration-resistant IDs (UUIDv7, no sequential IDs in URLs) (§14); signed media URLs (§5.4); export limited to account owner (§13). |
| **Auth tokens & sessions** | S3 | S: token theft (device, MitM, backup extraction); E: session fixation, refresh-token replay. | SecureStore/Keystore only (§4.2); TLS 1.2+ with cert pinning consideration (§5.1); short-lived sessions + rotation (§4.2); token revocation on password/passkey change; device list + remote sign-out (§15). |
| **Entitlements & generative credits** | S1 | T/E: client-side tampering to unlock paid features; credit fraud via replayed webhooks or refund abuse; D: credit-draining automation. | Server-side entitlements table as sole source of truth (SPINE; [12-pricing-entitlements-and-unit-economics.md](12-pricing-entitlements-and-unit-economics.md)); RevenueCat webhook signature verification + idempotency keys + reconciliation job; server-side metering of every generative call; rate limits (§14); entitlement changes audited (14 §10). |
| **Media pipeline (uploads, derived assets)** | S2–S3 | T: malicious file upload (polyglot, decompression bomb); I: EXIF GPS leakage; D: pipeline flooding. | Upload restrictions + scanning (§5.5); EXIF stripping before storage of derivatives (SPINE §3.5 pipeline); quarantine state in the media state machine (owned by [07-3d-avatar-and-garment-pipeline.md](07-3d-avatar-and-garment-pipeline.md)); per-user upload quotas (§14). |
| **Admin surface & audit data** | S3 | E: support tooling used to browse user media; R: untraceable admin actions. | Admin RBAC + step-up auth (§4.4); admin access to user media is break-glass, logged, and alerting (14 §10); audit log append-only. |
| **Secrets & provider keys** | S3 | I: key leakage via repo, logs, mobile bundle; E: pivot to providers. | No secrets in the mobile bundle (all provider calls server-side except on-device ML); platform secret manager + rotation (§5.3); secret scanning in CI ([15-team-workflow-and-ai-agent-operations.md](15-team-workflow-and-ai-agent-operations.md)). |
| **Backups & database** | S3 | I: backup exfiltration; T: restore of tampered snapshot. | Neon-managed encrypted storage + PITR (14 §13); access to production DB restricted to named accounts with MFA; restore drills verify integrity (13 §9). |

**Trust boundaries:** device ↔ API (TLS, authenticated); API ↔ Postgres/R2 (private networking / scoped credentials); API/worker ↔ AI providers (data leaves our control — governed by §7.5 and the SPINE AI data policy); API ↔ RevenueCat/PostHog (webhooks in, minimal data out). A Mermaid trust-boundary diagram belongs in [04-architecture.md](04-architecture.md); this doc owns the threat table only.

## 3. Abuse cases

Each abuse case gets an automated security test in 13 §8 where testable.

### 3.1 Unauthorized face creation & processing another person's images
- **Abuse:** enrolling a selfie of someone who is not the account holder (ex-partner, celebrity, minor); uploading closet photos that are actually photos of other people.
- **Controls:** (a) selfie capture defaults to live front-camera flow with capture-time attestation; gallery upload allowed but flagged for stricter checks; (b) single-face requirement — multi-face images rejected; (c) explicit consent copy states the face must be the user's own, recorded in the consent registry (§7); (d) face assets are bound to one account and never comparable/searchable across accounts — **we do no cross-user face matching, ever** (also keeps us out of "identification" use; see §11); (e) moderation queue for reported likeness misuse with fast takedown (§16); (f) apparent-minor detection on selfies routes to rejection + guidance (§10).
- **Honest limitation:** we cannot cryptographically prove the selfie is the account holder. Controls reduce, not eliminate, misuse; recorded as risk R-SEC-face-misuse in [16-risks-open-questions-and-decision-log.md](16-risks-open-questions-and-decision-log.md).

### 3.2 Account takeover
- **Abuse:** credential stuffing, OAuth token theft, recovery-flow abuse, session replay from a stolen device backup.
- **Controls:** better-auth with Apple/Google sign-in and passkeys preferred over passwords; rate-limited + breached-password-checked email/password if enabled; MFA available; sessions stored only in SecureStore/Keystore (excluded from cloud backup extraction paths); refresh rotation with reuse detection → full session revocation; sign-in from new device triggers notification; recovery flow in §15.

### 3.3 Scraping and enumeration
- **Abuse:** harvesting user closets, media URLs, or trend content; enumeration of user/item IDs.
- **Controls:** all reads authenticated + user-scoped (no public profile surface at launch); UUIDv7 identifiers; signed media URLs expire in minutes (§5.4); per-user and per-IP rate limits with anomaly alerts (§14, 14 §7); fashion-intel content served under its licensing constraints (sourcing/licensing owned by the `fashion-intel` subsystem, P12; risk tracked as RISK-03 in [16-risks-open-questions-and-decision-log.md](16-risks-open-questions-and-decision-log.md)).

### 3.4 Credit and billing fraud
- **Abuse:** replaying RevenueCat webhooks, refund-then-keep-credits, trial recycling via account churn, client patching to skip entitlement checks.
- **Controls:** webhook signature verification + idempotent event processing + daily reconciliation (doc 12 owns the billing lifecycle); credits debited server-side atomically with job enqueue, refunded only on verified job failure; trial granted server-side once per verified store identity/device heuristic (limits documented in doc 12, flagged as best-effort); all premium operations re-check entitlements server-side — the client is untrusted.

### 3.5 Content abuse via uploads
- **Abuse:** uploading illegal content, malware, or non-clothing imagery into the closet pipeline; poisoning try-on generation with disallowed content.
- **Controls:** §5.5 upload restrictions + scanning; generative requests constrained to the user's own processed closet items + own avatar (no arbitrary prompt-to-image surface); provider safety filters retained; moderation + quarantine (§16).

### 3.6 Denial of wallet
- **Abuse:** automation drives expensive AI calls (classification, try-on) to inflate our provider bills.
- **Controls:** server-side metering, per-user daily caps even on paid tiers (doc 12), queue-level backpressure, cost anomaly alerts (14 §4: AI cost per active user).

## 4. Authentication, authorization, and isolation

### 4.1 Authentication (better-auth, self-hosted — SPINE ratified)
- Sign-in methods at launch: **Sign in with Apple, Google Sign-In, passkeys; email+password optional** (decision DO-SEC-01 for P03: prefer launching without passwords if store review allows — record outcome in the decision log).
- MFA (TOTP) available for email/password accounts; passkeys/OAuth treated as inherently phishing-resistant.
- better-auth runs inside the NestJS `identity` module; session store in Postgres. Anonymous/pre-account browsing is out of scope: account creation is required before any sensitive data is collected (trial starts at account creation, per SPINE §5).

### 4.2 Sessions on device
- Tokens stored **only** in `expo-secure-store` (iOS Keychain / Android Keystore-backed EncryptedSharedPreferences). Never in AsyncStorage, Redux persistence, or files.
- Keychain items marked non-synchronizable and `WhenUnlockedThisDeviceOnly`-class accessibility; Android keys hardware-backed where available.
- Short-lived access token (~15 min) + rotating refresh token; reuse of a rotated refresh token revokes the whole session family.
- Session lifetime cap (e.g., 90 days sliding) — hypothesis, tune in P03. Sign-out clears SecureStore and revokes server-side. "Sign out all devices" in settings.

### 4.3 Authorization and user isolation
- Single-tenant-per-user model: **every table owning user data carries `user_id`; every repository method takes the authenticated principal and filters by it.** No repository API accepts "fetch by id" without a user scope, enforced by convention + the authz matrix test suite (13 §8.1).
- Cross-user access is impossible through public module APIs by construction; internal admin paths go through `admin` module with RBAC (§4.4).
- Media isolation: R2 object keys are namespaced `u/<user_id>/...`; signed URLs are minted only after the same user-scope check as the DB row (§5.4).
- Future chat (`assistant`) calls the same application services under the same principal — no privileged bypass (SPINE §3 dependency rules).

### 4.4 Admin RBAC
- Roles: `support` (metadata-only: account state, subscription state, job states — **no media, no measurements**), `moderator` (moderation queue: reported/quarantined media only), `engineer-oncall` (break-glass full read with reason string, time-boxed), `owner` (role management).
- Admin auth: separate better-auth surface, hardware-key/passkey MFA required, IP allowlist where practical, sessions ≤ 8 h.
- Every admin read/write of user data is written to the append-only audit log with actor, reason, target, timestamp (14 §10); break-glass access pages the other developer.

## 5. Encryption, keys, secrets, media protection

### 5.1 In transit
- TLS 1.2+ (1.3 preferred) for all client↔API, API↔provider, API↔DB (Neon requires TLS) traffic. HSTS on API domains. Mobile: certificate transparency respected; full cert pinning is a P14 decision (pinning vs. update-agility trade-off — decision DO-SEC-02).

### 5.2 At rest
- Neon: encrypted at rest (managed). R2: encrypted at rest (managed). Device: sensitive local caches (avatar params, measurements cached offline) stored via encrypted storage (SecureStore for small secrets; SQLCipher/encrypted MMKV for structured offline data — implementation choice in P03).
- Application-layer encryption of face-geometry blobs (envelope encryption, key in the platform KMS/secret manager) is a P05 decision (DO-SEC-03): default **yes** for face landmark/geometry data, because it is the highest-sensitivity derived asset.

### 5.3 Key management & secret rotation
- Secrets live in the platform secret manager (Railway environment secrets + Cloudflare API tokens), never in Git; `.env.example` only (doc 15).
- Inventory of secrets with owner + rotation period maintained in the ops runbook (14 §8): provider API keys (90 d), R2 signing credentials (90 d), better-auth signing secret (180 d, with dual-secret rollover), webhook signing secrets (on provider rotation), DB credentials (Neon role rotation, 180 d).
- Rotation must be exercised, not just documented: one rotation drill in P14 hardening (13 §8.2).
- CI secrets scoped per-lane (iOS signing certs only in the macOS lane — doc 15).

### 5.4 Signed, short-lived media URLs
- All user media in **private** R2 buckets. No public bucket for user content, ever.
- Reads: presigned GET URLs, TTL **≤ 10 minutes**, minted per-object after an authz check; the mobile app treats URLs as ephemeral and re-requests on expiry. CDN caching only on non-user (app/content) assets.
- Writes: presigned PUT/multipart URLs, TTL ≤ 15 minutes, constrained to content-type allowlist, max size, and the caller's own key namespace.
- Signed-URL authz is covered by dedicated security tests (13 §8.1) including the "signed URL of user A used by user B after account deletion" case.

### 5.5 Upload restrictions and content scanning
- Accepted types: JPEG/PNG/HEIC (photos); size cap ~20 MB pre-processing; dimension caps; magic-byte validation server-side (never trust extension/Content-Type); image decode in a sandboxed worker step with decompression-bomb limits.
- Pipeline order (state machine owned by doc 07): upload → hash → **validate/scan → quarantine on fail** → EXIF/GPS strip → normalize → segment → classify. Nothing downstream touches an unscanned original.
- Content scanning: (a) malware/format scan; (b) NSFW/abuse classification on originals before generative use (provider-side safety + a cheap classifier — exact model chosen in P06, recorded in [10-ai-usage-cost-and-evaluation.md](10-ai-usage-cost-and-evaluation.md)); (c) apparent-minor check on selfies (§10). CSAM detection/reporting obligations: legal-review item LR-11.

## 6. Data classification

Classes: **S0** public · **S1** internal/low (pseudonymous operational data) · **S2** personal (identifiable, non-special) · **S3** sensitive personal (special-category-adjacent, biometric-adjacent, or high-harm-on-breach).

| Class | Examples | Retention | Deletion | Access audit |
|---|---|---|---|---|
| **S0** | App content, licensed trend content, category taxonomy | Indefinite | n/a | none |
| **S1** | Pseudonymous analytics events (consented, no payloads — 14 §9), job/queue metadata, aggregated metrics, reason-code statistics | 12 mo (analytics), 90 d (job metadata) | Auto-expiry; user-id unlinking on account deletion | none |
| **S2** | Account email/name, preferences, style identity, closet items + attributes + wear history, saved outfits, city-level location, subscription state, consent records* | Life of account | Full cascade on account deletion (§13); consent records* retained 3 y post-deletion as compliance evidence (LR-04) | Admin reads audited |
| **S3** | Selfies, face landmarks/geometry, face-personalized avatar assets, body measurements, precise coordinates (transient only), auth secrets, raw ID-provider tokens | Life of consent (face data also auto-deleted if consent withdrawn — §7); precise coordinates: **never persisted**; originals of failed/quarantined uploads: 30 d then purge | Hard delete within 30 d of request incl. derived assets + provider-side (§13); backup caveat applies (§13.3) | Every access audited; break-glass only for engineers |

Rules: (1) a datum's class travels with it — derived data inherits the max class of its inputs (face-personalized avatar = S3); (2) S3 never appears in logs, analytics, crash reports, support tooling, or AI prompts outside the reviewed providers list; (3) fixtures and eval datasets use synthetic or explicitly consented data only (13 §2, doc 10).

## 7. Consent registry and privacy choices

### 7.1 Consent registry design (`identity` module owns `consents`)
Each consent record: `user_id`, `purpose` (enum below), `policy_version` (points at a versioned policy document), `status` (granted/withdrawn), `granted_at`, `withdrawn_at`, `surface` (which screen), `locale`. Append-only — withdrawal is a new record, giving a full history. Consent changes are audited (14 §10) and emitted as events so dependent processing halts (outbox pattern, doc 06).

### 7.2 Consent purposes (per-purpose, never bundled)
| Purpose key | Gates | Default |
|---|---|---|
| `core_service` | Account, profile, closet processing needed to deliver the product (contractual basis — LR-02) | Required to use app |
| `face_processing` | Selfie capture, face landmark extraction, A2 face personalization | **Off**; explicit opt-in with dedicated screen (biometric-class consent, §11/LR-05) |
| `location_precise` | One-shot device geolocation for weather (coarsened before use) | **Off**; manual city is the default path |
| `analytics` | Product analytics events (14 §9) | Off in GDPR/UK regions until opted in; jurisdiction handling = LR-07 |
| `ai_generative` | G2 try-on / missing-view synthesis (sends processed images to fal.ai-class providers) | Off; opt-in at first use with provider disclosure |
| `notifications` | Push (also OS-level permission) | Off |
| `calendar` *(future, P15)* | Calendar-derived context | Off; see §7.6 |
| `training_data` | Use of user data to improve our own models/evals | **Off. Default is NO training use**; only explicit, separate, revocable opt-in (SPINE AI data policy) |

### 7.3 Per-integration consent & disclosure
The settings screen lists each third-party processor per purpose (e.g., `ai_generative` → fal.ai; `analytics` → PostHog) with a plain-language description of what is sent. Adding a new provider to a purpose requires a privacy review (checklist in §7.5) and a policy-version bump; materially different processing requires re-consent.

### 7.4 Location: coarse by default
- Default: **manual city entry** (typeahead against an offline city gazetteer) — no device location permission requested at onboarding.
- Optional: "use my location" does a one-shot coarse fetch; coordinates are rounded to ~0.1° (≈11 km) client-side before transmission, geocoded to city, and **only the city + rounded coords** are stored as a `context_fact` with freshness metadata (`context` module). No background location, no location history, no movement inference. Weather calls to Open-Meteo use rounded coords only.

### 7.5 Provider privacy review checklist (gate for any provider touching S2/S3)
Data categories sent · retention at provider · training use (must be contractually excluded for S3) · sub-processors · region of processing · deletion API / SLA · DPA availability · breach notification terms. Results recorded per provider in doc 10 (AI providers) / [05-technology-decisions.md](05-technology-decisions.md); face/body media may go **only** to providers passing this review (SPINE).

### 7.6 Calendar minimization (future, P15 — design constraint now)
When calendar context ships: process only start/end time, coarse event type, and dress-code-relevant keywords **transiently**; derive a typed `context_fact` (e.g., `occasion=business_dinner`, confidence, expiry); **never store raw event titles, descriptions, attendees, or locations server-side**. Raw calendar text is a forbidden log field from day one (§8) so the rule is enforced before the feature exists.

## 8. Logging redaction rules (canonical — referenced by doc 14)

**Never loggable (forbidden fields — enforced by the logger and a lint, see 14 §2):**
- Photos or any image bytes/base64; media URLs with live signatures (log object key hashes instead).
- Auth material: passwords, session/access/refresh tokens, OAuth tokens, webhook signatures, API keys, signed-URL query strings.
- Raw body measurements and face geometry values (log presence/counts/validation results, not values).
- Precise coordinates; log city-level only.
- Raw calendar text (future-proofing, §7.6).
- Full names/emails outside the `identity` module's own audit records; elsewhere log `user_id` only.
- AI prompt/response payloads containing user data; log prompt-template id + token counts + model version instead (doc 10 owns AI observability details).

**Mechanism (implementation in 14 §2):** central logger with schema-based allowlist serialization (only declared fields are emitted), a forbidden-key denylist as backstop, CI lint banning `console.*` and raw `req.body` logging, and a canary test that plants marker values and asserts they never reach the log sink (13 §8.1).

## 9. Regulatory mapping — GDPR/UK GDPR and CCPA/CPRA *(requires qualified legal review — see §12)*

| Obligation | Our mechanism |
|---|---|
| Lawful basis per purpose (Art. 6; Art. 9 where special-category — face data likely qualifies) | Consent registry purposes (§7.2); `core_service` on contract basis; `face_processing` on explicit consent — basis mapping is LR-02/LR-05 |
| Transparency (Art. 13/14) | Layered privacy notice, per-purpose consent screens, per-integration disclosure (§7.3) |
| Access / portability (Art. 15/20; CCPA right to know) | Self-serve export (§13.1) |
| Rectification (Art. 16) | All profile/measurement/attribute data user-editable; correction flows in [02-user-journeys-and-information-architecture.md](02-user-journeys-and-information-architecture.md) |
| Erasure (Art. 17; CCPA deletion) | Deletion cascade incl. provider-side (§13.2); backup caveat disclosed (§13.3) |
| Restriction / objection (Art. 18/21) | Per-purpose consent withdrawal halts processing (§7.1); personalization reset (doc 09) |
| Records of processing (Art. 30) | Processing-activity register maintained alongside this doc (P00 deliverable) |
| DPIA (Art. 35) | Face processing + measurements likely trigger a DPIA → LR-06, due before P05 ships |
| Processors & transfers (Art. 28, Ch. V) | DPAs with Neon, Cloudflare, Railway, PostHog, RevenueCat, AI providers; transfer mechanism review = LR-03 |
| Breach notification (Art. 33/34; state laws) | Incident response §16 includes the 72-hour assessment step |
| CCPA/CPRA "sale/share" | We do not sell/share personal data for cross-context advertising; verify PostHog config keeps it that way → LR-08 |
| UK GDPR divergences | Tracked under LR-02 |

## 10. Age policy

**Decision (needs legal confirmation — LR-09): 16+ at launch; no minors under 16, and no users under 18 for `face_processing` in jurisdictions where biometric consent by minors is restricted — simplest launch rule: 16+ for the app, with counsel to confirm whether face features need 18+ anywhere.**
- Enforcement: age gate at signup (self-declared birth year — industry-standard but weak; stronger verification only if counsel requires); store age ratings set accordingly; apparent-minor detection on selfies rejects the image with guidance (§3.1); no marketing to minors.
- If counsel requires a different floor (13 with parental consent under COPPA-style regimes is explicitly **not** planned), that is a product change routed through the decision log.

## 11. Biometric / face data and EU AI Act *(requires qualified legal review)*

- **BIPA-class laws (Illinois BIPA, Texas CUBI, Washington, and newer state laws):** face landmarks/geometry likely constitute "biometric identifiers" even without cross-user identification. Plan assumes BIPA-grade handling **nationwide**: written/electronic informed consent before capture (dedicated `face_processing` consent with retention schedule shown), published retention & destruction schedule (delete on withdrawal, account deletion, or 3 years of inactivity — whichever first), no sale/lease/trade of biometric data, no profit from it beyond the service itself. → LR-05.
- **Our strongest structural mitigation:** we never compare face data across users and never use it for identification/authentication — it exists solely to render the user's own avatar (A2). This framing matters legally but **must be validated by counsel**, not assumed.
- **EU AI Act awareness note:** the recommendation system is a limited-risk AI system (transparency obligations: users are told they interact with AI-driven recommendations — already core UX). Face-avatar generation is not biometric *categorisation* or *identification* as designed, and we must keep it that way (no emotion inference, no attribute inference from faces beyond rendering). GPAI obligations fall on our model providers, but deployer duties (transparency, human oversight, logging) apply to us. Classification and obligations → LR-10. Any future feature that infers characteristics from face/body images must pass AI-Act review before design.
- **App-store disclosures:** Apple Privacy Nutrition Labels and Google Play Data safety must declare: health-adjacent body data? (measurements — check taxonomy mapping), photos, coarse location, identifiers, purchase history, and third-party sharing per §7.3. Apple's rules on face data in apps (permission strings, no silent capture) apply. Draft labels are a P14 deliverable; accuracy review → LR-01.

## 12. Legal-review register (single table; all items block the phase listed)

| ID | Item | Sections | Needed by | Status |
|---|---|---|---|---|
| LR-01 | App-store privacy label accuracy (Apple nutrition label, Play Data safety) | §11 | P14 | Open |
| LR-02 | GDPR/UK GDPR basis mapping per purpose; UK divergences | §9, §7 | P03 | Open |
| LR-03 | International transfer mechanisms + DPAs for all processors | §9 | P03 | Open |
| LR-04 | Consent-record retention post-deletion (evidence vs. erasure tension) | §6, §13 | P03 | Open |
| LR-05 | BIPA-class compliance for face landmarks/geometry; consent wording; retention schedule | §11 | **P05 (blocks selfie feature)** | Open |
| LR-06 | DPIA for face processing + measurements | §9 | P05 | Open |
| LR-07 | Analytics consent defaults per jurisdiction (ePrivacy/cookie-law analogues in apps) | §7.2 | P03 | Open |
| LR-08 | CCPA/CPRA sale/share classification of PostHog/RevenueCat data flows | §9 | P13 | Open |
| LR-09 | Age policy 16+ confirmation; whether face features need 18+ anywhere | §10 | P03 | Open |
| LR-10 | EU AI Act classification + deployer obligations | §11 | P14 | Open |
| LR-11 | CSAM scanning/reporting obligations for user uploads by region | §5.5 | P06 | Open |
| LR-12 | Wardrobe/wear history as inferable sensitive data (religion via garments etc.) — disclosure wording | §6 | P14 | Open |

## 13. Export and deletion

### 13.1 Export (always available, all tiers — SPINE §6)
Self-serve, async job: ZIP with machine-readable JSON (profile, measurements, preferences, closet items + attributes, outfits, wear history, consent history, recommendation history with reason codes) + original media files the user uploaded + generated assets marked with provenance. Delivered via signed URL (24 h TTL), notification on completion. Rate-limited (1 concurrent export). Export contains **only the requesting user's data**; tested in 13 §8.1.

### 13.2 Account deletion cascade
Ordered, resumable job (Trigger.dev, idempotent steps, each step audited):
1. Immediate: sessions revoked; account flagged `deleting` (login blocked); 7-day grace window with cancel option (guards against takeover-driven deletion; user informed).
2. Cancel store subscription linkage (RevenueCat subscriber deletion API); entitlements tombstoned.
3. Provider-side deletion: PostHog person deletion API; any AI-provider stored artifacts (design goal: **zero** — providers are chosen for zero/short retention, so this step is verification, not cleanup); push tokens removed.
4. R2: delete all objects under `u/<user_id>/` including derived assets, thumbnails, export bundles; verify by listing.
5. Postgres: hard-delete user-owned rows across all modules (FK cascade map owned by [06-data-api-and-event-contracts.md](06-data-api-and-event-contracts.md)); S1 analytics/job metadata unlinked (user_id nulled) rather than deleted where aggregate integrity requires.
6. Retained: consent + deletion-request records (compliance evidence, LR-04), financial transaction records required by tax law, audit-log entries (user_id pseudonymized).
7. Completion: audit event `account.deleted`, verification job re-scans for orphans; target completion ≤ 30 days, typical ≤ 8 days (grace + processing).

Face-consent withdrawal without account deletion runs steps 3–5 scoped to face assets only (selfies, landmarks, A2 avatar assets; avatar reverts to generic face).

### 13.3 Backup caveat (disclosed in the privacy notice)
Deleted data may persist in point-in-time-recovery windows and backups until they age out: Neon PITR window (7–30 d depending on plan) and any R2 versioning/backup copies (14 §13). We do not restore deleted users from backups; the restore runbook (14 §8) includes a re-deletion step replaying deletion requests after any restore. Disclosure wording → included in LR-02.

## 14. Rate limits and abuse prevention

Defaults (hypotheses; tune with real traffic, enforced at API gateway/middleware + per-user in Postgres/Redis-if-added):
- Auth: 5 failed sign-ins / 15 min / identity; 3 recovery attempts / h; signup 10 / day / IP.
- Uploads: 60 images / h / user (batch capture peak), 500 / day; 2 concurrent processing pipelines per free user.
- Generative (G2/missing-view): entitlement-metered (doc 12) **plus** hard cap 30 / day / user anti-runaway.
- Reads: 600 req / min / user general; export 1 concurrent; deletion 1 / 30 d.
- Global: per-IP limits, WAF-level bot rules (Cloudflare in front of API — P02 infra), queue backpressure (bounded queues, doc 04).
- All limit rejections return structured 429s with retry-after; limit hits are metrics with anomaly alerts (14 §7).

## 15. Account recovery

- OAuth accounts: recovery delegated to Apple/Google. Passkey accounts: multiple passkeys encouraged; fallback = email magic link with 24 h delay + notification to all devices (delay defeats fast takeover; user-visible cancel).
- Email/password (if shipped): reset via magic link, rate-limited, sessions revoked on reset, no security questions.
- Recovery never discloses whether an email exists (uniform responses). High-risk changes (email change, MFA disable, passkey removal) require step-up auth + 24 h notification with undo link.
- Support-assisted recovery: support role **cannot** reset auth; only the user-facing flow can. This is deliberate — social-engineering the two-person team is the realistic attack.

## 16. Incident response (outline; full runbook in 14 §8)

1. **Detect** — alert, user report, or provider notice → on-call (14 §7 severity ladder).
2. **Triage** — severity (SEV1 = confirmed S3 data exposure or auth bypass), scope, ongoing?
3. **Contain** — revoke credentials/sessions, disable feature flag, block IPs, pause pipelines; break-glass actions audited.
4. **Assess** — what data, whose, since when; **start the regulatory clock assessment immediately (GDPR 72 h to authority notification if reportable — LR-02)**.
5. **Eradicate & recover** — patch, rotate all possibly-touched secrets (§5.3), restore integrity, verify.
6. **Notify** — counsel-guided user/authority notification; honest, plain-language user comms.
7. **Review** — blameless incident review within 5 working days using the template (14 §8); regression test added (13 §1 rules).

**Moderation:** quarantine states in the media pipeline; user reporting on any generated/shared surface; moderator queue in `admin` with SLAs (24 h for likeness-misuse reports §3.1); appeal path. Detailed moderation policy for fashion-intel content lives with that subsystem (doc owner: fashion-intel sections of [02](02-user-journeys-and-information-architecture.md)/[12](12-pricing-entitlements-and-unit-economics.md)).

## 17. Product-ethics rules (binding product constraints, testable where possible)

1. **No body shaming.** Copy never evaluates the user's body; recommendations explain fit in garment terms ("this cut sits at the hip"), not body-judgment terms. Copy lint list maintained with the design system; AI-generated explanation text passes a blocklist + eval check (doc 10 evals; 13 §10).
2. **No attractiveness scoring.** No feature ranks, scores, or compares bodies or faces — including internally. Reason codes must not encode attractiveness (reason-code registry review, `shared-kernel`).
3. **No health diagnosis or advice.** Measurements drive fit only; no BMI display, no weight-trend commentary, no health inferences. Any future wellness feature is a new legal + ethics review.
4. **No unsupported inference from appearance.** No inferring gender, ethnicity, age, religion, or emotion from photos. Presentation settings are explicitly user-chosen (brief §2.1), never inferred.
5. **Inclusive language and representation** across base avatars, skin tones, sizes, and presentation options (doc 07 owns the asset requirements; demographic eval slices in 13 §10).
6. **User correction rights everywhere:** every AI-derived attribute (category, color, fit, style) is user-correctable, corrections win over model output permanently, and "reset personalization" is available (doc 09).
7. **Uncertainty is shown, not hidden:** confidence indicators and provenance markers per SPINE §10.5.
8. **No dark patterns** in consent, paywall, or deletion flows: symmetric opt-in/opt-out, no forced bundling, deletion reachable in ≤ 3 taps from settings.

Violations of these rules are release blockers in the P14 review checklist and thereafter defects, not preferences.

---

**Phase hooks:** P00 (processing register, DPIA scoping, LR items opened) · P02 (secret management, signed URLs, redaction lint, rate-limit middleware) · P03 (consent registry, auth, isolation tests, LR-02/03/04/07/09) · P05 (face consent, envelope encryption DO-SEC-03, LR-05/06 **blocking**) · P06 (upload scanning, quarantine, LR-11) · P13 (billing fraud controls, LR-08) · P14 (pen-test/security review, rotation drill, store labels LR-01, ethics checklist, LR-10/12).
