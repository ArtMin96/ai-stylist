# PROGRESS — Durable Status Ledger

**Purpose:** The single source of truth for project status across work sessions. Every session (human or AI agent) reads this file first and updates it before ending. Phase definitions: [SPINE §5](SPINE.md) and `phases/`. Templates: [templates/session-handoff.md](templates/session-handoff.md).

---

## Status vocabulary (exact — no other values allowed)

| Status | Definition |
|---|---|
| `NOT_STARTED` | No work begun beyond planning. No code, no branches. |
| `IN_PROGRESS` | Work begun. The phase file's task list reflects per-task state; a session-handoff entry exists for the latest session. |
| `BLOCKED` | Cannot proceed. The blocker (dependency, decision, external event) MUST be named in the Notes column with a link to the owning item (RISK-NN / OQ-NN / phase ID). |
| `DONE` | All phase acceptance criteria met with evidence; Definition of Done commands pass; docs and this ledger updated. Self-assessed by the implementing session. |
| `ACCEPTED` | A *different* session or the product owner has verified the phase's demo script and evidence after `DONE`. Only `ACCEPTED` phases may be depended on by later phases. |

Rules:
- Status may only move forward (`NOT_STARTED → IN_PROGRESS → DONE → ACCEPTED`), except any status may move to `BLOCKED` and back to `IN_PROGRESS`, and `ACCEPTED` may regress to `IN_PROGRESS` only with a decision-log entry (DEC-NN) explaining why.
- Never mark `DONE` because code exists. `DONE` requires tests, evidence, documentation, and the working vertical demo defined in the phase file (brief §10).
- A phase with unmet hard dependencies (SPINE §5 table) cannot leave `NOT_STARTED`.

## Phase status

| Phase | Name | Status | Notes |
|---|---|---|---|
| — | Planning package | `ACCEPTED` | This `planning/` directory; ratified 2026-08-24; **prices re-verified and pricing model re-baselined 2026-09-09** (r6, DEC-34/35) |
| P00 | Product validation and decisions | `NOT_STARTED` | |
| P01 | 3D and capture prototype gate | `NOT_STARTED` | Go/no-go gate — see RISK-01 |
| P02 | Repo foundations and CI | `NOT_STARTED` | |
| P03 | Identity, consent, onboarding | `NOT_STARTED` | |
| P04 | Parametric avatar v1 | `NOT_STARTED` | |
| P05 | Selfie face personalization | `NOT_STARTED` | |
| P06 | Closet capture pipeline | `NOT_STARTED` | |
| P07 | Closet organization and sync | `NOT_STARTED` | |
| P08 | Context providers | `NOT_STARTED` | |
| P09 | Recommendation engine v1 | `NOT_STARTED` | |
| P10 | Outfit on avatar | `NOT_STARTED` | |
| P11 | Generative try-on and views | `NOT_STARTED` | Eval + cost gate — see RISK-02 |
| P12 | Fashion intelligence | `NOT_STARTED` | Sourcing spike first — see RISK-03 |
| P13 | Monetization and entitlements | `NOT_STARTED` | Store-compliance review — see RISK-04 |
| P14 | Hardening and launch | `NOT_STARTED` | |
| P15 | Post-launch learning | `NOT_STARTED` | |

## ➡️ Next session starts here

**Start P00 — Product validation and decisions.**

1. Read, in order: [SPINE.md](SPINE.md) → [00-product-vision-and-scope.md](00-product-vision-and-scope.md) → `phases/P00-product-validation-and-decisions.md` → [16-risks-open-questions-and-decision-log.md](16-risks-open-questions-and-decision-log.md).
2. Set P00 to `IN_PROGRESS` in the table above.
3. Work the P00 task list top-down; P00 has no code deliverables — its outputs are ratified ADRs, measurable definitions, legal/privacy discovery notes, and resolution or scheduling of OQ-03 (age policy) and OQ-07 (data residency).
4. Before ending the session, follow the session-handoff rules below.

## Session-handoff rules

Every work session MUST, before ending:

1. **Update the phase table** above (status + notes, including any new blocker with its RISK/OQ link).
2. **Append a handoff entry** to the log below using [templates/session-handoff.md](templates/session-handoff.md) — newest entry first. Keep entries short; link to phase files and PRs instead of restating them.
3. **Update the "Next session starts here" section** so it points to the exact next action (phase, task ID, and any command to run first). It must never be stale.
4. **Record new decisions/risks/questions** in [16-risks-open-questions-and-decision-log.md](16-risks-open-questions-and-decision-log.md) — never only in this file or in chat.
5. **Leave the repository buildable**, or state precisely what is broken, the failing command, and the observed error in the handoff entry.

Log hygiene: when this log exceeds ~30 entries, move the oldest entries to `planning/handoff-archive.md` (create it on first archive); never delete them.

## Session handoff log

*(newest first)*

### 2026-09-09 — Planning amendment: price verification & weighted credits (no code)

- **What:** Four research agents verified live prices for every paid service in the plan (fal.ai model pages, Gemini/Anthropic/OpenAI/Voyage/Cohere, Neon/Trigger.dev/Cloudflare/Railway/PostHog/RevenueCat/Expo/GitHub, Apple/Google fees, competitor App Store listings). Findings in [research/r6-pricing-verification-2026-09-09.md](research/r6-pricing-verification-2026-09-09.md).
- **Key finding:** purpose-built virtual try-on on fal.ai costs **$0.07–0.075/image** (FASHN, Kling), ~8× the Aug-2026 assumption; under the flat 200-credit Pro grant that was break-even monthly and −$6/mo on annual. Per-item processing (≈ $0.0021) and explanation costs verified as planned. Infra envelope is ≈ 2× r4's estimate ($60–70 launch, $370–450 at 5k MAU). Open-Meteo commercial is $29/mo, not $500.
- **Decisions logged:** DEC-34 (weighted credits: try-on 3 / missing view 1; grants 0/10/60/150, trial 15; top-up packs 30 for $4.99 and 100 for $12.99 as P13 stretch), DEC-35 (Essentials gains missing views; Voyage embeddings; Gemini 3.5 Flash default; price corrections). New OQ-11 (FLUX 2 try-on LoRA cost arm at P11), OQ-12 (Free cap 40 vs 100, weekly SKU), ASM-08/09, AIC-O5–O7, BIL-O7/O8.
- **Docs touched:** SPINE §2/§6, 00, 05 (§5–§9), 07 §4, 10 (§2–§3, §5, §6.1, §7), 12 (§1–§7, §8), 16, phases P00/P06/P11/P13, README; correction banners on r3/r4/r5.
- **Next:** unchanged — start P00. When P11 and P13 kick off, re-verify r6 prices first (AIC-O6).
