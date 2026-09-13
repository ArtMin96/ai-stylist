# 06 — Data, API, and Event Contracts

**Status:** Draft for ratification · **Date:** 2026-08-24 · **Conforms to:** [SPINE.md](SPINE.md) §2–§3, §8 · **Amended:** 2026-09-13 ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — pg-boss jobs, ephemeral migration DBs, PITR caveat)
**Owns:** source-of-truth strategy, API style conventions, representative schema sketches, domain event catalog + envelope + versioning, outbox table design, migration policy, consistency model, deletion propagation.
**Does not own:** engine internals and reason-code semantics → [09-recommendation-engine.md](09-recommendation-engine.md) · pipeline stage/state semantics → [07-3d-avatar-and-garment-pipeline.md](07-3d-avatar-and-garment-pipeline.md) · entitlement/plan semantics → [12-pricing-entitlements-and-unit-economics.md](12-pricing-entitlements-and-unit-economics.md) · container/module topology → [04-architecture.md](04-architecture.md).

Schemas below are **representative sketches**, not exhaustive DDL. Field-level completeness lives in `packages/contracts` once P02 lands.

---

## 1. Source-of-truth strategy

One canonical owner per concept. Everyone else generates or imports — never copies.

| Concept | Canonical owner | Consumed as |
|---|---|---|
| API request/response shapes | `packages/contracts` — OpenAPI 3.1 (`contracts/openapi/*.yaml`) | Generated TS client (mobile), generated Python models (ML workers), NestJS DTO validation |
| Domain event schemas + envelope | `packages/contracts` (`contracts/events/*.json`, JSON Schema 2020-12) | TS types (api/trigger), Pydantic models (workers) |
| Units, IDs, color values, measurement definitions | `packages/shared-kernel` | Imported by api/mobile/contracts; mirrored into generated Python models |
| Reason-code registry | `packages/shared-kernel` (semantics: doc 09) | Referenced by contracts as enums |
| Entitlement names | `packages/shared-kernel` (semantics: doc 12) | Referenced by contracts as enums |
| Category taxonomy | `closet` module data (seeded, versioned; doc 08) | Read via API; IDs stable |
| Asset manifests / 3D formats | `assets/3d` schemas (doc 07) | Validated by asset tooling + mobile loader |
| DB schema | `apps/api/src/modules/<name>/internal/schema.ts` (Drizzle, per owning module) | Never exposed outside the module |

**Generation pipeline** (runs via `just generate`, checked in CI):

1. OpenAPI 3.1 specs are authored per module in `packages/contracts/openapi/`, bundled to one `openapi.bundle.json`.
2. TS client for mobile: `@hey-api/openapi-ts` → `packages/contracts/gen/ts-client/` (typed fetch client + TanStack Query hooks).
3. Python models for ML workers and event consumers: **`datamodel-code-generator`** → `workers/ml/generated/` (Pydantic v2 models from OpenAPI components + event JSON Schemas).
4. Event TS types: JSON Schema → TS via `json-schema-to-typescript` → `packages/contracts/gen/events-ts/`.
5. All generated files carry a `GENERATED — DO NOT EDIT` header and are committed. **CI runs `just generate --check`; stale generation fails the build.** Generators are version-pinned via the root toolchain (`mise`).

NestJS controllers validate against the same contract: the OpenAPI spec is the source; server DTOs are generated from it (not the reverse) so the server cannot drift from the published contract. tRPC was rejected in [SPINE.md](SPINE.md) §2; rationale in [05-technology-decisions.md](05-technology-decisions.md).

## 2. API style conventions

