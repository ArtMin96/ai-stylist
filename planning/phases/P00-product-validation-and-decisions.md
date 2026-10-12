# P00 — Product Validation and Decisions

> Amended 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — service consolidation: pg-boss jobs, owned server + Coolify, self-managed PostgreSQL, R2 delivery model).

> Amended 2026-10-09 (owner decisions: DEC-60 age policy, DEC-61 EU home region, DEC-62 hosting, DEC-68 one ratification ADR instead of 33 — [proposal](../../.claude/plans/2026-10-09-open-questions-decisions-proposal.md)).

> Amended 2026-10-12 (owner decision DEC-79: counsel engagement and the legal items LR-01…LR-12 wait for the first minimal release. T04, the counsel confirmation in T05 and the memo of T06 leave P00; the two-week counsel stop criterion in §17 no longer applies; P00 may reach `DONE` without them. The legal items gate that release, not the end of P03. Marked in place in §3, §4, §12, §17, §19, §20 and §22; §13 and §18 still describe the earlier plan).

> Amended 2026-10-12 (P00-T02 and P00-T03 audits, AI-35 and AI-37: the §15 infra figure and the §9 AI cost anchor now match SPINE §6; the 3D gate in §15 is marked as waiting on DEC-76).

> Amended 2026-10-13 (P00 sign-off by the product owner: ADR-0010 is `Accepted` and covers DEC-01…DEC-82; docs 11, 10 and 03 carry their ratification lines. §12 records the task states, §19 AC-2 gains the budget-label check, §20 holds the evidence index. The phase is `DONE` on 2026-10-13, self-assessed, and `ACCEPTED` only when the owner says so; the deferred tasks are in §12 and the accepted gap in §20).

