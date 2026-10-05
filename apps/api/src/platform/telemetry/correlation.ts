// Correlation id (planning/14 §2): one id per logical operation, sent by clients as
// `x-correlation-id` and carried API → outbox envelope (`correlationId`) → pg-boss job → worker.
// It is our own metadata, never user data. This module keeps the current id in an
// AsyncLocalStorage scope: the pino mixin in ../logger.ts adds it to every log line of the scope,
// and application code reads it with `currentCorrelationId()`. Translation only: which operation
// gets which id is decided by the client (or minted here when the client sent none or a bad one).
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { trace } from '@opentelemetry/api';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import envelopeSchema from '@ai-stylist/contracts/events/envelope.json' with { type: 'json' };
import { CORRELATION_ID_HEADER, CORRELATION_ID_KEY } from '@ai-stylist/shared-kernel';

// The request and response header, and the log key and span attribute name
// (packages/shared-kernel/registry/correlation.json).
export { CORRELATION_ID_HEADER, CORRELATION_ID_KEY };

/**
 * An accepted client id: the event envelope's `correlationId` rule
 * (`packages/contracts/events/envelope.json`: pattern, minLength and maxLength), compiled from the
 * schema with the Ajv 2020-12 options the jobs validate envelopes with, so an id this accepts is one
 * an envelope accepts and nothing here restates the rule. Today 1–128 characters of `[A-Za-z0-9._:-]`
 * (a UUID, ULID or `corr-…`).
 */
const correlationIdRule = new Ajv2020({ strict: true, allErrors: true }).compile<string>(
  envelopeSchema.properties.correlationId,
);

type CorrelationScope = { readonly correlationId: string };

const scopes = new AsyncLocalStorage<CorrelationScope>();

export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && correlationIdRule(value);
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
