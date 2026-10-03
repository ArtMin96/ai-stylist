// PostHog adapter of the shared-kernel `FeatureFlags` port (planning/14 §11, ADR-0007,
// docs/observability/posthog.md), on posthog-node 5.54.1. Translation only: whether a flag is on
// is decided in PostHog; the registry decides the value used when PostHog cannot answer.
//
// - Remote evaluation of every registered flag in one `/flags` request, for one fixed system
//   distinct id (never a user id), GeoIP disabled. No personal/secret key, so no definitions poller.
// - At most one request per `cacheTtlMs` (10 s): a flag flipped in PostHog reaches the process
//   within seconds. Concurrent checks share the in-flight request; a failed one is cached as well,
//   so an outage costs one bounded request per TTL instead of one per check.
// - Bounded: `timeoutMs` (1.5 s) per request, no retry.
// - Outcomes: on → true. Off, or absent from a clean reply → false: remote `/flags` omits a flag
//   that is inactive in PostHog (posthog-node `getFeatureFlagResult` docs; PostHog/posthog-js
//   PR #4785, 2026-09-05), and "inactive" must mean off, or turning a flag off in PostHog would
//   fall back to a `true` default. Timeout, transport or HTTP error, quota limit or
//   `errorsWhileComputingFlags` → the registry's `defaultWhenUnavailable`. Never throws.
// - No capture of any kind: `sendFeatureFlagEvent: false`, flags are read with
//   `getAllFlagsAndPayloads` (which fires no `$feature_flag_called`), `before_send` drops every
//   event, and the injected transport refuses every request that is not `<host>/flags/…`.
// - Logs: flag key and outcome enum only.
import { FEATURE_FLAG_REGISTRY, type FeatureFlagKey } from '@ai-stylist/shared-kernel';
import { PostHog, type PostHogOptions } from 'posthog-node';
import type { Logger } from 'pino';

import { type Clock, SystemClock } from '../ports/clock.port.js';
import { withTimeout } from '../resilience/timeout.js';

import {
  type FeatureFlagDefaults,
  type FeatureFlagsAdapter,
  registryDefault,
} from './registry-default-feature-flags.js';

/** The one distinct id every evaluation is made for: this service, never a user. */
export const FEATURE_FLAGS_DISTINCT_ID = 'ai-stylist-api';
/** One `/flags` request, headers and body included (posthog-node `featureFlagsRequestTimeoutMs`). */
export const FEATURE_FLAG_TIMEOUT_MS = 1_500;
/** How long one evaluation is reused: the delay before a flip in PostHog takes effect here. */
export const FEATURE_FLAG_CACHE_TTL_MS = 10_000;
/** Outer bound over the SDK's own deadline, in case its call never settles. */
const OUTER_TIMEOUT_MARGIN_MS = 250;
/** `shutdown()`: nothing is ever queued, so this only bounds the SDK's own teardown. */
const SHUTDOWN_TIMEOUT_MS = 2_000;

/** How one flag was resolved (logged): `inactive` = absent from a clean reply. */
export type FeatureFlagOutcome = 'on' | 'off' | 'inactive' | 'unavailable';

type Transport = NonNullable<PostHogOptions['fetch']>;
type TransportInit = Parameters<Transport>[1];
type TransportResponse = Awaited<ReturnType<Transport>>;

type Evaluation = { readonly values: ReadonlyMap<string, boolean>; readonly expiresAtMs: number };

/** Whether the `/flags` reply of the current evaluation was complete and trustworthy. */
type ReplyRecord = { clean: boolean };

export type PostHogFeatureFlagsOptions = {
  /** PostHog project key (`phc_…`), passed in by the composition root. */
  readonly apiKey: string;
  /** Ingestion host, `https://eu.i.posthog.com`. Required: the SDK's default is the US region. */
  readonly host: string;
  /** A pino logger built from `loggerOptions()`. */
  readonly logger: Logger;
  /** Default `SystemClock`; tests pass `fakeClock()` to move past the TTL. */
  readonly clock?: Clock;
  /** Default `FEATURE_FLAG_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
  /** Default `FEATURE_FLAG_CACHE_TTL_MS`. */
  readonly cacheTtlMs?: number;
  /** Default `FEATURE_FLAG_REGISTRY`: which flags are evaluated and their fallback values. */
  readonly registry?: FeatureFlagDefaults;
};

/** A reply PostHog computed fully: flags present, no computation error, not quota-limited. */
function isCleanFlagsReply(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const reply = body as Record<string, unknown>;
  const flags = reply.flags ?? reply.featureFlags;
  const quotaLimited =
    Array.isArray(reply.quotaLimited) && reply.quotaLimited.includes('feature_flags');
  return (
    typeof flags === 'object' &&
    flags !== null &&
    reply.errorsWhileComputingFlags !== true &&
    !quotaLimited
  );
}

export class PostHogFeatureFlags implements FeatureFlagsAdapter {
  private readonly client: PostHog;
  private readonly logger: Logger;
  private readonly clock: Clock;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly defaults: FeatureFlagDefaults;
  private readonly keys: readonly string[];
  private readonly flagsUrlPrefix: string;
  private evaluation: Evaluation | undefined;
  private evaluating: Promise<Evaluation> | undefined;
  private reply: ReplyRecord | undefined;
  private stopped: Promise<void> | undefined;

