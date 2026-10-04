// Composition root, part 1 (doc 04 §5): the only place that constructs adapters and binds them
// to ports. main.ts (part 2) builds the HTTP server around `createApp`.
import type { Writable } from 'node:stream';

import {
  type DynamicModule,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import rateLimit from '@fastify/rate-limit';
import { Logger } from 'nestjs-pino';
import pino from 'pino';

import { createDb, type DbHandle } from '@ai-stylist/db';
import type { FeatureFlags } from '@ai-stylist/shared-kernel';

import { type AppConfig, allowsInMemoryStorage, loadConfig } from './config.js';
import { DevModule, UnconfiguredOutboxWriter, isDevRouteEnabled } from './dev/index.js';
import { JOB_QUEUES, queueForEventType, userIdOf } from './jobs/queues.js';
import { AdminModule } from './modules/admin/index.js';
import { AssistantModule } from './modules/assistant/index.js';
import { AvatarModule } from './modules/avatar/index.js';
import { BillingModule } from './modules/billing/index.js';
import { ClosetModule } from './modules/closet/index.js';
import { ContextModule } from './modules/context/index.js';
import { FashionIntelModule } from './modules/fashion-intel/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { MediaModule } from './modules/media/index.js';
import { NotificationsModule } from './modules/notifications/index.js';
import { OutfitModule } from './modules/outfit/index.js';
import { ProfileModule } from './modules/profile/index.js';
import { RecommendationModule } from './modules/recommendation/index.js';
import {
  type FeatureFlagsAdapter,
  type HealthProbe,
  OutboxRelay,
  type OutboxWriter,
  PgBossQueue,
  PgHealthProbe,
  PgOutboxWriter,
  PlatformModule,
  SystemClock,
  UnconfiguredHealthProbe,
  createFeatureFlags,
  createStorageProvider,
  currentCorrelationId,
  frameworkErrors,
  httpLoggerOptions,
  loggerOptions,
  registerCorrelationId,
  registerRequestMetrics,
  shutdownTelemetry,
} from './platform/index.js';

/** Every domain module's public Nest module (SPINE §3 order). */
export const DOMAIN_MODULES = [
  IdentityModule,
  ProfileModule,
  AvatarModule,
  ClosetModule,
  MediaModule,
  OutfitModule,
  ContextModule,
  RecommendationModule,
  FashionIntelModule,
  BillingModule,
  NotificationsModule,
  AdminModule,
  AssistantModule,
] as const;

const DB_LIFECYCLE = Symbol('DbLifecycle');

/** Everything that exists only when DATABASE_URL is set. */
type DbRuntime = {
  readonly handle: DbHandle;
  readonly queue: PgBossQueue;
  readonly relay: OutboxRelay;
};

/**
 * Starts the pg-boss queue, then the outbox relay, once the app is wired; stops them in reverse
 * and closes the Postgres pool on shutdown (tests close apps constantly).
 */
class DbLifecycle implements OnApplicationBootstrap, OnApplicationShutdown {
  private stopped: Promise<void> | undefined;

  constructor(private readonly runtime: DbRuntime | null) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.runtime === null) return;
    try {
      await this.runtime.queue.start();
    } catch (error) {
      await this.onApplicationShutdown().catch(() => undefined); // the start failure is the error
      const reason = error instanceof Error ? error.message : typeof error;
      throw new Error(
        `pg-boss queue failed to start (${reason}); the outbox relay needs a migrated database: ` +
          'run `just db-migrate` against DATABASE_URL first',
        { cause: error },
      );
    }
    this.runtime.relay.start();
  }

  /** Idempotent: a failed bootstrap already ran it, and `app.close()` may run it again. */
  onApplicationShutdown(): Promise<void> {
    const runtime = this.runtime;
    if (runtime === null) return Promise.resolve();
    this.stopped ??= (async () => {
      try {
        await runtime.relay.stop();
        await runtime.queue.stop();
      } finally {
        await runtime.handle.close();
      }
    })();
    return this.stopped;
  }
}

export type CreateAppOptions = {
  /** Defaults to `loadConfig(process.env)`. */
  readonly config?: AppConfig;
  /** Where pino writes; defaults to stdout. Tests pass a memory stream. */
  readonly logStream?: Writable;
  /**
   * Defaults to `createFeatureFlags` over `POSTHOG_API_KEY` / `POSTHOG_HOST` (the registry
   * defaults without a key). Tests pass a fake; a passed port is the caller's to stop.
   */
  readonly featureFlags?: FeatureFlags;
  /**
   * Defaults to `PgOutboxWriter` with `DATABASE_URL`, else a writer that refuses (503). Tests pass
   * a recording one to see what the dev route appends without a database.
   */
  readonly outboxWriter?: OutboxWriter;
};

