# P08 — Context Providers

> File name per [SPINE §5](../SPINE.md). Template: [templates/phase.md](../templates/phase.md). Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P08 — Context providers
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Deliver the `context` module — pluggable `ContextProvider` ports with the four v1 providers (Open-Meteo weather, forecast-day, Nager.Date holidays, explicit user occasion), typed `ContextFact` records with freshness/confidence/consent/override, caching, and graceful provider-failure degradation — so P09 can consume context without ever touching a provider SDK.
- **User-visible outcome:** The user can see today's (and a selected future day's) weather and holiday context with source and freshness labels, choose an occasion/dress code/activity explicitly, override any fact ("I'll be indoors all day"), and get weather via coarse location by default or manual city with no location permission at all.
- **Why now:** P09 (engine) hard-depends on typed context facts; P03 delivered the profile fields (locale, units, timezone, climate tolerance) and the consent machinery this phase builds on. Building context before the engine keeps stage 1–2 of the doc 09 pipeline an independent, separately testable module.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-CTX-010 | ContextFact typed envelope: provider, source time, expiry/freshness, confidence, consent scope, user override | AC-1 |
| REQ-CTX-020 | Weather provider (Open-Meteo behind `WeatherProvider` port), current + hourly | AC-2 |
| REQ-CTX-030 | Forecast for a user-selected future day; beyond-horizon degrades explicitly | AC-3 |
| REQ-CTX-040 | Weather facts include temp, feels-like, precip, wind, humidity, UV, indoor/outdoor plan | AC-2 |
| REQ-CTX-050 | Locale-aware holidays (Nager.Date behind `HolidayProvider` port) + "matters to me" toggle | AC-4 |
| REQ-CTX-060 | Explicit occasion/dress code/activity/location type/time of day/travel/style/comfort inputs | AC-5 |
| REQ-CTX-070 | Providers pluggable; future calendar provider addable with zero engine changes | AC-6 |
| REQ-CTX-080 | Cached/offline context usable with staleness warnings *(P08 part: caching + freshness fields; P09 consumes)* | AC-7 |
| NFR-PRV-100 | Precise vs coarse location + manual city entry; weather fully functional with no location permission | AC-8 |

Out of this table by design: REQ-CTX-090 (calendar minimization — P15), REQ-ONB-070 (delivered P03, consumed P09).

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P03** (identity/consent records, profile locale/timezone/units) — per SPINE §5. (P02 foundations transitively via P03.)
- External blockers: Open-Meteo **commercial API plan** account + key provisioned (SPINE §2, DEC-22); decision on Nager.Date hosted vs self-hosted instance (default: hosted, self-host documented as fallback per DEC-23); ASM-08 (coverage adequacy) is validated in this phase.

## 4. In scope / out of scope

**In scope:** `context` module (ports, registry, fact cache, freshness derivation, overrides, MissingFact semantics); `platform` adapters for Open-Meteo and Nager.Date; `ContextFact` schemas in `packages/contracts`; consent-scope wiring for coarse/precise location; location settings UI (coarse default / precise opt-in / manual city); occasion picker and holiday "does this matter" toggle; future-day date picker bounded by forecast horizon; context strip UI showing facts + source + freshness + override affordances (rendered on a placeholder Today surface until P09 fills it); provider-failure degradation and chaos tests; mock calendar provider proving the plugin seam.

