import { Module } from '@nestjs/common';

import { DemoEventsController } from './demo-events.controller.js';

/** Imported by the composition root only outside production. */
@Module({ controllers: [DemoEventsController] })
export class DevModule {}
