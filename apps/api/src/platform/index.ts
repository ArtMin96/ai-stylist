// Public API of `platform` (docs/modules/platform.md): ports + the Nest module that serves the
// operational endpoints. Only composition roots import this (rule: modules-not-platform).
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule, type Params as LoggerParams } from 'nestjs-pino';

import type { VersionInfo } from '@ai-stylist/contracts/types';
import { FEATURE_FLAGS } from '@ai-stylist/shared-kernel';

import type { FeatureFlagsAdapter } from './feature-flags/registry-default-feature-flags.js';
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
  /**
   * Bound to the shared-kernel `FEATURE_FLAGS` port (from `createFeatureFlags`) and shut down with
   * the app. Optional only until the API composition root passes it; unbound, `FEATURE_FLAGS` does
   * not resolve (no silent default).
   */
  readonly featureFlags?: FeatureFlagsAdapter;
};

const FEATURE_FLAGS_LIFECYCLE = Symbol('FeatureFlagsLifecycle');

function featureFlagProviders(featureFlags: FeatureFlagsAdapter | undefined): Provider[] {
  if (featureFlags === undefined) return [];
  return [
    { provide: FEATURE_FLAGS, useValue: featureFlags },
    // Nest runs `onApplicationShutdown` on value providers as well (as app.module.ts's DbLifecycle).
    {
      provide: FEATURE_FLAGS_LIFECYCLE,
      useValue: { onApplicationShutdown: () => featureFlags.shutdown() },
    },
  ];
}

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
        ...featureFlagProviders(bindings.featureFlags),
      ],
      exports: [
        LoggerModule,
        CLOCK,
        HEALTH_PROBE,
        STORAGE_PROVIDER,
        ...(bindings.featureFlags !== undefined ? [FEATURE_FLAGS] : []),
      ],
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
  MAX_PRESIGN_GET_TTL_SECONDS,
  MAX_PRESIGN_PUT_TTL_SECONDS,
  STORAGE_PROVIDER,
  StorageError,
  type PresignGetRequest,
  type PresignPutRequest,
  type PresignedUrl,
  type StorageNamespace,
  type StorageProvider,
  clampTtl,
} from './ports/storage.port.js';
export {
  type StorageProviderConfig,
  createStorageProvider,
} from './storage/create-storage-provider.js';
export {
  R2StorageProvider,
  type R2StorageProviderOptions,
  r2Endpoint,
} from './storage/r2-storage-provider.js';
export { PgHealthProbe } from './pg-health-probe.js';
export {
  type BackoffPolicy,
  CircuitBreaker,
  type CircuitBreakerOptions,
  CircuitOpenError,
  type CircuitState,
  type RetryOptions,
  TimeoutError,
  backoffDelayMs,
  retry,
  withTimeout,
} from './resilience/index.js';
export {
  PgBossQueue,
  deadLetterQueueName,
  type EnqueueOptions,
  type EnqueueResult,
  type JobHandler,
  type PgBossQueueConfig,
  type QueueDefinition,
  type QueueJob,
  type QueueStatsSnapshot,
} from './queue/pg-boss-queue.js';
export { PGBOSS_SCHEMA_VERSION, pgBossConstructionSql } from './queue/pg-boss-schema.js';
export { OUTBOX_WRITER, type OutboxWriter } from './ports/outbox-writer.port.js';
export { PgOutboxWriter } from './outbox/pg-outbox-writer.js';
export { markOutboxFailed } from './outbox/outbox-dead-letter.js';
export {
  MAX_OUTBOX_BATCH_SIZE,
  OutboxRelay,
  type OutboxDispatchQueue,
  type OutboxEnvelope,
  type OutboxPollResult,
  type OutboxRelayConfig,
  type OutboxRelaySettings,
} from './outbox/outbox-relay.js';
export {
  IdempotencyKeyBusyError,
  IdempotencyKeyConflictError,
  PgIdempotencyGuard,
  type IdempotentEffectRequest,
  type IdempotentEffectResult,
  type PgIdempotencyGuardOptions,
} from './idempotency/pg-idempotency-guard.js';
export {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_KEY,
  CORRELATION_ID_PATTERN,
  currentCorrelationId,
  isValidCorrelationId,
  mintCorrelationId,
  registerCorrelationId,
  runWithCorrelationId,
} from './telemetry/correlation.js';
export type { CarriedTraceContext } from './telemetry/trace-context.js';
// `startTelemetry` is not re-exported: the `--import` entries load the SDK only when an OTLP
// endpoint is set (telemetry/register.ts); a process entry only flushes it on shutdown.
export { type Telemetry, shutdownTelemetry } from './telemetry/lifecycle.js';
export {
  METRIC_NAMES,
  REQUEST_DURATION_BUCKETS_SECONDS,
  STYLIST_METER_NAME,
} from './telemetry/metrics.js';
export { registerRequestMetrics } from './telemetry/request-metrics.js';
export { QueueMetrics, type QueueMetricsOptions } from './telemetry/queue-metrics.js';
export {
  type FeatureFlagsConfig,
  createFeatureFlags,
} from './feature-flags/create-feature-flags.js';
export {
  FEATURE_FLAG_CACHE_TTL_MS,
  FEATURE_FLAG_TIMEOUT_MS,
  FEATURE_FLAGS_DISTINCT_ID,
  PostHogFeatureFlags,
  type PostHogFeatureFlagsOptions,
} from './feature-flags/posthog-feature-flags.js';
export {
  type FeatureFlagsAdapter,
  RegistryDefaultFeatureFlags,
} from './feature-flags/registry-default-feature-flags.js';