**Out of scope / non-goals:** engine consumption of facts and recommendation staleness banners on results (P09); calendar/travel providers and calendar data minimization (P15, REQ-CTX-090); notifications tied to context changes (P09); Tomorrow.io upgrade (documented fallback only); any AI use — this phase is 100% deterministic (doc 10 §1 #17).

## 5. Product/UX behavior

Journey detail owned by [02 §8.2](../02-user-journeys-and-information-architecture.md).

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Location setup (Settings → Privacy) | Coarse location default (OS permission, geohash precision ~city); precise opt-in with "why we ask"; manual city search works with zero permissions | No permission + no city → context strip shows "Set a city for weather" prompt; nothing else blocked | Geocoding failure → retry + free-text city retained; permission denied → manual city path highlighted | Last chosen city persists locally | All controls labeled; permission states announced; no gesture-only interactions |
| Context strip (Today placeholder) | Weather (temp/feels-like/precip icon), holiday chip if any, occasion chip; each shows provider + "as of <time>" on tap | New user, no facts yet → skeleton then facts; no holiday → no chip (not an empty error) | Provider error → chip per missing fact: "Weather unavailable — using nothing, not guesses" + retry; typed `MissingFact` underneath | Cached facts render with staleness label ("Based on this morning's forecast") once past `staleAfter`; "expired" label past `expiresAt` | Chips are buttons with full labels ("Weather, 21 degrees, feels like 20, fetched 6:05"); freshness announced |
| Occasion picker | Preset occasions (from P03 lifestyle presets) + dress code, activity, location type, time of day, travel, desired style, comfort/formality goals; selection stored as `occasion` fact (provider `user`, confidence 1.0) | No presets configured → generic preset list | n/a (local-first, synced) | Fully offline-capable; syncs later | Standard form controls; grouped and labeled |
| Override sheet | Per-fact override ("Actually indoors all day", manual temp band, holiday matters yes/no); provider value stays visible ("Open-Meteo says 21°") | — | Failed sync → queued with idempotency key, retried | Override applies locally immediately | Override state visibly and audibly distinct from provider value |
| Future-day picker | Date picker bounded by provider horizon (Open-Meteo ≤ 16 days); facts for the chosen date with lead-day-decayed confidence | — | Beyond-horizon date selectable but yields explicit `MissingFact{reason:'not_configured'}` note ("No forecast that far out"), never fake weather | Cached future facts render with freshness labels | Calendar control accessible; horizon limit explained in text |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); update each touched module's contract file.

| Module | Change | Contract update needed? |
|---|---|---|
| `context` | **New module**: `ContextProvider` port + registry, `collect()` orchestration, `context_facts` cache, freshness derivation, override handling, `MissingFact` semantics, `ContextSnapshot` assembly (consumed by P09) | Yes — new module contract |
| `platform` | `OpenMeteoWeatherProvider`, `NagerDateHolidayProvider` adapters (SDK/HTTP code lives here only); geocoding adapter for manual city | Yes |
| `shared-kernel` | Context enums (`ContextFactKind`, `ConsentScope` additions `coarse-location`/`precise-location`, occasion/dress-code enums), geohash precision constants | Yes (single-writer, sequence first) |
| `identity` | Consent scopes for coarse/precise location registered; withdrawal halts collection | Yes |
| `profile` | Manual-city field + location-mode preference (reads existing locale/timezone) | Yes (minor) |
| `recommendation` | None (P09). The `ContextSnapshot` type ships in contracts now so P09 starts against a frozen shape | No |

Architecture invariants exercised: domain never imports provider SDKs (`just arch-check` rule extended to the two new adapters); providers `collect()` never throws and is side-effect free (doc 09 §2.2).

## 7. Public interfaces, contracts, schemas, migrations, events

- **API (OpenAPI 3.1, `packages/contracts`):** `GET /v1/context-facts?date=&kinds=` (envelope per [06 §3.4](../06-data-api-and-event-contracts.md)); `PUT /v1/context-overrides/{kind}` (+ delete); `PUT /v1/me/occasion-defaults`; `PUT /v1/me/location` (mode: coarse|precise|manual-city). All mutations take `Idempotency-Key`.
- **Event schemas:** `context.fact.overridden.v1` (per doc 06 catalog). No other new events.
- **DB migrations (Drizzle, expand-only):** `context_facts` cache table (kind, value jsonb, provider, source_time, fetched_at, expires_at, confidence, consent_scope, user geohash/date subject, schema_version); `context_overrides`; profile column for manual city/location mode. Rollback: tables are additive caches — down migration drops them; overrides are user data, so the down path is documented `-- IRREVERSIBLE` for `context_overrides` with export note (doc 06 §7 policy).
- **Generated clients to regenerate:** TS mobile client, event TS types, Python worker models (`just generate`, CI `--check`).

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Location settings UI, occasion picker, context strip + freshness labels, override sheet, future-day picker, offline cache of facts, staleness rendering from fact fields (no separate client logic — doc 09 §11) |
| Backend | `context` module, provider registry, cache/TTL logic, override endpoints, consent gating, `ContextSnapshot` assembly |
| Workers (ML/media) | None |
| Data / migrations | `context_facts`, `context_overrides`, profile location fields |
| Infrastructure | Open-Meteo commercial key + Nager.Date base URL in env/secrets (doc 15 §6); rate-limit budget config per provider |
| 3D / assets | None |
| Admin / internal tools | Provider-health panel entry (last success per provider, error rate) in existing ops dashboard |

