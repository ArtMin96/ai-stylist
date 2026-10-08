// Adapter for the shared-kernel `Clock` port: wall-clock time. Tests use `fakeClock` from
// `@ai-stylist/test-support`.
import type { Clock } from '@ai-stylist/shared-kernel';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