/** A flags port the caller built and owns (tests): bound as is, never stopped by the app. */
function callerOwnedFlags(flags: FeatureFlags): FeatureFlagsAdapter {
  return {
    isEnabled: (key) => flags.isEnabled(key),
    shutdown: () => Promise.resolve(),
  };
}

@Module({})
export class AppModule implements OnApplicationShutdown {
  static forRoot(config: AppConfig, options: Omit<CreateAppOptions, 'config'> = {}): DynamicModule {
    const { logStream } = options;
    const logger = pino(
      loggerOptions({ level: config.LOG_LEVEL }),
      ...(logStream !== undefined ? [logStream] : []),
    );
    const featureFlags =
      options.featureFlags === undefined
        ? createFeatureFlags({ apiKey: config.POSTHOG_API_KEY, host: config.POSTHOG_HOST, logger })
        : callerOwnedFlags(options.featureFlags);
    const db = config.DATABASE_URL === undefined ? null : createDb(config.DATABASE_URL, { max: 5 });
    const healthProbe: HealthProbe =
      db === null ? new UnconfiguredHealthProbe() : new PgHealthProbe(db.sql);
    const clock = new SystemClock();
    // R2 when the four R2_* keys are set (presigned URLs on R2's S3 endpoint), else in-memory.
    const storage = createStorageProvider({
      accountId: config.R2_ACCOUNT_ID,
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      bucket: config.R2_BUCKET,
      clock,
      logger,
      // Staging and prod refuse the in-memory fallback (doc 15 §11); the rule lives in config.ts.
      allowsInMemory: allowsInMemoryStorage(config),
    });
    let runtime: DbRuntime | null = null;
    if (db !== null && config.DATABASE_URL !== undefined) {
      // Queue names, routes and the per-user key come from `jobs/queues.ts` (single source of
      // truth), not `jobs/index.ts`, so the job runtime stays out of the API process.
      const queue = new PgBossQueue({
        connectionString: config.DATABASE_URL,
        logger,
        queues: JOB_QUEUES,
      });
      const relay = new OutboxRelay({
        sql: db.sql,
        queue,
        logger,
        routeEvent: queueForEventType,
        userIdOf,
      });
      runtime = { handle: db, queue, relay };
    }
    const outboxWriter: OutboxWriter =
      options.outboxWriter ??
      (db === null ? new UnconfiguredOutboxWriter() : new PgOutboxWriter(db.sql));
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot({
          logger: { pinoHttp: httpLoggerOptions({ level: config.LOG_LEVEL }, logStream) },
          version: {
            version: config.APP_VERSION,
            commit: config.GIT_COMMIT,
            builtAt: config.BUILD_TIME,
          },
          clock,
          healthProbe,
          storage,
          featureFlags,
        }),
        ...DOMAIN_MODULES,
        ...(isDevRouteEnabled(config)
          ? [DevModule.forRoot(outboxWriter, currentCorrelationId)]
          : []),
      ],
      providers: [{ provide: DB_LIFECYCLE, useValue: new DbLifecycle(runtime) }],
    };
  }

  /**
   * Nest calls the root module's hook last, after every provider's (relay, queue, pool, flags), so
   * the spans and log lines of the shutdown itself are exported. A no-op when no telemetry runs.
   */
  onApplicationShutdown(): Promise<void> {
    return shutdownTelemetry();
  }
}

/** Build the Fastify-backed Nest app without listening; `main.ts` and tests both use this. */
export async function createApp(options: CreateAppOptions = {}): Promise<NestFastifyApplication> {
  const config = options.config ?? loadConfig();
  const adapter = new FastifyAdapter({ trustProxy: true, frameworkErrors });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(config, options),
    adapter,
    { bufferLogs: true, abortOnError: false },
  );
  // On the root Fastify instance before any route or plugin exists (routes register at init), so
  // every response, the 404 and 429 problems included, echoes `x-correlation-id` and is measured.
  const fastify = app.getHttpAdapter().getInstance();
  registerCorrelationId(fastify);
  registerRequestMetrics(fastify);
  app.useLogger(app.get(Logger));
  // Release the buffered boot lines through pino now, so no early `Logger` call bypasses redaction.
  app.flushLogs();
  app.enableShutdownHooks();
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    // ProblemFilter maps the thrown error (statusCode 429) to a RATE_LIMITED problem.
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error(`rate limit exceeded, retry in ${context.after}`), {
        statusCode: context.statusCode,
      }),
  });
  return app;
}
