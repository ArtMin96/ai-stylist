// The `FeatureFlags` adapters (planning/14 §11): `PostHogFeatureFlags` runs the real posthog-node
// client over real HTTP against a local fake PostHog host (./fake-posthog.ts). On/off, a flag
// inactive in PostHog (absent from the reply) is off, timeout / HTTP error / quota limit fall back
// to the registry default, the TTL cache (one request per TTL, shared by concurrent checks, a flip
// visible after the TTL), the request carries only the system distinct id with GeoIP disabled, and
// no capture request ever leaves the process. Plus `RegistryDefaultFeatureFlags`,
// `createFeatureFlags` and the `FEATURE_FLAGS` binding in `PlatformModule`.
import { Test } from '@nestjs/testing';
import pino from 'pino';
import type { PostHog } from 'posthog-node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  FEATURE_FLAGS,
  FEATURE_FLAG_REGISTRY,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@ai-stylist/shared-kernel';
import { type FakeClock, fakeClock, memoryLogStream } from '@ai-stylist/test-support';

import {
  FEATURE_FLAGS_DISTINCT_ID,
  FEATURE_FLAG_CACHE_TTL_MS,
  FEATURE_FLAG_TIMEOUT_MS,
  type FeatureFlagsAdapter,
  InMemoryStorageProvider,
  PlatformModule,
  PostHogFeatureFlags,
  RegistryDefaultFeatureFlags,
  SystemClock,
  UnconfiguredHealthProbe,
  createFeatureFlags,
  httpLoggerOptions,
  loggerOptions,
} from '../index.js';

import { type FakePostHog, startFakePostHog } from './fake-posthog.js';

/** Synthetic project key (the shape PostHog issues; public by design, never a real one). */
const API_KEY = 'phc_synthetic_test';
/** Test registry: one flag whose fallback is on, one whose fallback is off. */
const ROLLOUT = 'test-rollout';
const KILL_SWITCH = 'test-kill-switch';
const REGISTRY = {
  [ROLLOUT]: { defaultWhenUnavailable: true },
  [KILL_SWITCH]: { defaultWhenUnavailable: false },
};
/** Test keys live outside the shared-kernel registry's key type on purpose. */
const flag = (name: string): FeatureFlagKey => name as FeatureFlagKey;
/** Short enough to keep the timeout tests fast; the production value is asserted separately. */
const TEST_TIMEOUT_MS = 300;

