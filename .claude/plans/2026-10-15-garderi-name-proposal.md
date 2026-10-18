# Proposal: the product name Garderi in the human-only prose

> Status: PROPOSED (2026-10-15). Written by a records pass in the main checkout on `main` @ `09b506e`
> (uncommitted tree), after DEC-85 was added to `planning/16-risks-open-questions-and-decision-log.md`
> (the product name is Garderi; resolves OQ-01). The four files below are human-only
> (`.claude/rules/human-only.md`): root `CLAUDE.md` and `planning/SPINE.md` are path-guarded
> (invariant 1), and `planning/00-product-vision-and-scope.md` and `planning/README.md` are read-only
> context (invariant 2). Nothing here renames code; see "Not in this proposal".

## What changes and why

`rg -n 'AI Stylist|working name|brand name TBD|final brand' CLAUDE.md planning/SPINE.md planning/00-product-vision-and-scope.md planning/README.md`
found five places that state the product name as the working name "AI Stylist" or as "TBD". Each
now names Garderi. Two documents that keep an **Amended:** list gain an entry for the change;
`planning/README.md` gains its entry on the same line as its name statement. Lowercase "AI stylist"
where it describes the product category (`planning/SPINE.md:13`, `planning/00-product-vision-and-scope.md:13`,
`planning/README.md:5`, and the chat feature in `planning/00-product-vision-and-scope.md:55` and `:171`)
stays as it is.

