// The process's running telemetry, so a process entry can flush it on shutdown without loading
// the OpenTelemetry SDK itself (this file imports nothing). The handle lives on `globalThis`
// under a registry symbol: the `--import` entry and the process entry may load `telemetry.ts`
// through different module URLs (tsx vs compiled), and both must see the same handle.

/** A started (or deliberately not started) telemetry pipeline. */
export type Telemetry = {
  /** false when no OTLP endpoint was configured: nothing was started, nothing is exported. */
  readonly enabled: boolean;
  /** Export every finished span now (tests); `shutdown` flushes on its own. */
  flush(): Promise<void>;
  /** Flush and stop every exporter; idempotent. */
  shutdown(): Promise<void>;
};

const ACTIVE = Symbol.for('@ai-stylist/platform.telemetry');

type TelemetryHolder = { [ACTIVE]?: Telemetry };

const holder = globalThis as TelemetryHolder;

/** Record `telemetry` as this process's pipeline. Throws when one is already running. */
export function setActiveTelemetry(telemetry: Telemetry): void {
  if (holder[ACTIVE] !== undefined) {
    throw new Error('telemetry is already started in this process');
  }
  holder[ACTIVE] = telemetry;
}

/** Forget `telemetry` as this process's pipeline (its own `shutdown` calls this). */
export function clearActiveTelemetry(telemetry: Telemetry): void {
  if (holder[ACTIVE] === telemetry) delete holder[ACTIVE];
}

/** The running pipeline, if `startTelemetry` ran in this process. */
export function activeTelemetry(): Telemetry | undefined {
  return holder[ACTIVE];
}

/**
 * Flush and stop this process's telemetry, if any (a no-op when the process was started without
 * the `--import` entry or without an OTLP endpoint). Call it last in a graceful shutdown, after the
 * work whose spans and logs should still be exported has stopped.
 */
export async function shutdownTelemetry(): Promise<void> {
  await holder[ACTIVE]?.shutdown();
}
