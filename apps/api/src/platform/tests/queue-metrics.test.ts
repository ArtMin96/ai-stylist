// `QueueMetrics` with an in-memory metric reader (planning/14 §4): counter names, zero-initialised
// series per known job type, outcome counting around a handler (completion, failure, retry), one
// dead letter counted once, and the queue gauges read at collection time (units, attributes, a
// failed read, stopping). The pg-boss side of the gauges is `queue-stats.docker.test.ts`; the
// jobs-process wiring with an injected failure is `apps/api/src/jobs/tests/queue-metrics.docker.test.ts`.
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { memoryLogStream } from '@ai-stylist/test-support';

import {
  type JobHandler,
  METRIC_NAMES,
  QueueMetrics,
  type QueueJob,
  type QueueStatsSnapshot,
  loggerOptions,
} from '../index.js';

import {
  type MemoryMetrics,
  memoryMetrics,
  metricNamed,
  numberPoints,
  valueAt,
} from './memory-metrics.js';

const SOURCE = {
  name: 'test.metrics',
  retryLimit: 2,
  retryDelaySeconds: 1,
  retryDelayMaxSeconds: 1,
};
const DEAD_LETTER = { ...SOURCE, name: 'test.metrics.dlq' };

function job(attempt: number, queue = SOURCE.name): QueueJob {
  return { id: `job-${attempt}`, queue, data: {}, attempt, signal: new AbortController().signal };
}

describe('QueueMetrics (in-memory reader)', () => {
  let metrics: MemoryMetrics;
  const logs = memoryLogStream();
  const logger = pino(loggerOptions({ level: 'debug', service: 'api-test' }), logs);

  beforeEach(() => {
    metrics = memoryMetrics();
  });

  afterEach(async () => {
    await metrics.shutdown();
  });

  function queueMetrics(): QueueMetrics {
    return new QueueMetrics({
      jobTypes: [SOURCE.name, DEAD_LETTER.name],
      deadLetterSources: [SOURCE.name],
      logger,
      meter: metrics.meter,
    });
  }

  it('starts every counter at 0 for each known job type, and dlq for each dead-letter source only', async () => {
    queueMetrics();
    const collected = await metrics.collect();

    for (const name of [
      METRIC_NAMES.jobCompletions,
      METRIC_NAMES.jobFailures,
      METRIC_NAMES.jobRetries,
    ]) {
      const counter = metricNamed(collected, name);
      expect(counter.descriptor.unit).toBe('');
      expect(numberPoints(counter)).toEqual([
        { attributes: { job_type: SOURCE.name }, value: 0 },
        { attributes: { job_type: DEAD_LETTER.name }, value: 0 },
      ]);
    }
    const dlq = metricNamed(collected, 'stylist.queue.job.dlq');
    expect(numberPoints(dlq)).toEqual([{ attributes: { job_type: SOURCE.name }, value: 0 }]);
    expect(METRIC_NAMES).toMatchObject({
      jobCompletions: 'stylist.queue.job.completions',
      jobFailures: 'stylist.queue.job.failures',
      jobRetries: 'stylist.queue.job.retries',
      jobDeadLetters: 'stylist.queue.job.dlq',
    });
  });

  it('counts completions, failures and retries around a handler and rethrows the failure', async () => {
    const qm = queueMetrics();
    const failure = new Error('injected');
    const handler = qm.countOutcomes(SOURCE, (j) =>
      j.attempt === 3 ? Promise.resolve() : Promise.reject(failure),
    );

    await expect(handler(job(1))).rejects.toBe(failure);
    await expect(handler(job(2))).rejects.toBe(failure);
    await expect(handler(job(3))).resolves.toBeUndefined();
    // The last attempt (retryLimit + 1 = 3) fails: a failure, no retry (pg-boss dead-letters it).
    const lastAttemptFails = qm.countOutcomes(SOURCE, () => Promise.reject(failure));
    await expect(lastAttemptFails(job(3))).rejects.toBe(failure);

    const collected = await metrics.collect();
    const at = (name: string) => valueAt(metricNamed(collected, name), { job_type: SOURCE.name });
    expect(at(METRIC_NAMES.jobCompletions)).toBe(1);
    expect(at(METRIC_NAMES.jobFailures)).toBe(3);
    expect(at(METRIC_NAMES.jobRetries)).toBe(2);
  });

  it('counts a dead letter once for its source queue, on its first delivery only', async () => {
    const qm = queueMetrics();
    const runs: number[] = [];
    const inner: JobHandler = (j) => {
      runs.push(j.attempt);
      return j.attempt === 1 ? Promise.reject(new Error('mark failed')) : Promise.resolve();
    };
    const handler = qm.countOutcomes(DEAD_LETTER, qm.countDeadLetters(SOURCE.name, inner));

    await expect(handler(job(1, DEAD_LETTER.name))).rejects.toThrow('mark failed');
    await handler(job(2, DEAD_LETTER.name));

    expect(runs).toEqual([1, 2]);
    const collected = await metrics.collect();
    expect(
      valueAt(metricNamed(collected, METRIC_NAMES.jobDeadLetters), { job_type: SOURCE.name }),
    ).toBe(1);
    expect(
      valueAt(metricNamed(collected, METRIC_NAMES.jobCompletions), { job_type: DEAD_LETTER.name }),
    ).toBe(1);
  });

  it('reports queue depth and oldest job age at collection time, with their units and attributes', async () => {
    const qm = queueMetrics();
    let reads = 0;
    const snapshot: QueueStatsSnapshot = {
      depth: [
        { queue: SOURCE.name, jobs: 7 },
        { queue: DEAD_LETTER.name, jobs: 0 },
        { queue: `${DEAD_LETTER.name}.dlq`, jobs: 2 },
      ],
      oldestAgeSeconds: [
        { jobType: SOURCE.name, seconds: 42.5 },
        { jobType: DEAD_LETTER.name, seconds: 0 },
      ],
    };
    const stop = qm.observeQueues(() => {
      reads += 1;
      return Promise.resolve(snapshot);
    });

    const collected = await metrics.collect();
    const depth = metricNamed(collected, 'stylist.queue.depth');
    const age = metricNamed(collected, 'stylist.queue.job.age_oldest');
    expect(depth.descriptor.unit).toBe('');
    expect(age.descriptor.unit).toBe('s');
    expect(numberPoints(depth)).toEqual([
      { attributes: { queue: SOURCE.name }, value: 7 },
      { attributes: { queue: DEAD_LETTER.name }, value: 0 },
      { attributes: { queue: 'test.metrics.dlq.dlq' }, value: 2 },
    ]);
    expect(numberPoints(age)).toEqual([
      { attributes: { job_type: SOURCE.name }, value: 42.5 },
      { attributes: { job_type: DEAD_LETTER.name }, value: 0 },
    ]);
    expect(reads).toBe(1);

    stop();
    await metrics.collect();
    expect(reads).toBe(1);
  });

  it('reports no gauge point for a failed read and logs its error class only', async () => {
    const qm = queueMetrics();
    const marker = 'stats-failure-marker-9c1d';
    qm.observeQueues(() => Promise.reject(new TypeError(marker)));

    const collected = await metrics.collect();
    const depth = collected.find((m) => m.descriptor.name === METRIC_NAMES.queueDepth);
    expect(depth === undefined ? [] : numberPoints(depth)).toEqual([]);
    const record = logs.records().find((r) => r.msg === 'queue stats read failed');
    expect(record).toMatchObject({ component: 'queue-metrics', errorName: 'TypeError' });
    expect(logs.text()).not.toContain(marker);
  });
});
