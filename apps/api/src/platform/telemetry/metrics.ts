// The metrics catalog this process emits (planning/14 §4). The names are fixed: the Grafana
// dashboards and alerts in docs/observability/grafana/** query them after Grafana Cloud's OTLP →
// Prometheus conversion (`.` → `_`, unit `s` → `_seconds`, counters `_total`, histograms
// `_bucket/_sum/_count`; docs/observability/grafana.md "Metric names in PromQL"). Attributes carry
// route templates, queue names and enums only: never an id, a raw path or anything user-derived
// (planning/11 §8; the 10k active-series cap of the free tier).
//
// Instruments come from the global `@opentelemetry/api` meter, which the NodeSDK started by the
// `--import` entry (./register.ts) installs before the application loads. The metrics API has no
// proxy provider: without that entry (tests, local runs without an OTLP endpoint) every instrument
// is a no-op, and a meter taken before the SDK started stays a no-op. Take it at composition time.
import { type Meter, metrics } from '@opentelemetry/api';

/** Instrumentation scope of every `stylist.*` instrument the API and jobs processes create. */
export const STYLIST_METER_NAME = '@ai-stylist/api';

export const METRIC_NAMES = {
  /** Histogram, seconds. `http.route`, `http.request.method`, `http.response.status_code`. */
  requestDuration: 'stylist.api.request.duration',
  /** Counter of 5xx responses. `http.route`, `error.class` = `5xx`. */
  requestErrors: 'stylist.api.request.errors',
  /** Gauge: jobs waiting (created or retry) per `queue`, dead-letter queues included. */
  queueDepth: 'stylist.queue.depth',
  /** Gauge, seconds: age of the oldest waiting job per `job_type`. */
  jobAgeOldest: 'stylist.queue.job.age_oldest',
  /** Counter: job attempts that completed, per `job_type`. */
  jobCompletions: 'stylist.queue.job.completions',
  /** Counter: job attempts that failed (the handler threw), per `job_type`. */
  jobFailures: 'stylist.queue.job.failures',
  /** Counter: failed attempts pg-boss retries, per `job_type`. */
  jobRetries: 'stylist.queue.job.retries',
  /** Counter: jobs that reached their dead-letter queue, per source `job_type`. */
  jobDeadLetters: 'stylist.queue.job.dlq',
} as const;

/**
 * Explicit bucket boundaries of `stylist.api.request.duration`, in seconds: the OpenTelemetry HTTP
 * semantic conventions' advice for `http.server.request.duration`
 * (https://opentelemetry.io/docs/specs/semconv/http/http-metrics/, stable). The SDK's
 * default boundaries (0 … 10000) are sized for milliseconds and would put every request in the
 * first bucket. Explicit (not exponential) buckets, so Grafana gets the `_bucket` series the
 * latency panels read.
 */
export const REQUEST_DURATION_BUCKETS_SECONDS: readonly number[] = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
];

/** The global meter for `stylist.*` instruments (a no-op until the telemetry SDK started). */
export function stylistMeter(): Meter {
  return metrics.getMeter(STYLIST_METER_NAME);
}
