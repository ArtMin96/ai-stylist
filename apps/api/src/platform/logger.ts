// pino options implementing doc 11 §8 / doc 14 §2: allowlist serializers for req/res (method,
// url path, request id, status code — nothing else) and for errors (class, code-shaped code and
// cause chain — never a message, a stack or a driver field), plus a forbidden-key denylist applied
// to every merged object at any depth as a backstop. The message is the caller's own string only
// (`hooks.logMethod`), and child-logger bindings get the same rules through `childLogger`. The
// canary test in tests/ plants marker values under each forbidden key and in an error's free
// text, and asserts none reach the sink.
//
// Required ids (doc 14 §2): a `mixin` adds `correlation_id` inside a correlation scope
// (./telemetry/correlation.ts: the API request, the pg-boss job); `trace_id` / `span_id` come from
// @opentelemetry/instrumentation-pino when telemetry runs (./telemetry/telemetry.ts).
import type { Writable } from 'node:stream';

import type { Bindings, LogFn, Logger, LoggerOptions } from 'pino';
import type { Options as PinoHttpOptions } from 'pino-http';

import { FORBIDDEN_LOG_KEYS } from '@ai-stylist/shared-kernel';

import { errorSummary } from './queue/error-summary.js';
import { correlationLogFields } from './telemetry/correlation.js';

export const REDACTED = '[REDACTED]';

/**
 * Forbidden key words (doc 11 §8), one lowercase word each; a key matches when any of its
 * camel/snake/kebab words does. Single source and single name: `FORBIDDEN_LOG_KEYS` of
 * `@ai-stylist/shared-kernel` (packages/shared-kernel/registry/forbidden-log-keys.json, also read
 * by the worker's drift test and the forbidden-field lint); platform does not re-export it.
 */
const FORBIDDEN = new Set<string>(FORBIDDEN_LOG_KEYS);
const WORD_SPLIT = /[^a-zA-Z0-9]+|(?<=[a-z0-9])(?=[A-Z])/;

export function isForbiddenLogKey(key: string): boolean {
  if (FORBIDDEN.has(key.toLowerCase())) return true;
  return key
    .split(WORD_SPLIT)
    .map((word) => word.toLowerCase())
    .some((word) => word.length > 0 && FORBIDDEN.has(word));
}

/** `cause` links of a logged error that are followed; the bound also ends a circular chain. */
export const MAX_ERR_CAUSE_DEPTH = 5;

/** Everything of a thrown value that may reach the sink. */
type SerializedErr = {
  /** `Error.name` when identifier-shaped (else `Error`), or `typeof` for a non-Error throw. */
  readonly type: string;
  /** Postgres SQLSTATE or a Node system code; absent unless the value's `code` is code-shaped. */
  readonly code?: string;
  readonly cause?: SerializedErr;
};

/**
 * pino-http hands a custom `err` serializer pino's own serialized copy of the error (message, stack
 * and every enumerable field); the thrown value is that copy's non-enumerable `raw`.
 */
function thrownValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || value instanceof Error) return value;
  return 'raw' in value && value.raw instanceof Error ? value.raw : value;
}

function causeOf(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !('cause' in value)) return undefined;
  return value.cause ?? undefined;
}

/**
 * The allowlist for a logged error: its class, a code-shaped code and the same for its `cause`
 * chain (./queue/error-summary.ts is the rule for each link). Never the message, the stack or any
 * other field: a driver error's `detail`, `where`, `hint`, query and parameters echo row values,
 * and a wrapper's message can list the statement parameters.
 */
function serializeErr(thrown: unknown, depth = 0): SerializedErr {
  const value = thrownValue(thrown);
  const { errorName, pgCode } = errorSummary(value);
  const cause = depth < MAX_ERR_CAUSE_DEPTH ? causeOf(value) : undefined;
  return {
    type: errorName,
    ...(pgCode !== undefined ? { code: pgCode } : {}),
    ...(cause !== undefined ? { cause: serializeErr(cause, depth + 1) } : {}),
  };
}

/**
 * Deep-copy `value`, replacing every forbidden key's value with REDACTED and every Error, under
 * any key, with its `serializeErr` summary. Cycle-safe.
 */
export function redactForbidden(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return serializeErr(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactForbidden(item, seen));
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = isForbiddenLogKey(key) ? REDACTED : redactForbidden(entry, seen);
  }
  return out;
}

/** Keys that have their own allowlist serializer and are therefore not deep-walked here. */
const SERIALIZED_KEYS = new Set(['req', 'res', 'err']);