> File name: `phases/P00-product-validation-and-decisions.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); "None" is written explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P00 — Product Validation and Decisions
- **Status:** `DONE` on 2026-10-13, self-assessed; `ACCEPTED` only when the owner says so. §12 lists what DEC-79 deferred, and §20 (AC-5) names the one accepted gap *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Convert the ratified planning package into executable ground truth — measurable metric definitions, a kicked-off legal/privacy discovery track, and formally ratified ADRs for every SPINE decision — so no later phase starts on an unratified assumption or an unmeasurable "success".
- **User-visible outcome:** None directly (no code ships). Indirectly: every later user-facing promise (trial mechanics, privacy posture, age policy, performance targets) now has a written, owned, testable definition.
- **Why now:** P00 has no dependencies and everything depends on it. P01's go/no-go gate needs ratified pass criteria; P02's repo needs the ADR log and templates it will enforce; P03's consent flows are blocked by legal-review items (LR-02/03/04/07/09) that need weeks of counsel lead time — the clock must start immediately.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only. P00 is the *primary* delivery phase for each ID below (first listed phase in doc 01); the later phases listed there consume or re-verify these artifacts.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| NFR-SEC-010 | Threat model + abuse cases documented and maintained from P00 | AC-4 |
| NFR-PRV-010 | Sensitive-data classification table exists and is ratified | AC-4 |
| NFR-PRV-060 | GDPR/CCPA/store-disclosure legal-review register live, owned, not presented as legal advice | AC-3 |
| NFR-PRV-070 | Age policy explicit (minimum age decided, enforcement planned) — never implicit | AC-3 |
| NFR-PRV-090 | No body shaming / attractiveness scoring / health diagnosis — recorded as binding non-goals | AC-4 |
| NFR-PERF-010 | Measurable budgets defined as labeled hypotheses (never "fast") | AC-2 |
| NFR-OBS-100 | Product-metric tree with owners, sources, privacy classes, targets/baselines, decisions informed | AC-2 |
| NFR-TEAM-110 | ADR template + decision log seeded with every SPINE decision | AC-1 |
| NFR-AIC-010 | Complete AI/non-AI decision table with per-feature classification ratified | AC-5 |
| NFR-AIC-070 | AI data policy (no training, zero/short retention, privacy-reviewed providers for face/body media) ratified | AC-5 |
| NFR-AIC-100 | Research-bet register (all five named bets, all ten fields) ratified | AC-5 |

Contributing (primary delivery elsewhere): the brief-coverage audit re-run of [doc 01 §4–§5](../01-requirements-and-traceability.md) (owned by doc 01, executed here per its §4); OQ-07 data-residency input to P02 infra.

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): none — P00 is the root phase ([SPINE §5](../SPINE.md)).
- External blockers:
  - **Qualified legal counsel engagement** — LR-02, LR-03, LR-04, LR-07, LR-09 in [11 §12](../11-security-privacy-and-compliance.md) are due by P03; counsel must be engaged in P00 or P03 slips. This is the only item that can block P00 exit (see §17 stop criteria). *(Amended 2026-10-12 by DEC-79: counsel is engaged for the first minimal release, these items gate that release, and counsel no longer blocks P00 exit.)*
  - **Product-owner availability** for ratification sign-offs (DEC entries, OQ-03 age policy) — decisions in §2 cannot be self-ratified by an agent ([15 §12.6](../15-team-workflow-and-ai-agent-operations.md)).
  - No vendor accounts required in P00 (first accounts are P01/P02 work).

## 4. In scope / out of scope

**In scope:**
- ADR ratification: one ratification ADR ([ADR-0010](../../docs/adr/0010-decision-log-ratification.md), DEC-68) in which the product owner ratifies the decision log in [doc 16](../16-risks-open-questions-and-decision-log.md) as it stands. Doc 16 stays the per-decision record. *(Was: one ADR file per DEC-01…DEC-33.)*
- Measurable definitions: every metric in [doc 00 §8](../00-product-vision-and-scope.md) and every budget row in [13 §12](../13-testing-quality-and-performance.md) checked for the five NFR-OBS-100 attributes and "hypothesis/measured/baseline-first" labeling.
- Legal/privacy discovery kickoff: LR-01…LR-12 register items each assigned an owner and due phase; counsel engaged; processing-activity register (Art. 30 skeleton, [11 §9](../11-security-privacy-and-compliance.md)) started; DPIA scoping note for face/measurement processing (LR-06 pre-work). *(Moved out of P00 to the first minimal release by DEC-79, 2026-10-12; the register in doc 11 §12 already lists an owner and a due phase for each item.)*
- Decisions closed or formally scheduled: **OQ-03** (age policy — P00-due) decided as a product position pending counsel confirmation (LR-09); **OQ-07** (data residency) discovery output handed to P02 infra. Decided 2026-10-09: DEC-60 (16+), DEC-61 (one EU home region) and DEC-62 (Hetzner, one server; resolves OQ-14).
- Ratification of the threat model ([11 §2–§3](../11-security-privacy-and-compliance.md)), data classification ([11 §6](../11-security-privacy-and-compliance.md)), product-ethics rules ([11 §17](../11-security-privacy-and-compliance.md)), AI decision table + provider data policy ([doc 10 §1, §3](../10-ai-usage-cost-and-evaluation.md)), and research-bet register ([doc 00 §9.1](../00-product-vision-and-scope.md), [doc 16](../16-risks-open-questions-and-decision-log.md)).
- Re-run of the brief-coverage audit (doc 01 §4/§5 instrument) and fixing any gap found.

**Out of scope / non-goals for this phase:**
- Any code, repo scaffolding, CI, or vendor account setup → P02 (prototype tooling → P01).
- Resolving OQs not due at P00 (OQ-01 brand → P13; OQ-04 iOS lane → P02 ADR; OQ-05 content sourcing → P12; OQ-08 device floor → P01/P14; OQ-10 pose set → P04).
- Market/pricing validation — all prices stay labeled hypotheses ([SPINE §6](../SPINE.md)); P13 owns testing them.
- Producing legal conclusions — P00 produces *questions with owners*, never counsel-free answers (doc 11 header rule).

## 5. Product/UX behavior

Cover every state: **empty · loading · partial · failure · retry · recovery · offline · accessibility**.

P00 ships no user-facing software; there are no runtime states. The UX deliverable of P00 is *upstream* of doc 02: confirming that [02-user-journeys-and-information-architecture.md](../02-user-journeys-and-information-architecture.md) §1.1 state-coverage rule (empty/loading/partial/failure/retry/recovery/offline) and §13 accessibility requirements are complete enough for P03+ to implement against — REQ-ONB-130's state-inventory prerequisite.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| *(none shipped in P00)* | n/a | n/a | n/a | n/a | Audit confirms doc 02 §13 covers every planned surface; gaps logged as doc 02 edits, not deferred |

## 6. Domain and architecture changes (by owning module)

No module code exists yet. P00 ratifies the module map itself and the documents each module will be built against. Module contract *files* are created in P02; P00 changes are to planning documents only.

| Module | Change | Contract update needed? |
|---|---|---|
| *(all — documentation only)* | SPINE §3 module map, [04-architecture.md](../04-architecture.md) dependency rules, and [03-domain-model-and-glossary.md](../03-domain-model-and-glossary.md) invariants ratified via ADRs (DEC-33 et al.) | No (contract files first exist in P02) |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`): None (package exists from P02; [doc 06](../06-data-api-and-event-contracts.md) sketches are ratified as the P02 starting point).
- Event schemas added/changed: None (envelope + catalog in [06 §4](../06-data-api-and-event-contracts.md) ratified as design).
- DB migrations (Drizzle): None.
- Generated clients to regenerate: None.

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | None |
| Backend | None |
| Workers (ML/media) | None |
| Data / migrations | None |
| Infrastructure | None (OQ-07 residency discovery memo feeds P02 region choices for the server provider, R2 and PostHog; ties to OQ-14 server provider + topology; decided 2026-10-09 by DEC-61 and DEC-62) |
| 3D / assets | None (Anny license attribution requirement noted for P01/P04 asset work, per [15 §9](../15-team-workflow-and-ai-agent-operations.md) SBOM/license rules) |
| Admin / internal tools | None |
| **Documents (the actual surface of P00)** | ADR-0010 in `docs/adr/` (DEC-68); legal-review register updates in doc 11 §12; processing-activity register skeleton; metric/budget label audit edits in docs 00/13/14; decision-log updates in doc 16 |

