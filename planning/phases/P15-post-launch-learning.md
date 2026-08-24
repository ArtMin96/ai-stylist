# P15 — Post-Launch Learning

> File name: `phases/P15-post-launch-learning.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10). Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P15 — Post-launch learning
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Turn production data into decisions — review every metric against the doc 00 targets and close the deferred decide-by-data items; design (and only build if the data justifies it) the calendar/schedule `ContextProvider`; and lay AI-stylist-chat foundations as a thin `assistant` adapter over existing application services, gated on the metrics.
- **User-visible outcome:** Directly: a product tuned by evidence (pricing/paywall/notification/feed adjustments from experiments). Conditionally, behind gates: outfit context from the user's calendar (consented, minimized) and a first Pro-tier stylist-chat capability that answers "what should I wear tomorrow?" through the same engine and reason codes as every other surface.
- **Why now:** Both candidate investments were deliberately deferred until real usage exists (brief §10.16, [SPINE §5](../SPINE.md)): the seams were built early (`ContextProvider` interface in P08, application-service seam ratified by P09 per [04 §10](../04-architecture.md), `chat.stylist` entitlement named since doc 12) precisely so P15 can decide from data instead of faith. P14's launch supplies the baselines that "baseline first" metrics have been waiting for.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| NFR-OBS-100 (final, with P00/P14) | Metric tree drives decisions; guardrails never traded for engagement | AC-1, AC-2 |
| REQ-CTX-070 (final, with P08) | Calendar-class provider added via the plugin interface with zero engine changes | AC-3 |
| REQ-CTX-090 | Calendar provider minimizes data; no full event content stored | AC-4 |
| REQ-CHT-010 (final, with P02) | No chat before P15; foundations gated on post-launch metrics | AC-5 |
| REQ-CHT-020 | Chat calls the same application services — no second engine, no direct tables | AC-6 |
| REQ-CHT-030 | Stable tool contracts with per-tool authorization | AC-7 |
| REQ-CHT-040 | Conversation privacy, auditability, safe deletion designed before chat ships | AC-8 |
| REQ-CHT-050 | Prompt versioning, tool-call limits, model routing, cost controls | AC-9 |

*Note:* if the chat gate (§17) decides "not yet", REQ-CHT-020…050 are delivered as **ratified designs + contracts** (their P15 scope per doc 01 acceptance criteria is design/contract-level; implementation follows the gate) — the phase records that explicitly rather than claiming shipped capability.

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P14** (per SPINE §5) — launched product with the metric tree live.
- External blockers: ≥ 2–4 weeks of production data for baseline honesty (earlier only for incident-driven review); calendar work additionally blocked on privacy design ratification in doc 11 (`calendar` consent purpose, [11 §7.6](../11-security-privacy-and-compliance.md)) and a legal-register check for calendar-data handling; chat build blocked on its metric gate (§17) and the AIC-O4 chat cost model ([10 §7](../10-ai-usage-cost-and-evaluation.md)); OS calendar API permissions (EventKit / Android providers) reviewed against store policies before any build.

## 4. In scope / out of scope

**In scope:** structured metric review against every [00 §8](../00-product-vision-and-scope.md) table (activation, core-loop, monetization, guardrails) producing written keep/change/kill decisions (DEC entries); closing deferred decide-by-data items — pricing/paywall experiment readouts ([12 §5.8](../12-pricing-entitlements-and-unit-economics.md)), trial length 3-vs-7-day experiment decision, notification defaults, Free over-cap behavior, feed-source curation from hide rates, credit quantities; **calendar/schedule `ContextProvider`: privacy-first design ratified (fact schema, minimization, consent purpose) — implementation only if the metric case justifies it** (design-only is the default posture); **chat foundations: assistant-module adapter design + tool contracts + cost model; implementation of a minimal Pro-gated chat only if the §17 gate passes**; instrumentation gaps found by the review; doc updates converting "baseline first" placeholders to measured baselines.

**Out of scope / non-goals:** any second recommendation engine or chat-side business logic (forbidden — [SPINE §3](../SPINE.md), REQ-CHT-020); storing raw calendar event titles/descriptions/attendees/locations server-side (forbidden by design, [11 §7.6](../11-security-privacy-and-compliance.md)); localization, commerce, social features (still deferred per [00 §5](../00-product-vision-and-scope.md)); G3/G4 and other research bets (their own gates, [00 §9.1](../00-product-vision-and-scope.md)); repricing outside the experiment framework; scaling/infra re-architecture without measured need.

## 5. Product/UX behavior

New user-facing surfaces exist only behind their gates. States for both candidate features are specified now so a "build" decision starts implementation-ready.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Calendar connect (Settings → Privacy, if built) | Explicit `calendar` consent screen (what is read, what is stored: occasion classification only) → OS permission → facts appear in context transparency UI | No events in range → no calendar facts; recommendations unchanged | Provider error → typed `MissingFact`, engine conservative path ([09 §10.3](../09-recommendation-engine.md)); retry on next context resolve | Cached facts with freshness labels; no background fetch | Consent text is real text; toggle state announced |
| Recommendation with calendar context (if built) | "Based on your 7 pm dinner" reason chip from `RC-*` codes; override affordance per fact | — | Missing consent → feature simply absent, no nag | Cached context + staleness banner (existing behavior) | Reason chips readable in sequence (existing pattern) |
| Stylist chat (Pro, if gate passes) | Chat surface answers wardrobe/outfit questions via tool calls; every recommendation shown carries the same reason codes; provenance: "answers come from your closet + stylist engine" | First open → suggested starter prompts from real closet data | Tool failure → honest error + retry; token/tool-limit reached → graceful "let me summarize" + limit notice | Chat requires connectivity; offline shows cached conversation read-only | Transcript navigable; responses announced; no auto-scrolling traps; text input standard |
| Chat gating | Pro entitlement (`chat.stylist`) checked server-side; non-Pro sees contextual paywall | — | `ENTITLEMENT_REQUIRED` → paywall (P13 pattern) | — | Paywall a11y per [02 §13.2](../02-user-journeys-and-information-architecture.md) |
| Metric-review artifacts (internal) | Review docs + DEC entries; dashboards annotated with decisions | — | — | — | — |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); update each touched module's contract file.

| Module | Change | Contract update needed? |
|---|---|---|
| `context` | (Design always; build if justified) `CalendarProvider` implementing the existing `ContextProvider` interface ([09 §2.2](../09-recommendation-engine.md)): produces `calendar.event` facts with occasion classification only; consent-checked before `collect()` | Yes — provider registry entry; **zero engine changes** (AC-3) |
| `identity` | `calendar` consent purpose activated in the registry (schema exists since P03 design) | Yes (small) |
| `assistant` | (Design always; build if gate passes) New module: conversation storage, prompt/version registry, tool-call orchestration, per-user limits, model routing config. **Adapter only** — imports exclusively public application services of `profile`/`closet`/`context`/`recommendation`/`fashion-intel`/`outfit`/`billing` per [04 §4.1/§10](../04-architecture.md) | Yes — new module contract |
| `shared-kernel` | Tool-contract schemas' shared types; chat reason-code passthrough (no new codes — chat reuses engine codes) | Yes (single-writer) |
| `platform` | LLM chat port (shares prompt registry conventions with [10 §2.7](../10-ai-usage-cost-and-evaluation.md)); calendar OS adapters live client-side (on-device read; server sees derived facts only) | Yes |
| `billing` | `chat.stylist` entitlement enforcement point + chat spend guardrail (REQ-BIL-100 pattern) | Yes (small) |
| `recommendation` | **No changes.** Chat and calendar consume it as-is — that is the point | No |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`): design-ratified in all cases; shipped only behind their gates — `POST /context/calendar/sync` (client-derived facts submission; server never receives raw event text), `POST /assistant/conversations` + `POST /assistant/conversations/:id/messages` (SSE/stream), `GET /assistant/conversations`, `DELETE /assistant/conversations/:id`. **Tool-contract schemas** (REQ-CHT-030): one schema per tool (`get_profile`, `query_closet`, `resolve_context`, `request_recommendation`, `submit_feedback`, `query_trends`, `compose_outfit`, `check_entitlement`) each with typed input/output and a declared authorization scope; contract tests generated for each.
- Event schemas added/changed: `assistant.conversation.created.v1`, `assistant.message.completed.v1` (ids/counts/versions only — no message text in events), `context.fact.calendar_synced.v1`.
- DB migrations (Drizzle): `conversations` + `messages` (user-scoped, S2/S3-classified content, retention policy field, deleted with account), `prompt_versions` registry, `assistant_usage` (per-user tool-call + token counters). All additive; forward + rollback per doc 06; none applied unless the respective gate passes.
- Generated clients to regenerate: TS mobile client, admin client (`just generate`) — on build only.

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Metric-driven UX adjustments from review decisions; (gated) calendar consent + on-device event→occasion derivation; (gated) chat surface with streaming, limits UI, paywall |
| Backend | (Design, then gated build) `assistant` module; `CalendarProvider`; consent purpose activation; chat entitlement + guardrails |
| Workers (ML/media) | None (chat LLM calls go through a `platform` port from the API/jobs; no new worker) |
| Data / migrations | §7 tables behind gates; baseline-annotation of metric docs |
| Infrastructure | Chat model routing config + per-task kill switch (extends [10 §6.3](../10-ai-usage-cost-and-evaluation.md) ladder with rung: "chat paused"); experiment configs for decide-by-data items |
| 3D / assets | None |
| Admin / internal tools | Conversation audit view (metadata only — no message browsing without break-glass, [11 §4.4](../11-security-privacy-and-compliance.md)); experiment-readout notebook/queries for the metric review |

