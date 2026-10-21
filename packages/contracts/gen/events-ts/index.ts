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
