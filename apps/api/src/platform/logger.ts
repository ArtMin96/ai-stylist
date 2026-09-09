// pino options implementing doc 11 §8 / doc 14 §2: allowlist serializers for req/res (method,
// url path, request id, status code — nothing else) plus a forbidden-key denylist applied to
// every merged object at any depth as a backstop. The canary test in tests/ plants marker
// values under each forbidden key and asserts none reach the sink.
import type { Writable } from 'node:stream';

import { type LoggerOptions, stdSerializers } from 'pino';
import type { Options as PinoHttpOptions } from 'pino-http';

/** Forbidden key words (doc 11 §8). A key matches when any of its camel/snake/kebab words does. */
export const FORBIDDEN_LOG_KEYS = [
  'measurements',
  'measurement',
  'selfie',
  'face',
  'photo',
  'image',
  'location',
  'lat',
  'lng',
  'latitude',
  'longitude',
  'coordinates',
  'token',
  'authorization',
  'cookie',
  'password',
  'secret',
  'email',
  'phone',
  'body',
  'prompt',
  'calendar',
] as const;

export const REDACTED = '[REDACTED]';

const FORBIDDEN = new Set<string>(FORBIDDEN_LOG_KEYS);
const WORD_SPLIT = /[^a-zA-Z0-9]+|(?<=[a-z0-9])(?=[A-Z])/;

export function isForbiddenLogKey(key: string): boolean {
  if (FORBIDDEN.has(key.toLowerCase())) return true;
  return key
    .split(WORD_SPLIT)
    .map((word) => word.toLowerCase())
    .some((word) => word.length > 0 && FORBIDDEN.has(word));
}

/** Deep-copy `value`, replacing every forbidden key's value with REDACTED. Cycle-safe. */
export function redactForbidden(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
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

function stripQuery(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

type SerializedReq = { id?: unknown; method?: string; url?: string };
type SerializedRes = { statusCode?: number };

export const allowlistSerializers = {
  /** Only method, path (query stripped: signed URLs carry credentials) and the request id. */
  req: (req: SerializedReq) => ({ id: req.id, method: req.method, url: stripQuery(req.url) }),
  res: (res: SerializedRes) => ({ statusCode: res.statusCode }),
  err: (err: Error) => redactForbidden(stdSerializers.err(err)),
} as const;

export const pinoLogFormatter = (object: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(object)) {
    if (isForbiddenLogKey(key)) out[key] = REDACTED;
    else out[key] = SERIALIZED_KEYS.has(key) ? entry : redactForbidden(entry);
  }
  return out;
};

export type LoggerConfig = {
  readonly level: string;
  readonly service?: string;
};

/** pino options shared by the HTTP logger and any standalone pino instance. */
export function loggerOptions(config: LoggerConfig): LoggerOptions {
  return {
    level: config.level,
    base: { service: config.service ?? 'api' },
    serializers: allowlistSerializers,
    formatters: {
      log: pinoLogFormatter,
      bindings: (bindings) => redactForbidden(bindings) as Record<string, unknown>,
    },
    // Child-logger bindings bypass `formatters.log` (pino resets the bindings formatter for
    // children), so the forbidden words are also redact paths: exact key at the top level and one
    // level down. Deeper structures in *bindings* are not covered — keep bindings flat.
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
