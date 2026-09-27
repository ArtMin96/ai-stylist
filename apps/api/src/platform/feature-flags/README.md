# platform/feature-flags — the `FeatureFlags` port's adapters (P02-T09)

The port, its DI token `FEATURE_FLAGS` and the flag registry live in `packages/shared-kernel`
(`src/feature-flags.ts`, `registry/feature-flags.json`). These adapters implement it. Translation
only: PostHog decides whether a flag is on; the registry decides the value used when PostHog cannot
answer. Policy (owner, expiry, rollout plan, safe off state): planning/14 §11 and
`docs/observability/posthog.md`.

## Files

- `create-feature-flags.ts`: `createFeatureFlags({ apiKey, host, logger })` → `FeatureFlagsAdapter`.
  The composition root passes the validated `POSTHOG_API_KEY` and `POSTHOG_HOST`; nothing here
  reads `process.env`. An empty key gives `RegistryDefaultFeatureFlags`; a key without a host
  throws (posthog-node's own default host is the US region).
- `registry-default-feature-flags.ts`: `RegistryDefaultFeatureFlags` answers each flag's
  `defaultWhenUnavailable` (local runs, tests, CI). `FeatureFlagsAdapter` = the port plus
  `shutdown()`.
- `posthog-feature-flags.ts`: `PostHogFeatureFlags` on posthog-node 5.54.1.

## `PostHogFeatureFlags`

- **One request per TTL.** Every registered flag is evaluated remotely in one `POST /flags/?v=2`
  (`getAllFlagsAndPayloads` with `flagKeys` = the registry keys), for the one system distinct id
  `FEATURE_FLAGS_DISTINCT_ID` = `ai-stylist-api` (never a user id; no person properties),
  `geoip_disable: true`. The result is reused for `FEATURE_FLAG_CACHE_TTL_MS` (10 s), so a flag
  flipped in PostHog takes effect here within about 10 s. Concurrent checks share the in-flight
  request. No personal or secret key is configured, so there is no local-evaluation poller.
- **Bounded.** `FEATURE_FLAG_TIMEOUT_MS` (1.5 s) per request (posthog-node
  `featureFlagsRequestTimeoutMs`, headers and body), no retry, plus an outer `withTimeout`.
- **Outcomes** (logged as `{ flag, outcome }`, nothing else):
  - `on` / `off`: the flag's value in the reply.
  - `inactive`: absent from a clean reply → **off**. Remote `/flags` omits a flag that is inactive
    in PostHog (posthog-node `getFeatureFlagResult` docs; PostHog/posthog-js PR #4785, merged
    2026-09-05), so turning a flag off in PostHog must read as off, not as its default. A flag not
    yet created in the project reads the same way (the sync creates new flags off anyway).
  - `unavailable`: timeout, network or HTTP error, a quota-limited reply, or
    `errorsWhileComputingFlags` → the flag's registry `defaultWhenUnavailable`. It is cached for the
    TTL too, so an outage costs one bounded request per TTL instead of one per check.
  - A key outside the registry answers false (`unregistered`). `isEnabled` never throws.
- **No capture of any kind.** `sendFeatureFlagEvent: false`; `getAllFlagsAndPayloads` fires no
  `$feature_flag_called`; `before_send` drops every event; exception autocapture is off; and the
  posthog-node `fetch` is a transport that lets only `<host>/flags/…` leave the process and refuses
  anything else before the network. The same transport records whether the reply was clean, which
  posthog-node's result cannot tell apart from an inactive flag.
- **Flags must be evaluable on the server:** posthog-node sends `evaluation_runtime: server`, so a
  flag restricted to client runtimes reads as inactive (off).
- **Shutdown:** `shutdown()` (idempotent) stops the client; later checks answer the registry
  defaults without a request. `PlatformModule.forRoot({ …, featureFlags })` binds `FEATURE_FLAGS`
  and calls it on application shutdown.
- **Keys:** the project key must start with `phc_` (a personal `phx_` key is a secret and is
  refused; the error never echoes the value). The host must be an http(s) URL.

## Tests

`../tests/feature-flags.test.ts` runs the real posthog-node client over HTTP against a local fake
PostHog host (`../tests/fake-posthog.ts`): on/off, inactive = off, timeout / HTTP 401 and 500 /
quota limit / computation error / malformed reply → registry defaults within the timeout, TTL cache
(one request per TTL, shared by concurrent checks, a flip after the TTL, an outage cached), the
request body (system distinct id, no person properties, GeoIP off, registry keys), no request other
than `/flags/` across the whole suite (also when the SDK client is told to capture), shutdown,
logs, key and host validation, `RegistryDefaultFeatureFlags`, `createFeatureFlags` and the
`PlatformModule` binding.
