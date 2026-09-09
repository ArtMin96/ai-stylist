/** Injectable time source so domain code never calls `Date.now()` directly. */
export type Clock = {
  now(): Date;
};

export const CLOCK = Symbol('Clock');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
