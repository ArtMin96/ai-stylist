// Correlation id (planning/14 §2): one id per logical operation, sent by clients as
// `x-correlation-id` and carried API → outbox envelope (`correlationId`) → pg-boss job → worker.
// It is our own metadata, never user data. This module keeps the current id in an
// AsyncLocalStorage scope: the pino mixin in ../logger.ts adds it to every log line of the scope,
// and application code reads it with `currentCorrelationId()`. Translation only: which operation
// gets which id is decided by the client (or minted here when the client sent none or a bad one).
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { trace } from '@opentelemetry/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import envelopeSchema from '@ai-stylist/contracts/events/envelope.json' with { type: 'json' };

/** Request and response header (lowercase, as Node exposes incoming headers). */
export const CORRELATION_ID_HEADER = 'x-correlation-id';
/** Log key and span attribute name. */
export const CORRELATION_ID_KEY = 'correlation_id';
/**
 * An accepted client id: the event envelope's `correlationId` pattern
 * (`packages/contracts/events/envelope.json`), read from the schema so it is never restated here.
 * Today 1–128 characters of `[A-Za-z0-9._:-]` (a UUID, ULID or `corr-…`).
 */
export const CORRELATION_ID_PATTERN = new RegExp(envelopeSchema.properties.correlationId.pattern);

type CorrelationScope = { readonly correlationId: string };

const scopes = new AsyncLocalStorage<CorrelationScope>();

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && CORRELATION_ID_PATTERN.test(value);
}

/** A fresh id for an operation that arrived without a valid one. */
export function mintCorrelationId(): string {
  return randomUUID();
}

/** The correlation id of the current request or job, or `undefined` outside any scope. */
export function currentCorrelationId(): string | undefined {
  return scopes.getStore()?.correlationId;
}

/**
 * Run `fn` with `correlationId` as the current id (for every async continuation it starts). An
 * `undefined` or invalid id runs `fn` outside any scope, so an outer id never leaks into it.
 */
export function runWithCorrelationId<T>(correlationId: string | undefined, fn: () => T): T {
  if (!isValidCorrelationId(correlationId)) return scopes.exit(fn);
  return scopes.run({ correlationId }, fn);
}

/** pino `mixin`: `{ correlation_id }` inside a scope, nothing outside one. */
export function correlationLogFields(): Record<string, string> {
  const correlationId = currentCorrelationId();
  return correlationId === undefined ? {} : { [CORRELATION_ID_KEY]: correlationId };
}

/** The client's id when valid, else a minted one. Never throws on a bad header. */
export function correlationIdFromHeader(value: string | string[] | undefined): string {
  return isValidCorrelationId(value) ? value : mintCorrelationId();
}

/**
 * Install the correlation id on a Fastify instance (the API's root instance: hooks added here
 * apply to every route registered after): read `x-correlation-id`, accept it when valid or mint
 * one, echo it in the response header, tag the active span with `correlation_id`, and run the
 * rest of the request in its scope. Body parsing runs on the socket's async context and drops the
 * scope, so `preValidation` (after parsing, before the handler) re-enters it.
 */
export function registerCorrelationId(fastify: FastifyInstance): void {
  const requestScopes = new WeakMap<FastifyRequest, CorrelationScope>();
  fastify.addHook('onRequest', function correlationIdOnRequest(request, reply, done) {
    const correlationId = correlationIdFromHeader(request.headers[CORRELATION_ID_HEADER]);
    const scope = { correlationId };
    requestScopes.set(request, scope);
    void reply.header(CORRELATION_ID_HEADER, scope.correlationId);
    trace.getActiveSpan()?.setAttribute(CORRELATION_ID_KEY, scope.correlationId);
    scopes.run(scope, done);
  });
  fastify.addHook('preValidation', function correlationIdPreValidation(request, _reply, done) {
    const scope = requestScopes.get(request);
    if (scope === undefined) done();
    else scopes.run(scope, done);
  });
}
