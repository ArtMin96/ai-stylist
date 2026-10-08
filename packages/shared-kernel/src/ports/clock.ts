// Clock port: an injectable time source, so domain code never calls `Date.now()` directly. Domain
// rules still take `now: Date` as a parameter; services read it from this port. The adapter
// (`SystemClock`) lives in `platform`; tests use `fakeClock` from `@ai-stylist/test-support`.

/** Injectable time source. */
export type Clock = {
  now(): Date;
};

/** DI token. `Symbol.for`: two installed copies of the kernel resolve to the same token. */
export const CLOCK: unique symbol = Symbol.for('ai-stylist.clock');
