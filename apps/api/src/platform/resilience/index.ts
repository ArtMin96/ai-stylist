// Resilience utilities (NFR-PERF-040, doc 04 §9): timeout, backoff + jitter, retry, circuit breaker.
export { type BackoffPolicy, backoffDelayMs } from './backoff.js';
export {
  CircuitBreaker,
  type CircuitBreakerOptions,
  CircuitOpenError,
  type CircuitState,
} from './circuit-breaker.js';
export { type RetryOptions, retry } from './retry.js';
export { TimeoutError, withTimeout } from './timeout.js';
