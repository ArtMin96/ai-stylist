// Process entry for the dedicated `jobs` process (doc 04 §9.1 step 3): validated config, pino
// logger, `startJobs`, graceful shutdown on SIGINT/SIGTERM.
//
// Telemetry (doc 14 §3) is started before this file by the `--import` entry
// `../platform/telemetry/instrument-jobs.ts` (no-op without `OTEL_EXPORTER_OTLP_ENDPOINT`), e.g.
// `tsx --import ./src/platform/telemetry/instrument-jobs.ts src/jobs/main.ts`; this file flushes it
// last on shutdown. Started without that entry, the process runs untraced.
import 'reflect-metadata';

import pino from 'pino';

import { ConfigError, loadConfig } from '../config.js';
import { loggerOptions, shutdownTelemetry } from '../platform/index.js';

import { type RunningJobs, startJobs } from './index.js';

/**
 * Segmentation worker origin: where `just dev-workers` serves it (uvicorn on :8001). A constant,
 * not an env key: P02-T08 adds no `.env.example` key. Deployed environments need one first.
 */
const SEGMENTATION_BASE_URL = 'http://127.0.0.1:8001';

const config = loadConfig();
const logger = pino(loggerOptions({ level: config.LOG_LEVEL, service: 'jobs' }));
if (config.DATABASE_URL === undefined) {
  throw new ConfigError('invalid configuration: DATABASE_URL is required by the jobs process');
}

let jobs: RunningJobs;
try {
  jobs = await startJobs({
    databaseUrl: config.DATABASE_URL,
    segmentationBaseUrl: SEGMENTATION_BASE_URL,
    logger,
  });
} catch (error) {
  // Export what the failed start traced and logged, then fail the process with the start error.
  await shutdownTelemetry().catch(() => undefined);
  throw error;
}

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'jobs stopping');
  try {
    await jobs.stop();
    logger.info('jobs stopped');
  } catch (error) {
    // `err` is the logger's error allowlist: class (identifier-shaped) and code only.
    logger.error({ err: error }, 'jobs stop failed');
    process.exitCode = 1;
  } finally {
    // Last: the stop's own spans and log lines are exported too.
    await shutdownTelemetry().catch(() => {
      process.exitCode = 1;
    });
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}