## 9. AI vs deterministic decisions

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Metric review + experiment readouts | **Deterministic** (queries, dashboards, human judgment) | Analysis, not inference | n/a | $0 |
| Calendar event → occasion classification | Deterministic keyword/type mapping on device first; NL classification only if eval shows rules insufficient (would need its own doc 10 entry before build) | Minimization: the less inference, the less data; rules are auditable | No calendar facts (typed MissingFact) | $0 target |
| Stylist chat (NL, [10 §2.9](../10-ai-usage-cost-and-evaluation.md)) | NL orchestration over **deterministic tools**: the engine, closet queries, context — the model never decides outfits, it calls the engine and explains from its reason codes | Conversational interface is inherently NL; decisions stay deterministic (no second engine) | Chat unavailable → all capabilities remain reachable through normal UI (chat is additive, never load-bearing) | Per-conversation token budget + tool-call limit (≤ 10 calls/turn hypothesis); per-user monthly chat spend cap within Pro guardrail ([10 §6.1](../10-ai-usage-cost-and-evaluation.md)); cost model = AIC-O4 deliverable, prices as-of-dated |
| Chat answer faithfulness | Post-generation validation: recommendation claims must map to tool-call results/reason codes (extends [10 §2.7](../10-ai-usage-cost-and-evaluation.md) validator) | Honesty invariant — no invented wardrobe facts | Discard + retry once → template summary of tool results | Hallucination rate < 0.5 % on eval (gate to ship) |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11 §6](../11-security-privacy-and-compliance.md)): calendar-derived occasion facts = **S2** (transient, freshness-limited; raw event text never persisted server-side — S3-grade handling of the transient client-side read); chat conversations = **S2/S3** (may reference measurements/wardrobe — treated as sensitive, excluded from analytics/logs).
- Consent required / consent UI changes: `calendar` purpose (off by default, per-integration disclosure); chat requires no new purpose (core service + existing AI provider review) but the provider carrying conversation text must pass the [11 §7.5](../11-security-privacy-and-compliance.md) review with no-training/short-retention terms (NFR-AIC-070) before launch.
- Retention, deletion, and export impact: conversations user-deletable individually and cascade-deleted with the account (REQ-CHT-040); included in export; calendar facts expire by freshness and are never in export beyond the derived facts; raw calendar text is already a forbidden log field ([11 §8](../11-security-privacy-and-compliance.md)).
- Threat/abuse cases added to the threat model: prompt injection via item names/content attempting to steer tool calls (tool authorization scopes + server-side entitlement checks make tools no more powerful than the REST API; injection eval added); chat as a data-exfiltration surface (tools return only the caller-principal's data — same isolation suite extended to tool calls); denial-of-wallet via chat (token/tool limits + spend caps, [11 §3.6](../11-security-privacy-and-compliance.md) pattern); calendar over-collection (schema structurally lacks fields for raw text — AC-4).

## 11. Observability and analytics added in this phase

Per [14 §15](../14-observability-operations-and-analytics.md) P15 row.

- Logs/metrics/traces: calendar-context minimization metrics (facts produced, consent state, zero-raw-text canary in the redaction suite); chat: `ai.call.count/tokens/cost_usd{task=chat}`, tool-call counts per tool, limit-hit counters, validator-rejection rate, conversation latency; experiment exposure logging for every decide-by-data item.
- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md); consent-gated, no message content ever): `chat_opened`, `chat_message_sent` (`tool_calls_bucket`, `latency_bucket`), `chat_limit_reached` (`kind`), `calendar_context_connected` / `disconnected` — added to the schema registry before emission.
- Alerts/dashboards/runbook entries: chat spend added to AI-cost dashboard with its own guardrail alert; kill-switch rung "chat paused" in runbook 10; metric-review outputs annotated on dashboards (decision + date); baseline values recorded into the doc 00 metric tables.

