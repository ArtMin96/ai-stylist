import { type DynamicModule, Module, ServiceUnavailableException } from '@nestjs/common';

import { OUTBOX_WRITER, type OutboxWriter } from '../platform/ports/outbox-writer.port.js';

import { DemoEventsController } from './demo-events.controller.js';

/**
 * Bound when no DATABASE_URL is configured: there is no outbox to append to, so the request is
 * refused (503 problem) rather than accepted and silently dropped.
 */
export class UnconfiguredOutboxWriter implements OutboxWriter {
  append(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException({ detail: 'outbox unavailable: DATABASE_URL is not set' }),
    );
  }
}

/** Imported by the composition root only outside production. */
@Module({})
export class DevModule {
  /** `outboxWriter` is the adapter the composition root built, or null without a database. */
  static forRoot(outboxWriter: OutboxWriter | null): DynamicModule {
    return {
      module: DevModule,
      controllers: [DemoEventsController],
      providers: [
        { provide: OUTBOX_WRITER, useValue: outboxWriter ?? new UnconfiguredOutboxWriter() },
      ],
    };
  }
}
