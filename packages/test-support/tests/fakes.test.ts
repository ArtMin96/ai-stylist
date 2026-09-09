import { describe, expect, it } from 'vitest';

import { fakeClock, memoryLogStream } from '../src/index.js';

describe('fakeClock', () => {
  it('is deterministic and advances only when told', () => {
    const clock = fakeClock('2026-03-01T10:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-03-01T10:00:00.000Z');
    clock.advance(60_000);
    expect(clock.now().toISOString()).toBe('2026-03-01T10:01:00.000Z');
    clock.set('2027-01-01T00:00:00.000Z');
    expect(clock.now().getUTCFullYear()).toBe(2027);
  });
});

describe('memoryLogStream', () => {
  it('collects lines and parses JSON records', async () => {
    const stream = memoryLogStream();
    await new Promise<void>((resolve) =>
      stream.write('{"level":30,"msg":"a"}\n{"level":40,"msg":"b"}\nnot json\n', () => resolve()),
    );
    expect(stream.lines()).toHaveLength(3);
    expect(stream.records().map((r) => r['msg'])).toEqual(['a', 'b']);
  });
});