## 12. Ordered tasks

Small enough for one AI-assisted session each. Task IDs `P15-T##`.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P15-T01 | Metric review part 1 — activation + core loop vs [00 §8.1–8.2](../00-product-vision-and-scope.md): readouts, keep/change/kill decisions drafted | — (2–4 wk data) | 1 |
| P15-T02 | Metric review part 2 — monetization + guardrails vs [00 §8.3–8.4](../00-product-vision-and-scope.md); pricing/trial/credit experiment readouts ([12 §7.6](../12-pricing-entitlements-and-unit-economics.md) baselines filled) | T01 | 1 |
| P15-T03 | Decide-by-data closure: notification defaults, Free over-cap behavior, feed-source curation, doc 02/16 open items → DEC entries; instrumentation-gap fixes filed | T02 | 1 |
| P15-T04 | Backlog re-rank + doc updates: doc 00 baselines recorded, doc 12 LTV section seeded from cohort data, PROGRESS next-arc definition | T03 | 1 |
| P15-T05 | **Calendar design (always):** fact schema (occasion classification only), on-device derivation rules, consent purpose + disclosure copy, doc 11 §7.6 ratification, mock-provider test proving zero engine changes (REQ-CTX-070 seam exercise) | — (parallel with T01) | 1 |
| P15-T06 | **Calendar gate decision:** metric case (occasion-context usage, planning-feature usage) → build / defer DEC | T03, T05 | 1 |
| P15-T07 | Calendar build (only if T06 = build): client permission + derivation, `CalendarProvider`, consent activation, transparency UI, minimization canary tests | T06 | 3 |
| P15-T08 | **Chat foundations design (always):** tool-contract schemas with authZ scopes in `packages/contracts`, prompt/version registry design, limits + model routing config shape, conversation privacy/deletion design, AIC-O4 cost model | — (parallel with T01) | 2 |
| P15-T09 | **Chat gate decision:** metric case (Pro retention/conversion, engine trust metrics, unit economics headroom) against pre-declared criteria (§17) → build / defer DEC | T02, T08 | 1 |
| P15-T10 | Chat build 1 (only if T09 = build): `assistant` module skeleton, conversations storage + deletion cascade, tool-call orchestration against application services, entitlement + limits enforcement | T09 | 3 |
| P15-T11 | Chat build 2: mobile chat surface (streaming, limits, paywall, states per §5), faithfulness validator + injection/faithfulness eval suite, observability | T10 | 3 |
| P15-T12 | Chat qualification: security (isolation via tools, injection eval), cost-guardrail verification, a11y pass on chat surface, internal→beta flag rollout | T11 | 2 |
| P15-T13 | Phase close: evidence, docs, PROGRESS, next-arc handoff | T04 + (T07, T12 as gated) | 1 |

