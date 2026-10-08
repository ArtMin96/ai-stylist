// Outbox relay (doc 04 §9.1 step 2, §9.2; doc 06 §6): polls `platform_outbox` and enqueues each
// due `pending` row on its pg-boss queue with the event id as the idempotency key.
//
// One poll = one transaction: claim ≤ `batchSize` (≤ 100) due rows `FOR UPDATE SKIP LOCKED`, send
// each, record each outcome, commit. Concurrent relays never claim the same row. The enqueue runs
// on pg-boss's own pool, so a relay that dies after a send but before COMMIT leaves the row
// pending and sends it again: `PgBossQueue.send` dedupes on the job id derived from the event id,
// so the retry is a no-op (`enqueued: false`) that still counts as dispatched (at-least-once
// dispatch, exactly-once job).
//
// Translation only: which queue an event type goes to and which user a job belongs to are injected
// by the composition root (`routeEvent`, `userIdOf`). Logs carry event id, type, attempts and
// last_error (`describeSendError`: error class and pg code, never a foreign error message) —
// never the payload. Each send runs in a PRODUCER span `outbox.dispatch <event type>` parented
// on the envelope's `traceparent` (doc 14 §3), carrying event id, type, queue and
// `correlation_id` only.
import { SpanKind } from '@opentelemetry/api';
import type { Logger } from 'pino';
import type { Sql } from 'postgres';

import type { EventEnvelope, EventType } from '@ai-stylist/shared-kernel';

import { childLogger } from '../logger.js';
import { errorSummary, isError } from '../errors/error-shape.js';
import type { EnqueueOptions, EnqueueResult } from '../queue/pg-boss-queue.js';
import { type BackoffPolicy, backoffDelayMs } from '../resilience/backoff.js';
import { TimeoutError, withTimeout } from '../resilience/timeout.js';
import { SPAN_ATTRIBUTES, queueSpanAttributes, runTraced } from '../telemetry/trace-context.js';

/** Hard cap on rows per poll (doc 04 §9.1). */
export const MAX_OUTBOX_BATCH_SIZE = 100;
/** Longest `last_error` stored; longer messages are truncated. */
export const MAX_LAST_ERROR_LENGTH = 500;

/** The one queue operation the relay needs (`PgBossQueue` satisfies it). */
export type OutboxDispatchQueue = {
  send(queue: string, data: object, options: EnqueueOptions): Promise<EnqueueResult>;
};

/** The stored envelope as the relay hands it to `userIdOf` (written by `PgOutboxWriter`). */
export type OutboxEnvelope = EventEnvelope<EventType, unknown>;

export type OutboxRelayConfig = {
  /** postgres.js pool from the composition root; each poll holds one connection. */
  readonly sql: Sql;
  readonly queue: OutboxDispatchQueue;
  /** A pino logger built from `loggerOptions()` (../logger.ts). */
  readonly logger: Logger;
  /** Event type → pg-boss queue name; `undefined` = unrouted (counts as a failed attempt). */
  readonly routeEvent: (type: string) => string | undefined;
  /** `usr_…` id stored as the job's key for per-user cancellation; omit when events carry none. */
  readonly userIdOf?: (envelope: OutboxEnvelope) => string | undefined;
  /** Delay between polls, ms (integer >= 1). Default 250. A full batch polls again at once. */
  readonly pollIntervalMs?: number;
  /** Rows claimed per poll, 1..100. Default 100. */
  readonly batchSize?: number;
  /** Failed sends before a row is marked `failed` (integer >= 1). Default 5 (doc 04 §9.2). */
  readonly maxAttempts?: number;
  /** Delay before re-sending a row after failed send n. Default 1 s base, 5 min cap. */
  readonly backoff?: BackoffPolicy;
  /** Upper bound on one `queue.send`, ms (integer >= 1). Default 10 000. */
  readonly sendTimeoutMs?: number;
  /** Jitter source for `backoffDelayMs`; injected by tests. Default `Math.random`. */
  readonly random?: () => number;
};

/** Validated relay settings (defaults applied). */
export type OutboxRelaySettings = {
  readonly pollIntervalMs: number;
  readonly batchSize: number;
  readonly maxAttempts: number;
  readonly backoff: BackoffPolicy;
  readonly sendTimeoutMs: number;
};

/** Counts for one poll. `claimed = dispatched + retrying + failed`. */
export type OutboxPollResult = {
  readonly claimed: number;
  readonly dispatched: number;
  /** Send failed; the row stays `pending` with a later `next_attempt_at`. */
  readonly retrying: number;
  /** Send failed for the `maxAttempts`-th time; the row is now `failed` (DLQ sweep). */
  readonly failed: number;
};

/** What happens to a row whose send just failed, given its `attempts` before this failure. */
export type FailureOutcome =
  | { readonly status: 'pending'; readonly attempts: number; readonly delayMs: number }
  | { readonly status: 'failed'; readonly attempts: number };