- **Base:** `https://api.<domain>/v1` — URI major version only. Within `v1`, changes are additive (new optional fields, new endpoints). Breaking change ⇒ `v2` side-by-side with a deprecation window ≥ 2 mobile release cycles (mobile apps update slowly; server supports N and N−1 app versions).
- **Resources:** plural kebab-case nouns: `/closet-items`, `/media-assets`, `/recommendations`, `/context-facts`, `/entitlements`, `/me/*` for the caller's own scope. Verbs only as sub-resource actions where a state transition isn't CRUD: `POST /media-uploads/{id}/complete`, `POST /recommendations/{id}/feedback`.
- **IDs:** ULIDs, prefixed (`itm_`, `ast_`, `rec_`, `out_`, `ent_`, `evt_`) — sortable, greppable, unambiguous in logs.
- **Pagination:** cursor-based everywhere (`?cursor=&limit=`, default 25, max 100); response `{ items: [...], nextCursor: string | null }`. No offset pagination (closets grow; offsets break under concurrent edits).
- **Errors:** RFC 9457 `application/problem+json`: `{ type, title, status, detail, instance, code, errors? }` where `code` is a stable machine code from `shared-kernel` (e.g. `CLOSET_LIMIT_REACHED`, `ENTITLEMENT_REQUIRED`, `CONTEXT_STALE`). Field validation errors under `errors[]` with JSON-pointer paths. Never leak internals or provider error bodies.
- **Idempotency:** all non-GET endpoints that create or trigger work accept an `Idempotency-Key` header (client-generated ULID; the mobile mutation-log `opId` — doc 04 §8). Server stores key + request hash + response for 48 h; replay returns the stored response; same key with different body ⇒ `409`.
- **Concurrency:** mutable resources carry `version` (integer); writes send `If-Match: "<version>"`; mismatch ⇒ `409` with current state (drives the conflict policy in doc 04 §8).
- **Auth:** better-auth session token in `Authorization: Bearer`; every request resolved to a principal + consent scopes (doc 11). Webhooks are signature-verified, never bearer-authed.
- **Conventions:** JSON camelCase; timestamps RFC 3339 UTC; all quantities carry explicit units (no bare numbers for measurements); enums are closed strings from `shared-kernel`; money as `{ amount: integer minor units, currency }`.
- **Rate limits:** per-user and per-IP token buckets at the Fastify layer; `429` + `Retry-After`. Expensive AI endpoints additionally metered via entitlements (doc 12).

## 3. Representative schema sketches

### 3.1 Profile & measurements (`profile`)

```jsonc
// GET /v1/me/profile
{
  "id": "prf_01J...",
  "displayName": "…",
  "presentation": { "styleIdentity": ["minimal", "smart-casual"], "pronounSet": "she" },
  "locale": { "language": "en", "region": "DE", "timezone": "Europe/Berlin", "unitSystem": "metric" },
  "measurements": {                     // every value: explicit unit + provenance
    "height":   { "value": 172, "unit": "cm", "source": "user", "measuredAt": "2026-08-20T10:00:00Z" },
    "weight":   { "value": 63.5, "unit": "kg", "source": "user", "measuredAt": "2026-08-20T10:00:00Z" },
    "chest":    { "value": 92, "unit": "cm", "source": "user", "confidence": 1.0 },
    "inseam":   { "value": 78, "unit": "cm", "source": "estimated", "confidence": 0.6 }
  },
  "fitPreferences": { "tops": "regular", "bottoms": "slim" },
  "climateTolerance": "runs_cold",       // shared-kernel enum
  "hardExclusions": [ { "kind": "material", "value": "wool" } ],
  "sizingByRegion": [ { "region": "EU", "category": "cat.shoes", "size": "39" } ],
  "version": 7
}
```

Unit rules: `unitSystem` controls display only; the API always stores and returns SI (`cm`, `kg`) with conversion in clients via `shared-kernel` converters. `source ∈ user | estimated | derived`; estimated/derived values always carry `confidence` and are user-overridable (brief: never silently invent personal facts).

### 3.2 Closet item + attributes (`closet`)

