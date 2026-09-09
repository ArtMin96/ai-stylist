// Domain event envelope (planning/06 §4). The JSON Schema in
// `packages/contracts/events/envelope.json` is the wire contract; this type mirrors it
// field-for-field and `packages/contracts/tests` pins the two together.
import { type Id } from './ids.js';

/** `<module>.<entity>.<action>.v<N>` — versioning rules in doc 06 §4. */
export type EventType = `${string}.${string}.${string}.v${number}`;

export const ACTOR_KINDS = ['user', 'system', 'admin', 'job'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export type EventAggregate = {
  /** Aggregate kind in snake_case, e.g. `closet_item`. */
  readonly kind: string;
  /** Prefixed ULID of the aggregate root. */
  readonly id: string;
};

export type EventActor = {
  readonly kind: ActorKind;
  /** Prefixed ULID (`usr_…` for users); omitted for `system`. */
  readonly id?: string;
};

export type EventEnvelope<
  TType extends EventType = EventType,
  TPayload = Record<string, unknown>,
> = {
  /** `evt_` ULID; doubles as the idempotency key and the outbox row id (doc 06 §6). */
  readonly id: Id<'event'>;
  readonly type: TType;
  /** RFC 3339 UTC timestamp. */
  readonly occurredAt: string;
  /** Producing module (SPINE §3 canonical name). */
  readonly producer: string;
  readonly aggregate: EventAggregate;
  /** Per-aggregate monotonic sequence, assigned in the producing transaction. */
  readonly sequence: number;
  readonly actor: EventActor;
  /** Trace/request correlation id shared across the whole causal chain. */
  readonly correlationId: string;
  /** `evt_` id of the event (or request id) that caused this one; absent for roots. */
  readonly causationId?: Id<'event'> | string;
  /** Consent scope required to process the payload; present when it touches sensitive data (doc 11). */
  readonly consentScope?: string;
  readonly payload: TPayload;
};
