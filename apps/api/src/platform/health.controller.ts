import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';

import type { HealthReport } from '@ai-stylist/contracts/types';

import { HEALTH_PROBE, type HealthProbe } from './ports/health-probe.port.js';

/** GET /v1/health — contract: 200 HealthReport, 503 problem+json when a dependency is down. */
@Controller('v1/health')
export class HealthController {
  constructor(@Inject(HEALTH_PROBE) private readonly dbProbe: HealthProbe) {}

  @Get()
  async health(): Promise<HealthReport> {
    const db = await this.dbProbe.check();
    if (db !== 'ok') {
      // ProblemFilter turns this into application/problem+json with the checks as an extension.
      throw new ServiceUnavailableException({ detail: 'dependency check failed', checks: { db } });
    }
    return { status: 'ok', checks: { db } };
  }
}