## 9. AI vs deterministic decisions

No AI runs in P00. The phase's job is ratifying the rules that govern all later AI use.

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| P00 deliverables themselves | Deterministic (human/agent document work) | Ratification and legal discovery are judgment work, not model calls | n/a | $0 provider spend |
| AI/non-AI decision table (all product features) | Ratified in [10 §1](../10-ai-usage-cost-and-evaluation.md) | NFR-AIC-010: every AI use classified, deterministic-first justified | Per-feature fallbacks in doc 10 §2 | Anchors: $0.01–0.06/user/mo steady (light–medium), $0.10–0.15 heavy, excluding credits; $0.10–0.30 onboarding spike (SPINE §6; r6, verified 2026-09-09) — hypotheses |
| AI data policy | Ratified (DEC-29) | NFR-AIC-070: no training on customer data, zero/short retention, privacy-reviewed providers for face/body media | Provider removal via ports (NFR-AIC-090) | n/a |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11](../11-security-privacy-and-compliance.md)): none collected. The **classification scheme itself (S0–S3, 11 §6)** is ratified here (NFR-PRV-010).
- Consent required / consent UI changes: none shipped; the consent-purpose registry design ([11 §7.2](../11-security-privacy-and-compliance.md)) is ratified as P03's build spec.
- Retention, deletion, and export impact: retention table, deletion-cascade design ([11 §13](../11-security-privacy-and-compliance.md), [06 §8](../06-data-api-and-event-contracts.md)), and export scope ratified; backup-caveat disclosure wording flagged into LR-02.
- Threat/abuse cases added to the threat model: baseline threat model + abuse cases ([11 §2–§3](../11-security-privacy-and-compliance.md)) ratified as the living document every later phase must extend (NFR-SEC-010). Legal-review register LR-01…LR-12 all opened with owner + due phase; **OQ-03 decided:** 16+ floor per [11 §10](../11-security-privacy-and-compliance.md), pending LR-09 counsel confirmation (DEC-60, 2026-10-09).