| # | File:line | Current text | Replacement |
|---|---|---|---|
| 1 | `CLAUDE.md:1` | `# CLAUDE.md — AI Stylist Operating Contract` | `# CLAUDE.md — Garderi Operating Contract` |
| 2 | `planning/SPINE.md:3` | **Amended:** list ends `… [proposal](../.claude/plans/2026-10-09-open-questions-decisions-proposal.md))` | append ` · 2026-10-15 (§1 product name — DEC-85, [proposal](../.claude/plans/2026-10-15-garderi-name-proposal.md))` |
| 3 | `planning/SPINE.md:12` | `- **Working name:** "AI Stylist" (final brand name TBD — open question OQ-01).` | ``- **Product name:** Garderi (wordmark: lowercase `garderi`) — DEC-85, which resolves OQ-01. Code, package names and the bundle id keep the former working name (`ai-stylist`, `app.aistylist.mobile`) until the DEC-85 rename pass, due before the first signed build.`` |
| 4 | `planning/00-product-vision-and-scope.md:4` | **Amended:** list ends `… rubric-rated engine metric of doc 09 §13.1).` | insert ` · 2026-10-15 (§1 — product name Garderi, DEC-85)` before the final period |
| 5 | `planning/00-product-vision-and-scope.md:11` | `**Working name:** "AI Stylist" (final brand name TBD — [OQ-01](16-risks-open-questions-and-decision-log.md#open-questions)).` | ``**Product name:** Garderi (wordmark: lowercase `garderi`) — [DEC-85](16-risks-open-questions-and-decision-log.md#decision-log), which resolves [OQ-01](16-risks-open-questions-and-decision-log.md#open-questions). Code, package names and the bundle id keep the former working name (`ai-stylist`) until the DEC-85 rename pass.`` |
| 6 | `planning/README.md:1` | `# AI Stylist — Planning Package` | `# Garderi — Planning Package` |
| 7 | `planning/README.md:3` | `… DEC-49–54) · **Files:** 63 · Product working name TBD (OQ-01 in [doc 16](16-risks-open-questions-and-decision-log.md)).` | `… DEC-49–54) · 2026-10-15 (product name — DEC-85) · **Files:** 63 · Product name: Garderi (DEC-85 in [doc 16](16-risks-open-questions-and-decision-log.md), which resolves OQ-01).` |

The **Files:** count in `planning/README.md` stays 63: this change adds no file under `planning/`.
`planning/claude-contract-historical.md:1` carries the old `CLAUDE.md` title too; it is a superseded
copy kept as history and is left as it is.

## Patch

Seven changed lines in four files. Apply from the repository root with `git apply`. `git apply --check`
passed on 2026-10-15 against `main` @ `09b506e` plus the uncommitted DEC-85 tree. The `SPINE.md` and
`00` header lines are long; the patch carries them whole.

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -1,4 +1,4 @@
-# CLAUDE.md — AI Stylist Operating Contract
+# CLAUDE.md — Garderi Operating Contract
 
 > **Status: LIVE.** This is the binding operating contract; `planning/claude-contract-historical.md` is a superseded planning-era copy kept for reference only.
 
--- a/planning/SPINE.md
+++ b/planning/SPINE.md
@@ -1,6 +1,6 @@
 # SPINE — Canonical Decisions & Conventions
 
-**Status:** Ratified for planning · **Date:** 2026-08-24 · **Amended:** 2026-09-09 (§2 fal.ai prices, §6 weighted credits — [r6](research/r6-pricing-verification-2026-09-09.md), DEC-34/35) · 2026-09-13 (§2 self-hosting baseline: jobs, hosting, database, storage delivery, holidays, AI eval arms; §6 Google Play fee — [r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), [ADR-0003](../docs/adr/0003-self-hosted-infrastructure-baseline.md), DEC-41–48) · 2026-09-22 (§1 team/Mac, §2 mobile framework, 3D renderer, API contract, push, iOS build rows, §5 P01: native iOS/Android replace React Native + Expo — [ADR-0004](../docs/adr/0004-native-ios-and-android-clients.md), DEC-49–54) · 2026-10-09 (§2 3D renderer, API hosting and iOS build rows, §5 P01 row, §6 top-up row — owner decisions DEC-61, DEC-62, DEC-63, DEC-73, DEC-76; [proposal](../.claude/plans/2026-10-09-open-questions-decisions-proposal.md))
+**Status:** Ratified for planning · **Date:** 2026-08-24 · **Amended:** 2026-09-09 (§2 fal.ai prices, §6 weighted credits — [r6](research/r6-pricing-verification-2026-09-09.md), DEC-34/35) · 2026-09-13 (§2 self-hosting baseline: jobs, hosting, database, storage delivery, holidays, AI eval arms; §6 Google Play fee — [r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), [ADR-0003](../docs/adr/0003-self-hosted-infrastructure-baseline.md), DEC-41–48) · 2026-09-22 (§1 team/Mac, §2 mobile framework, 3D renderer, API contract, push, iOS build rows, §5 P01: native iOS/Android replace React Native + Expo — [ADR-0004](../docs/adr/0004-native-ios-and-android-clients.md), DEC-49–54) · 2026-10-09 (§2 3D renderer, API hosting and iOS build rows, §5 P01 row, §6 top-up row — owner decisions DEC-61, DEC-62, DEC-63, DEC-73, DEC-76; [proposal](../.claude/plans/2026-10-09-open-questions-decisions-proposal.md)) · 2026-10-15 (§1 product name — DEC-85, [proposal](../.claude/plans/2026-10-15-garderi-name-proposal.md))
 **Purpose:** Single source of truth for decisions, names, and conventions used across every file in `planning/`. Every planning document MUST conform to this file. If a document conflicts with the SPINE, the document is wrong unless the decision log in `16-risks-open-questions-and-decision-log.md` records a superseding decision.
 
 Research evidence: `research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md` (**third-party services and self-hosting audit, verified 2026-09-13 — supersedes r4 vendor picks for jobs, hosting, database, media transforms, holidays**), `research/r6-pricing-verification-2026-09-09.md` (**verified prices, 2026-09-09 — supersedes r3/r4/r5 price figures**), `research/r1-linux-ios-build.md`, `research/r2-mobile-3d-stack.md`, `research/r3-ai-providers-costs.md`, `research/r4-backend-providers.md`, `research/r5-avatar-garment-3d.md`. All prices/versions cited are **as of Aug 2026** unless noted.
@@ -9,7 +9,7 @@
 
 ## 1. Product
 
-- **Working name:** "AI Stylist" (final brand name TBD — open question OQ-01).
+- **Product name:** Garderi (wordmark: lowercase `garderi`) — DEC-85, which resolves OQ-01. Code, package names and the bundle id keep the former working name (`ai-stylist`, `app.aistylist.mobile`) until the DEC-85 rename pass, due before the first signed build.
 - Premium personalized AI stylist for **iOS + Android**: parametric 3D avatar adjusted from user measurements, digitized virtual closet (clothing, shoes, accessories), explainable outfit recommendations from the user's real wardrobe driven by weather/forecast/holidays/occasion, generative photo try-on, and personalized fashion intelligence. Not a random outfit generator; every suggestion is grounded, traceable, and explainable.
 - **Market:** Global, English-first at launch; USD pricing modeled, store regional tiers. Localization deferred (post-launch).
 - **Team:** 2–3 developers, Linux workstations, heavy AI-coding-agent (Claude Code) usage. **One Mac for iOS development** (since 2026-09-22, DEC-51; it supersedes "no Mac owned"); GitHub Actions macOS runner for iOS CI.
--- a/planning/00-product-vision-and-scope.md
+++ b/planning/00-product-vision-and-scope.md
@@ -1,14 +1,14 @@
 # 00 — Product Vision and Scope
 
 **Status:** Ratified for planning · **Date:** 2026-08-24
-**Amended:** 2026-09-13 ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — pg-boss metrics, try-on eval arm) · 2026-10-12 (§8 — P00-T02 metric-definition audit, AI-35: privacy-class pointer, cost anchor, guardrail labels, audit note; §9.1 — P00-T03 budget-label audit, AI-37: RB-5 size wording aligned with the P01 gate, DEC-76 wait noted) · 2026-10-13 (§8.2 — with the P00 sign-off: the user-judged practical-validity rate is named apart from the rubric-rated engine metric of doc 09 §13.1).
+**Amended:** 2026-09-13 ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — pg-boss metrics, try-on eval arm) · 2026-10-12 (§8 — P00-T02 metric-definition audit, AI-35: privacy-class pointer, cost anchor, guardrail labels, audit note; §9.1 — P00-T03 budget-label audit, AI-37: RB-5 size wording aligned with the P01 gate, DEC-76 wait noted) · 2026-10-13 (§8.2 — with the P00 sign-off: the user-judged practical-validity rate is named apart from the rubric-rated engine metric of doc 09 §13.1) · 2026-10-15 (§1 — product name Garderi, DEC-85).
 **Conforms to:** [SPINE.md](SPINE.md) (canonical decisions). Requirement IDs live in [01-requirements-and-traceability.md](01-requirements-and-traceability.md). Risks, assumptions, and open questions referenced here are tracked in [16-risks-open-questions-and-decision-log.md](16-risks-open-questions-and-decision-log.md).
 
 ---
 
 ## 1. Product summary
 