## 13. Parallelization

- Can run in parallel: **{T01–T02}** (analysis) with **{T05}** and **{T08}** (design tracks — disjoint: docs/contracts vs dashboards); **{T07}** and **{T10–T11}** touch disjoint modules (`context`+mobile-settings vs `assistant`+mobile-chat) and may run in parallel worktrees if both gates pass; T12 sub-checks (security/cost/a11y) parallelize across sessions.
- Must be serial: T01 → T02 → T03 → T04 (each review builds on the last); gate decisions strictly after their inputs (T06 after T03+T05; T09 after T02+T08); contract additions in T05/T08 are single-writer on `packages/contracts`/`shared-kernel` — sequence them (T05's schema lands before T08's or vice versa, never concurrent); T10 → T11 → T12; T13 last.

## 14. Test-first plan (by module and level)

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `context` (calendar) | Occasion-derivation rules; consent-gating of `collect()` | Derivation never emits raw text fields (structural property over arbitrary event inputs) | `calendar.event` fact schema; mock-provider registered via public interface only — **zero `recommendation` diffs** asserted by arch-check | Provider added → engine output unchanged except new facts; MissingFact on no-consent | Maestro: connect calendar → reason chip appears; disconnect → facts gone |
| `assistant` | Limit enforcement (tool-call, token, spend); prompt-version selection; routing table | Any tool-call sequence stays within declared authZ scopes (generated property over tool schemas) | One contract test per tool schema; conversation API vs `packages/contracts` | Tool calls hit real application services (Testcontainers): user isolation suite extended to tool paths; deletion cascade incl. conversations; entitlement 403 for non-Pro | Maestro chat journey incl. limit-hit + paywall; a11y pass |
| Chat evals ([13 §10](../13-testing-quality-and-performance.md) pattern) | — | — | — | Faithfulness eval (claims ↦ tool results/reason codes ≥ 99.5 %); prompt-injection corpus (item names with instructions) → zero out-of-scope tool calls; cost/latency regression gate | — |
| `billing` | Chat spend guardrail arithmetic | — | — | Guardrail breach → alert + degrade | — |
| Analysis artifacts | Review queries checked into repo with expected-schema tests (no hand-copied numbers) | — | — | — | — |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Chat first-token p95 ≤ 3 s, full response p95 ≤ 15 s (incl. tool calls); calendar fact resolution adds ≤ 50 ms to context resolve | OTel spans + dashboards |
| Cost | Chat ≤ $0.05/active-chat-user/mo blended (AIC-O4 model to refine; hypothesis, as-of P15 prices); stays inside Pro plan cap ([10 §6.1](../10-ai-usage-cost-and-evaluation.md)); calendar $0 marginal | `ai.cost_usd{task=chat}` vs provider bills |
| AI quality | Chat faithfulness ≥ 99.5 %; injection-eval pass 100 %; validator-rejection rate tracked (baseline first) | Eval suite reports (`just ml-eval --suite chat`) |
| Reliability | Chat failure degrades to normal UI with zero impact on non-chat journeys (chaos test); tool-limit breaches never partial-charge credits | Integration suite + dashboards |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): `calendar-context` (owner BE; ≤ 90 d post-full-rollout), `stylist-chat` (owner PO; staged internal → Pro beta cohort → all Pro; ≤ 90 d post-rollout), `chat-kill-switch` (permanent operational flag, runbook 10). Entitlement `chat.stylist` gates access; flags gate rollout only ([14 §11](../14-observability-operations-and-analytics.md)).
- Migration/backward-compatibility plan: all schema additive; clients without chat/calendar features are unaffected (additive API); tool contracts versioned in `packages/contracts` from v1 with additive-only policy within the major.
- Rollback plan: (1) `stylist-chat`/`chat-kill-switch` off → conversations retained (user-deletable), surface hidden, zero effect on other journeys; (2) `calendar-context` off → provider unregistered, facts expire naturally, engine unaffected by construction; (3) experiment reverts via flag config; (4) DB rollback contract-phase only. Both features are structurally severable — that is verified, not assumed (chaos test in §14).

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); add phase-local ones there, not here.