describe('PostHogFeatureFlags (posthog-node against a fake PostHog host)', () => {
  let posthog: FakePostHog;
  const logs = memoryLogStream();
  const logger = pino(loggerOptions({ level: 'debug', service: 'api-test' }), logs);
  const adapters: FeatureFlagsAdapter[] = [];
  /** Every request the fake host received, across all tests of this suite. */
  const seen: string[] = [];

  beforeAll(async () => {
    posthog = await startFakePostHog();
  });

  afterEach(async () => {
    for (const adapter of adapters.splice(0)) await adapter.shutdown();
    seen.push(...posthog.requests.map((r) => r.url));
    posthog.requests.length = 0;
  });

  afterAll(async () => {
    await posthog.close();
    // Across every scenario above, only flag evaluations reached the host: never a capture.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((url) => !url.startsWith('/flags/'))).toEqual([]);
    expect(logs.text()).not.toContain(API_KEY);
  });

  function adapter(clock: FakeClock = fakeClock()): PostHogFeatureFlags {
    const flags = new PostHogFeatureFlags({
      apiKey: API_KEY,
      host: posthog.host,
      logger,
      clock,
      timeoutMs: TEST_TIMEOUT_MS,
      registry: REGISTRY,
    });
    adapters.push(flags);
    return flags;
  }

  function flagRequests(): number {
    return posthog.requests.filter((r) => r.url.startsWith('/flags/')).length;
  }

  it('uses the documented bounds: 1.5 s per request, 10 s cache', () => {
    expect(FEATURE_FLAG_TIMEOUT_MS).toBe(1_500);
    expect(FEATURE_FLAG_CACHE_TTL_MS).toBe(10_000);
  });

  it('answers on and off from PostHog in one /flags request for the system distinct id, GeoIP off', async () => {
    posthog.behaviour = { flags: { [ROLLOUT]: false, [KILL_SWITCH]: true } };
    const flags = adapter();

    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(false);
    expect(await flags.isEnabled(flag(KILL_SWITCH))).toBe(true);

    expect(posthog.requests).toHaveLength(1);
    const [request] = posthog.requests;
    expect(request).toMatchObject({ method: 'POST', url: '/flags/?v=2' });
    expect(request?.json).toMatchObject({
      token: API_KEY,
      distinct_id: FEATURE_FLAGS_DISTINCT_ID,
      geoip_disable: true,
      flag_keys_to_evaluate: [ROLLOUT, KILL_SWITCH],
      groups: {},
      group_properties: {},
    });
    // Nothing about a person: no person properties at all.
    const body = request?.json as { person_properties?: unknown };
    expect(body.person_properties).toEqual({});
  });

  it('treats a flag absent from a clean reply (inactive in PostHog) as off, not as its default', async () => {
    posthog.behaviour = { flags: {} };
    const flags = adapter();

    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(false);
    expect(await flags.isEnabled(flag(KILL_SWITCH))).toBe(false);
    const outcomes = logs
      .records()
      .filter((r) => r.component === 'feature-flags' && r.flag === ROLLOUT);
    expect(outcomes.at(-1)).toMatchObject({ outcome: 'inactive' });
  });

  it.each([
    ['a timeout', 'hang' as const],
    ['an HTTP 500', { status: 500 }],
    ['an HTTP 401', { status: 401 }],
    ['a quota-limited reply', { reply: { flags: {}, quotaLimited: ['feature_flags'] } }],
    [
      'a reply with errorsWhileComputingFlags',
      { reply: { flags: {}, errorsWhileComputingFlags: true } },
    ],
    ['a reply that is not a flags reply', { reply: 'unexpected' }],
  ])('falls back to the registry defaults on %s, never throws', async (_label, behaviour) => {
    posthog.behaviour = behaviour;
    const flags = adapter();
    const started = performance.now();

    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(true);
    expect(await flags.isEnabled(flag(KILL_SWITCH))).toBe(false);

    // Bounded by the request timeout (no retry), plus scheduling slack.
    expect(performance.now() - started).toBeLessThan(TEST_TIMEOUT_MS + 1_000);
    expect(flagRequests()).toBe(1);
    const warned = logs.records().filter((r) => r.outcome === 'unavailable' && r.flag === ROLLOUT);
    expect(warned.length).toBeGreaterThan(0);
  });

  it('caches one evaluation for the TTL, shares it between concurrent checks, and sees a flip after the TTL', async () => {
    posthog.behaviour = { flags: { [ROLLOUT]: true, [KILL_SWITCH]: false } };
    const clock = fakeClock();
    const flags = adapter(clock);

    const checks = Array.from({ length: 5 }, () => flags.isEnabled(flag(ROLLOUT)));
    expect(await Promise.all(checks)).toEqual([true, true, true, true, true]);
    expect(flagRequests()).toBe(1);

    posthog.behaviour = { flags: { [ROLLOUT]: false, [KILL_SWITCH]: false } };
    clock.advance(FEATURE_FLAG_CACHE_TTL_MS - 1);
    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(true);
    expect(flagRequests()).toBe(1);

    clock.advance(1);
    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(false);
    expect(flagRequests()).toBe(2);
  });

  it('caches an unavailable evaluation too: an outage costs one request per TTL', async () => {
    posthog.behaviour = { status: 503 };
    const clock = fakeClock();
    const flags = adapter(clock);

    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(true);
    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(true);
    expect(flagRequests()).toBe(1);

    posthog.behaviour = { flags: { [ROLLOUT]: false } };
    clock.advance(FEATURE_FLAG_CACHE_TTL_MS);
    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(false);
    expect(flagRequests()).toBe(2);
  });

  it('never sends a capture request, even when the SDK client is asked to capture', async () => {
    posthog.behaviour = { flags: { [ROLLOUT]: true } };
    const flags = adapter();
    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(true);

    // Reach past the port on purpose: an event captured through the adapter's own client (the
    // `$feature_flag_called` a flag read would send, or any event) must not leave the process.
    const client = (flags as unknown as { client: PostHog }).client;
    client.capture({ distinctId: FEATURE_FLAGS_DISTINCT_ID, event: '$feature_flag_called' });
    client.capture({ distinctId: FEATURE_FLAGS_DISTINCT_ID, event: 'server_event' });
    await client.getFeatureFlag(ROLLOUT, FEATURE_FLAGS_DISTINCT_ID);
    await client.flush();
    await flags.shutdown();

    expect(posthog.requests.length).toBeGreaterThan(0);
    expect(posthog.requests.filter((r) => !r.url.startsWith('/flags/'))).toEqual([]);
  });

  it('answers the registry default after shutdown, without a request', async () => {
    posthog.behaviour = { flags: { [ROLLOUT]: false, [KILL_SWITCH]: true } };
    const flags = adapter();
    await flags.shutdown();
    await flags.shutdown(); // idempotent

    expect(await flags.isEnabled(flag(ROLLOUT))).toBe(true);
    expect(await flags.isEnabled(flag(KILL_SWITCH))).toBe(false);
    expect(posthog.requests).toHaveLength(0);
  });

  it('answers off for a key outside the registry', async () => {
    posthog.behaviour = { flags: { 'not-registered': true } };
    const flags = adapter();

    expect(await flags.isEnabled(flag('not-registered'))).toBe(false);
    expect(posthog.requests).toHaveLength(0);
  });

  it('logs flag keys and outcome enums only', async () => {
    posthog.behaviour = { flags: { [ROLLOUT]: true } };
    await adapter().isEnabled(flag(ROLLOUT));

    const records = logs.records().filter((r) => r.component === 'feature-flags');
    expect(records.length).toBeGreaterThan(0);
    const allowed = new Set(['level', 'time', 'msg', 'service', 'component', 'flag', 'outcome']);
    for (const record of records) {
      expect(Object.keys(record).filter((key) => !allowed.has(key))).toEqual([]);
      expect(['on', 'off', 'inactive', 'unavailable', 'unregistered']).toContain(record.outcome);
    }
  });

  it('refuses a personal key and a host that is not an http(s) URL, without echoing the key', () => {
    const personal = 'phx_synthetic_personal';
    const make = (apiKey: string, host: string) => () =>
      new PostHogFeatureFlags({ apiKey, host, logger, registry: REGISTRY });

    expect(make(personal, posthog.host)).toThrow(/project key \(phc_…\)/);
    expect(make(personal, posthog.host)).not.toThrow(personal);
    expect(make(API_KEY, 'eu.i.posthog.com')).toThrow(/http\(s\) URL/);
  });

  it('evaluates the real registry: demo-outbox-flow falls back to its registry default', async () => {
    posthog.behaviour = 'hang';
    const flags = new PostHogFeatureFlags({
      apiKey: API_KEY,
      host: posthog.host,
      logger,
      timeoutMs: TEST_TIMEOUT_MS,
    });
    adapters.push(flags);

    const fallback = FEATURE_FLAG_REGISTRY['demo-outbox-flow'].defaultWhenUnavailable;
    expect(await flags.isEnabled('demo-outbox-flow')).toBe(fallback);
    expect(posthog.requests[0]?.json).toMatchObject({
      flag_keys_to_evaluate: Object.keys(FEATURE_FLAG_REGISTRY),
    });
  });
});

