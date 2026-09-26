import type { Clock } from '../ports/clock.port.js';

export type CircuitState = 'closed' | 'open' | 'half-open';

export type CircuitBreakerOptions = {
  /** Consecutive failures that open the circuit. */
  readonly failureThreshold: number;
  /** Time the circuit stays open before one trial call is let through. */
  readonly coolDownMs: number;
};

export class CircuitOpenError extends Error {
  constructor() {
    super('circuit breaker is open');
    this.name = 'CircuitOpenError';
  }
}

/**
 * closed → (failureThreshold consecutive failures) → open → (coolDownMs on the Clock) →
 * half-open: exactly one trial call; success closes, failure reopens. Calls rejected while open
 * (or while the trial is in flight) fail fast with `CircuitOpenError` and never reach `operation`.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | undefined;
  private trialInFlight = false;

  constructor(
    private readonly clock: Clock,
    private readonly options: CircuitBreakerOptions,
  ) {
    if (!Number.isInteger(options.failureThreshold) || options.failureThreshold < 1) {
      throw new RangeError(`failureThreshold must be an integer >= 1`);
    }
    if (!Number.isFinite(options.coolDownMs) || options.coolDownMs < 0) {
      throw new RangeError(`coolDownMs must be >= 0`);
    }
  }

  get state(): CircuitState {
    if (this.openedAt === undefined) return 'closed';
    return this.clock.now().getTime() - this.openedAt >= this.options.coolDownMs
      ? 'half-open'
      : 'open';
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const state = this.state;
    if (state === 'open' || (state === 'half-open' && this.trialInFlight)) {
      throw new CircuitOpenError();
    }
    const isTrial = state === 'half-open';
    if (isTrial) this.trialInFlight = true;
    try {
      const result = await operation();
      this.failures = 0;
      this.openedAt = undefined;
      return result;
    } catch (error) {
      this.failures += 1;
      if (isTrial || this.failures >= this.options.failureThreshold) {
        this.openedAt = this.clock.now().getTime();
      }
      throw error;
    } finally {
      if (isTrial) this.trialInFlight = false;
    }
  }
}
