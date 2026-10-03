// Child process started by telemetry-process.ts behind a real `--import` telemetry entry, like a
// process entry (main.ts, jobs/main.ts). Inside one span and one correlation scope it logs the
// redaction canary through the API's pino options and fetches the receiver with a
// credential-shaped query string, then flushes telemetry. argv[2]: the receiver's base URL.
import { trace } from '@opentelemetry/api';
import pino from 'pino';

import { loggerOptions } from '../logger.js';
import { runWithCorrelationId } from '../telemetry/correlation.js';
import { shutdownTelemetry } from '../telemetry/lifecycle.js';

import { CANARY, plant } from './redaction-canary.js';
import { FIXTURE_CORRELATION_ID, PROBE_PATH } from './telemetry-process.js';

const receiverUrl = process.argv[2];
if (receiverUrl === undefined) throw new TypeError('usage: telemetry-fixture-process <url>');

const logger = pino(loggerOptions({ level: 'info', service: 'telemetry-fixture' }));
const tracer = trace.getTracer('telemetry-fixture');

await tracer.startActiveSpan('fixture.operation', async (span) => {
  await runWithCorrelationId(FIXTURE_CORRELATION_ID, async () => {
    logger.info(plant(), 'canary');
    const response = await fetch(`${receiverUrl}${PROBE_PATH}?sig=${CANARY}&token=${CANARY}`);
    await response.body?.cancel();
    logger.info({ status: response.status }, 'probe done');
  });
  span.end();
});
logger.info('outside any scope');
await shutdownTelemetry();