-**Working name:** "AI Stylist" (final brand name TBD — [OQ-01](16-risks-open-questions-and-decision-log.md#open-questions)).
+**Product name:** Garderi (wordmark: lowercase `garderi`) — [DEC-85](16-risks-open-questions-and-decision-log.md#decision-log), which resolves [OQ-01](16-risks-open-questions-and-decision-log.md#open-questions). Code, package names and the bundle id keep the former working name (`ai-stylist`) until the DEC-85 rename pass.
 
 A premium, personalized AI stylist for iOS and Android. Users create a parametric 3D avatar adjusted from their real measurements (capability **A1**), digitize their actual wardrobe — clothing, shoes, and accessories — and receive **explainable outfit recommendations built only from items they own**, driven by weather, forecast, holidays, occasion, and learned preferences. Premium tiers add generative photo try-on (**G2**) and personalized fashion intelligence.
 
--- a/planning/README.md
+++ b/planning/README.md
@@ -1,6 +1,6 @@
-# AI Stylist — Planning Package
+# Garderi — Planning Package
 
-**Status:** Planning complete, audited, ready for implementation · **Date:** 2026-08-24 · **Amended:** 2026-09-22 (native iOS/Android clients replace React Native + Expo — [ADR-0004](../docs/adr/0004-native-ios-and-android-clients.md), DEC-49–54) · **Files:** 63 · Product working name TBD (OQ-01 in [doc 16](16-risks-open-questions-and-decision-log.md)).
+**Status:** Planning complete, audited, ready for implementation · **Date:** 2026-08-24 · **Amended:** 2026-09-22 (native iOS/Android clients replace React Native + Expo — [ADR-0004](../docs/adr/0004-native-ios-and-android-clients.md), DEC-49–54) · 2026-10-15 (product name — DEC-85) · **Files:** 63 · Product name: Garderi (DEC-85 in [doc 16](16-risks-open-questions-and-decision-log.md), which resolves OQ-01).
 
 A premium, personalized AI stylist for iOS + Android: a parametric 3D avatar adjusted from the user's real measurements, a digitized virtual closet (clothing, shoes, accessories), explainable outfit recommendations from the clothes the user actually owns — driven by weather, forecast, holidays, and occasion — generative photo try-on, and personalized fashion intelligence. Built by a 2–3 dev team on Linux (plus one Mac for iOS) with heavy AI-coding-agent use, as native Swift/SwiftUI and Kotlin/Compose apps on one backend. Every suggestion is grounded, traceable, and explainable; nothing is random.
 
```

## Proof after applying

`just docs-check --strict` (DC-14 compares the root `CLAUDE.md` layout block with the tree; the title
line is outside that block) and
`rg -n 'AI Stylist|working name|brand name TBD|final brand' CLAUDE.md planning/SPINE.md planning/00-product-vision-and-scope.md planning/README.md`,
which then prints nothing.

## Not in this proposal: the rename pass (DEC-85)

DEC-85 keeps every identifier as it is until a rename pass that must land before the first signed
build. None of these is in the patch above, and none should be changed under this proposal:

- code identifiers and package names: the root package `ai-stylist`, the `@ai-stylist/*` workspace
  packages, the Python packages `ai_stylist_*`, the Swift modules `AIStylistAPI` and `AIStylistKernel`,
  the compose project `ai-stylist`;
- the repository name and the host names under `ai-stylist.app`;
- the bundle id and applicationId `app.aistylist.mobile`, which becomes `app.garderi.mobile`
  (DEC-85; OQ-18 keeps the signing and upload lanes open);
- the "AI Stylist" prose outside these four files: on 2026-10-15 `rg -l 'AI Stylist'` lists 71 files
  (code, configs, generated clients, READMEs, `docs/`, `.claude/agents/`, `templates/linear/`, the
  `planning/04-architecture.md:19` diagram label and the dated research files r2, r3 and r4).