  constructor(options: PostHogFeatureFlagsOptions) {
    if (!options.apiKey.startsWith('phc_')) {
      // Never echo the value: a personal `phx_` key is a secret.
      throw new TypeError('PostHogFeatureFlags: apiKey must be a PostHog project key (phc_…)');
    }
    const host = options.host.trim().replace(/\/+$/, '');
    const protocol = URL.canParse(host) ? new URL(host).protocol : '';
    if (protocol !== 'https:' && protocol !== 'http:') {
      throw new TypeError('PostHogFeatureFlags: host must be an http(s) URL');
    }
    this.logger = options.logger.child({ component: 'feature-flags' });
    this.clock = options.clock ?? new SystemClock();
    this.timeoutMs = options.timeoutMs ?? FEATURE_FLAG_TIMEOUT_MS;
    this.cacheTtlMs = options.cacheTtlMs ?? FEATURE_FLAG_CACHE_TTL_MS;
    this.defaults = options.registry ?? FEATURE_FLAG_REGISTRY;
    this.keys = Object.keys(this.defaults);
    this.flagsUrlPrefix = `${host}/flags/`;
    this.client = new PostHog(options.apiKey, {
      host,
      featureFlagsRequestTimeoutMs: this.timeoutMs,
      featureFlagsRequestMaxRetries: 0,
      sendFeatureFlagEvent: false,
      disableGeoip: true,
      enableExceptionAutocapture: false,
      before_send: () => null,
      fetch: (url, init) => this.transport(url, init),
    });
  }

  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const fallback = registryDefault(this.defaults, key);
    if (this.defaults[key] === undefined) {
      this.logger.warn({ flag: key, outcome: 'unregistered' }, 'feature flag not in the registry');
      return false;
    }
    if (this.stopped !== undefined) return fallback;
    try {
      return (await this.current()).values.get(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  shutdown(): Promise<void> {
    this.stopped ??= this.client.shutdown(SHUTDOWN_TIMEOUT_MS).catch((error: unknown) => {
      const errorName = error instanceof Error ? error.name : typeof error;
      this.logger.warn({ errorName }, 'posthog client shutdown failed');
    });
    return this.stopped;
  }

  /** The evaluation still within its TTL, or the one in flight, or a new one. */
  private current(): Promise<Evaluation> {
    const cached = this.evaluation;
    if (cached !== undefined && this.clock.now().getTime() < cached.expiresAtMs) {
      return Promise.resolve(cached);
    }
    this.evaluating ??= this.evaluate()
      .then((evaluation) => {
        this.evaluation = evaluation;
        return evaluation;
      })
      .finally(() => {
        this.evaluating = undefined;
      });
    return this.evaluating;
  }

  private async evaluate(): Promise<Evaluation> {
    const reply: ReplyRecord = { clean: false };
    this.reply = reply;
    let flags: Record<string, unknown> = {};
    let clean = false;
    try {
      const result = await withTimeout(
        () =>
          this.client.getAllFlagsAndPayloads(FEATURE_FLAGS_DISTINCT_ID, {
            flagKeys: [...this.keys],
            disableGeoip: true,
          }),
        this.timeoutMs + OUTER_TIMEOUT_MARGIN_MS,
      );
      flags = result.featureFlags ?? {};
      clean = reply.clean;
    } catch {
      // Outer timeout: the SDK never settled. Unavailable.
    } finally {
      if (this.reply === reply) this.reply = undefined;
    }
    const values = new Map<string, boolean>();
    for (const key of this.keys) {
      const value = flags[key];
      let outcome: FeatureFlagOutcome;
      if (!clean) outcome = 'unavailable';
      else if (value === undefined) outcome = 'inactive';
      else outcome = value === false ? 'off' : 'on';
      if (outcome === 'unavailable') {
        values.set(key, registryDefault(this.defaults, key));
        this.logger.warn({ flag: key, outcome }, 'feature flag unavailable; registry default used');
      } else {
        values.set(key, outcome === 'on');
        this.logger.debug({ flag: key, outcome }, 'feature flag evaluated');
      }
    }
    return { values, expiresAtMs: this.clock.now().getTime() + this.cacheTtlMs };
  }

  /**
   * posthog-node's `fetch`: only `<host>/flags/…` leaves the process; anything else (an event
   * batch, remote config) is refused before the network. Records whether the `/flags` reply was
   * clean, which the SDK's result cannot tell apart from an inactive flag.
   */
  private async transport(url: string, init: TransportInit): Promise<TransportResponse> {
    const reply = this.reply;
    if (!url.startsWith(this.flagsUrlPrefix)) {
      this.logger.error({ outcome: 'refused' }, 'posthog request refused: only /flags is allowed');
      throw new TypeError('posthog request refused: only flag evaluation may leave the process');
    }
    const response = await fetch(url, init);
    return {
      status: response.status,
      headers: response.headers,
      body: response.body,
      text: () => response.text(),
      json: async () => {
        const parsed: unknown = await response.json();
        if (reply !== undefined && response.ok && isCleanFlagsReply(parsed)) reply.clean = true;
        return parsed;
      },
    };
  }
}
