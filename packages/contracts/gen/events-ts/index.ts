// GENERATED — do not edit. Run `just generate`.
// Source: packages/contracts/events/**/*.json (JSON Schema 2020-12)

// ---- events/analytics/events.schema.json ----

/**
 * Schema for the product-analytics event taxonomy (events.json). CI rejects any analytics call whose event name is not registered here (brief §6); events marked consentRequired never fire before consent.
 */
export interface AnalyticsTaxonomy {
  version: number;
  events: AnalyticsEventDefinition[];
}
export interface AnalyticsEventDefinition {
  /**
   * snake_case event name, stable once shipped
   */
  name: string;
  /**
   * Owning SPINE module
   */
  owner: string;
  description?: string;
  /**
   * Allowed property names and their scalar types; anything else is dropped
   */
  properties: {
    [k: string]: 'string' | 'integer' | 'number' | 'boolean' | undefined;
  };
  /**
   * True when the event may only be sent after analytics consent (doc 11)
   */
  consentRequired: boolean;
}

// ---- events/demo.event.json ----

/**
 * P02 demo event proving the API → outbox → pg-boss → worker round-trip (brief §7 T08). The full event is the envelope (envelope.json) narrowed by this schema.
 */
export interface DemoOutboxFlowRequestedV1 {
  type: 'demo.outbox-flow.requested.v1';
  payload: DemoOutboxFlowRequestedV1Payload;
}
export interface DemoOutboxFlowRequestedV1Payload {
  /**
   * Client-chosen id of the demo run; used by the worker to correlate its reply
   */
  demoId: string;
  requestedAt: string;
  /**
   * Free text echoed by the worker; never sensitive
   */
  note?: string;
}

// ---- events/envelope.json ----

/**
 * Domain event envelope (planning/06 §4). Mirrored by `EventEnvelope` in @ai-stylist/shared-kernel; consumers must tolerate unknown fields.
 */
export interface EventEnvelope {
  /**
   * `evt_` ULID; idempotency key and outbox row id
   */
  id: string;
  /**
   * <module>.<entity>.<action>.v<N>
   */
  type: string;
  /**
   * RFC 3339 UTC timestamp
   */
  occurredAt: string;
  /**
   * Producing module (SPINE §3 canonical name)
   */
  producer: string;
  aggregate: {
    kind: string;
    id: string;
  };
  /**
   * Per-aggregate monotonic sequence assigned in the producing transaction
   */
  sequence: number;
  actor: {
    kind: 'user' | 'system' | 'admin' | 'job';
    id?: string;
  };
  /**
   * `usr_` ULID of the user the event is about (the data subject), whoever caused it; distinct from `actor`, the party that caused it. Lets per-user work be found and cancelled on account deletion (doc 06 §8 step 4, DEC-57). An id only, never another personal value; absent when the event concerns no single user
   */
  subjectUserId?: string;
  /**
   * Correlation id of the logical operation (doc 14 §2): minted by the client per operation (or by the API when a request carried none or an invalid one) and carried request → outbox → job → worker as `x-correlation-id`. Our own correlation metadata, never user data. 1–128 characters of `[A-Za-z0-9._:-]` (a UUID, ULID or `corr-…`); producers and consumers accept exactly this pattern
   */
  correlationId: string;
  /**
   * Id of the event or request that caused this one; absent for roots
   */
  causationId?: string;
  /**
   * Consent scope required to process the payload (doc 11); present when it touches sensitive data
   */
  consentScope?: string;
  /**
   * W3C Trace Context `traceparent` of the producing span (doc 14 §3), so one trace covers request → outbox → job → worker. Carries trace context only, never user data; absent when the producer was not traced
   */
  traceparent?: string;
  /**
   * Event-specific payload; the per-event schema (e.g. demo.event.json) narrows it
   */
  payload: {};
}

// ---- events/identity.account.created.v1.event.json ----

/**
 * An account was created: `completeSignUp` accepted the birth year at the age gate (phase P03 §7, doc 06 §4). Producer `identity`; aggregate `user` with the account's `usr_` id; `subjectUserId` is that id. Ids and timestamps only, never an email, name or birth year (doc 06 §6, doc 11 §6). The full event is the envelope (envelope.json) narrowed by this schema; the payload is open content, so consumers ignore properties they do not know (doc 06 §4).
 */