## 11. Observability and analytics added in this phase

- Logs/metrics/traces for what this phase introduces: none to operate (no running system). NFR-OBS-090's per-phase rule is satisfied vacuously and *enforced structurally from here on* — this template section plus the DoD hook it ratifies.
- Product analytics events (taxonomy per [14](../14-observability-operations-and-analytics.md)): none emitted. The event taxonomy ([14 §9](../14-observability-operations-and-analytics.md)) and metric tree ([00 §8](../00-product-vision-and-scope.md), NFR-OBS-100) are ratified with all five attributes per metric (owner, source, privacy class, target-or-baseline, decision informed) and guardrail metrics identified.
- Alerts/dashboards/runbook entries: none live; alert-budget policy and severity ladder ([14 §7](../14-observability-operations-and-analytics.md)) ratified.

## 12. Ordered tasks

Small enough for one AI-assisted session each (~half-day). Task IDs `P00-T##` are referenced by handoff entries. P00 is document work: "owner" sign-offs marked **[PO]** need the product owner and cannot be closed by an agent alone.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P00-T01 | Write [ADR-0010](../../docs/adr/0010-decision-log-ratification.md) from `templates/adr.md` (DEC-68; drafted 2026-10-09). Check that every DEC row in [doc 16](../16-risks-open-questions-and-decision-log.md) is either standing or names the DEC that supersedes or amends it. **[PO]** ratifies by filling in the ratification line. *(Was: 33 ADR files in `planning/adr/`.)* | — | 1 |
| P00-T02 | Metric-definition audit: walk [00 §8](../00-product-vision-and-scope.md) + [14 §9](../14-observability-operations-and-analytics.md) metric tree; verify every metric carries owner/source/privacy-class/target-or-baseline/decision; fix gaps in the owning docs; confirm guardrail metrics ([00 §8.4](../00-product-vision-and-scope.md)) have hard targets. | — | 1 |
| P00-T03 | Budget-label audit: walk [13 §12](../13-testing-quality-and-performance.md) and [07 §10.1](../07-3d-avatar-and-garment-pipeline.md); verify every number is labeled hypothesis with its measuring phase; verify the P01 gate table ([05 §2.3](../05-technology-decisions.md)) is internally consistent with 13 §12.1 and [doc 00 §9.1 RB-5](../00-product-vision-and-scope.md). | — | 1 |
| P00-T04 | Legal/privacy discovery kickoff: engage counsel; for LR-01…LR-12 record owner, due phase, and briefing note per item; start the Art. 30 processing-activity register ([11 §9](../11-security-privacy-and-compliance.md)); write the DPIA scoping note (LR-06 pre-work). **[PO]** engages counsel. On 2026-10-09 the owner confirmed that no counsel is engaged yet and that he will engage one. **Moved out of P00 by DEC-79 (2026-10-12):** counsel engagement, the briefing notes, the Art. 30 register and the DPIA scoping note wait for the first minimal release. | — | 2 |
| P00-T05 | Age-policy decision (OQ-03): ratify the 16+ launch proposal ([11 §10](../11-security-privacy-and-compliance.md)) as a DEC entry marked "pending LR-09 counsel confirmation"; record signup-enforcement + store-rating implications for P03/P14. **[PO]** decides. **Decided 2026-10-09: DEC-60.** The implications are recorded (2026-10-13, AI-39): signup enforcement in [P03](P03-identity-consent-onboarding.md) §4, §5 and T03, and the store age rating in [P14](P14-hardening-and-launch.md) T14. Only the LR-09 counsel confirmation remains open; it waits for the first minimal release (DEC-79, 2026-10-12). | ~~P00-T04~~ — (DEC-79) | 1 |
| P00-T06 | Data-residency discovery (OQ-07): memo on EU-hosting requirements vs server-provider (OQ-14: Hetzner vs alternative, single-host vs DB-separate topology), R2 and PostHog region options (as-of dated); hand recommendation to P02 as an input to infra setup; log DEC or keep OQ-07 open with a P02 due date. **Decided 2026-10-09: DEC-61 (region) and DEC-62 (provider, topology).** The memo still records the as-of-dated region options and the counsel framing. **Moved out of P00 by DEC-79 (2026-10-12):** the memo is written with counsel, for the first minimal release; DEC-61 and DEC-62 stand as product positions until then. | P00-T04 | 1 |
| P00-T07 | Ratify security/privacy/ethics baselines: threat model + abuse cases (11 §2–§3), data classification (11 §6), product-ethics rules (11 §17), logging redaction rules (11 §8) — each gets a ratification line (date + **[PO]**) in its doc header. | — | 1 |
| P00-T08 | Ratify AI governance: decision table (10 §1), per-feature specs' deterministic-first justifications (10 §2), provider data policy + provider register (10 §3), research-bet register RB-1…RB-5 with all ten fields (00 §9.1 / 16 prototype needs). | — | 1 |
| P00-T09 | Re-run the brief-coverage audit: verify [01 §4](../01-requirements-and-traceability.md) maps every brief section and [01 §5](../01-requirements-and-traceability.md) every named specific; fix any gap by adding requirement IDs in doc 01 (steps-of-10 insertion rule), never by hand-waving. | — | 1 |
| P00-T10 | Phase close-out: DEC entries for everything decided; update doc 16 (OQ table, risks unchanged or amended); write the P00 evidence index (§20); update [PROGRESS.md](../PROGRESS.md) + handoff (§22). The close-out lists what DEC-79 (2026-10-12) moved to the first minimal release (T04, the LR-09 confirmation of T05, the memo of T06) as carried forward, not as done. | P00-T01…T09, except T04 and T06 (DEC-79) | 1 |

