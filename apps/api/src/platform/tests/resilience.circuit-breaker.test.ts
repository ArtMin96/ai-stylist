import { describe, expect, it } from 'vitest';

import { fakeClock } from '@ai-stylist/test-support';

import { CircuitBreaker, CircuitOpenError } from '../resilience/index.js';

const fail = () => Promise.reject(new Error('provider down'));
const succeed = () => Promise.resolve('ok');

function openBreaker() {
  const clock = fakeClock('2026-09-26T10:00:00.000Z');
  const breaker = new CircuitBreaker(clock, { failureThreshold: 3, coolDownMs: 30_000 });
  return { clock, breaker };
}

async function tripOpen(breaker: CircuitBreaker) {
  for (let i = 0; i < 3; i += 1) {
    await expect(breaker.execute(fail)).rejects.toThrow('provider down');
  }
}

describe('CircuitBreaker', () => {
  it('stays closed below the failure threshold and a success resets the count', async () => {
    const { breaker } = openBreaker();
    await expect(breaker.execute(fail)).rejects.toThrow();
    await expect(breaker.execute(fail)).rejects.toThrow();
    await expect(breaker.execute(succeed)).resolves.toBe('ok');
    await expect(breaker.execute(fail)).rejects.toThrow();
    await expect(breaker.execute(fail)).rejects.toThrow();
    expect(breaker.state).toBe('closed');
  });

  it('opens after the threshold of consecutive failures and fails fast without calling the operation', async () => {
    const { breaker } = openBreaker();
    await tripOpen(breaker);
    expect(breaker.state).toBe('open');
    let called = false;
    await expect(
      breaker.execute(() => {
        called = true;
        return Promise.resolve('ok');
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false);
  });

  it('turns half-open after the cool-down on the Clock and closes on a successful trial', async () => {
    const { clock, breaker } = openBreaker();
    await tripOpen(breaker);
    clock.advance(29_999);
    expect(breaker.state).toBe('open');
    clock.advance(1);
    expect(breaker.state).toBe('half-open');
    await expect(breaker.execute(succeed)).resolves.toBe('ok');
    expect(breaker.state).toBe('closed');
  });

  it('reopens for a full cool-down when the half-open trial fails', async () => {
    const { clock, breaker } = openBreaker();
    await tripOpen(breaker);
    clock.advance(30_000);
    await expect(breaker.execute(fail)).rejects.toThrow('provider down');
    expect(breaker.state).toBe('open');
    clock.advance(29_999);
    await expect(breaker.execute(succeed)).rejects.toBeInstanceOf(CircuitOpenError);
    clock.advance(1);
    expect(breaker.state).toBe('half-open');
  });

  it('lets exactly one trial through while half-open', async () => {
    const { clock, breaker } = openBreaker();
    await tripOpen(breaker);
    clock.advance(30_000);
    let release: (value: string) => void = () => undefined;
    const trial = breaker.execute(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    await expect(breaker.execute(succeed)).rejects.toBeInstanceOf(CircuitOpenError);
    release('ok');
    await expect(trial).resolves.toBe('ok');
    expect(breaker.state).toBe('closed');
  });

  it('rejects invalid options', () => {
    const clock = fakeClock();
    expect(() => new CircuitBreaker(clock, { failureThreshold: 0, coolDownMs: 1 })).toThrow(
      RangeError,
    );
    expect(() => new CircuitBreaker(clock, { failureThreshold: 1, coolDownMs: -1 })).toThrow(
      RangeError,
    );
  });
});
