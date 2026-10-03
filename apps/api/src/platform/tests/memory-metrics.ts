// In-memory metrics for in-process tests: a `MeterProvider` from @opentelemetry/sdk-metrics whose
// reader collects on demand, with cumulative temporality (what the OTLP exporter sends by default
// and Grafana Cloud's Prometheus conversion expects). Production uses the periodic OTLP reader
// that `telemetry.ts` configures; the instruments and their data are the same.
import type { Attributes, Meter } from '@opentelemetry/api';
import {
  DataPointType,
  type Histogram,
  type MetricData,
  MeterProvider,
  MetricReader,
} from '@opentelemetry/sdk-metrics';

class OnDemandReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export type MemoryMetrics = {
  readonly meter: Meter;
  /** Every metric recorded so far; throws the first collection error (a failed callback). */
  collect(): Promise<MetricData[]>;
  shutdown(): Promise<void>;
};

export function memoryMetrics(): MemoryMetrics {
  const reader = new OnDemandReader();
  const provider = new MeterProvider({ readers: [reader] });
  return {
    meter: provider.getMeter('test'),
    async collect() {
      const { resourceMetrics, errors } = await reader.collect();
      if (errors.length > 0) throw errors[0];
      return resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics);
    },
    shutdown: () => provider.shutdown(),
  };
}

/** The metric called `name`, or an error listing what was collected. */
export function metricNamed(collected: readonly MetricData[], name: string): MetricData {
  const metric = collected.find((m) => m.descriptor.name === name);
  if (metric === undefined) {
    const names = collected.map((m) => m.descriptor.name).join(', ');
    throw new Error(`metric ${name} not collected (collected: ${names})`);
  }
  return metric;
}

export type NumberPoint = { readonly attributes: Attributes; readonly value: number };

/** The points of a counter or gauge. */
export function numberPoints(metric: MetricData): NumberPoint[] {
  if (metric.dataPointType !== DataPointType.SUM && metric.dataPointType !== DataPointType.GAUGE) {
    throw new Error(`${metric.descriptor.name} is not a sum or gauge`);
  }
  return metric.dataPoints.map((p) => ({ attributes: p.attributes, value: p.value }));
}

/** The value of the point whose attributes equal `attributes` exactly, or undefined. */
export function valueAt(metric: MetricData, attributes: Attributes): number | undefined {
  const wanted = JSON.stringify(Object.entries(attributes).sort());
  return numberPoints(metric).find(
    (p) => JSON.stringify(Object.entries(p.attributes).sort()) === wanted,
  )?.value;
}

export type HistogramPoint = { readonly attributes: Attributes; readonly value: Histogram };

/** The points of a histogram. */
export function histogramPoints(metric: MetricData): HistogramPoint[] {
  if (metric.dataPointType !== DataPointType.HISTOGRAM) {
    throw new Error(`${metric.descriptor.name} is not a histogram`);
  }
  return metric.dataPoints.map((p) => ({ attributes: p.attributes, value: p.value }));
}
