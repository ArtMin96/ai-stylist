# P00 — Product Validation and Decisions

> File name: `phases/P00-product-validation-and-decisions.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); "None" is written explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P00 — Product Validation and Decisions
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
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
  - **Qualified legal counsel engagement** — LR-02, LR-03, LR-04, LR-07, LR-09 in [11 §12](../11-security-privacy-and-compliance.md) are due by P03; counsel must be engaged in P00 or P03 slips. This is the only item that can block P00 exit (see §17 stop criteria).
  - **Product-owner availability** for ratification sign-offs (DEC entries, OQ-03 age policy) — decisions in §2 cannot be self-ratified by an agent ([15 §12.6](../15-team-workflow-and-ai-agent-operations.md)).
  - No vendor accounts required in P00 (first accounts are P01/P02 work).

## 4. In scope / out of scope

**In scope:**
- ADR ratification: one ADR file per SPINE §2 decision (DEC-01…DEC-33 in [doc 16](../16-risks-open-questions-and-decision-log.md)), from [templates/adr.md](../templates/adr.md), cross-linked to the decision-log rows.
- Measurable definitions: every metric in [doc 00 §8](../00-product-vision-and-scope.md) and every budget row in [13 §12](../13-testing-quality-and-performance.md) checked for the five NFR-OBS-100 attributes and "hypothesis/measured/baseline-first" labeling.
- Legal/privacy discovery kickoff: LR-01…LR-12 register items each assigned an owner and due phase; counsel engaged; processing-activity register (Art. 30 skeleton, [11 §9](../11-security-privacy-and-compliance.md)) started; DPIA scoping note for face/measurement processing (LR-06 pre-work).
- Decisions closed or formally scheduled: **OQ-03** (age policy — P00-due) decided as a product position pending counsel confirmation (LR-09); **OQ-07** (data residency) discovery output handed to P02 infra.
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
| Infrastructure | None (OQ-07 residency discovery memo feeds P02 region choices for Neon/R2/Railway) |
| 3D / assets | None (Anny license attribution requirement noted for P01/P04 asset work, per [15 §9](../15-team-workflow-and-ai-agent-operations.md) SBOM/license rules) |
| Admin / internal tools | None |
| **Documents (the actual surface of P00)** | ADR set in `planning/adr/` (moves to `docs/adr/` in P02); legal-review register updates in doc 11 §12; processing-activity register skeleton; metric/budget label audit edits in docs 00/13/14; decision-log updates in doc 16 |

## 9. AI vs deterministic decisions

No AI runs in P00. The phase's job is ratifying the rules that govern all later AI use.

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| P00 deliverables themselves | Deterministic (human/agent document work) | Ratification and legal discovery are judgment work, not model calls | n/a | $0 provider spend |
| AI/non-AI decision table (all product features) | Ratified in [10 §1](../10-ai-usage-cost-and-evaluation.md) | NFR-AIC-010: every AI use classified, deterministic-first justified | Per-feature fallbacks in doc 10 §2 | Anchors: $0.02–0.15/user/mo steady, $0.10–0.30 onboarding spike (as of Aug 2026, r3) — hypotheses |
| AI data policy | Ratified (DEC-29) | NFR-AIC-070: no training on customer data, zero/short retention, privacy-reviewed providers for face/body media | Provider removal via ports (NFR-AIC-090) | n/a |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11](../11-security-privacy-and-compliance.md)): none collected. The **classification scheme itself (S0–S3, 11 §6)** is ratified here (NFR-PRV-010).
- Consent required / consent UI changes: none shipped; the consent-purpose registry design ([11 §7.2](../11-security-privacy-and-compliance.md)) is ratified as P03's build spec.
- Retention, deletion, and export impact: retention table, deletion-cascade design ([11 §13](../11-security-privacy-and-compliance.md), [06 §8](../06-data-api-and-event-contracts.md)), and export scope ratified; backup-caveat disclosure wording flagged into LR-02.
- Threat/abuse cases added to the threat model: baseline threat model + abuse cases ([11 §2–§3](../11-security-privacy-and-compliance.md)) ratified as the living document every later phase must extend (NFR-SEC-010). Legal-review register LR-01…LR-12 all opened with owner + due phase; **OQ-03 decided:** proposed 16+ floor per [11 §10](../11-security-privacy-and-compliance.md), pending LR-09 counsel confirmation.

## 11. Observability and analytics added in this phase

- Logs/metrics/traces for what this phase introduces: none to operate (no running system). NFR-OBS-090's per-phase rule is satisfied vacuously and *enforced structurally from here on* — this template section plus the DoD hook it ratifies.
- Product analytics events (taxonomy per [14](../14-observability-operations-and-analytics.md)): none emitted. The event taxonomy ([14 §9](../14-observability-operations-and-analytics.md)) and metric tree ([00 §8](../00-product-vision-and-scope.md), NFR-OBS-100) are ratified with all five attributes per metric (owner, source, privacy class, target-or-baseline, decision informed) and guardrail metrics identified.
- Alerts/dashboards/runbook entries: none live; alert-budget policy and severity ladder ([14 §7](../14-observability-operations-and-analytics.md)) ratified.

## 12. Ordered tasks

Small enough for one AI-assisted session each (~half-day). Task IDs `P00-T##` are referenced by handoff entries. P00 is document work: "owner" sign-offs marked **[PO]** need the product owner and cannot be closed by an agent alone.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P00-T01 | Create `planning/adr/` and write ADR-0001…ADR-0033 from [templates/adr.md](../templates/adr.md), one per DEC-01…DEC-33 row in [doc 16](../16-risks-open-questions-and-decision-log.md), each linking its evidence file (r1–r5) and SPINE row; add back-links from the decision-log table. **[PO]** ratifies. | — | 2 |
| P00-T02 | Metric-definition audit: walk [00 §8](../00-product-vision-and-scope.md) + [14 §9](../14-observability-operations-and-analytics.md) metric tree; verify every metric carries owner/source/privacy-class/target-or-baseline/decision; fix gaps in the owning docs; confirm guardrail metrics ([00 §8.4](../00-product-vision-and-scope.md)) have hard targets. | — | 1 |
| P00-T03 | Budget-label audit: walk [13 §12](../13-testing-quality-and-performance.md) and [07 §10.1](../07-3d-avatar-and-garment-pipeline.md); verify every number is labeled hypothesis with its measuring phase; verify the P01 gate table ([05 §2.3](../05-technology-decisions.md)) is internally consistent with 13 §12.1 and [doc 00 §9.1 RB-5](../00-product-vision-and-scope.md). | — | 1 |
| P00-T04 | Legal/privacy discovery kickoff: engage counsel; for LR-01…LR-12 record owner, due phase, and briefing note per item; start the Art. 30 processing-activity register ([11 §9](../11-security-privacy-and-compliance.md)); write the DPIA scoping note (LR-06 pre-work). **[PO]** engages counsel. | — | 2 |
| P00-T05 | Age-policy decision (OQ-03): ratify the 16+ launch proposal ([11 §10](../11-security-privacy-and-compliance.md)) as a DEC entry marked "pending LR-09 counsel confirmation"; record signup-enforcement + store-rating implications for P03/P14. **[PO]** decides. | P00-T04 | 1 |
| P00-T06 | Data-residency discovery (OQ-07): memo on EU-hosting requirements vs Neon/R2/Railway/PostHog region options (as-of dated); hand recommendation to P02 as an input to infra setup; log DEC or keep OQ-07 open with a P02 due date. | P00-T04 | 1 |
| P00-T07 | Ratify security/privacy/ethics baselines: threat model + abuse cases (11 §2–§3), data classification (11 §6), product-ethics rules (11 §17), logging redaction rules (11 §8) — each gets a ratification line (date + **[PO]**) in its doc header. | — | 1 |
| P00-T08 | Ratify AI governance: decision table (10 §1), per-feature specs' deterministic-first justifications (10 §2), provider data policy + provider register (10 §3), research-bet register RB-1…RB-5 with all ten fields (00 §9.1 / 16 prototype needs). | — | 1 |
| P00-T09 | Re-run the brief-coverage audit: verify [01 §4](../01-requirements-and-traceability.md) maps every brief section and [01 §5](../01-requirements-and-traceability.md) every named specific; fix any gap by adding requirement IDs in doc 01 (steps-of-10 insertion rule), never by hand-waving. | — | 1 |
| P00-T10 | Phase close-out: DEC entries for everything decided; update doc 16 (OQ table, risks unchanged or amended); write the P00 evidence index (§20); update [PROGRESS.md](../PROGRESS.md) + handoff (§22). | P00-T01…T09 | 1 |

