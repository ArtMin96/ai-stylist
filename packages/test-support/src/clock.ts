/** Structural match for the API's `Clock` port (apps/api/src/platform/ports/clock.port.ts). */
export type FakeClock = {
  now(): Date;
  /** Move time forward by `ms`. */
  advance(ms: number): void;
  /** Jump to an absolute instant. */
  set(instant: Date | string): void;
};

/** Deterministic clock starting at `start` (default 2026-01-01T00:00:00Z). */
export function fakeClock(start: Date | string = '2026-01-01T00:00:00.000Z'): FakeClock {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    advance: (ms) => {
      current += ms;
    },
    set: (instant) => {
      current = new Date(instant).getTime();
    },
  };
}