const DEFAULT_BACKOFF: BackoffPolicy = { baseMs: 1_000, capMs: 300_000 };

export function resolveOutboxRelaySettings(
  config: Partial<OutboxRelaySettings> = {},
): OutboxRelaySettings {
  const settings: OutboxRelaySettings = {
    pollIntervalMs: config.pollIntervalMs ?? 250,
    batchSize: config.batchSize ?? MAX_OUTBOX_BATCH_SIZE,
    maxAttempts: config.maxAttempts ?? 5,
    backoff: config.backoff ?? DEFAULT_BACKOFF,
    sendTimeoutMs: config.sendTimeoutMs ?? 10_000,
  };
  requireInteger(settings.pollIntervalMs, 'pollIntervalMs', 1);
  requireInteger(settings.batchSize, 'batchSize', 1, MAX_OUTBOX_BATCH_SIZE);
  requireInteger(settings.maxAttempts, 'maxAttempts', 1);
  requireInteger(settings.sendTimeoutMs, 'sendTimeoutMs', 1);
  // Throws RangeError for an inverted or negative policy.
  backoffDelayMs(1, settings.backoff, () => 0);
  return settings;
}

/**
 * The failed send is attempt `previousAttempts + 1`. Reaching `maxAttempts` marks the row
 * `failed`; before that it is retried after `backoffDelayMs(attempts)`.
 */
export function failureOutcome(
  previousAttempts: number,
  settings: Pick<OutboxRelaySettings, 'maxAttempts' | 'backoff'>,
  random: () => number = Math.random,
): FailureOutcome {
  const attempts = previousAttempts + 1;
  if (attempts >= settings.maxAttempts) return { status: 'failed', attempts };
  return {
    status: 'pending',
    attempts,
    delayMs: backoffDelayMs(attempts, settings.backoff, random),
  };
}

/** The relay's own failure for a row whose event type `routeEvent` maps to no queue. */
export class UnroutedEventError extends Error {
  constructor(type: string) {
    super(`no queue routed for event type '${type}'`);
    this.name = 'UnroutedEventError';
  }
}

/** The relay's own failure for a row whose stored payload is not an envelope object. */
export class InvalidEnvelopeError extends TypeError {
  constructor() {
    super('outbox payload is not an event envelope object');
    this.name = 'InvalidEnvelopeError';
  }
}

/**
 * `last_error` text (also logged): the error class, plus `(pg <SQLSTATE>)` when present, e.g.
 * `Error` or `PostgresError (pg 57P01)`. The message is kept only for errors the relay raises
 * itself, whose text it controls (`TimeoutError`, `UnroutedEventError`, `InvalidEnvelopeError`):
 * any other message (pg-boss, the driver, the queue) can echo statement parameters, i.e. the
 * payload. A non-Error throw (which could be the envelope itself) is recorded by its type only.
 */
export function describeSendError(error: unknown): string {
  let text: string;
  if (!isError(error)) {
    text = `non-Error thrown (${typeof error})`;
  } else if (
    error instanceof TimeoutError ||
    error instanceof UnroutedEventError ||
    error instanceof InvalidEnvelopeError
  ) {
    text = `${error.name}: ${error.message}`;
  } else {
    const { errorName, pgCode } = errorSummary(error);
    text = pgCode === undefined ? errorName : `${errorName} (pg ${pgCode})`;
  }
  return text.length > MAX_LAST_ERROR_LENGTH
    ? `${text.slice(0, MAX_LAST_ERROR_LENGTH - 1)}…`
    : text;
}

type ClaimedRow = { id: string; type: string; attempts: number; payload: unknown };

export class OutboxRelay {
  private readonly sql: Sql;
  private readonly queue: OutboxDispatchQueue;
  private readonly logger: Logger;
  private readonly routeEvent: (type: string) => string | undefined;
  private readonly userIdOf: ((envelope: OutboxEnvelope) => string | undefined) | undefined;
  private readonly random: () => number;
  readonly settings: OutboxRelaySettings;

  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(config: OutboxRelayConfig) {
    this.sql = config.sql;
    this.queue = config.queue;
    this.logger = childLogger(config.logger, { component: 'outbox-relay' });
    this.routeEvent = config.routeEvent;
    this.userIdOf = config.userIdOf;
    this.random = config.random ?? Math.random;
    this.settings = resolveOutboxRelaySettings({
      ...(config.pollIntervalMs !== undefined ? { pollIntervalMs: config.pollIntervalMs } : {}),
      ...(config.batchSize !== undefined ? { batchSize: config.batchSize } : {}),
      ...(config.maxAttempts !== undefined ? { maxAttempts: config.maxAttempts } : {}),
      ...(config.backoff !== undefined ? { backoff: config.backoff } : {}),
      ...(config.sendTimeoutMs !== undefined ? { sendTimeoutMs: config.sendTimeoutMs } : {}),
    });
  }