- Risks in play: RISK-08 (AI cost — chat is the first open-ended NL spend; hard caps by construction), RISK-07-adjacent calendar privacy exposure (minimization by schema), RISK-16 (capacity — both builds are optional by design); relevant open items: AIC-O4, doc 02 §15 deferred decisions.
- **Gates (pre-declared, decided by data, logged as DEC):**
  - **Chat build gate (T09):** build only if Pro-tier metrics justify it — e.g. Pro retention/conversion and engine-trust signals (reason-tap-through, feedback rates per [09 §13.1](../09-recommendation-engine.md)) at-or-above their review thresholds **and** unit-economics headroom confirmed within Pro plan caps. Otherwise: designs + contracts ratified, build deferred, DEC logged. (Exact thresholds fixed in T08 *before* looking at the readouts — no post-hoc gates.)
  - **Calendar build gate (T06):** build only if occasion/planning-context usage shows demand; else defer with design ratified.
- **Stop/kill criteria for this phase:**
  - Chat faithfulness eval < 99.5 % or any injection-eval failure after one fix iteration → chat stays internal-only/off; log DEC; re-attempt requires new eval evidence.
  - Chat spend breaches the Pro-plan hard cap pattern in beta → `chat-kill-switch` on; redesign limits before resuming.
  - Any calendar implementation path found to require storing raw event content → **stop calendar build** (design violation of REQ-CTX-090); redesign or defer.
  - Guardrail metrics ([00 §8.4](../00-product-vision-and-scope.md)) regress during any P15 experiment → experiment auto-stops; engagement is never bought with trust/privacy/wellbeing (NFR-OBS-100).