export interface IdentityAccountCreatedV1 {
  type: 'identity.account.created.v1';
  payload: IdentityAccountCreatedV1Payload;
}
export interface IdentityAccountCreatedV1Payload {
  /**
   * The new account, a prefixed ULID (`usr_`, shared-kernel `ID_PREFIXES.user`); the API's `UserId`
   */
  userId: string;
  /**
   * When the account was created
   */
  createdAt: string;
}

// ---- events/identity.account.deletion_requested.v1.event.json ----

/**
 * An account deletion was requested, by the person or an admin (`actor`): sessions are revoked and the 7-day grace window starts (DEC-65). It starts the deletion cascade, which purges after `graceEndsAt` unless the request was cancelled (doc 06 §8, doc 11 §13.2, NFR-PRV-040). Producer `identity`; aggregate `user` with the account's `usr_` id; `subjectUserId` is that id. Ids and timestamps only (doc 06 §6). The full event is the envelope (envelope.json) narrowed by this schema; the payload is open content, so consumers ignore properties they do not know (doc 06 §4).
 */
export interface IdentityAccountDeletionRequestedV1 {
  type: 'identity.account.deletion_requested.v1';
  payload: IdentityAccountDeletionRequestedV1Payload;
}
export interface IdentityAccountDeletionRequestedV1Payload {
  /**
   * The account to delete, a prefixed ULID (`usr_`, shared-kernel `ID_PREFIXES.user`); the API's `UserId`
   */
  userId: string;
  /**
   * The deletion request, a prefixed ULID (`del_`, shared-kernel `ID_PREFIXES.deletionRequest`); the API's `AccountDeletionRequest.id`. A cancel ends this request; a later request gets a new id
   */
  deletionRequestId: string;
  /**
   * When the request was accepted; the API's `AccountDeletionRequest.requestedAt`
   */
  requestedAt: string;
  /**
   * End of the grace window; the purge starts after it. The API's `AccountDeletionRequest.graceEndsAt`
   */
  graceEndsAt: string;
}

// ---- events/identity.account.export_requested.v1.event.json ----

/**
 * A data export was requested (`requestDataExport`, doc 11 §13.1); it starts the export job chain (doc 04 §9.1 step 1). Producer `identity`; aggregate `user` with the account's `usr_` id; `subjectUserId` is that id. The payload holds the export id, the user id and the request time, nothing else (doc 06 §6). The full event is the envelope (envelope.json) narrowed by this schema; the payload is open content, so consumers ignore properties they do not know (doc 06 §4).
 */
export interface IdentityAccountExportRequestedV1 {
  type: 'identity.account.export_requested.v1';
  payload: IdentityAccountExportRequestedV1Payload;
}
export interface IdentityAccountExportRequestedV1Payload {
  /**
   * The requested export, a prefixed ULID (`xpt_`, shared-kernel `ID_PREFIXES.exportRequest`); the API's `DataExport.id`
   */
  exportId: string;
  /**
   * The account whose data is exported, a prefixed ULID (`usr_`, shared-kernel `ID_PREFIXES.user`); the API's `UserId`
   */
  userId: string;
  /**
   * When the export was requested; the API's `DataExport.requestedAt`
   */
  requestedAt: string;
}

// ---- events/identity.consent.changed.v1.event.json ----

/**
 * A consent record was appended: a person granted or withdrew consent for one purpose, so processing that depends on it starts or halts (doc 11 §7.1, NFR-PRV-020). Producer `identity`; aggregate `user` with the person's `usr_` id, so `sequence` orders one person's consent changes; `subjectUserId` is that id. The purpose travels as `purpose` (doc 11 §7.1); the envelope's `consentScope` is a different field. Ids, enums and timestamps only (doc 06 §6). The full event is the envelope (envelope.json) narrowed by this schema; the payload is open content, so consumers ignore properties they do not know (doc 06 §4).
 */
