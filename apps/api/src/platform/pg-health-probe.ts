import type { Sql } from 'postgres';

import type { HealthCheckStatus } from '@ai-stylist/contracts/types';

import type { HealthProbe } from './ports/health-probe.port.js';

/** `select 1` against the pool the composition root opened; never throws. */
export class PgHealthProbe implements HealthProbe {
  constructor(private readonly sql: Sql) {}

  async check(): Promise<HealthCheckStatus> {
    try {
      await this.sql`select 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