## 18. Demo script

Two-part demo (part B only for gates that passed):

**A — Learning (always):**
1. Walk the metric-review artifacts: each [00 §8](../00-product-vision-and-scope.md) table with measured baseline vs target, the decision column filled, DEC entries linked.
2. Show one closed decide-by-data item end-to-end: experiment readout → DEC → shipped config change (e.g. notification default) → post-change metric annotation on the dashboard.
3. Show doc 00/12 updated from "baseline first" to measured values with dates.

**B — Gated builds (as applicable):**
4. Calendar: on device, grant `calendar` consent (screen states exactly what is stored) → create a test event "Dinner — Le Bernardin 7 pm" → request tomorrow's recommendation → reason chip "evening dinner occasion"; inspect the stored fact via the transparency UI: occasion classification + confidence + expiry, **no title text**; run the redaction canary showing raw text never reached server logs. Show `git diff --stat` of the calendar PRs: zero lines changed in `recommendation`.
5. Chat: as a Pro user, ask "what should I wear tomorrow?" → streamed answer citing the engine's reason codes; ask "what black shoes do I own?" → tool call against `closet` returns real items; as user B ask about user A's closet → isolation holds (nothing returned); as a Free user → paywall. Show a conversation's tool-call trace (prompt version, model, tool calls, token counts) in the audit view; hit the tool-call limit deliberately → graceful limit notice; delete the conversation → gone (verified by API); flip `chat-kill-switch` → chat hidden, rest of app untouched.
6. Show the chat cost dashboard against the budget and the faithfulness/injection eval reports.

## 19. Acceptance criteria

Objectively verifiable statements — no "works well".