**Task states on 2026-10-13.** The table has no state column; the state of each task lives in its Linear ticket. Complete: T01 (AI-34), T02 (AI-35), T03 (AI-37), T07 (AI-43), T08 (AI-44), T09 (AI-45), the document part of T05 (AI-39) and T10 (AI-46), which closed with the ledger row, the handoff entry of 2026-10-13 and the evidence index in §20. Deferred to the first minimal release by DEC-79, not done: T04 (AI-38), the LR-09 counsel confirmation of T05, and T06 (AI-40). With that the phase is `DONE` on 2026-10-13, self-assessed; it becomes `ACCEPTED` only when the owner says so.

## 13. Parallelization

- Can run in parallel: **Group A** {P00-T01}, **Group B** {P00-T02, P00-T03} (docs 00/13/14/07 label edits — disjoint from ADR files), **Group C** {P00-T04}, **Group D** {P00-T07, P00-T08} (docs 11/10/16 ratification lines — disjoint from A/B), **Group E** {P00-T09} (doc 01 only). Files touched are disjoint per group; one agent per group per [15 §12.3](../15-team-workflow-and-ai-agent-operations.md).
- Must be serial: P00-T05 and P00-T06 after P00-T04 (need counsel framing); P00-T10 last (single-writer on doc 16 and PROGRESS.md — doc 16 is also touched by T01/T05/T06, so T01→T05/T06→T10 sequence their doc 16 edits; T01 checks the supersession chain, T05/T06 append OQ/DEC rows, T10 reconciles).

## 14. Test-first plan (by module and level)

No code, so no automated tests execute. The "tests" of P00 are document-verification checks, run and pasted as evidence:

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| *(documents)* | Per-artifact checklist: ADR-0010 exists with a ratification date and decider, and every DEC row is standing or names its successor; every LR item has owner+due; every metric has 5 attributes | None | Cross-doc consistency: P01 gate numbers identical in 05 §2.3 / 13 §12.1 / 00 §9.1; module names in all P00-touched docs match SPINE §3 exactly | None | None |

New bug fixes require a regression test that fails before the fix — no code in P00; documentation contradictions found later are fixed via decision-log entries, not silent edits ([SPINE](../SPINE.md) header rule).

## 15. Budgets introduced or measured

