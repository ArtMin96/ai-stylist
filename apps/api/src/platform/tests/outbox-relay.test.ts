// Outbox relay policy (unit, no database): retry scheduling with backoff, `failed` after the
// configured attempts, the batch cap, and a `last_error` that never carries the payload.
// The SQL path runs against real Postgres in outbox-relay.docker.test.ts.
import { describe, expect, it } from 'vitest';

import {
  InvalidEnvelopeError,
  MAX_LAST_ERROR_LENGTH,
  MAX_OUTBOX_BATCH_SIZE,
  UnroutedEventError,
  describeSendError,
  failureOutcome,
  resolveOutboxRelaySettings,
} from '../outbox/outbox-relay.js';
import { TimeoutError } from '../resilience/timeout.js';

describe('failureOutcome (retry scheduling)', () => {
  const settings = { maxAttempts: 4, backoff: { baseMs: 100, capMs: 1_000 } };
  const top = () => 0.999_999_999;

  it('keeps the row pending with an exponentially growing, capped delay before maxAttempts', () => {
    expect(failureOutcome(0, settings, top)).toEqual({
      status: 'pending',
      attempts: 1,
      delayMs: 100,
    });
    const second = failureOutcome(1, settings, top);
    expect(second).toMatchObject({ status: 'pending', attempts: 2 });
    expect(second.status === 'pending' && second.delayMs).toBeCloseTo(200, 3);
    const third = failureOutcome(2, settings, top);
    expect(third.status === 'pending' && third.delayMs).toBeCloseTo(400, 3);
  });

  it('draws the jitter from the injected source and stays within [baseMs, capMs]', () => {
    for (const draw of [0, 0.25, 0.5, 0.75, 0.999]) {
      const outcome = failureOutcome(2, settings, () => draw);
      expect(outcome.status).toBe('pending');
      if (outcome.status === 'pending') {
        expect(outcome.delayMs).toBeGreaterThanOrEqual(100);
        expect(outcome.delayMs).toBeLessThanOrEqual(1_000);
      }
    }
  });

  it('marks the row failed on the maxAttempts-th failure, never later', () => {
    expect(failureOutcome(3, settings, top)).toEqual({ status: 'failed', attempts: 4 });
    expect(failureOutcome(0, { ...settings, maxAttempts: 1 })).toEqual({
      status: 'failed',
      attempts: 1,
    });
  });
});

describe('resolveOutboxRelaySettings (bounds)', () => {
  it('defaults to a 250 ms interval, 100-row batches and 5 attempts (doc 04 §9)', () => {
    expect(resolveOutboxRelaySettings()).toMatchObject({
      pollIntervalMs: 250,
      batchSize: MAX_OUTBOX_BATCH_SIZE,
      maxAttempts: 5,
    });
    expect(MAX_OUTBOX_BATCH_SIZE).toBe(100);
  });

  it('rejects a batch above 100 and every unbounded or empty setting', () => {
    expect(() => resolveOutboxRelaySettings({ batchSize: 101 })).toThrow(RangeError);
    expect(() => resolveOutboxRelaySettings({ batchSize: 0 })).toThrow(RangeError);
    expect(() => resolveOutboxRelaySettings({ maxAttempts: 0 })).toThrow(RangeError);
    expect(() => resolveOutboxRelaySettings({ maxAttempts: Number.POSITIVE_INFINITY })).toThrow(
      RangeError,
    );
    expect(() => resolveOutboxRelaySettings({ pollIntervalMs: 0 })).toThrow(RangeError);
    expect(() => resolveOutboxRelaySettings({ sendTimeoutMs: 0 })).toThrow(RangeError);
    expect(() => resolveOutboxRelaySettings({ backoff: { baseMs: 10, capMs: 5 } })).toThrow(
      RangeError,
    );
  });
});

describe('describeSendError (last_error)', () => {
  /** Canary: a payload value a foreign error message may echo; never in `last_error`. */
  const PAYLOAD_MARKER = 'payload-marker-5c2e';

  it('records only the class of a foreign error, never its message', () => {
    expect(describeSendError(new Error(PAYLOAD_MARKER))).toBe('Error');
    expect(describeSendError(new TypeError(`queue unavailable ${PAYLOAD_MARKER}`))).toBe(
      'TypeError',
    );
  });

  it('adds the pg SQLSTATE of a driver error, never its message or free-text codes', () => {
    const pgError = Object.assign(new Error(`insert failed: ($1) = (${PAYLOAD_MARKER})`), {
      name: 'PostgresError',
      code: '23505',
    });
    expect(describeSendError(pgError)).toBe('PostgresError (pg 23505)');
    const oddCode = Object.assign(new Error('x'), { code: `bad ${PAYLOAD_MARKER}` });
    expect(describeSendError(oddCode)).toBe('Error');
  });

  it("keeps the message of the relay's own errors, whose text it controls", () => {
    expect(describeSendError(new TimeoutError(10_000))).toBe(
      'TimeoutError: operation timed out after 10000 ms',
    );
    expect(describeSendError(new UnroutedEventError('demo.unrouted.v1'))).toBe(
      "UnroutedEventError: no queue routed for event type 'demo.unrouted.v1'",
    );
    expect(describeSendError(new InvalidEnvelopeError())).toBe(
      'InvalidEnvelopeError: outbox payload is not an event envelope object',
    );
  });

  it('records a non-Error throw by type only, so a thrown envelope never reaches the row', () => {
    const thrown = { payload: { note: PAYLOAD_MARKER } };
    expect(describeSendError(thrown)).toBe('non-Error thrown (object)');
  });

  it('truncates long messages', () => {
    const text = describeSendError(new UnroutedEventError('x'.repeat(5_000)));
    expect(text.length).toBe(MAX_LAST_ERROR_LENGTH);
  });
});