## 9. AI vs deterministic decisions

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| All of P08 (provider adapters, freshness, overrides, occasion mapping) | **Deterministic** | Doc 10 §1 #17: context acquisition and context→fact mapping are pure code; no perceptual judgment involved | n/a | $0 marginal AI cost |

Any future proposal to add AI here requires the doc 10 entry first (CLAUDE.md invariant).

## 10. Security, privacy, consent, and data lifecycle

- **New sensitive data:** location (coarse geohash, or precise with opt-in), manual city string. Classified per [11](../11-security-privacy-and-compliance.md); precise coordinates are never stored — only the geohash at the consented precision, on the fact's `subject`.
- **Consent:** `coarse-location` / `precise-location` consent scopes gate the respective providers (`requiredConsent` checked before `collect()` — doc 09 §2.2). Manual city requires no consent scope beyond account. Withdrawal → provider stops being called; cached facts for withdrawn scopes purged.
- **Retention/deletion/export:** `context_facts` is a short-TTL cache (rows pruned at `expiresAt` + 7 days); overrides and occasion defaults are user data — included in export, deleted in the doc 06 §8 cascade (add both tables to the cascade coverage test).
- **Threat/abuse cases:** location inference from fact history (mitigation: coarse geohash only, short retention); provider-response injection (schema-validate every provider payload; reject unknown shapes); SSRF via manual city geocoding (allowlist provider hosts). Added to the doc 11 threat model this phase.

## 11. Observability and analytics added in this phase

- **Logs/metrics/traces:** per-provider success/error/latency metrics (`context.provider.{ok,error,latency}` tagged by provider), cache hit rate, fact staleness-at-read distribution, override rate per kind, MissingFact rate by reason. Provider calls traced as spans in the request trace (NFR-OBS-020 pattern).
- **Product analytics (taxonomy per [14 §9](../14-observability-operations-and-analytics.md), consent-gated):** `context_location_mode_set`, `context_occasion_selected`, `context_fact_overridden` (kind only, no values), `context_manual_city_set` (boolean, not the city).
- **Alerts/dashboards/runbooks:** alert on provider error rate > 20% over 15 min (degradation is graceful, but we must know); runbook: "weather provider down" (verify status page → confirm MissingFact behavior → consider Tomorrow.io swap per DEC-22); dashboard panel per NFR-OBS-030 provider-failures line. Per-phase observability rule 14 §15 satisfied.

## 12. Ordered tasks

Small enough for one AI-assisted session each. Task IDs `P08-T##`.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P08-T01 | Contracts: `ContextFact`/`MissingFact`/`ContextSnapshot`/override schemas + OpenAPI paths + `context.fact.overridden.v1`; regenerate clients | — | 1 |
| P08-T02 | `shared-kernel`: context enums, consent scopes, occasion/dress-code enums, geohash constants (single-writer; lands before consumers) | — | 1 |
| P08-T03 | `context` module skeleton: `ContextProvider` port, registry, `collect()` orchestration with per-provider isolation (one failing provider never blocks others), MissingFact semantics + unit tests | T01, T02 | 1 |
| P08-T04 | `platform`: Open-Meteo adapter (current + forecast-day, all REQ-CTX-040 signals) + recorded-fixture contract tests (doc 13 §5) | T03 | 1–2 |
| P08-T05 | `platform`: Nager.Date adapter + locale mapping + recorded-fixture contract tests | T03 | 1 |
| P08-T06 | `UserOccasionProvider` + occasion-defaults endpoints + REQ-CTX-060 input set | T03 | 1 |
| P08-T07 | `context_facts` cache + TTL/freshness derivation (`fresh|stale|expired` from `staleAfter`/`expiresAt`) + migrations + prune job | T03 | 1 |
| P08-T08 | Overrides: endpoint, precedence (override wins, provider value retained), event emission, cache invalidation on override | T07 | 1 |
| P08-T09 | Consent gating + location modes: coarse default, precise opt-in, manual city + geocoding adapter; purge-on-withdrawal | T03, T07 | 1–2 |
| P08-T10 | Mobile: location settings UI + occasion picker (offline-capable) | T01 | 1–2 |
| P08-T11 | Mobile: context strip, freshness labels, override sheet, future-day picker with horizon bound | T10, T08 | 2 |
| P08-T12 | Degradation: chaos tests per provider (down, slow, garbage payload), beyond-horizon behavior, `ContextSnapshot` immutability + content hash | T04–T08 | 1 |
| P08-T13 | Plugin-seam proof: mock calendar provider added in a test via the public interface only — zero `context`-core or engine changes (REQ-CTX-070) | T03 | 1 |
| P08-T14 | Observability + analytics events + provider-health admin panel + runbook | T04–T09 | 1 |
| P08-T15 | Demo prep, module contract docs, deletion-cascade coverage for new tables, PROGRESS update | all | 1 |

