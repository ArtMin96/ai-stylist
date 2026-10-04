// The one Nest + Fastify app for platform tests that need the HTTP path (ProblemFilter, pino-http,
// Fastify hooks): `PlatformModule.forRoot` with test bindings (system clock, no database, in-memory
// storage) plus the test's controllers, built the way `createApp` (apps/api/src/app.module.ts)
// builds the real one: Nest's buffered logs go to the platform logger, and hooks are registered on
// the root Fastify instance before init. `platformTestBindings` alone serves a testing module.
import type { Writable } from 'node:stream';

import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import { Logger } from 'nestjs-pino';

import {
  type FeatureFlagsAdapter,
  InMemoryStorageProvider,
  type PlatformBindings,
  PlatformModule,
  SystemClock,
  UnconfiguredHealthProbe,
  httpLoggerOptions,
} from '../index.js';

export type PlatformTestBindingsOptions = {
  /** pino level of the HTTP logger; default `info`. */
  readonly level?: string;
  /** Log sink (e.g. `memoryLogStream()`); default stdout. */
  readonly logs?: Writable;
  readonly featureFlags?: FeatureFlagsAdapter;
};

/** `PlatformModule.forRoot` bindings for a test. No database: `/v1/health` answers 503. */
export function platformTestBindings(options: PlatformTestBindingsOptions = {}): PlatformBindings {
  const clock = new SystemClock();
  return {
    logger: { pinoHttp: httpLoggerOptions({ level: options.level ?? 'info' }, options.logs) },
    version: { version: 'test', commit: 'test', builtAt: '2026-09-27T00:00:00Z' },
    clock,
    healthProbe: new UnconfiguredHealthProbe(),
    storage: new InMemoryStorageProvider(() => clock.now()),
    ...(options.featureFlags !== undefined ? { featureFlags: options.featureFlags } : {}),
  };
}

export type PlatformTestAppOptions = PlatformTestBindingsOptions & {
  /** Test controllers, mounted next to the platform's own routes. */
  readonly controllers?: readonly Type[];
  /** Runs on the root Fastify instance before init: where `createApp` registers its hooks. */
  readonly beforeInit?: (fastify: FastifyInstance) => void;
};

@Module({})
class PlatformTestAppModule {}

/** An initialised Nest + Fastify app that does not listen (`app.inject`); the caller closes it. */
export async function createPlatformTestApp(
  options: PlatformTestAppOptions = {},
): Promise<NestFastifyApplication> {
  const root: DynamicModule = {
    module: PlatformTestAppModule,
    imports: [PlatformModule.forRoot(platformTestBindings(options))],
    controllers: [...(options.controllers ?? [])],
  };
  const app = await NestFactory.create<NestFastifyApplication>(root, new FastifyAdapter(), {
    bufferLogs: true,
    abortOnError: false,
  });
  app.useLogger(app.get(Logger));
  const fastify = app.getHttpAdapter().getInstance();
  options.beforeInit?.(fastify);
  await app.init();
  await fastify.ready();
  return app;
}