P00 *introduces* (labels and ratifies) budgets; it measures nothing (no system exists — measuring starts at P01). All values are hypotheses per [13 §12](../13-testing-quality-and-performance.md).

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Full table ratified in [13 §12](../13-testing-quality-and-performance.md) incl. P01 gate thresholds (60 fps iPhone 13-class / 50 fps Galaxy A52-class, <50 ms touch, <100 MB package, <300 MB memory) | P01 gate (3D; waits on DEC-76), P02+ per phase, ratified P14 |
| Cost | Infra ≈ $25–45/mo launch (ADR-0003; ≈ $370–450 at 5k MAU as an upper-bound hypothesis); AI $0.01–0.15/user/mo steady excl. credits, $0.10–0.30 onboarding spike; try-on ≈ $0.0825/image = 3 credits; iOS CI $10–30/mo (verified 2026-09-09, [r6](../research/r6-pricing-verification-2026-09-09.md)) | Provider billing + `usage_meters` from P06; checked P13 (RISK-08) |
| AI quality | Eval-gate structure ratified ([13 §10](../13-testing-quality-and-performance.md), doc 10); numeric thresholds set in owning phases (P06/P09/P11) | `just ml-eval` from P06 |
| Reliability | API ≥ 99.5% monthly, error budget 3.6 h/mo; crash-free ≥ 99.5% (hypotheses) | Dashboards from P02; ratified P14 |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): None (no runtime).
- Migration/backward-compatibility plan: None (documents only; doc versions tracked in git).
- Rollback plan: revert the planning-doc commits; any ratified-then-reversed decision requires a superseding DEC entry per [doc 16](../16-risks-open-questions-and-decision-log.md) rules — never a silent revert.

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); phase-local ones are added there, not here.

- Risks in play: **RISK-07** (face/biometric compliance — P00 is its discovery step), **RISK-16** (team capacity/planning-discipline decay — P00 sets the ledger discipline), **RISK-04** (store trial compliance — LR framing starts here). Assumptions: **ASM-06** (cadence), **ASM-10** (consent UX acceptance — framed by the discovery work).
- **Stop/kill criteria for this phase:**
  - ~~Counsel cannot be engaged within 2 calendar weeks of P00 start → mark P00 `BLOCKED` in PROGRESS.md naming LR-02/LR-09, escalate to **[PO]**~~ **No longer applies (DEC-79, 2026-10-12):** counsel engagement waits for the first minimal release, so a missing counsel does not block P00. What stays: do not "resolve" legal items in-house.
  - Coverage audit (P00-T09) finds an unmapped brief requirement that changes scope materially → stop, add the requirement IDs to doc 01, and re-check affected phase files before P00 exit.
  - P00 itself is never killed — it has no falsifiable technical bet; it can only complete or block.

## 18. Demo script

No device demo exists; the P00 demo is an evidence walkthrough with the product owner:

1. Open `docs/adr/0010-decision-log-ratification.md` — show the ratification line; pick DEC-11 (OpenAPI over tRPC) in doc 16 and walk decision → evidence → SPINE row.
2. Open [doc 16](../16-risks-open-questions-and-decision-log.md) — show OQ-03 closed (or formally scheduled with counsel), OQ-07 memo linked; new DEC entries dated.
3. Open [11 §12](../11-security-privacy-and-compliance.md) — show LR-01…LR-12 each with owner + due phase; show counsel engagement evidence and the Art. 30 register skeleton.
4. Open [00 §8](../00-product-vision-and-scope.md) — pick two metrics (one guardrail, one activation) and show all five NFR-OBS-100 attributes.
5. Open [13 §12](../13-testing-quality-and-performance.md) — show every row labeled hypothesis with a measuring phase; show the P01 gate numbers match [05 §2.3](../05-technology-decisions.md).
6. Show [PROGRESS.md](../PROGRESS.md): P00 `DONE`, handoff entry, "next session" pointing at P01/P02.

## 19. Acceptance criteria

Objectively verifiable statements — no "works well". Verification commands run from `planning/`:

