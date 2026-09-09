import type { HealthCheckStatus } from '@ai-stylist/contracts';

/** One dependency check behind GET /v1/health; adapters must never throw, only report. */
export type HealthProbe = {
  check(): Promise<HealthCheckStatus>;
};

export const HEALTH_PROBE = Symbol('HealthProbe');

/** Bound when no DATABASE_URL is configured: the db check is honestly `down`. */
export class UnconfiguredHealthProbe implements HealthProbe {
  check(): Promise<HealthCheckStatus> {
    return Promise.resolve('down');
  }
}