## 13. Parallelization

- Can run in parallel: **Group A** {P00-T01}, **Group B** {P00-T02, P00-T03} (docs 00/13/14/07 label edits — disjoint from ADR files), **Group C** {P00-T04}, **Group D** {P00-T07, P00-T08} (docs 11/10/16 ratification lines — disjoint from A/B), **Group E** {P00-T09} (doc 01 only). Files touched are disjoint per group; one agent per group per [15 §12.3](../15-team-workflow-and-ai-agent-operations.md).
- Must be serial: P00-T05 and P00-T06 after P00-T04 (need counsel framing); P00-T10 last (single-writer on doc 16 and PROGRESS.md — doc 16 is also touched by T01/T05/T06, so T01→T05/T06→T10 sequence their doc 16 edits; T01 writes only back-link column entries, T05/T06 append OQ/DEC rows, T10 reconciles).

## 14. Test-first plan (by module and level)

No code, so no automated tests execute. The "tests" of P00 are document-verification checks, run and pasted as evidence:

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| *(documents)* | Per-artifact checklist: every DEC row ↔ ADR file 1:1 (scripted grep count); every LR item has owner+due; every metric has 5 attributes | None | Cross-doc consistency: P01 gate numbers identical in 05 §2.3 / 13 §12.1 / 00 §9.1; module names in all P00-touched docs match SPINE §3 exactly | None | None |