describe('RegistryDefaultFeatureFlags and createFeatureFlags', () => {
  const logger = pino({ level: 'silent' });

  it('answers every registered flag with its defaultWhenUnavailable', async () => {
    const flags = new RegistryDefaultFeatureFlags();
    for (const [key, definition] of Object.entries(FEATURE_FLAG_REGISTRY)) {
      expect(await flags.isEnabled(flag(key))).toBe(definition.defaultWhenUnavailable);
    }
    const custom = new RegistryDefaultFeatureFlags(REGISTRY);
    expect(await custom.isEnabled(flag(ROLLOUT))).toBe(true);
    expect(await custom.isEnabled(flag(KILL_SWITCH))).toBe(false);
    expect(await custom.isEnabled(flag('not-registered'))).toBe(false);
  });

  it('picks the registry defaults without a key and PostHog with one; a key without a host is refused', async () => {
    for (const apiKey of [undefined, '', '   ']) {
      const flags = createFeatureFlags({ apiKey, host: undefined, logger });
      expect(flags).toBeInstanceOf(RegistryDefaultFeatureFlags);
    }
    expect(() => createFeatureFlags({ apiKey: API_KEY, host: undefined, logger })).toThrow(
      /POSTHOG_HOST is required/,
    );
    const host = 'https://eu.i.posthog.com';
    const remote = createFeatureFlags({ apiKey: API_KEY, host, logger });
    expect(remote).toBeInstanceOf(PostHogFeatureFlags);
    await remote.shutdown();
  });
});

describe('PlatformModule FEATURE_FLAGS binding', () => {
  it('binds FEATURE_FLAGS to the adapter the composition root built and shuts it down with the app', async () => {
    let shutdowns = 0;
    const adapter: FeatureFlagsAdapter = {
      isEnabled: () => Promise.resolve(true),
      shutdown: () => {
        shutdowns += 1;
        return Promise.resolve();
      },
    };
    const clock = new SystemClock();
    const moduleRef = await Test.createTestingModule({
      imports: [
        PlatformModule.forRoot({
          logger: { pinoHttp: httpLoggerOptions({ level: 'silent' }) },
          version: { version: 'test', commit: 'test', builtAt: '2026-09-27T00:00:00Z' },
          clock,
          healthProbe: new UnconfiguredHealthProbe(),
          storage: new InMemoryStorageProvider(() => clock.now()),
          featureFlags: adapter,
        }),
      ],
    }).compile();

    expect(moduleRef.get<FeatureFlags>(FEATURE_FLAGS)).toBe(adapter);
    await moduleRef.close();
    expect(shutdowns).toBe(1);
  });
});