export interface IdentityConsentChangedV1 {
  type: 'identity.consent.changed.v1';
  payload: IdentityConsentChangedV1Payload;
}
export interface IdentityConsentChangedV1Payload {
  /**
   * The person whose consent changed, a prefixed ULID (`usr_`, shared-kernel `ID_PREFIXES.user`); the API's `UserId`
   */
  userId: string;
  /**
   * The appended consent record, a prefixed ULID (`cns_`, shared-kernel `ID_PREFIXES.consentRecord`); the API's `ConsentRecord.id`
   */
  consentRecordId: string;
  /**
   * The consent purpose (doc 11 §7.2); mirrors shared-kernel `CONSENT_PURPOSES` and the API's `ConsentPurpose`
   */
  purpose:
    | 'core_service'
    | 'face_processing'
    | 'location_precise'
    | 'analytics'
    | 'ai_generative'
    | 'notifications'
    | 'training_data';
  /**
   * The purpose's state from this record on; the API's `ConsentStatus`
   */
  status: 'granted' | 'withdrawn';
  /**
   * Version of the policy text the person saw, e.g. `0.1.0-draft`; the API's `PolicyVersion`. The consent audit entry records it (doc 14 §10)
   */
  policyVersion: string;
  /**
   * When the record was appended: its `grantedAt` when `status` is `granted`, its `withdrawnAt` when `status` is `withdrawn`
   */
  changedAt: string;
}

// ---- events/profile.measurements.updated.v1.event.json ----

/**
 * A person's measurement set changed (`replaceMeasurements`): measurements were set, replaced or removed. Producer `profile`; aggregate `profile` with the profile's `prf_` id; `subjectUserId` is the person's `usr_` id. Names the changed measurements and their units, never a value: measurements are S3 (doc 11 §6) and an outbox payload holds ids and references only (doc 06 §6), so a consumer reads the current set through profile's public API. The full event is the envelope (envelope.json) narrowed by this schema; the payload is open content, so consumers ignore properties they do not know (doc 06 §4), but each change object is closed and holds the unit only.
 */
export interface ProfileMeasurementsUpdatedV1 {
  type: 'profile.measurements.updated.v1';
  payload: ProfileMeasurementsUpdatedV1Payload;
}
export interface ProfileMeasurementsUpdatedV1Payload {
  /**
   * The person whose measurements changed, a prefixed ULID (`usr_`, shared-kernel `ID_PREFIXES.user`); the API's `UserId`
   */
  userId: string;
  changed: ProfileMeasurementsUpdatedV1Changes;
}
/**
 * The measurements this write set, replaced or removed, keyed by measurement id (shared-kernel `registry/measurement-definitions.json`, as in the API's `BodyMeasurements`). Each entry names the stored unit and nothing else
 */
export interface ProfileMeasurementsUpdatedV1Changes {
  height?: ProfileMeasurementsUpdatedV1LengthChange;
  weight?: ProfileMeasurementsUpdatedV1MassChange;
  chest?: ProfileMeasurementsUpdatedV1LengthChange;
  waist?: ProfileMeasurementsUpdatedV1LengthChange;
  hips?: ProfileMeasurementsUpdatedV1LengthChange;
  inseam?: ProfileMeasurementsUpdatedV1LengthChange;
  shoulder?: ProfileMeasurementsUpdatedV1LengthChange;
  sleeve?: ProfileMeasurementsUpdatedV1LengthChange;
  thigh?: ProfileMeasurementsUpdatedV1LengthChange;
  neck?: ProfileMeasurementsUpdatedV1LengthChange;
}
/**
 * A changed length measurement: its stored unit, never its value. Closed, so no later v1 producer can add a value or any other field (doc 11 §6)
 */
export interface ProfileMeasurementsUpdatedV1LengthChange {
  /**
   * Stored length unit; mirrors shared-kernel `LENGTH_UNITS`
   */
  unit: 'cm';
}
/**
 * A changed mass measurement: its stored unit, never its value. Closed, so no later v1 producer can add a value or any other field (doc 11 §6)
 */
export interface ProfileMeasurementsUpdatedV1MassChange {
  /**
   * Stored mass unit; mirrors shared-kernel `MASS_UNITS`
   */
  unit: 'kg';
}
