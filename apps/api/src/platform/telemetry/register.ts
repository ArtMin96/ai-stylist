// Process bootstrap for telemetry, run through Node's `--import` flag (instrument-api.ts,
// instrument-jobs.ts) before the application's modules load, as the OpenTelemetry JS ESM guidance
// requires: ESM imports are only patched when the loader hook is registered first
// (https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md).
//
// With no OTLP endpoint it returns before touching anything: no loader hook, no SDK, no exporter,
// no network. Local runs, tests and CI stay unaffected.
import { register } from 'node:module';

import type { TelemetryService } from './telemetry.js';

/**
 * Modules the application imports as ESM that an instrumentation patches. Only these pass through
 * the import-in-the-middle loader; everything else loads untouched. CommonJS `require` (fastify,
 * pino-http, pg-pool) is patched by require-in-the-middle without a loader.
 */
export const ESM_INSTRUMENTED_MODULES: readonly string[] = ['pino', 'pg'];

/** The env keys the bootstrap reads (the exporters read the rest of `OTEL_*` themselves). */
export type TelemetryEnv = {
  readonly OTEL_EXPORTER_OTLP_ENDPOINT?: string | undefined;
  readonly APP_VERSION?: string | undefined;
  readonly APP_ENV?: string | undefined;
};

/**
 * Register the ESM loader hook, then start telemetry for `service`, when
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Returns whether telemetry started.
 */
export async function registerTelemetry(
  service: TelemetryService,
  env: TelemetryEnv,
): Promise<boolean> {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (endpoint === undefined || endpoint === '') return false;
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url, {
    data: { include: [...ESM_INSTRUMENTED_MODULES] },
  });
  // Imported after the hook is registered, so every module this pulls in (pino included, through
  // the span sanitizer's use of the log denylist) already passes through it.
  const { startTelemetry } = await import('./telemetry.js');
  return startTelemetry({
    service,
    serviceVersion: env.APP_VERSION,
    environment: env.APP_ENV,
    otlpEndpoint: endpoint,
  }).enabled;
}