```jsonc
// GET /v1/closet-items/{id}
{
  "id": "itm_01J...",
  "categoryId": "cat.tops.tshirt",          // taxonomy id grammar: doc 08 §2
  "name": "White linen tee",
  "attributes": {                            // normalized IDs, never free strings (doc 08)
    "colors": { "dominant": "#F5F1E8", "secondary": ["#D9D2C5"], "paletteId": "color.warm-neutral" },
    "pattern": "attr.pattern.solid",
    "material": ["attr.material.linen"],
    "silhouette": "attr.silhouette.relaxed",
    "sleeve": "attr.sleeve.short",
    "warmth": 2, "breathability": 3, "waterResistance": "none",   // scales/enums per doc 08 §4.3
    "layeringRole": "base",
    "formality": 2,
    "seasons": ["spring", "summer"]
  },
  "attributeProvenance": {                   // per attribute group: who set it
    "colors": { "source": "extracted", "confidence": 0.91, "extractorVersion": "attr-v3" },
    "material": { "source": "user_corrected", "correctedAt": "2026-08-21T09:12:00Z" }
  },
  "media": {
    "primaryAssetId": "ast_01J...",
    "views": [ { "view": "front", "assetId": "ast_01J...", "provenance": "original_capture" },
               { "view": "back",  "assetId": "ast_01K...", "provenance": "ai_generated", "confidence": 0.72 } ]
  },
  "availability": "laundry",                 // available|laundry|packed|lent|repair|archived (SPINE §8)
  "brand": "…", "size": { "region": "EU", "value": "M" },
  "purchase": { "date": "2025-06-01", "price": { "amount": 3900, "currency": "EUR" } },
  "wear": { "count": 14, "lastWornAt": "2026-08-18" },
  "tags": ["tag.user.01J…"], "isFavorite": true,   // tag id grammar: doc 08 §2
  "version": 3
}
```

User corrections (`user_corrected`) permanently win over re-extraction (doc 04 §8 conflict class 2; doc 08 owns correction → model-feedback flow).

### 3.3 Media asset, derivation lineage, provenance (`media`)

```jsonc
// GET /v1/media-assets/{id}
{
  "id": "ast_01J...",
  "kind": "item_photo",                       // item_photo|selfie|avatar_asset|generated_view|tryon_render|…
  "state": "published",                       // state machine owned by doc 07 §8.1
  "contentHash": "sha256:…",                  // immutable, dedupe key
  "storage": { "bucket": "media", "key": "u/usr_…/ast_…", "url": "signed, short-lived, on request" },
  "pipelineVersion": "media-v4",
  "provenance": {
    "origin": "original_capture",             // original_capture|derived_deterministic|ai_generated|user_corrected (doc 03 §1.5) — REQUIRED on every asset
    "generator": null,                        // for ai_generated: { model: "fal-vton-x", version, promptRef }
    "confidence": null,                       // required when origin=ai_generated
    "consentScope": "closet_processing"       // doc 11
  },
  "lineage": {
    "derivedFrom": ["ast_01H..."],            // DAG edges: original → cutout → thumbnail → generated view
    "derivationKind": "background_removal",
    "supersededBy": null                      // set when user replaces a generated view with a real photo
  },
  "exif": "stripped",
  "createdAt": "…", "version": 2
}
```

Invariants: originals are immutable; every derived asset points to its parents; a generated view is **never** allowed to supersede a captured one (only the reverse), enforced in the `media` module.

### 3.4 Context fact envelope (`context`)

```jsonc
// element of GET /v1/context-facts?date=…
{
  "type": "weather.hourly",                   // weather.hourly|weather.daily|holiday|occasion|… (calendar future)
  "provider": "open-meteo",                   // or "user_override"
  "sourceTime": "2026-08-24T06:00:00Z",       // when the provider produced it
  "fetchedAt": "2026-08-24T06:05:11Z",
  "expiresAt": "2026-08-24T09:00:00Z",        // freshness horizon; stale facts flagged, not silently used
  "confidence": 0.9,
  "consentScope": "coarse_location",          // which consent authorized acquiring this fact (doc 11)
  "override": null,                           // user override replaces value, provider="user_override", confidence=1.0
  "subject": { "location": { "kind": "coarse", "geohash": "u33d" }, "date": "2026-08-24" },
  "value": { "tempC": 21.5, "feelsLikeC": 20.0, "precipProb": 0.15, "windKph": 12, "uvIndex": 5 }
}
```

This envelope is the **context-provider contract** — adding a calendar provider in P15 means implementing a port that emits this shape (consumption rules: doc 09).

### 3.5 Recommendation result (`recommendation`)