- AC-1: Every metric in the [00 §8.1–8.4](../00-product-vision-and-scope.md) tables has a recorded measured baseline (or a documented reason it cannot yet be measured), and every "Decision it informs" column has a written decision or explicit deferral, logged as DEC entries in doc 16.
- AC-2: All deferred decide-by-data items enumerated at phase start (from P13/P14 handoffs + doc 02 §15) are closed by DEC or re-scheduled with owner and date; guardrail metrics show no regression attributable to P15 changes (dashboard evidence).
- AC-3: A calendar-class provider (mock in tests; real if built) registers through the public `ContextProvider` interface and produces engine-consumed facts with **zero changes to the `recommendation` module** — proven by arch-check rules plus a diff assertion in CI for the provider PRs.
- AC-4: The ratified `calendar.event` fact schema structurally contains no free-text title/description/attendee/location fields (schema test); if built: the redaction canary and a property test prove raw event text never persists server-side or reaches logs.
- AC-5: Chat gate criteria were written down (T08) before readouts were reviewed; the T09 decision references them; no chat UI/service shipped to users before the gate passed (release history evidence).
- AC-6: If built: the `assistant` module imports only public application services (dependency-cruiser rule green); a design-review checklist confirms zero duplicated business logic and zero direct table access; chat recommendations carry the same engine version + reason codes as the equivalent REST request (comparison test).
- AC-7: Tool-contract schemas exist in `packages/contracts` with a declared authorization scope per tool and a passing contract test per tool; the extended isolation suite proves tool calls cannot cross user boundaries.
- AC-8: Conversation records are user-scoped, audit-logged (metadata), excluded from provider training per the provider register (NFR-AIC-070 terms recorded), deletable individually, and removed by the account-deletion cascade (test evidence) — verified at design level if deferred, at runtime if built.
- AC-9: If built: every chat response records prompt + model versions; per-user tool-call and spend limits demonstrably enforce (limit-hit test + guardrail alert test); faithfulness ≥ 99.5 % and injection eval 100 % on the versioned suites.
- AC-10: If either gate deferred: the deferral DEC includes the ratified design artifacts, the metric thresholds that would flip it, and the re-review date — deferral is a decision, not a drift.

## 20. Definition of done

Exact commands and evidence required:

```bash
just test context            # calendar seam tests (mock provider, zero-engine-change)
just test assistant          # if built; else contract-design tests in packages/contracts
just test billing            # chat guardrail if built
just lint && just typecheck  # clean
just arch-check              # assistant→services-only + calendar seam rules hold
just generate --check        # tool/fact contracts fresh
just ml-eval --suite chat    # if built: faithfulness + injection gates green
just security-scan && just ci-parity   # green
# phase-specific: metric-review artifacts committed; DEC entries linked;
# gated-build evidence per §18B where applicable
```

Evidence to attach/link: metric-review documents with dashboard exports; DEC entries for every decision/gate; calendar minimization test output + zero-engine-diff proof; chat eval reports, cost dashboard, isolation/limit test output (if built); deferral packages (if deferred). Never fabricated — every readout traces to a stored query/dashboard.

## 21. Documentation and PROGRESS.md updates

- Docs to update: [00 §8](../00-product-vision-and-scope.md) baselines; [12 §7.6](../12-pricing-entitlements-and-unit-economics.md) LTV/funnel from cohort data; [10](../10-ai-usage-cost-and-evaluation.md) — AIC-O4 chat cost model + §1/#10 status; [11 §7.6](../11-security-privacy-and-compliance.md) calendar ratification + provider register updates; doc 16 — DEC entries for every gate/decision, new risks for chat/calendar if built; new `docs/modules/assistant.md` and `context` contract updates as applicable; [04 §10](../04-architecture.md) seam table marked exercised.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence; the "Next session starts here" section must define the post-P15 arc (there is no P16 — the next plan comes from T04's backlog re-rank).

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md). Expected content: P15 is the final planned phase — the handoff hands the product to its **operating rhythm**: the re-ranked backlog from P15-T04 (next candidate arcs: chat GA hardening or gate re-review, calendar build/expansion, G3 gate per [00 §9](../00-product-vision-and-scope.md), localization, top experiment follow-ups), the standing cadences (quarterly restore drills, annual pen-test, monthly flag review, metric reviews each cycle), and the exact first command for the next session (`just doctor`, read PROGRESS "Next session starts here"). Any deferred gate lists its re-review date and flip thresholds.
