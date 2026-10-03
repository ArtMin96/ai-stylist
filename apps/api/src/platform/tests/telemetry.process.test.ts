// The telemetry `--import` entries in a real child process (tsx, like `just dev-*`), against a stub
// OTLP/HTTP receiver: no endpoint → nothing starts and nothing leaves the process; an endpoint →
// traces, metrics and logs arrive over OTLP/protobuf with the process resource, the fetch carries
// a W3C `traceparent`, log lines carry `trace_id`, and no planted value or query string is exported.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CANARY } from './redaction-canary.js';
import {
  FIXTURE_CORRELATION_ID,
  FIXTURE_TEST_TIMEOUT_MS,
  type OtlpReceiver,
  PROBE_PATH,
  encodedStringAttribute,
  runTelemetryFixture,
  startOtlpReceiver,
} from './telemetry-process.js';

const OTLP_PATHS = ['/v1/traces', '/v1/metrics', '/v1/logs'];

// Every test spawns a cold `tsx --import` child: 5 s is too short under full-suite load.
describe('telemetry --import entries', { timeout: FIXTURE_TEST_TIMEOUT_MS }, () => {
  let receiver: OtlpReceiver;

  beforeAll(async () => {
    receiver = await startOtlpReceiver();
  });

  afterAll(async () => {
    await receiver.close();
  });

  beforeEach(() => {
    receiver.requests.length = 0;
  });

  function probes() {
    return receiver.requests.filter((request) => request.path.startsWith(PROBE_PATH));
  }

  it('without an OTLP endpoint nothing starts: no export, traceparent or trace_id', async () => {
    const run = await runTelemetryFixture({
      entry: 'jobs',
      receiverUrl: receiver.url,
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: '', APP_VERSION: '1.2.3', APP_ENV: 'staging' },
    });

    expect(run.code, run.stderr).toBe(0);
    expect(receiver.requests.map((request) => request.path.split('?')[0])).toEqual([PROBE_PATH]);
    expect(probes()[0]?.headers['traceparent']).toBeUndefined();
    const canary = run.records.find((record) => record['msg'] === 'canary');
    expect(canary?.['correlation_id']).toBe(FIXTURE_CORRELATION_ID);
    expect(canary).not.toHaveProperty('trace_id');
    expect(run.stdout).not.toContain(CANARY);
  });

  it('exports traces, metrics and logs over OTLP with the jobs resource, ids only', async () => {
    const run = await runTelemetryFixture({
      entry: 'jobs',
      receiverUrl: receiver.url,
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: receiver.url, APP_VERSION: '1.2.3', APP_ENV: 'staging' },
    });

    expect(run.code, run.stderr).toBe(0);
    const canary = run.records.find((record) => record['msg'] === 'canary');
    const traceId = canary?.['trace_id'];
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(canary?.['span_id']).toMatch(/^[0-9a-f]{16}$/);
    expect(canary?.['correlation_id']).toBe(FIXTURE_CORRELATION_ID);
    // undici injected the context of the active span into the fetch.
    expect(probes()[0]?.headers['traceparent']).toMatch(new RegExp(`^00-${String(traceId)}-`));

    const traces = receiver.bodies('/v1/traces');
    for (const path of OTLP_PATHS) expect(receiver.bodies(path).length, path).toBeGreaterThan(0);
    expect(traces.includes(Buffer.from(String(traceId), 'hex'))).toBe(true);
    for (const [key, value] of [
      ['service.name', 'jobs'],
      ['service.version', '1.2.3'],
      ['deployment.environment.name', 'staging'],
    ] as const) {
      expect(traces.includes(encodedStringAttribute(key, value)), key).toBe(true);
    }
    // The fetch's client span keeps the URL path, never the query (planning/11 §8).
    const probeUrl = encodedStringAttribute('url.full', `${receiver.url}${PROBE_PATH}`);
    expect(traces.includes(probeUrl)).toBe(true);
    const correlation = encodedStringAttribute('correlation_id', FIXTURE_CORRELATION_ID);
    expect(receiver.bodies('/v1/logs').includes(correlation)).toBe(true);
    for (const path of OTLP_PATHS) {
      expect(receiver.bodies(path).includes(CANARY), path).toBe(false);
    }
    expect(run.stdout).not.toContain(CANARY);
  });

  it('lets OTEL_SERVICE_NAME override the default service name', async () => {
    const run = await runTelemetryFixture({
      entry: 'jobs',
      receiverUrl: receiver.url,
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: receiver.url, OTEL_SERVICE_NAME: 'svc-override' },
    });

    expect(run.code, run.stderr).toBe(0);
    const traces = receiver.bodies('/v1/traces');
    expect(traces.includes(encodedStringAttribute('service.name', 'svc-override'))).toBe(true);
    expect(traces.includes(encodedStringAttribute('service.name', 'jobs'))).toBe(false);
  });

  it('starts the API entry (http + @fastify/otel instrumentation) under its own name', async () => {
    const run = await runTelemetryFixture({
      entry: 'api',
      receiverUrl: receiver.url,
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: receiver.url },
    });

    expect(run.code, run.stderr).toBe(0);
    const traces = receiver.bodies('/v1/traces');
    expect(traces.includes(encodedStringAttribute('service.name', 'api'))).toBe(true);
    expect(traces.includes(CANARY)).toBe(false);
  });
});