```jsonc
// GET /v1/recommendations/{id}
{
  "id": "rec_01J...",
  "requestedFor": { "date": "2026-08-25", "occasionId": "occ_office" },
  "engine": { "rulesVersion": "rules-v12", "modelVersion": "rank-v3", "reproducible": true },
  "contextSnapshotId": "ctx_01J...",          // frozen facts used — replayable (doc 09)
  "outfits": [
    {
      "rank": 1,
      "items": ["itm_A", "itm_B", "itm_C"],
      "confidence": 0.84,
      "reasons": [                             // codes from shared-kernel registry; semantics: doc 09
        { "code": "RC-WEATHER-RAIN-READY", "params": { "precipProb": 0.6 } },
        { "code": "RC-OCCASION-FORMALITY-MATCH", "params": { "target": 3 } },
        { "code": "RC-RARELY-WORN", "params": { "itemId": "itm_B", "lastWornDays": 61 } }
      ],
      "presentation": { "capabilities": ["G0"], "tryonEligible": true }   // renderer-agnostic hints only
    }
  ],
  "alternatives": [ { "rank": 2, "…": "…" } ],
  "missingData": [ { "kind": "no_rain_shell", "suggestion": "PROMPT_ADD_ITEM", "categoryId": "cat.outerwear.raincoat" } ],
  "constraintsApplied": { "hard": 9, "softWeighted": 14 }
}
```

Structured, UI- and renderer-independent (brief §2.3/§3.3). Reasons come from the decision trace — never generated after the fact.

### 3.6 Entitlement state (`billing`)

```jsonc
// GET /v1/me/entitlements   — semantics owned by doc 12
{
  "planId": "plan_plus",
  "state": "active_paid",                     // trial|free|active_paid|grace|cancelled_active — lifecycle in doc 03 §4.3; store mechanics in doc 12 §5.3
  "source": "revenuecat",                     // revenuecat|server_grant (trial)|admin_grant
  "entitlements": [ { "name": "ent.tryon.g2", "granted": true },
                    { "name": "ent.closet.limit", "value": null },        // null = unlimited
                    { "name": "ent.recs.future_day", "granted": true } ],
  "credits": { "generative": { "remaining": 37, "resetsAt": "2026-09-01T00:00:00Z" } },
  "effectiveAt": "2026-08-24T00:00:00Z",
  "version": 12
}
```

## 4. Domain event catalog

Envelope (owned by `shared-kernel`, schema in `packages/contracts/events/envelope.json`):

```jsonc
{
  "id": "evt_01J...",                // ULID; idempotency key
  "type": "closet.item.created.v1",  // <module>.<entity>.<action>.v<N>
  "occurredAt": "…",
  "producer": "closet",
  "aggregate": { "kind": "closet_item", "id": "itm_…" },
  "sequence": 4,                     // per-aggregate monotonic
  "actor": { "kind": "user", "id": "usr_…" },   // or system|admin|job
  "correlationId": "…", "causationId": "evt_…",
  "consentScope": "…",               // when payload touches sensitive data
  "payload": { }                     // event-specific schema
}
```

Catalog (initial; payloads sketched, full schemas in `packages/contracts/events/`):