- AC-1: `docs/adr/0010-decision-log-ratification.md` is `Accepted` and carries a ratification date and decider. A scripted check finds every `DEC-NN` row in doc 16 either standing or naming the DEC that supersedes or amends it. No `planning/adr/` directory exists. *(Amended 2026-10-09 by DEC-68; was ≥ 33 ADR files.)*
- AC-2: every metric row in [00 §8.1–8.4](../00-product-vision-and-scope.md) has non-empty Owner, Source, Privacy, Target/baseline, and Decision columns (scripted table walk finds zero empty cells), and every guardrail row in §8.4 has a hard target or "baseline first" label. Every row of [13 §12.1–12.2](../13-testing-quality-and-performance.md) carries the word "hypothesis" and a measuring phase in its Status cell (a scripted table walk finds zero rows without both), and the P01 gate numbers are identical in [05 §2.3](../05-technology-decisions.md), 13 §12.1 and [00 §9.1](../00-product-vision-and-scope.md) RB-5 (NFR-PERF-010; added 2026-10-13 from the P00-T03 audit).
- AC-3: [11 §12](../11-security-privacy-and-compliance.md) shows LR-01…LR-12 each with an owner and due phase; LR-02/03/04/07/09 show counsel engaged (engagement evidence linked); OQ-03 has a DEC entry (16+ pending LR-09) and OQ-07 has a memo linked from doc 16. *(Amended 2026-10-12 by DEC-79: the counsel-engagement evidence and the OQ-07 memo moved out of P00 to the first minimal release; in P00 this criterion checks the owner and due phase of each LR item and the DEC entries for OQ-03 and OQ-07.)*
- AC-4: docs 11 (threat model §2–3, classification §6, redaction §8, ethics §17) and doc 03 invariants carry a "Ratified <date> by <name>" header line; `grep -L "Ratified" 11-security-privacy-and-compliance.md` returns empty.
- AC-5: doc 10 §1 table has a classification + why-not-deterministic entry for every AI-touching feature (zero rows marked TBD); provider register (10 §3) carries as-of-dated training/retention terms; research-bet register shows RB-1…RB-5 with all ten fields each.
- AC-6: brief-coverage audit re-run recorded: [01 §4](../01-requirements-and-traceability.md) has zero unmapped brief sections and §5 zero unmapped named specifics, with a dated audit note; any IDs added follow the steps-of-10 rule.
- AC-7: [PROGRESS.md](../PROGRESS.md) shows P00 `DONE` with a handoff entry linking every artifact above; no status vocabulary violations.

## 20. Definition of done

Exact commands and evidence required. The standard `just` gates do not exist until P02; for P00 the DoD is document evidence (this exception is phase-specific and ends here — P01+ carry runnable gates):

```bash
# from planning/ — repo-level just recipes do not exist yet (first exist in P02)
grep -c 'Ratified 20' ../docs/adr/0010-decision-log-ratification.md   # ≥ 1: the PO's ratification line (DEC-68)
grep -c '^| LR-' 11-security-privacy-and-compliance.md   # = 12, all with owner + due
grep -n 'OQ-03\|OQ-07' 16-risks-open-questions-and-decision-log.md  # closed or scheduled w/ DEC refs
git log --oneline -- planning/                     # ratification commits, PO sign-off noted
```

Evidence to attach/link: ADR-0010 with the ratification line; counsel engagement evidence (redacted as needed); the OQ-07 residency memo; dated ratification headers; the coverage-audit note in doc 01 — never fabricated sign-offs. *(Amended 2026-10-12 by DEC-79: the counsel engagement evidence and the OQ-07 residency memo are evidence for the first minimal release, not for P00.)*

### Evidence index (written 2026-10-13 for P00-T10)

How the sign-off was recorded: the product owner gave it in the working session of 2026-10-13 ("Sign all four"; name on record: Arthur Minasyan), and the four ratification lines were entered at his instruction. The commit that carries them is the lasting evidence; this index points at it and does not replace it.

