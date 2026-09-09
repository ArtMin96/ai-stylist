// Composition root, part 1 (doc 04 §5): the only place that constructs adapters and binds them
// to ports. main.ts (part 2) builds the HTTP server around `createApp`.
import type { Writable } from 'node:stream';

import { type DynamicModule, Module, type OnApplicationShutdown } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import rateLimit from '@fastify/rate-limit';
import { Logger } from 'nestjs-pino';

import { createDb, type DbHandle } from '@ai-stylist/db';

import { type AppConfig, loadConfig } from './config.js';
import { DevModule } from './dev/index.js';
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
  type HealthProbe,
  InMemoryStorageProvider,
  PgHealthProbe,
  PlatformModule,
  SystemClock,
  UnconfiguredHealthProbe,
  httpLoggerOptions,
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

const DB_HANDLE = Symbol('DbHandle');

/** Closes the Postgres pool when the Nest app shuts down (tests close apps constantly). */
class DbLifecycle implements OnApplicationShutdown {
  constructor(private readonly handle: DbHandle | null) {}
  async onApplicationShutdown(): Promise<void> {
    await this.handle?.close();
  }
}

export type CreateAppOptions = {
  /** Defaults to `loadConfig(process.env)`. */
  readonly config?: AppConfig;
  /** Where pino writes; defaults to stdout. Tests pass a memory stream. */
  readonly logStream?: Writable;
};

@Module({})
export class AppModule {
  static forRoot(config: AppConfig, logStream: Writable | undefined): DynamicModule {
    const db = config.DATABASE_URL === undefined ? null : createDb(config.DATABASE_URL, { max: 2 });
    const healthProbe: HealthProbe =
      db === null ? new UnconfiguredHealthProbe() : new PgHealthProbe(db.sql);
    const clock = new SystemClock();
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
          storage: new InMemoryStorageProvider(() => clock.now()),
        }),
        ...DOMAIN_MODULES,
        ...(config.NODE_ENV === 'production' ? [] : [DevModule]),
      ],
      providers: [{ provide: DB_HANDLE, useValue: new DbLifecycle(db) }],
    };
  }
}

/** Build the Fastify-backed Nest app without listening; `main.ts` and tests both use this. */
export async function createApp(options: CreateAppOptions = {}): Promise<NestFastifyApplication> {
  const config = options.config ?? loadConfig();
  const adapter = new FastifyAdapter({ trustProxy: true });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(config, options.logStream),
    adapter,
    { bufferLogs: true, abortOnError: false },
  );
  app.useLogger(app.get(Logger));
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
