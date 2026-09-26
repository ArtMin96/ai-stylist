// Process entry for the dedicated `jobs` process (doc 04 §9.1 step 3): validated config, pino
// logger, `startJobs`, graceful shutdown on SIGINT/SIGTERM.
import 'reflect-metadata';

import pino from 'pino';

import { ConfigError, loadConfig } from '../config.js';
import { loggerOptions } from '../platform/index.js';

import { startJobs } from './index.js';

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

const jobs = await startJobs({
  databaseUrl: config.DATABASE_URL,
  segmentationBaseUrl: SEGMENTATION_BASE_URL,
  logger,
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'jobs stopping');
  try {
    await jobs.stop();
    logger.info('jobs stopped');
  } catch (error) {
    logger.error(
      { errorName: error instanceof Error ? error.name : typeof error },
      'jobs stop failed',
    );
    process.exitCode = 1;
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}