New bug fixes require a regression test that fails before the fix — no code in P00; documentation contradictions found later are fixed via decision-log entries, not silent edits ([SPINE](../SPINE.md) header rule).

## 15. Budgets introduced or measured

P00 *introduces* (labels and ratifies) budgets; it measures nothing (no system exists — measuring starts at P01). All values are hypotheses per [13 §12](../13-testing-quality-and-performance.md).

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Full table ratified in [13 §12](../13-testing-quality-and-performance.md) incl. P01 gate thresholds (60 fps iPhone 13-class / 50 fps Galaxy A52-class, <50 ms touch, <100 MB package, <300 MB memory) | P01 gate (3D), P02+ per phase, ratified P14 |
| Cost | Infra ~$60–70/mo launch (~$370–450 at 5k MAU); AI $0.01–0.15/user/mo steady excl. credits, $0.10–0.30 onboarding spike; try-on ≈ $0.0825/image = 3 credits; iOS CI $10–30/mo (verified 2026-09-09, [r6](../research/r6-pricing-verification-2026-09-09.md)) | Provider billing + `usage_meters` from P06; checked P13 (RISK-08) |
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
  - Counsel cannot be engaged within 2 calendar weeks of P00 start → mark P00 `BLOCKED` in PROGRESS.md naming LR-02/LR-09, escalate to **[PO]**; do not "resolve" legal items in-house to unblock.
  - Coverage audit (P00-T09) finds an unmapped brief requirement that changes scope materially → stop, add the requirement IDs to doc 01, and re-check affected phase files before P00 exit.
  - P00 itself is never killed — it has no falsifiable technical bet; it can only complete or block.

## 18. Demo script

No device demo exists; the P00 demo is an evidence walkthrough with the product owner:

1. Open `planning/adr/` — show 33 ADR files; pick DEC-11 (OpenAPI over tRPC) and walk decision → evidence → SPINE row → decision-log back-link.
2. Open [doc 16](../16-risks-open-questions-and-decision-log.md) — show OQ-03 closed (or formally scheduled with counsel), OQ-07 memo linked; new DEC entries dated.
3. Open [11 §12](../11-security-privacy-and-compliance.md) — show LR-01…LR-12 each with owner + due phase; show counsel engagement evidence and the Art. 30 register skeleton.
4. Open [00 §8](../00-product-vision-and-scope.md) — pick two metrics (one guardrail, one activation) and show all five NFR-OBS-100 attributes.
5. Open [13 §12](../13-testing-quality-and-performance.md) — show every row labeled hypothesis with a measuring phase; show the P01 gate numbers match [05 §2.3](../05-technology-decisions.md).
6. Show [PROGRESS.md](../PROGRESS.md): P00 `DONE`, handoff entry, "next session" pointing at P01/P02.