| Criterion | State on 2026-10-13 | Where the evidence is |
|---|---|---|
| AC-1 | Met | [ADR-0010](../../docs/adr/0010-decision-log-ratification.md): status `Accepted`, with the line "Ratified 2026-10-13 by Arthur Minasyan, covering DEC-01 … DEC-82". The scripted pointer check of the P00-T01 report (AI-34), last run on 2026-10-13: 82 decision rows, 40 forward and 40 back pointers, 0 findings. No `planning/adr/` directory exists |
| AC-2 | Met | The audit notes in [00 §8](../00-product-vision-and-scope.md) (P00-T02) and [13 §12](../13-testing-quality-and-performance.md) (P00-T03). Table walks re-run on 2026-10-13: 26 metric rows with 0 empty cells; 8 of 8 guardrail rows labelled; 24 budget rows, 0 without "hypothesis" and 0 without a phase. The P01 gate numbers are compared in the 13 §12 note |
| AC-3 | Met as amended by DEC-79 | [11 §12](../11-security-privacy-and-compliance.md): 12 `LR-` rows, each with an owner and a due phase or release. In [doc 16](../16-risks-open-questions-and-decision-log.md), OQ-03 is resolved by DEC-60 and OQ-07 by DEC-61. Counsel engagement and the OQ-07 memo are evidence for the first minimal release |
| AC-4 | Met | The header line "Ratified 2026-10-13 by Arthur Minasyan" in [doc 11](../11-security-privacy-and-compliance.md) (§2–§3, §6, §8, §17) and in [doc 03](../03-domain-model-and-glossary.md) (invariants, §2.1). `grep -L "Ratified" 11-security-privacy-and-compliance.md` returns nothing |
| AC-5 | Two of three clauses met | [10 §1](../10-ai-usage-cost-and-evaluation.md): 20 rows, no empty cell and no "TBD". [00 §9.1](../00-product-vision-and-scope.md): RB-1…RB-5 with ten fields each. The doc 10 header carries the ratification line. Not met: 10 §3 dates its prices (verified 2026-09-09) but not the providers' training and retention terms. The owner signed with this gap listed; no row tracks it yet |
| AC-6 | Met | The note "Audit re-run 2026-10-12" in [01 §4](../01-requirements-and-traceability.md): 217 ids, each defined once; §4 has 42 rows and §5 has 39; REQ-EXP-085 and NFR-TEAM-135 sit at unused numbers |
| AC-7 | Met | [PROGRESS.md](../PROGRESS.md): P00 is `DONE` on 2026-10-13, self-assessed, and the handoff entry of that date links the artifacts above. `ACCEPTED` only when the owner says so |

The commands above, run on 2026-10-13: the `Ratified 20` count in ADR-0010 is 1; the `LR-` row count is 12; OQ-03 and OQ-07 name DEC-60 and DEC-61. `git log` shows no ratification commit yet: the change was not committed when this index was written.

Carried forward, not done: the three items that DEC-79 deferred, listed in §12. Left open at the sign-off, each with a row in doc 16: OQ-38 (3D budget numbers, deferral confirmed), OQ-39 (infrastructure-as-code and preview deployments), OQ-40 (who measures what P02 and the staging server were to measure), OQ-41 (a note on DEC-32) and the host-name note in OQ-17.

## 21. Documentation and PROGRESS.md updates

- Docs to update: `docs/adr/0010-*` (new, DEC-68), doc 16 (DEC/OQ tables), doc 11 (§12 register, ratification headers, Art. 30 skeleton), docs 00/13/14/07/10 (label/attribute fixes + ratification lines), doc 01 (audit note, any inserted IDs).
- [PROGRESS.md](../PROGRESS.md): set P00 `IN_PROGRESS` at start, `DONE` only with §20 evidence linked; `ACCEPTED` requires a different session or the product owner verifying §18.

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md).

Next session starts: **P01-T01** (prototype workspace bring-up) and/or **P02-T01** (monorepo scaffold) — P01 and P02 may run in parallel per [SPINE §5](../SPINE.md) (P02 depends on P00 only; P01 depends on P00). First command for either: read `PROGRESS.md`, then the target phase file end-to-end, then confirm P00 is `ACCEPTED` (a phase may only depend on `ACCEPTED` phases). If counsel items LR-02/09 are still open, that does **not** block P01/P02 — ~~it blocks P03 exit~~ it blocks the first minimal release (DEC-79, 2026-10-12; was: P03 exit); carry the tracking line forward in PROGRESS.md notes.