| Event type | Producer | Payload sketch | Consumers |
|---|---|---|---|
| `identity.account.created.v1` | identity | userId, locale, consents | billing (start 3-day trial grant), notifications (welcome), analytics |
| `identity.consent.changed.v1` | identity | scope, granted, at | media (gate face processing), context (location), fashion-intel |
| `identity.account.deletion_requested.v1` | identity | userId, requestedAt | **all modules** — see §8 |
| `profile.measurements.updated.v1` | profile | changed fields + units | avatar (re-derive morphs), recommendation (invalidate fit cache) |
| `media.asset.uploaded.v1` | media | assetId, kind, contentHash | media pipeline task (validate, scan) |
| `media.asset.ready_for_processing.v1` | media | assetId, pipelineVersion | media pipeline task (segment → attributes → derivations; doc 07) |
| `media.asset.processing_failed.v1` | media | assetId, stage, reason | notifications (user retry prompt), admin (quarantine queue) |
| `media.derivation.completed.v1` | media | assetId, derivedIds, lineage | closet (attach views), avatar (asset versions) |
| `closet.item.draft_ready.v1` | closet | itemId, extracted attrs + confidence | notifications (confirm prompt), mobile sync |
| `closet.item.created.v1` | closet | itemId, categoryId | recommendation (candidate cache invalidation), fashion-intel, embeddings task |
| `closet.item.updated.v1` / `.availability_changed.v1` | closet | itemId, changed fields | recommendation (laundry state), sync |
| `closet.item.correction_applied.v1` | closet | itemId, field, from→to, source | media/ML eval dataset task (doc 10), analytics |
| `avatar.config.updated.v1` | avatar | avatarId, paramsVersion | media (regenerate avatar assets), outfit |
| `outfit.saved.v1` / `outfit.worn.v1` | outfit | outfitId, itemIds, wornAt | closet (wear history), recommendation (feedback signals) |
| `recommendation.generated.v1` | recommendation | recId, rulesVersion, contextSnapshotId | analytics (validity metrics), fashion-intel |
| `recommendation.feedback_received.v1` | recommendation | recId, feedbackKind, target | recommendation aggregation task (doc 09 guardrails), analytics |
| `context.fact.overridden.v1` | context | factType, override | recommendation (recompute eligibility), analytics |
| `billing.webhook.received.v1` | billing | provider eventId, rawRef | billing processor task |
| `billing.entitlement.changed.v1` | billing | userId, planId, state, effectiveAt | notifications, all entitlement-gated modules (cache bust), analytics |
| `billing.credits.consumed.v1` | billing | userId, meter, amount, refId | analytics, admin (cost tracking) |
| `fashion-intel.content.ingested.v1` | fashion-intel | contentId, sourceId, license | moderation task, personalization task |
| `notifications.delivery.failed.v1` | notifications | deliveryId, channel, reason | admin ops queue |

**Versioning rules:** additive-only within `vN` (new optional payload fields); renaming/removing/retyping ⇒ `vN+1`; producers may dual-publish during migration; consumers must tolerate unknown fields (open-content JSON Schema) and unknown event types (log + skip). Event schemas live in `packages/contracts` and follow §1 generation; a contract test per consumer pins the versions it understands.

## 5. Consistency model

- **Within a request:** strong. Each API write is one Postgres transaction in the owning module, including its outbox rows. Transaction boundary = application-service call; no cross-module transactions (cross-module = events).
- **Across modules / async:** eventual, at-least-once, idempotent consumers, per-aggregate ordering via `sequence` (doc 04 §9). Read-your-writes holds for the writing user via the API; mobile local store is eventually consistent with the conflict policy of doc 04 §8.
- **Derived data** (attributes, embeddings, generated views, avatar assets): always rebuildable from originals + versioned pipelines; loss is an inconvenience, not data loss.
- **Entitlements:** the `entitlements` table is authoritative *now*; RevenueCat is an input. Enforcement reads may be cached ≤ 60 s; anything monetarily sensitive (credit spend) checks the table transactionally (doc 12).

## 6. Outbox table design

Owned by `platform` (mechanism) with rows written by every module's transactions; relay semantics in [04-architecture.md](04-architecture.md) §9.

```sql
CREATE TABLE outbox (
  id             TEXT PRIMARY KEY,              -- evt_ ULID (= envelope id)
  type           TEXT NOT NULL,                 -- 'closet.item.created.v1'
  aggregate_kind TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  sequence       BIGINT NOT NULL,               -- per-aggregate, assigned in-transaction
  payload        JSONB NOT NULL,                -- full envelope
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending|dispatched|failed
  attempts       SMALLINT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  dispatched_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_kind, aggregate_id, sequence)
);
CREATE INDEX outbox_pending_idx ON outbox (status, next_attempt_at) WHERE status <> 'dispatched';
```

Retention: `dispatched` rows pruned after **90 days** (replay window, §9.2 of doc 04); `failed` rows kept until resolved via the admin ops queue. The relay polls with `FOR UPDATE SKIP LOCKED`; dispatch marks `dispatched_at`. Payloads never contain raw media or sensitive free text — IDs and references only (logging/redaction rules: doc 14).

## 7. Migration policy (Drizzle)