## 19. Acceptance criteria

Objectively verifiable statements — no "works well". Verification commands run from `planning/`:

- AC-1: `ls adr/ | wc -l` returns ≥ 33 and a scripted check maps each `DEC-NN` in doc 16's decision log to exactly one ADR file and back (`grep -o 'DEC-[0-9]\+' adr/*.md | sort -u` covers DEC-01…DEC-33); each ADR names its evidence source and carries a ratification date + decider.
- AC-2: every metric row in [00 §8.1–8.4](../00-product-vision-and-scope.md) has non-empty Owner, Source, Privacy, Target/baseline, and Decision columns (scripted table walk finds zero empty cells), and every guardrail row in §8.4 has a hard target or "baseline first" label.
- AC-3: [11 §12](../11-security-privacy-and-compliance.md) shows LR-01…LR-12 each with an owner and due phase; LR-02/03/04/07/09 show counsel engaged (engagement evidence linked); OQ-03 has a DEC entry (16+ pending LR-09) and OQ-07 has a memo linked from doc 16.
- AC-4: docs 11 (threat model §2–3, classification §6, redaction §8, ethics §17) and doc 03 invariants carry a "Ratified <date> by <name>" header line; `grep -L "Ratified" 11-security-privacy-and-compliance.md` returns empty.
- AC-5: doc 10 §1 table has a classification + why-not-deterministic entry for every AI-touching feature (zero rows marked TBD); provider register (10 §3) carries as-of-dated training/retention terms; research-bet register shows RB-1…RB-5 with all ten fields each.
- AC-6: brief-coverage audit re-run recorded: [01 §4](../01-requirements-and-traceability.md) has zero unmapped brief sections and §5 zero unmapped named specifics, with a dated audit note; any IDs added follow the steps-of-10 rule.
- AC-7: [PROGRESS.md](../PROGRESS.md) shows P00 `DONE` with a handoff entry linking every artifact above; no status vocabulary violations.

## 20. Definition of done

Exact commands and evidence required. The standard `just` gates do not exist until P02; for P00 the DoD is document evidence (this exception is phase-specific and ends here — P01+ carry runnable gates):

```bash
# from planning/ — repo-level just recipes do not exist yet (first exist in P02)
ls adr/ | wc -l                                   # ≥ 33
grep -c '^| LR-' 11-security-privacy-and-compliance.md   # = 12, all with owner + due
grep -n 'OQ-03\|OQ-07' 16-risks-open-questions-and-decision-log.md  # closed or scheduled w/ DEC refs
git log --oneline -- planning/                     # ratification commits, PO sign-off noted
```

Evidence to attach/link: ADR directory listing; counsel engagement evidence (redacted as needed); the OQ-07 residency memo; dated ratification headers; the coverage-audit note in doc 01 — never fabricated sign-offs.

## 21. Documentation and PROGRESS.md updates

- Docs to update: `planning/adr/*` (new), doc 16 (DEC/OQ tables), doc 11 (§12 register, ratification headers, Art. 30 skeleton), docs 00/13/14/07/10 (label/attribute fixes + ratification lines), doc 01 (audit note, any inserted IDs).
- [PROGRESS.md](../PROGRESS.md): set P00 `IN_PROGRESS` at start, `DONE` only with §20 evidence linked; `ACCEPTED` requires a different session or the product owner verifying §18.

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md).

Next session starts: **P01-T01** (prototype workspace bring-up) and/or **P02-T01** (monorepo scaffold) — P01 and P02 may run in parallel per [SPINE §5](../SPINE.md) (P02 depends on P00 only; P01 depends on P00). First command for either: read `PROGRESS.md`, then the target phase file end-to-end, then confirm the P00 ADR set is `ACCEPTED` (a phase may only depend on `ACCEPTED` phases). If counsel items LR-02/09 are still open, that does **not** block P01/P02 — it blocks P03 exit; carry the tracking line forward in PROGRESS.md notes.