  /** Start polling every `pollIntervalMs`. Idempotent. Polls never overlap within one relay. */
  start(): void {
    if (this.running) return;
    this.running = true;
    // Restarted while a poll from before stop() is still finishing: that poll schedules the next.
    if (this.inFlight === undefined) this.schedule(0);
    this.logger.info({ ...this.settings }, 'outbox relay started');
  }

  /**
   * Graceful: no new poll starts; an in-flight poll finishes (its transaction commits every
   * outcome it recorded) before this resolves. Idempotent.
   */
  async stop(): Promise<void> {
    const wasRunning = this.running;
    this.running = false;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    await this.inFlight;
    if (wasRunning) this.logger.info('outbox relay stopped');
  }

  /** One poll: claim due rows, send each, record each outcome, commit. */
  async pollOnce(): Promise<OutboxPollResult> {
    const counts = { claimed: 0, dispatched: 0, retrying: 0, failed: 0 };
    await this.sql.begin(async (tx) => {
      const rows = await tx<ClaimedRow[]>`
        select id, type, attempts, payload
        from platform_outbox
        where status = 'pending' and (next_attempt_at is null or next_attempt_at <= now())
        order by created_at
        limit ${this.settings.batchSize}
        for update skip locked`;
      counts.claimed = rows.length;
      for (const row of rows) {
        try {
          await this.dispatch(row);
        } catch (error) {
          const lastError = describeSendError(error);
          const outcome = failureOutcome(row.attempts, this.settings, this.random);
          const fields = { eventId: row.id, type: row.type, attempts: outcome.attempts, lastError };
          if (outcome.status === 'failed') {
            await tx`
              update platform_outbox
              set status = 'failed', attempts = ${outcome.attempts}, next_attempt_at = null,
                  last_error = ${lastError}
              where id = ${row.id}`;
            counts.failed += 1;
            this.logger.error(fields, 'outbox event failed; left for the DLQ sweep');
          } else {
            const delaySeconds = outcome.delayMs / 1000;
            await tx`
              update platform_outbox
              set attempts = ${outcome.attempts},
                  next_attempt_at = now() + make_interval(secs => ${delaySeconds}),
                  last_error = ${lastError}
              where id = ${row.id}`;
            counts.retrying += 1;
            this.logger.warn(fields, 'outbox dispatch failed; will retry');
          }
          continue;
        }
        await tx`
          update platform_outbox
          set status = 'dispatched', dispatched_at = now(), next_attempt_at = null
          where id = ${row.id}`;
        counts.dispatched += 1;
        this.logger.debug(
          { eventId: row.id, type: row.type, attempts: row.attempts },
          'outbox event dispatched',
        );
      }
    });
    return counts;
  }

  /** Send one row; throws on any reason it cannot be enqueued. */
  private async dispatch(row: ClaimedRow): Promise<void> {
    const queueName = this.routeEvent(row.type);
    if (queueName === undefined) {
      throw new UnroutedEventError(row.type);
    }
    if (typeof row.payload !== 'object' || row.payload === null || Array.isArray(row.payload)) {
      throw new InvalidEnvelopeError();
    }
    const envelope = row.payload as OutboxEnvelope;
    const userId = this.userIdOf?.(envelope);
    const options: EnqueueOptions = {
      idempotencyKey: row.id,
      ...(userId !== undefined ? { userId } : {}),
    };
    // PRODUCER span in the producer's trace (the envelope's `traceparent`, doc 14 §3; a new trace
    // when the event carries none), in the event's correlation scope. Ids and enums only.
    const attributes = {
      ...queueSpanAttributes('send', queueName),
      [SPAN_ATTRIBUTES.outboxEventId]: row.id,
      [SPAN_ATTRIBUTES.outboxEventType]: row.type,
    };
    // A timed-out send may still land later; the job id dedupes the re-send.
    const send = () => this.queue.send(queueName, envelope, options);
    const spanName = `outbox.dispatch ${row.type}`;
    await runTraced(spanName, SpanKind.PRODUCER, attributes, envelope, async () => {
      await withTimeout(send, this.settings.sendTimeoutMs);
    });
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.inFlight = this.tick().finally(() => {
        this.inFlight = undefined;
      });
    }, delayMs);
  }

  private async tick(): Promise<void> {
    let next = this.settings.pollIntervalMs;
    try {
      const result = await this.pollOnce();
      // A full batch means more rows are probably due: drain without waiting.
      if (result.claimed === this.settings.batchSize) next = 0;
    } catch (error) {
      // Class and pg code only: driver messages can echo statement parameters.
      this.logger.error(errorSummary(error), 'outbox poll failed; retrying next interval');
    }
    if (this.running && this.timer === undefined) this.schedule(next);
  }
}

function requireInteger(
  value: number,
  name: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    const range = max === Number.MAX_SAFE_INTEGER ? `>= ${min}` : `in ${min}..${max}`;
    throw new RangeError(`OutboxRelay: ${name} must be an integer ${range}, got ${value}`);
  }
}
