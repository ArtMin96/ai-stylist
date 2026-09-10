// Public API of `platform` (docs/modules/platform.md): ports + the Nest module that serves the
// operational endpoints. Only composition roots import this (rule: modules-not-platform).
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule, type Params as LoggerParams } from 'nestjs-pino';

import type { VersionInfo } from '@ai-stylist/contracts/types';

import { HealthController } from './health.controller.js';
import { CLOCK, type Clock } from './ports/clock.port.js';
import { HEALTH_PROBE, type HealthProbe } from './ports/health-probe.port.js';
import { STORAGE_PROVIDER, type StorageProvider } from './ports/storage.port.js';
import { ProblemFilter } from './problem.filter.js';
import { VERSION_INFO, VersionController } from './version.controller.js';

export type PlatformBindings = {
  readonly logger: LoggerParams;
  readonly version: VersionInfo;
  readonly clock: Clock;
  readonly healthProbe: HealthProbe;
  readonly storage: StorageProvider;
};

/**
 * Ports are bound to adapters here from values the composition root constructed; nothing in
 * this module instantiates an adapter itself (rule: composition-root-only).
 */
@Module({})
export class PlatformModule {
  static forRoot(bindings: PlatformBindings): DynamicModule {
    return {
      module: PlatformModule,
      // Ports are needed by every module; binding them once at the root avoids re-importing.
      global: true,
      imports: [LoggerModule.forRoot(bindings.logger)],
      controllers: [HealthController, VersionController],
      providers: [
        { provide: APP_FILTER, useClass: ProblemFilter },
        { provide: VERSION_INFO, useValue: bindings.version },
        { provide: CLOCK, useValue: bindings.clock },
        { provide: HEALTH_PROBE, useValue: bindings.healthProbe },
        { provide: STORAGE_PROVIDER, useValue: bindings.storage },
      ],
      exports: [LoggerModule, CLOCK, HEALTH_PROBE, STORAGE_PROVIDER],
    };
  }
}

export {
  ProblemFilter,
  PROBLEM_CONTENT_TYPE,
  type ProblemBody,
  toProblem,
} from './problem.filter.js';
export {
  FORBIDDEN_LOG_KEYS,
  REDACTED,
  httpLoggerOptions,
  isForbiddenLogKey,
  loggerOptions,
  redactForbidden,
} from './logger.js';
export { CLOCK, type Clock, SystemClock } from './ports/clock.port.js';
export {
  HEALTH_PROBE,
  type HealthProbe,
  UnconfiguredHealthProbe,
} from './ports/health-probe.port.js';
export {
  InMemoryStorageProvider,
  MAX_PRESIGN_TTL_SECONDS,
  STORAGE_PROVIDER,
  StorageError,
  type PresignGetRequest,
  type PresignPutRequest,
  type PresignedUrl,
  type StorageNamespace,
  type StorageProvider,
  clampTtl,
} from './ports/storage.port.js';
export { PgHealthProbe } from './pg-health-probe.js';
