// API request metrics (planning/14 §4 `api.request.duration`, `api.request.errors`): one Fastify
// `onResponse` hook records every response's duration and counts the 5xx ones. Translation only:
// the attributes are the route template Fastify matched, the method and the status code.
import type { Attributes, Meter } from '@opentelemetry/api';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { METRIC_NAMES, REQUEST_DURATION_BUCKETS_SECONDS, stylistMeter } from './metrics.js';

/** Methods the HTTP semantic conventions name; anything else is recorded as `_OTHER`. */
const KNOWN_METHODS: ReadonlySet<string> = new Set([
  'CONNECT',
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
  'TRACE',
]);

function methodAttribute(method: string): string {
  return KNOWN_METHODS.has(method) ? method : '_OTHER';
}

/**
 * The route template (`/v1/items/:id`), never the raw path. Fastify leaves it `undefined` when no
 * route matched (404); the attribute is then omitted, as the HTTP semantic conventions require.
 */
function routeAttributes(route: string | undefined): Attributes {
  return route === undefined ? {} : { 'http.route': route };
}

/**
 * Install the request metrics on the API's root Fastify instance. Call it once, before the routes
 * are registered (before `app.init()` / `app.listen()`): the `onRoute` hook registers the error
 * counter at 0 for every route, so the first 5xx after a restart is visible to `increase()`.
 * `meter`: tests only; defaults to the global meter, which the telemetry `--import` entry
 * installs (a no-op without it).
 */
export function registerRequestMetrics(
  fastify: FastifyInstance,
  meter: Meter = stylistMeter(),
): void {
  const duration = meter.createHistogram(METRIC_NAMES.requestDuration, {
    description: 'Duration of HTTP server requests, by route template, method and status code',
    unit: 's',
    advice: { explicitBucketBoundaries: [...REQUEST_DURATION_BUCKETS_SECONDS] },
  });
  const errors = meter.createCounter(METRIC_NAMES.requestErrors, {
    description: 'HTTP server responses with a 5xx status code, by route template',
  });
  const errorAttributes = (route: string | undefined): Attributes => ({
    ...routeAttributes(route),
    'error.class': '5xx',
  });

  // Unmatched requests (404 handler) have no route: their series exists from the start too.
  errors.add(0, errorAttributes(undefined));
  fastify.addHook('onRoute', function requestMetricsOnRoute(route) {
    errors.add(0, errorAttributes(route.url));
  });
  fastify.addHook(
    'onResponse',
    function requestMetricsOnResponse(request: FastifyRequest, reply: FastifyReply, done) {
      const route = request.routeOptions.url;
      const status = reply.statusCode;
      duration.record(reply.elapsedTime / 1000, {
        ...routeAttributes(route),
        'http.request.method': methodAttribute(request.method),
        'http.response.status_code': status,
      });
      if (status >= 500) errors.add(1, errorAttributes(route));
      done();
    },
  );
}
