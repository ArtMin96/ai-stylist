import { type DynamicModule, Module, ServiceUnavailableException } from '@nestjs/common';

import type { AppConfig } from '../config.js';
import { OUTBOX_WRITER, type OutboxWriter } from '../platform/ports/outbox-writer.port.js';

import { DemoEventsController } from './demo-events.controller.js';

/**
 * Fail closed: dev routes exist only outside production builds AND in a local or dev deployment,
 * so a staging/prod deploy that forgets NODE_ENV=production still never exposes them.
 */
export function isDevRouteEnabled(config: Pick<AppConfig, 'NODE_ENV' | 'APP_ENV'>): boolean {
  return (
    config.NODE_ENV !== 'production' && (config.APP_ENV === 'local' || config.APP_ENV === 'dev')
  );
}

/**
 * Bound by the composition root when no DATABASE_URL is configured: there is no outbox to append
 * to, so the request is refused (503 problem) rather than accepted and silently dropped.
 */
export class UnconfiguredOutboxWriter implements OutboxWriter {
  append(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException({ detail: 'outbox unavailable: DATABASE_URL is not set' }),
    );
  }
}

/** Imported by the composition root only when `isDevRouteEnabled(config)`. */
@Module({})
export class DevModule {
  /** `outboxWriter` is the adapter the composition root built (doc 04 §5), never built here. */
  static forRoot(outboxWriter: OutboxWriter): DynamicModule {
    return {
      module: DevModule,
      controllers: [DemoEventsController],
      providers: [{ provide: OUTBOX_WRITER, useValue: outboxWriter }],
    };
  }
}