## 13. Parallelization

- **Can run in parallel:** {T04, T05, T06} after T03 (disjoint adapter files); {T10, T11 mobile} against generated client from T01 while backend T04–T09 proceed (disjoint apps); T13 anytime after T03.
- **Must be serial:** T01 and T02 first and alone — `packages/contracts` and `shared-kernel` are single-writer (CLAUDE.md parallel-session rules); T07 → T08 → T09 share cache internals; T12/T14/T15 after their inputs.

## 14. Test-first plan (by module and level)

Per [13](../13-testing-quality-and-performance.md); tests live in each module's `tests/`.

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `context` | freshness derivation, override precedence, MissingFact per failure reason, snapshot hashing | fast-check: freshness is a pure monotone function of timestamps; override never mutates provider value; `collect()` results are order-independent | ContextFact schema round-trip per kind; snapshot consumed by a stub engine | Testcontainers: cache write/read/prune, consent-withdrawal purge | — |
| `platform` (adapters) | payload mapping incl. all REQ-CTX-040 fields | — | recorded Open-Meteo/Nager.Date fixtures; provider format change breaks test, not prod (doc 13 §5) | timeout/retry/circuit behavior against a fake slow server | — |
| `identity`/`profile` | consent-scope checks | — | — | withdrawal halts collection mid-flight (sec suite pattern, doc 13 §8.1 consent gating) | — |
| Mobile | freshness label rendering from fact fields | — | generated-client handshake | RNTL: strip states (fresh/stale/expired/missing), override sheet | Maestro: manual-city-only weather flow; degraded-provider flow (doc 13 §7 list) |

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | `GET /context-facts` p95 ≤ 250 ms warm cache; cold provider fetch p95 ≤ 2.5 s; prefetch keeps engine path warm for P09 | API metrics + k6 smoke on the endpoint |
| Cost | Open-Meteo commercial plan flat fee within infra budget (SPINE §6 anchors); $0 AI spend; provider calls/user/day ≤ 4 via cache TTLs (weather ttl 3 h / stale 1 h per doc 09 §2.2) | provider-call metric vs active users |
| AI quality | n/a (no AI) | — |
| Reliability | Any single provider down ⇒ 0 request failures on `/context-facts` (facts + MissingFacts returned); cache hit rate ≥ 70% steady state | chaos tests (T12) + dashboard |

## 16. Rollout, flags, migration, compatibility, rollback

- **Feature flags (owner + expiry):** `context.providers` master flag (owner: BE lead; expiry: P09 acceptance — engine makes it permanent); `context.precise-location` (owner: BE; expiry P14 review). Registered per NFR-OBS-080 with owners/expiry.
- **Migration/backward-compat:** all-new tables, expand-only; no existing reads change. Mobile ships behind the flag; API additive within `/v1`.
- **Rollback plan:** flip `context.providers` off (UI hides strip; no other feature depends on it before P09) → revert deploy if needed → down-migrate cache tables (data loss limited to cache + overrides, overrides export-covered). Exact steps in the release notes for the phase PR train.

## 17. Risks, mitigations, assumptions, stop/kill criteria

Registry in [16](../16-risks-open-questions-and-decision-log.md); add new phase risks there, not here.

- Risks in play: **RISK-11** (small-vendor/provider concentration — mitigated by ports + Tomorrow.io/Calendarific fallbacks per DEC-22/DEC-23); **ASM-08** (Open-Meteo + Nager.Date global coverage adequacy — this phase validates it).
- **Stop/kill criteria:** coverage spot-check across ≥ 10 launch-relevant countries shows Open-Meteo hourly forecast or Nager.Date holidays materially missing/wrong for > 20% of them → swap the failing provider behind its port (Tomorrow.io / Calendarific), log a DEC entry; the port means this is an adapter task, not a redesign. If the commercial-plan procurement blocks > 1 week → develop against the free tier with a hard pre-launch gate item (never launch on the free tier — DEC-22).