/**
 * The one rule for a URL that platform logs or records: everything from the first `?` or `#` is
 * cut, because a query string or a fragment can carry a signed-URL credential, a token or user
 * input. Used by the `req` serializer below, the problem `instance` and `detail`
 * (./problem.filter.ts), and the span name, event names and URL attributes
 * (./telemetry/span-sanitizer.ts); not re-exported from ./index.ts.
 */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

type SerializedReq = { id?: unknown; method?: string; url?: string };
type SerializedRes = { statusCode?: number };

export const allowlistSerializers = {
  /** Only method, path (`stripQuery`: no query, no fragment) and the request id. */
  req: (req: SerializedReq) => ({
    id: req.id,
    method: req.method,
    url: req.url === undefined ? undefined : stripQuery(req.url),
  }),
  res: (res: SerializedRes) => ({ statusCode: res.statusCode }),
  /** Class, code-shaped code and cause chain only (`serializeErr`); a non-Error throw by type. */
  err: (err: unknown) => serializeErr(err),
} as const;

export const pinoLogFormatter = (object: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(object)) {
    if (isForbiddenLogKey(key)) out[key] = REDACTED;
    else out[key] = SERIALIZED_KEYS.has(key) ? entry : redactForbidden(entry);
  }
  return out;
};

/**
 * A child of `parent` whose bindings got the rules of a logged object (`pinoLogFormatter`: every
 * forbidden word and word-split variant at any depth, an Error under any key summarised; `req`,
 * `res` and `err` still go through their serializers). pino writes a raw `.child()`'s bindings
 * without `formatters.log` and resets the bindings formatter for children, so only the exact-word
 * redact paths of `loggerOptions` would apply. Every platform and jobs child logger is made here.
 */
export function childLogger(parent: Logger, bindings: Bindings): Logger {
  return parent.child(pinoLogFormatter(bindings));
}

/** `msg` of an error logged without a message, where pino would copy the error's own message. */
const ERROR_LOGGED_MESSAGE = 'error logged';

/**
 * Whether pino would copy `err.message` into `msg` for this first argument when no message follows
 * (pino lib/proto.js `write`): an Error, or an object with a truthy `err` and no `msg` of its own.
 * `loggerOptions` keeps pino's default `errorKey` (`err`) and `messageKey` (`msg`).
 */
function carriesErrorWithoutMessage(first: object): boolean {
  if (first instanceof Error) return true;
  const fields = first as Record<string, unknown>;
  return Boolean(fields['err']) && fields['msg'] === undefined;
}

/**
 * `hooks.logMethod`: `msg` is only ever the string the caller wrote. A call keeps its first argument
 * and, after an object, a string message. Dropped: printf-style arguments (pino interpolates them
 * into `msg`, past the serializers and the denylist) and a message that is not a string (written to
 * `msg` as it is). An error logged without a message gets `ERROR_LOGGED_MESSAGE` instead of the
 * `err.message` pino would copy (a driver message can quote statement parameters).
 */
function callerMessageOnly(this: Logger, args: Parameters<LogFn>, method: LogFn): void {
  const [first, message] = args as readonly unknown[];
  let kept: unknown[];
  if (typeof first !== 'object' || first === null) kept = [first];
  else if (typeof message === 'string') kept = [first, message];
  else kept = carriesErrorWithoutMessage(first) ? [first, ERROR_LOGGED_MESSAGE] : [first];
  method.apply(this, kept as Parameters<LogFn>);
}

export type LoggerConfig = {
  readonly level: string;
  readonly service?: string;
};

/** pino options shared by the HTTP logger and any standalone pino instance. */
export function loggerOptions(config: LoggerConfig): LoggerOptions {
  return {
    level: config.level,
    base: { service: config.service ?? 'api' },
    // Merged into each line before `formatters.log`, so the denylist still applies to it.
    mixin: correlationLogFields,
    serializers: allowlistSerializers,
    hooks: { logMethod: callerMessageOnly },
    formatters: {
      log: pinoLogFormatter,
      bindings: (bindings) => redactForbidden(bindings) as Record<string, unknown>,
    },
    // Child-logger bindings bypass `formatters.log` (pino resets the bindings formatter for
    // children): `childLogger` applies it first. The forbidden words are also redact paths, the
    // backstop for a raw `.child()` (pino-http's per-request child): exact key at the top level
    // and one level down only, no word-split variant and no Error summary.
    redact: {
      paths: FORBIDDEN_LOG_KEYS.flatMap((key) => [key, `*.${key}`]),
      censor: REDACTED,
    },
  };
}

/** pino-http options for nestjs-pino: allowlisted request logging, optional test sink. */
export function httpLoggerOptions(config: LoggerConfig, stream?: Writable): PinoHttpOptions {
  return {
    ...loggerOptions(config),
    ...(stream ? { stream } : {}),
    autoLogging: true,
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request errored',
  };
}
