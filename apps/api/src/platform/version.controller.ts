import { Controller, Get, Inject } from '@nestjs/common';

import type { VersionInfo } from '@ai-stylist/contracts';

export const VERSION_INFO = Symbol('VersionInfo');

/** GET /v1/version — build identity from APP_VERSION / GIT_COMMIT / BUILD_TIME. */
@Controller('v1/version')
export class VersionController {
  constructor(@Inject(VERSION_INFO) private readonly info: VersionInfo) {}

  @Get()
  version(): VersionInfo {
    return this.info;
  }
}
