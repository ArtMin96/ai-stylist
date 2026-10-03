// In-memory span exporter for in-process telemetry tests (passed as `startTelemetry`'s
// `spanExporter`, so spans still go through the SanitizingSpanExporter). The SDK's own
// `InMemorySpanExporter` lives in `@opentelemetry/sdk-trace`, which is not a direct dependency of
// apps/api; this is the same few lines, typed from NodeSDK's configuration.
import { core } from '@opentelemetry/sdk-node';

import type { ExportedSpan, SpanExporter } from '../telemetry/span-sanitizer.js';

export type MemorySpanExporter = SpanExporter & {
  /** Every span exported so far, in export order. */
  readonly spans: ExportedSpan[];
};

export function memorySpanExporter(): MemorySpanExporter {
  const spans: ExportedSpan[] = [];
  return {
    spans,
    export(batch, resultCallback) {
      spans.push(...batch);
      resultCallback({ code: core.ExportResultCode.SUCCESS });
    },
    shutdown: () => Promise.resolve(),
    forceFlush: () => Promise.resolve(),
  };
}
