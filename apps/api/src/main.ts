// Composition root, part 2: build the app (app.module.ts) and listen on the configured port.
//
// Telemetry (planning/14 §3) is started before this file by the `--import` entry
// `platform/telemetry/instrument-api.ts` (package scripts `dev` and `start`; a no-op without
// `OTEL_EXPORTER_OTLP_ENDPOINT`). `AppModule.onApplicationShutdown` flushes it last on a graceful
// shutdown; a failed start flushes it here. Started without that entry, the API runs untraced.
import 'reflect-metadata';

import { createApp } from './app.module.js';
import { loadConfig } from './config.js';
import { shutdownTelemetry } from './platform/index.js';

try {
  const config = loadConfig();
  const app = await createApp({ config });
  await app.listen({ port: config.listenPort, host: '0.0.0.0' });
} catch (error) {
  // Export what the failed start traced and logged, then fail the process with the start error.
  await shutdownTelemetry().catch(() => undefined);
  throw error;
}