- **Tooling:** drizzle-kit generated SQL migrations, committed under `apps/api/drizzle/`; applied via `just db-migrate` locally and by a release step in CI (never on app boot). Ephemeral databases (Testcontainers) give every PR an isolated migrated copy in CI; migration + rollback are tested there before merge and then proven on a staging scratch database restored from the latest backup (DEC-43).
- **Expand–contract, always:**
  1. *Expand:* additive migration (new nullable column/table/index `CONCURRENTLY`), deploy code that writes both/reads old.
  2. *Migrate:* backfill via idempotent batched job (pg-boss job, ≤ 5k rows/batch), verify counts.
  3. *Contract:* only after all code paths read the new shape **and** one release cycle has passed, drop the old column in a separate migration.
- **Rollback rules:** every migration ships with a down path or an explicit `-- IRREVERSIBLE:` header + ADR link; deploys roll back **code first** (safe because expand-phase schema supports N and N−1 code); destructive migrations (drops, type narrowing) require a fresh backup verification and cannot ship in the same release as the code that stops using the data.
- **Forbidden:** renaming columns in place (add-copy-drop instead), long-lock operations without `CONCURRENTLY`/batching, editing an applied migration file.
- Schema files live inside each owning module (`internal/schema.ts`); one migration stream for the monolith, but a migration may only touch tables of the module named in its filename (`0042_closet_add_condition.sql`) — reviewed via CODEOWNERS.

## 8. Deletion propagation (account deletion)

Trigger: `identity.account.deletion_requested.v1` (user action or admin). Orchestrated as a durable pg-boss job chain with per-step idempotency and a completion audit record. Consent-scope deletions (e.g. revoking face processing) run the same machinery scoped to the affected data class (doc 11 owns policy; this doc owns mechanics).

| Step | Target | Action | Notes |
|---|---|---|---|
| 1 | Postgres (all modules) | Hard-delete user-owned rows in dependency order (closet → media metadata → profile → …), keep an anonymized `deleted_accounts` stub (userId hash, deletedAt) for audit/idempotency | Cascade map generated from Drizzle FK graph; contract test asserts every user-FK table is covered |
| 2 | R2 | Delete all objects under the user prefix (originals + derived + avatar + generated views) | Prefix-scoped; verified by a follow-up list call returning empty |
| 3 | Provider data | fal.ai / LLM providers: zero-or-short retention by policy (SPINE §2, r3) — nothing to delete; RevenueCat: delete subscriber via API; PostHog: deletion request API; push tokens revoked | Each provider step recorded with response evidence |
| 4 | pg-boss | Cancel pending jobs keyed to the user (queue/singleton keys carry the user id); job payloads carry IDs only and are purged by pg-boss's completed-job retention | |
| 5 | Caches/local | Session revocation (all devices); next mobile launch wipes local store on 401 + `ACCOUNT_DELETED` code | |
| 6 | Outbox/events | Historical envelopes carry IDs only; rows age out at 90 days — documented as residual until pruning completes | |

**Backups caveat (stated honestly, also in user-facing policy):** our pgBackRest point-in-time-recovery archive, nightly logical dumps and any R2 backup copies retain deleted data until their retention windows lapse (PITR retention: 14 days; doc 11). We do not rewrite backups; we guarantee deletion from live systems immediately and from backups by expiry, and we never restore deleted user data except during disaster recovery, in which case deletions are re-applied from the `deleted_accounts` ledger before serving traffic. Legal review required (doc 11 register).

SLA: user-visible completion target ≤ 30 days (GDPR-aligned; typically minutes for live systems); progress auditable in `admin`.

## 9. CI contract gates (summary)

- `just generate --check` reproducibility check (stale generation fails).
- OpenAPI lint (spectral: naming, pagination, problem+json, idempotency-header presence on mutating routes).
- Contract tests: mobile client ↔ API (generated-client round-trips), Trigger tasks ↔ ML workers (Pydantic models vs fixtures), event consumers ↔ envelope versions.
- Drizzle schema ↔ migration drift check; deletion-cascade coverage test (§8 step 1).
- Breaking-change detector (`oasdiff`) on `openapi.bundle.json` against `main` — breaking diff requires an ADR label.