## 18. Demo script

On a real device (staging backend):

1. Fresh P03-complete account, no location permission. Open Today placeholder → prompt to set a city; enter city manually → weather facts appear with "Open-Meteo · as of <time>" and temp/feels-like/precip/wind/humidity/UV visible in the detail sheet.
2. Grant coarse location in Settings → facts refetch for geohash location; show consent record in Settings → Privacy.
3. Tap the holiday chip on a fixture holiday date → toggle "matters to me" off → fact shows override state, provider value still visible.
4. Select occasion "office + smart casual + outdoors" → occasion fact appears (provider `user`, confidence 1.0).
5. Pick a future date within horizon → forecast-day facts with decayed confidence; pick a date beyond horizon → explicit "no forecast that far out" note, no invented weather.
6. Kill weather via the chaos flag (staging) → strip shows "Weather unavailable" MissingFact chip + retry; nothing crashes; holiday/occasion still present. Re-enable → recovery on retry.
7. Airplane mode → cached facts render with staleness label once past `staleAfter`.
8. Show the mock-calendar-provider test run (`just test context`) proving the plugin seam.

## 19. Acceptance criteria

Objectively verifiable; evidence = actual command output / screenshots.

- **AC-1:** `ContextFact` schema in `packages/contracts` contains all six REQ-CTX-010 fields; a contract test rejects a fact missing any of them; the P09-facing `ContextSnapshot` is immutable and content-hashed (test).
- **AC-2:** `just test context platform` passes adapter suites proving current + hourly + all REQ-CTX-040 signals from recorded Open-Meteo fixtures; swapping the weather provider in a test requires only a new port implementation (compile-time proof: fake provider registered, zero `context`-core diffs).
- **AC-3:** future-day request within horizon returns forecast facts with lead-decayed confidence; beyond-horizon returns `MissingFact{not_configured}` — both covered by tests and demo step 5.
- **AC-4:** holiday facts appear for ≥ 3 locales from Nager.Date fixtures; per-recommendation-request "matters" toggle round-trips and is visible in the fact's override field.
- **AC-5:** every REQ-CTX-060 input is settable via API + UI and lands in the occasion fact payload (schema test enumerates the full list).
- **AC-6:** T13 mock calendar provider test passes using only the public `ContextProvider` interface; `git diff` in the test PR shows zero changes under `context/src` core (REQ-CTX-070).
- **AC-7:** offline device renders cached facts with a staleness warning naming the fact and its age (Maestro flow recording).
- **AC-8:** with no location permission ever granted, manual city yields full weather function (Maestro flow); precise mode requires the consent record (integration test fails closed without it).
- **AC-9:** chaos suite: each provider down/slow/garbage ⇒ `/context-facts` returns 200 with facts + typed MissingFacts, no defaults invented (`just test context` chaos lane green).

## 20. Definition of done

```bash
just test context          # module suite incl. chaos + plugin-seam tests — all pass, no skips
just test platform         # adapter contract tests (recorded fixtures)
just lint && just typecheck
just arch-check            # no provider SDK imports outside platform; module boundaries hold
just generate --check      # contracts/clients not stale
just db-migrate && just db-rollback   # forward + rollback exercised on a Neon branch
just ci-parity             # full PR gate green
```

Evidence to attach/link: demo-script screen recording (steps 1–8), Maestro run artifacts for offline + manual-city flows, dashboard screenshot showing provider metrics + cache hit rate on staging, coverage-spot-check table for ASM-08 (≥ 10 countries). Never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: new `docs/modules/context.md` module contract; `platform` contract (two adapters + geocoder); doc 11 threat model additions (§10 above); doc 14 runbook "weather provider down"; mark ASM-08 validated (or trigger its fallback) in doc 16.
- [PROGRESS.md](../PROGRESS.md): set `IN_PROGRESS` at start; `DONE` only with §20 evidence linked; append session-handoff entries per its rules.

## 22. Handoff note

Written at phase end. Expected shape: P08 `ACCEPTED` unblocks **P09** (with P07). Next session starts at `phases/P09-recommendation-engine-v1.md` task P09-T01; first command: `just test context` (green baseline), then read doc 09 §§3–10 before touching `recommendation`. Interim handoffs go to the PROGRESS.md log via [templates/session-handoff.md](../templates/session-handoff.md).
