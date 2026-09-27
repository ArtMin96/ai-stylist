// Queue metrics of the jobs process (planning/14 §4): job attempt outcomes and dead letters as
// counters, queue depth and oldest-job age as gauges read from pg-boss at each metric collection.
// Translation only: the composition root (apps/api/src/jobs/index.ts) says which queues exist and
// wraps each worker's handler; the counts come from what pg-boss and the handler report.
// Attributes are queue names (`queue`, `job_type`) only.
import type { BatchObservableCallback, Counter, Meter, ObservableGauge } from '@opentelemetry/api';
import type { Logger } from 'pino';

import type { JobHandler, QueueDefinition, QueueStatsSnapshot } from '../queue/pg-boss-queue.js';
import { errorSummary } from '../queue/error-summary.js';
import { withTimeout } from '../resilience/timeout.js';

import { METRIC_NAMES, stylistMeter } from './metrics.js';

/** Upper bound on one gauge read (pg-boss stats + one SQL query) per metric collection. */
export const QUEUE_STATS_READ_TIMEOUT_MS = 10_000;

export type QueueMetricsOptions = {
  /** Every queue this process works (`job_type`): completions, failures and retries start at 0. */
  readonly jobTypes: readonly string[];
  /** Source queues whose `<queue>.dlq` this process works: their `dlq` counter starts at 0. */
  readonly deadLetterSources: readonly string[];
  /** A pino logger built from `loggerOptions()`; a failed gauge read logs its error class only. */
  readonly logger: Logger;
  /** Tests only; defaults to the global meter (a no-op unless the telemetry entry started). */
  readonly meter?: Meter;
};

export class QueueMetrics {
  private readonly meter: Meter;
  private readonly logger: Logger;
  private readonly completions: Counter;
  private readonly failures: Counter;
  private readonly retries: Counter;
  private readonly deadLetters: Counter;
  private readonly depth: ObservableGauge;
  private readonly ageOldest: ObservableGauge;

  constructor(options: QueueMetricsOptions) {
    const meter = options.meter ?? stylistMeter();
    this.meter = meter;
    this.logger = options.logger.child({ component: 'queue-metrics' });
    this.completions = meter.createCounter(METRIC_NAMES.jobCompletions, {
      description: 'Job attempts that completed, by job type',
    });
    this.failures = meter.createCounter(METRIC_NAMES.jobFailures, {
      description: 'Job attempts that failed (the handler threw), by job type',
    });
    this.retries = meter.createCounter(METRIC_NAMES.jobRetries, {
      description: 'Failed job attempts that pg-boss runs again, by job type',
    });
    this.deadLetters = meter.createCounter(METRIC_NAMES.jobDeadLetters, {
      description: 'Jobs that exhausted their attempts and reached their dead-letter queue',
    });
    // No unit: a count (a gauge with unit `1` would be renamed `_ratio` by Grafana Cloud).
    this.depth = meter.createObservableGauge(METRIC_NAMES.queueDepth, {
      description: 'Jobs waiting (created or retry) per queue, dead-letter queues included',
    });
    this.ageOldest = meter.createObservableGauge(METRIC_NAMES.jobAgeOldest, {
      description: 'Age of the oldest waiting job per job type (0 when none waits)',
      unit: 's',
    });
    // Every known series exists from process start: `increase()` cannot see the first increment
    // of a series that starts at 1 (docs/observability/grafana.md, rule 3).
    for (const jobType of options.jobTypes) {
      const attributes = { job_type: jobType };
      this.completions.add(0, attributes);
      this.failures.add(0, attributes);
      this.retries.add(0, attributes);
    }
    for (const source of options.deadLetterSources) {
      this.deadLetters.add(0, { job_type: source });
    }
  }

  /**
   * Wrap the handler of `definition`'s worker: a resolved attempt counts as a completion, a thrown
   * one as a failure, and also as a retry while `attempt < retryLimit + 1` (pg-boss runs it again).
   * The error is rethrown unchanged. A job refused for a cancelled user never reaches the handler
   * and counts as neither.
   */
  countOutcomes(definition: QueueDefinition, handler: JobHandler): JobHandler {
    const attributes = { job_type: definition.name };
    const maxAttempts = definition.retryLimit + 1;
    return async (job) => {
      try {
        await handler(job);
      } catch (error) {
        this.failures.add(1, attributes);
        if (job.attempt < maxAttempts) this.retries.add(1, attributes);
        throw error;
      }
      this.completions.add(1, attributes);
    };
  }

  /**
   * Wrap the handler of `<source>.dlq`'s worker: every dead letter counts once for `source`, on its
   * first delivery (`attempt` 1), whether or not the handler then succeeds. A redelivery after a
   * failed first attempt is the same dead letter and does not count again.
   */
  countDeadLetters(source: string, handler: JobHandler): JobHandler {
    const attributes = { job_type: source };
    return (job) => {
      if (job.attempt === 1) this.deadLetters.add(1, attributes);
      return handler(job);
    };
  }

  /**
   * Report `stylist.queue.depth` and `stylist.queue.job.age_oldest` from `read` at every metric
   * collection (the periodic export, 60 s by default). A failed or slow read (bounded by
   * `QUEUE_STATS_READ_TIMEOUT_MS`) reports nothing for that collection and logs its error class.
   * Returns the function that stops observing: call it before the queue stops.
   */
  observeQueues(read: () => Promise<QueueStatsSnapshot>): () => void {
    const callback: BatchObservableCallback = async (result) => {
      let snapshot: QueueStatsSnapshot;
      try {
        snapshot = await withTimeout(() => read(), QUEUE_STATS_READ_TIMEOUT_MS);
      } catch (error) {
        this.logger.warn(errorSummary(error), 'queue stats read failed');
        return;
      }
      for (const { queue, jobs } of snapshot.depth) {
        result.observe(this.depth, jobs, { queue });
      }
      for (const { jobType, seconds } of snapshot.oldestAgeSeconds) {
        result.observe(this.ageOldest, seconds, { job_type: jobType });
      }
    };
    const observables = [this.depth, this.ageOldest];
    this.meter.addBatchObservableCallback(callback, observables);
    return () => this.meter.removeBatchObservableCallback(callback, observables);
  }
}
