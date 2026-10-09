# Proposal: open-question sweep and owner decisions (2026-10-09)

> Status: APPLIED (2026-10-09, at the owner's word "apply everything"), with the exceptions and
> changes listed here. The text below is the original proposal.
>
> **Not applied:**
> - §F rows that need investigation or belong to P00's own tasks: the "Draft for …" doc headers and
>   the provider-register dates (P00-T07, P00-T08); the dangling references in docs 11, 12 (one
>   fixed: §5.8 → §5.6), 13, 14 and 15; the fps mismatch between doc 07 and doc 05; the r7 banner;
>   the stale lines inside ADR-0004, ADR-0006 and ADR-0007; the banners of five older plan files;
>   the missing DEC row for the owner's 2026-09-25 setup decisions.
> - §K (code work) is not started.
>
> **Path-guarded files:** `planning/SPINE.md` (lines 28, 40, 53, 94, 122) and `planning/15-*.md`
> (§1.2 pins, §3, §9, §10) were written with a shell command on 2026-10-09 at the owner's explicit
> request ("I want you to write in files you mentioned you couldn't"), because the path guard has
> no per-edit approval.
>
> **Applied differently from the text below:**
> - P11: only the try-on figure (≤ $0.01 → ≤ $0.0825) and the ASM-03 wording changed. The $0.025
>   missing-view ceiling in §9 and AC-2 was kept; the banner flags it against §15's $0.012.
> - Doc 08 §2 (taxonomy registry home) was not rewritten. The conflict with doc 06 §1 is filed as
>   **OQ-37**, so the register now runs to OQ-37.
> - P13's "8 SKUs" is consistent (6 subscription + 2 top-up); only the missing OQ-12 task is noted.
> - P01 keeps `prototype/p01-filament/` as the planned spike location.
> - DEC-76 gained one sentence: the owner does not require Filament and named three.js as a
>   candidate, so the renderer is reviewed in the same research.
> - The four stale keys in `secrets/dev.enc.yaml` were checked by key name and are gone.
> - §A rows went into doc 16 as written; §B2 rows went in without line numbers.
>
> Structure copied from `2026-10-04-human-applied-followups-proposal.md`.

## 0. Source, checks and apply order

- **Source.** Five read-only sweeps on branch `D90-dev/p00-open-questions-readiness` at `a5da55e`: docs 00–08 + SPINE,
  docs 09–15 + r5/r7, phases P01–P07, phases P08–P15, and plans + ADRs + ledger + setup docs. The lead
  read `planning/phases/P00-product-validation-and-decisions.md` and doc 16 in full.
- **Spot-checked against the files:** P01:10/37/127/128, P03:48–52/57/97/161/209, P04:13/37,
  P10:11/12/60, P12:35/176, P13:42/50, doc 02:439/457/538, doc 03:115/328–343, doc 05:326,
  doc 09:400, doc 10:328, doc 11:76/198–200/211–214/233, doc 12:37/171, SPINE:122,
  `docs/SERVICES-SETUP.md`:200/323/372/379/423/470/538, `docs/NEW-REPO-SETUP.md`:891–896, the
  2026-10-04 repo-split proposal lines 10–45, and `planning/PROGRESS.md`:135/280/285–286. Every other
  line number below comes from a sweep and was not re-opened. **Re-read each passage before editing;
  line numbers shift as edits land.**
- **Owner's standing rule (round 4):** "make sure to not [leave] stale data behind and make sure all
  plans and phases know each other using references." So each decision lands with its doc 16 row,
  the fix for every passage that contradicts it, and links both ways.
- **Apply order:** A (DEC rows) → B (OQ table) → C (ADR files + index) → D (phase files) → E (planning
  docs) → F (older stale text) → the `planning/SPINE.md` and `planning/15-*.md` lines last (path
  guard; the owner applies them or approves the prompt). Then `just docs-check --strict`.
- **Not recorded here on purpose:** the owner has a working product name and asked that it stay out
  of the repository for now.

## A. Doc 16 — decision-log rows to append after DEC-59

Also extend the `**Amended:**` list in the doc 16 header (line 3) with: "2026-10-09 (DEC-60–77 and
OQ-20–36 added; OQ-03, OQ-07, OQ-09, OQ-14 and OQ-19 resolved; OQ-01, OQ-08, OQ-10 and OQ-18 updated;
DEC-58 amended — owner decisions,
`.claude/plans/2026-10-09-open-questions-decisions-proposal.md`)".

| ID | Decision | Rationale (one line) | Evidence |
|---|---|---|---|
| DEC-60 | **(2026-10-09) Age policy: 16+ at launch for the whole app.** Counsel confirms it under LR-09, including whether `face_processing` needs 18+ in any jurisdiction. Enforcement: self-declared birth year at signup and store age ratings; 13 with parental consent is not planned. Resolves OQ-03 | Product-owner decision. Doc 11 §10 already proposed 16+, and brief §3.6 forbids an implicit age policy. A product position, not a legal conclusion | [11 §10](11-security-privacy-and-compliance.md); P00-T05 |
| DEC-61 | **(2026-10-09) Data residency: one EU home region, built to expand.** Server, database, backups, object storage (R2 buckets with EU jurisdiction), product analytics (PostHog EU Cloud) and observability (Grafana Cloud EU) sit in the EU. Every account carries a `home_region` from the first user table (P03). Region, storage jurisdiction and analytics host come from config, never from code. A second region is added only on measured latency need or a legal requirement, by a new DEC. Counsel supplies the launch-country exclusion list (LR-03). AI providers stay under DEC-29. The vendor accounts that exist on 2026-10-09 are test accounts and will be replaced, so the PostHog US project named in DEC-58 is not the production project. Resolves OQ-07 as a product position pending LR-03; amends DEC-58 | The launch is global (DEC-02) and the app holds body measurements, photos and face-derived data. An EU home needs no outbound transfer for EU users; a US home does. Two regions would double the database operations that RISK-17 rates M/H. Slower replies for distant users are accepted and measured at P14 (estimate 0.1–0.3 s per request, not measured) | Owner decision 2026-10-09; P00-T06; [11 §9](11-security-privacy-and-compliance.md) |
| DEC-62 | **(2026-10-09) Hosting provider and topology: Hetzner, EU data center, one server at launch.** API, jobs, workers and PostgreSQL share the host (DEC-42, DEC-43). The database moves to its own host when the P03 p95 gate fails or P14 hardening calls for it. Resolves OQ-14 | Hetzner was the working assumption of DEC-42 and r7. One host is the cheapest envelope that still proves backup and restore (RISK-17). Prices and data-center list not re-checked on 2026-10-09 | Owner decision 2026-10-09; [ADR-0003](../docs/adr/0003-self-hosted-infrastructure-baseline.md); [05](05-technology-decisions.md) |
| DEC-63 | **(2026-10-09) P02 re-scope: staging now, stores later.** P02-T07 (staging PostgreSQL host, backups, restore proof) and P02-T13 (R2 buckets, live suite) proceed now; a test account is acceptable because the scripts carry over to the real account. P02-T14 (signed iOS archive, TestFlight upload, Play keystore job) and P02-T15 (lane cost and flake data) leave P02 and move to the first phase that ships a build to testers, no later than P13 store setup. P02-T17 (3D asset scaffolding) leaves P02 and joins the 3D track (DEC-76); this records the owner's 2026-10-05 skip. Store enrollment type (individual or organization) and the permanent bundle id are deferred by the owner; OQ-18 stays open and must close before the first signed build. P02 may reach `DONE` without T14, T15 and T17. An exception to the phase's task list, recorded here as DEC-36 was | The owner is in development-only mode and enrolls with the stores later. Signing cannot be proven without store accounts, while backups, restore and real uploads can be proven now and protect every later phase | Owner decision 2026-10-09; [P02 §12](phases/P02-repo-foundations-and-ci.md); `docs/SERVICES-SETUP.md` §8–§9 |
| DEC-64 | **(2026-10-09) Sign-in at launch: Sign in with Apple, Google Sign-In and passkeys; no email+password.** Store reviewers get a demo account. Resolves DO-SEC-01 | Doc 11 preferred launching without passwords: no password storage, no reset flow, fewer takeover paths | [11](11-security-privacy-and-compliance.md) (DO-SEC-01); [P03 §3](phases/P03-identity-consent-onboarding.md) |
| DEC-65 | **(2026-10-09) Account-deletion grace window: 7 days.** Sessions are revoked and login is blocked at once; the user can cancel during the window; the purge cascade runs after it | Doc 11 §13 already wrote 7 days while docs 02 and 03 listed the duration as open. The window guards against takeover-driven deletion | [11 §13](11-security-privacy-and-compliance.md); [02 §11.3](02-user-journeys-and-information-architecture.md) |
| DEC-66 | **(2026-10-09) Crash diagnostics share the `analytics` consent purpose in v1; no separate diagnostics purpose.** Nothing, crash capture included, starts before `analytics` opt-in. Counsel confirms the withdrawal semantics for reports already stored on the device under LR-07. Resolves OQ-19 as a product position | It is what P02-T09 built and the most conservative default. A separate purpose needs a contract change and work in both apps for no stated requirement | Owner decision 2026-10-09; [11 §7.2](11-security-privacy-and-compliance.md); `docs/observability/posthog.md` |
| DEC-67 | **(2026-10-09) No cross-module foreign keys.** A table never declares `REFERENCES` to another module's table; `user_id` is a typed `Id<'user'>` column without a foreign key. Each module deletes its own rows through the deletion event chain of doc 06 §8. A test asserts that every module holding user rows registers a deletion step, and a migration lint rejects a cross-module `REFERENCES`. Foreign keys inside one module stay allowed. Amends doc 06 §8 step 1 | Keeps module boundaries real at the data layer and keeps a later split possible; deletion is already event-driven for R2, providers and jobs | [ADR-0009](../docs/adr/0009-no-cross-module-foreign-keys.md); `.claude/plans/2026-10-04-repo-split-readiness-proposal.md` §B |
| DEC-68 | **(2026-10-09) P00 ratifies the decision log with one ADR, not 33.** ADR-0010 records the product owner's ratification of the decision log as it stands. Doc 16 stays the only per-decision record, and no `planning/adr/` directory is created. Amends P00 §4, §8, §12 (T01), §14, §18, §19 (AC-1), §20 and §21 | `docs/adr/0001`–`0007` already exist and 8 of DEC-01…33 are superseded. Thirty-three ADR files would copy every decision into a second place that goes stale when a decision changes | [ADR-0010](../docs/adr/0010-decision-log-ratification.md); [P00](phases/P00-product-validation-and-decisions.md) |
| DEC-69 | **(2026-10-09) Closet counting and the Free cap.** A pair (shoes, earrings) is one item. A suit is two linked items; each piece can be used alone, and the suit counts as two toward `closet.max_items`. Archived items count toward the cap. After a downgrade, items above the cap stay visible and exportable but read-only for new recommendation composition; the most recently worn items up to the cap stay active | Outfit slots need the suit pieces separately, and a pair is never worn singly. Counting archived items keeps the cap easy to explain and bounds Free-tier processing cost (RISK-08). Nothing is deleted on downgrade (SPINE §6) | [03 §6](03-domain-model-and-glossary.md) items 4–6; [02 §12.2](02-user-journeys-and-information-architecture.md); [12](12-pricing-entitlements-and-unit-economics.md) |
| DEC-70 | **(2026-10-09) "Worn" is user-marked only in v1; laundry is prompt-only.** The app never infers wear from a scheduled day. Marking an outfit worn prompts a laundry move per category and never moves items by itself | Keeps wear statistics trustworthy; matches the working assumptions in docs 03 and 08 | [03 §6](03-domain-model-and-glossary.md) items 1–2; [08](08-closet-taxonomy-and-organization.md) |
| DEC-71 | **(2026-10-09) Default occasion: a stored "typical day"**, set during onboarding and editable later, used whenever the user selects no occasion | Suggestions work with zero taps; doc 02 already uses it in the Today flow | [03 §6](03-domain-model-and-glossary.md) item 3; [02](02-user-journeys-and-information-architecture.md) |
| DEC-72 | **(2026-10-09) Notification categories start off; each needs an explicit opt-in** | Confirms REQ-NOT-020 (nothing is sent without opt-in) and closes the open item in doc 02 §15 | [01](01-requirements-and-traceability.md) REQ-NOT-020; [02 §15](02-user-journeys-and-information-architecture.md) |
| DEC-73 | **(2026-10-09) Monthly generative credits do not roll over; purchased top-up credits never expire.** A plan change mid-cycle follows doc 12. Amends the SPINE §6 top-up row ("no expiry (or 90-day — decide at P13)") | Credits a user paid for stay until used; expiry on paid packs invites complaints and store-review questions. Closes the rollover and expiry parts of BIL-O4 | [SPINE §6](SPINE.md); [12 §8](12-pricing-entitlements-and-unit-economics.md) BIL-O4; [03 §6](03-domain-model-and-glossary.md) item 7 |
| DEC-74 | **(2026-10-09) Family sharing and shared closets are not in v1.** One user per account. Resolves OQ-09; closes BIL-O5 | Single-user is assumed in every doc, and P13 AC-6 needs the decision recorded | [12 §8](12-pricing-entitlements-and-unit-economics.md); [03 §6](03-domain-model-and-glossary.md) item 9; [P13](phases/P13-monetization-and-entitlements.md) |
| DEC-75 | **(2026-10-09) Device floor confirmed: iOS 26.0 and Android 10 (minSdk 29).** P14 re-checks it with measurements on the device matrix. Updates OQ-08; confirms the DEC-54 working values | The product must not be limited to new phones; the owner accepts these floors as the product floor | Owner decision 2026-10-09; DEC-54; [13](13-testing-quality-and-performance.md) |
| DEC-76 | **(2026-10-09) 3D track: garment 3D research reopens RB-2, and its go/no-go is the "3D resumes" trigger.** Scope: a garment photo becomes a 3D garment shown on the avatar. The body stays the measurement-based A1 avatar, and A3 stays a non-goal. Hard constraints from the owner: the result works on every supported phone with the same quality on all of them, so a server path is mandatory, and on-device AI is allowed only as a cost or latency optimization whose output matches the server path. The research compares image-to-3D services, self-hosted open models, on-device options, and on-device versus server rendering. The renderer is part of it: the owner does not require Filament and names three.js as a candidate (2026-10-09), so Filament, three.js in a web view and server-side rendering are compared on quality, cost and consistency. Deliverable: a written comparison first; then the owner picks 2–3 candidates for a hands-on test on about 30 real garment photos with pass/fail criteria; no provider spend without the owner's approval. P01's native spike, P04, P05, P10 and P11 wait for the go/no-go; P03 and P06–P09 proceed in parallel. The outcome lands as an ADR and a new DEC before DEC-07, DEC-08 or DEC-50 changes | RB-2 said to reopen "only when a new model class demonstrably changes r5's conclusion"; the owner asks for that evidence to be gathered again with current tools. DEC-50 named no trigger for resuming 3D, which left P01, P04, P05 and P10 without a start condition | Owner direction 2026-10-09; [00 §9.1](00-product-vision-and-scope.md) RB-2; [07 §6, §11](07-3d-avatar-and-garment-pipeline.md); §L of the 2026-10-09 proposal |
| DEC-77 | **(2026-10-09) Repository and local gates.** The repository stays private and is never made public. It moves to a GitHub organization later, at the owner's timing. Branch protection on `main` waits for that move: the `just repo-setup` report of 2026-10-04 found it unavailable on a private repository under a personal free account. Until then the local hooks and the no-push-to-`main` rule are the control. The secret scan allow-lists the gitignored repo-root `.env` only, because `just secrets-sync` writes real keys there by design; CI has no `.env`, so the CI gate does not change | The owner's call on visibility and timing. The allow-list is the smallest change that lets `just ci-parity` pass on a developer machine | Owner decision 2026-10-09; `docs/NEW-REPO-SETUP.md`; `.gitleaks.toml`; PROGRESS handoff 2026-10-03 |

## B. Doc 16 — open-question table

### B1. Edits to existing rows (append to the Notes cell unless stated)

| Row | Edit |
|---|---|
| OQ-01 | Append: "**2026-10-09:** the owner has a working name and keeps it out of the repository for now. The trademark and domain check is still owed before store submission." |
| OQ-03 | Append: "**Resolved 2026-10-09 by DEC-60:** 16+ everywhere, pending LR-09." |
| OQ-07 | Append: "**Resolved 2026-10-09 by DEC-61** as a product position: one EU home region, built to expand; counsel confirms under LR-03." |
| OQ-08 | Append: "**2026-10-09 (DEC-75):** iOS 26.0 / Android minSdk 29 confirmed by the product owner. The P14 measurement stays." |
| OQ-09 | Append: "**Resolved 2026-10-09 by DEC-74:** not in v1." |
| OQ-10 | Append: "Waits on the 3D track (DEC-76)." |
| OQ-14 | Owner cell `owner` → `PO`. Append: "**Resolved 2026-10-09 by DEC-62:** Hetzner, EU data center, one server at launch." |
| OQ-18 | Append: "**2026-10-09 (DEC-63):** deferred by the owner together with store enrollment. `app.aistylist.mobile` stays a placeholder. Decide before the first signed build; `docs/SERVICES-SETUP.md` §8 says the id cannot change afterwards." |
| OQ-19 | Append: "**Resolved 2026-10-09 by DEC-66** as a product position; LR-07 confirms the withdrawal semantics." |
| ASM-08, ASM-09 | Each id appears twice (lines 45/51 and 46/52). Renumber the credit-utilisation row to ASM-12 and the store-commission row to ASM-13, and fix the citations (`planning/phases/P13-*.md`:186 cites ASM-09 as closed). |

### B2. New rows

These exist in the docs today without a doc 16 entry. Docs 02 §15, 03 §6 and 09 §14 claim the
opposite. The rows decided on 2026-10-09 are in §A; the rows below stay open.

| ID | Question | Owner | Due | Notes |
|---|---|---|---|---|
| OQ-20 | Which transactional email provider sends deletion and export notices? | BE | P03-T10 | No candidate is named anywhere; P03 has an adapter stub (P03:97). Needs a short comparison and the DEC-48 pattern: managed, behind a port, with an exit trigger |
| OQ-21 | Sentry for native crashes, or PostHog only? | MOB | End of P03 (adequacy review) | DEC-21 and DEC-48 say Sentry is optional; P03-T16 expects a DEC (P03:161; doc 14:18) |
| OQ-22 | Which plan includes the A2 selfie face? | PO | P05 (waits on DEC-76) | The doc 12 entitlement matrix lists A1 only (12:37), while doc 12 §6 speaks of "the A2 face you created while paid" (12:171) |
| OQ-23 | Apparent-minor detection on selfies versus the rule that bans age inference from photos | PO + counsel | P05 (with LR-09) | Doc 11:199 requires the detection, doc 11:280 bans inferring age from photos, and doc 10:135 keeps selfies on-device |
| OQ-24 | Who signs the recommendation safety-threshold table, and what is the final default weight vector? | PO (thresholds), BE (weights) | P09-T02; weights after P09 eval data | Conservative defaults unblock the build (P09:65, P09:151; doc 09:400) |
| OQ-25 | How long are decision traces kept? | BE, with the doc 11 privacy review | P09-T02 | Doc 09 defers to doc 11; doc 11 states no duration (P09:136; doc 09:310) |
| OQ-26 | Repair and lent: separate UI, or one "unavailable (reason)"? | PO | P07 | The model keeps both states (doc 03 §6 item 10) |
| OQ-27 | Which on-device store per platform holds the upload queue and the offline closet? | MOB | P06-T03 (queue); P07-T07 (ADR) | P06 needs the queue store one phase before P07 chooses the offline store (P06:112, P07:135; doc 04:378). Decide both in one ADR at P06 |
| OQ-28 | Which device farm runs the nightly device lane? | MOB | Before the first phase that needs device runs; P14 at the latest | None is named in doc 13, P04, P10 or P14 (13:70, P04:167, P10:82, P14:141) |
| OQ-29 | Which geocoder serves manual city entry, and which countries form the P08 coverage check? | BE | P08 | None is named (P08:63, P08:125, P08:169) |
| OQ-30 | Which malware scanner and NSFW classifier does the upload pipeline use? | ML | P06-T13 | Doc 11:121 says "cheap classifier"; doc 10 §1 has no row for it, and the doc-10 entry rule applies (P06:116) |
| OQ-31 | Launch operations picks: admin UI surface, paging tool and on-call, pen test external or internal, certificate pinning (DO-SEC-02) | BE | Admin surface P12; the rest P14 | None is chosen; DO-SEC-02 has no P14 task (P12:88, P14:83, P14:103, P14:149; doc 11:100) |
| OQ-32 | What is the P12 content budget, and the feed-overlap threshold of P12 AC-4? | PO | P12-T01 | The RISK-03 kill criterion needs the amount (P12:176, P12:200) |
| OQ-33 | Which recommendation latency budget is the P09 gate: 800 ms at 500 items or 1.5 s at 200 items? | BE | P09 | Doc 09:220 and doc 13:158 disagree |
| OQ-34 | How does the measurement→morph mapping engine run in Swift and Kotlin? | MOB + ML | P04-T04 (waits on DEC-76) | P04 still says "shared TS package" (P04:55, P04:90, P04:133) |
| OQ-35 | Which clone-detection tool satisfies NFR-TEAM-040? | BE | P02-T18 | The `pr-gate` job is a placeholder (`.github/workflows/pr-gate.yml`:155–168) |
| OQ-36 | Chat and calendar gates: which metric values trigger each build, which LLM carries chat text, and which LR item covers calendar access? | PO | P15-T06, P15-T08 | P15:33, P15:98, P15:168–169 |

## C. ADR files (human-only bodies) and the index

### C1. New file `docs/adr/0009-no-cross-module-foreign-keys.md`

```markdown
# ADR-0009 — No cross-module foreign keys

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** owner (human choice between options A–C, 2026-10-09 session); BE
- **Decision-log entry:** DEC-67 in [16-risks-open-questions-and-decision-log.md](../../planning/16-risks-open-questions-and-decision-log.md)
- **Related:** doc 06 §8 (deletion propagation) · `.claude/plans/2026-10-04-repo-split-readiness-proposal.md` §B · phase P03

## Context

P03 adds the first domain tables. Doc 06 §8 step 1 builds the account-deletion cascade "from the Drizzle FK graph", which assumes that every module's tables hold a foreign key to `users`. Modules may import each other only through their public API (`CLAUDE.md`, `just arch-check`); a foreign key into another module's table couples two modules at the schema level, below that rule. Foreign keys also cannot cross databases, so they would block moving a module to its own service later (repo-split readiness audit, 2026-10-04). The rule has to exist before the first table, because removing foreign keys later costs one migration per table.

## Options considered

| Option | Pros | Cons | Evidence (primary source + as-of date) |
| ------ | ---- | ---- | -------------------------------------- |
| A (chosen): no foreign key crosses a module boundary | Module boundaries hold at the data layer; a later split stays possible; deletion is already event-driven for R2, providers and jobs | The database no longer guarantees cleanup; a module that misses its deletion step leaves orphan rows | Repo-split proposal §B (2026-10-04); doc 06 §8 |
| B: foreign keys to `users` only | The database guarantees cleanup of user rows | Every module stays tied to `identity`'s table and to one database; a standing exception | Owner question round, 2026-10-09 |
| C: foreign keys everywhere | Simplest; the cascade comes from the FK graph, as doc 06 is written | Schema-level coupling between modules; blocks a split | Doc 06 §8 step 1 (2026-08-24) |

## Decision

No table declares a foreign key to a table owned by another module.

- `user_id` is a typed `Id<'user'>` column with no foreign key.
- Each module deletes its own rows through the deletion event chain that doc 06 §8 defines.
- A test asserts that every module holding user rows registers a deletion step.
- A migration lint rejects a `REFERENCES` clause that crosses a module boundary.
- Foreign keys between tables of the same module stay allowed.
- Doc 06 §8 step 1 changes from "cascade map generated from Drizzle FK graph" to "each module's registered deletion step; a contract test asserts every table with a `user_id` column is covered".

## Rationale

The module boundary is the architecture's main invariant, and `just arch-check` enforces it for imports only. A schema-level link would let two modules depend on each other where no lint looks. Deletion already needs an ordered, event-driven chain, because R2 objects, provider data and queued jobs are not in PostgreSQL (doc 06 §8). The same chain can carry the row deletes. Option B keeps the database guarantee but leaves the coupling in place for the one table every module touches.

## Consequences and revisit triggers

- Positive: modules own their tables fully; a module can move to its own database without a schema rewrite.
- Negative/accepted debt: orphan rows are possible when a module forgets its deletion step. The coverage test, the migration lint and the purge-verification scan (doc 11 §13) are the controls.
- **Revisit when:** purge verification finds orphan user rows that the test and the lint should have caught, twice. Reversal requires a new DEC entry.
```

### C2. New file `docs/adr/0010-decision-log-ratification.md`

```markdown
# ADR-0010 — P00 ratification of the decision log

- **Status:** Proposed
- **Date:** 2026-10-09
- **Deciders:** product owner
- **Decision-log entry:** DEC-68 in [16-risks-open-questions-and-decision-log.md](../../planning/16-risks-open-questions-and-decision-log.md)
- **Related:** NFR-TEAM-110 · P00-T01 and P00 AC-1 in [P00](../../planning/phases/P00-product-validation-and-decisions.md) · phase P00

## Context

P00-T01 planned 33 ADR files in `planning/adr/`, one for each of DEC-01…DEC-33. Since then P02 created `docs/adr/` and used numbers 0001–0007, eight of the 33 decisions were superseded (DEC-03, 04, 12, 14, 17, 23, 27, 30), and the log grew past DEC-59. NFR-TEAM-110 asks for an ADR template and a decision log seeded with every SPINE decision. Both exist. What is missing is the product owner's formal ratification of the log.

## Options considered

| Option | Pros | Cons | Evidence (primary source + as-of date) |
| ------ | ---- | ---- | -------------------------------------- |
| A (chosen): one ratification ADR; doc 16 stays the per-decision record | No decision is written twice, so nothing can drift; one sign-off covers the whole log | P00 AC-1 changes | Doc 16 decision log (2026-10-09) |
| B: one ADR per standing decision not yet named in ADR-0001–0007 | Per-decision files for the live set | About 15 files that restate doc 16 rows and go stale when a row is amended | `docs/adr/` (2026-10-09) |
| C: 33 ADRs as P00-T01 is written | Matches the original plan | Includes 8 superseded decisions; the most duplication | P00 §12 (2026-08-24) |

## Decision

The product owner ratifies the decision log in doc 16 as it stands on the ratification date: every row not marked superseded, with its amendments.

- Doc 16 remains the only per-decision record. Rationale, evidence and the supersession chain live there.
- No `planning/adr/` directory is created.
- A separate ADR is written for a decision only under the doc 15 §8 triggers: a new dependency or provider, a contract shape, a SPINE override, or security-relevant design.

**Ratification line (the product owner fills it in; the ADR then becomes `Accepted`):**
`Ratified <YYYY-MM-DD> by <name>, covering DEC-01 … DEC-<NN>.`

## Rationale

The owner's rule is that no data is left stale and that plans reference each other. Option A adds one file and no copies. Options B and C add files that must change every time a decision is amended.

## Consequences and revisit triggers

- Positive: P00 AC-1 becomes a check on one file and on doc 16's own consistency.
- Negative/accepted debt: decisions made before 2026-09-09 have no ADR file of their own; their matrices stay in doc 05.
- **Revisit when:** an auditor, a partner or a store review asks for per-decision records. Reversal requires a new DEC entry.
```

### C3. `docs/adr/README.md`

Append two index rows:

| ADR | Label | Title | Status | Date | DEC |
|---|---|---|---|---|---|
| [0009](0009-no-cross-module-foreign-keys.md) | — | No cross-module foreign keys | Accepted | 2026-10-09 | DEC-67 |
| [0010](0010-decision-log-ratification.md) | — | P00 ratification of the decision log | Proposed | 2026-10-09 | DEC-68 |

Replace the last line ("Planned (not yet written): the P00 decision set (owned by P00, not P02).")
with: "Number 0008 is not used: its draft (home of the composed Drizzle schema) was declined by the
owner on 2026-10-04 (`.claude/plans/2026-10-04-repo-split-readiness-proposal.md` §A)."

Status lines on older ADRs (status changes are allowed in place): ADR-0003 and ADR-0007 gain
"provider and region set by DEC-61/DEC-62; PostHog region amended by DEC-61". ADR-0004:66–68 still
lists OQ-15/16/17 as open; ADR-0006:53 still awaits a landed pg18 patch; ADR-0007:6 calls DEC-58
drafted.

## D. Phase-file edits that follow today's decisions

### D1. `planning/phases/P00-product-validation-and-decisions.md` (DEC-68, DEC-60, DEC-61)

| Where | Change |
|---|---|
| §1 Status | `NOT_STARTED` → `IN_PROGRESS` together with the ledger row |
| §4 In scope, first bullet | Replace with: "ADR ratification: one ratification ADR ([ADR-0010](../../docs/adr/0010-decision-log-ratification.md), DEC-68) in which the product owner ratifies the decision log in [doc 16](../16-risks-open-questions-and-decision-log.md) as it stands. Doc 16 stays the per-decision record." |
| §4 fourth bullet (OQ-03, OQ-07) | Append: "Decided 2026-10-09: DEC-60 (16+) and DEC-61 (EU home region)." |
| §8 Documents row | "ADR set in `planning/adr/` (moves to `docs/adr/` in P02)" → "ADR-0010 in `docs/adr/`" |
| §12 P00-T01 | Replace the task text with: "Write [ADR-0010](../../docs/adr/0010-decision-log-ratification.md) from `templates/adr.md` (DEC-68). Check that every DEC row in doc 16 is either standing or names the DEC that supersedes or amends it. **[PO]** ratifies by filling in the ratification line." Est. sessions 2 → 1 |
| §12 P00-T05 | Append: "Decided 2026-10-09: DEC-60." |
| §12 P00-T06 | Append: "Decided 2026-10-09: DEC-61 (region) and DEC-62 (provider, topology). The memo still records the as-of-dated region options and the counsel framing." |
| §13 | Drop "T01 writes only back-link column entries" |
| §14 table, Unit cell | "every DEC row ↔ ADR file 1:1 (scripted grep count)" → "ADR-0010 exists with a ratification date and decider; every DEC row is standing or names its successor" |
| §18 step 1 | Replace with: "Open `docs/adr/0010-decision-log-ratification.md` — show the ratification line; pick DEC-11 in doc 16 and walk decision → evidence → SPINE row." |
| §19 AC-1 | Replace with: "`docs/adr/0010-decision-log-ratification.md` is `Accepted` and carries a ratification date and decider. A scripted check finds every `DEC-NN` row in doc 16 either standing or naming the DEC that supersedes or amends it. No `planning/adr/` directory exists." |
| §20 commands | `ls adr/ \| wc -l   # ≥ 33` → `grep -c '^Ratified\|Ratified 20' ../docs/adr/0010-decision-log-ratification.md   # ≥ 1` |
| §21 | "`planning/adr/*` (new)" → "`docs/adr/0010-*` (new)" |

### D2. Other phase files

| Where | Now says | Change to | Source |
|---|---|---|---|
| P01:10, P01:127 | "run when 3D resumes" / "Deferred until 3D resumes" with no condition | Name the trigger: "3D resumes on the go/no-go of the garment 3D research (DEC-76)" | DEC-76 |
| P01:37, P01:160 | "Gate thresholds ratified in P00" as a met premise | "ratified in P00 (not yet: P00 `IN_PROGRESS`)" until P00 exits | P00 state |
| P01:128 vs P01:37 | T02 "Can run now" while the phase hard-depends on P00 `ACCEPTED` | Either add T02 to the DEC-76 research scope or state the exception; no DEC covers it today | Sweep finding; needs the owner's word |
| P01:46, P01:99, P01:143, P01:244 | `prototype/p01-filament/`, "P02-T13" for tooling, "package.json/lockfile" | Existing spike is `prototype/g3-filament-spike`; the tooling task is P02-T17, now on the 3D track | DEC-50, DEC-63 |
| P02:77–80 (§3) | Cloud tasks wait on OQ-07 and OQ-14 | "OQ-07 and OQ-14 resolved (DEC-61, DEC-62): EU, Hetzner, one server" | DEC-61, DEC-62 |
| P02:187 (T07) | "Hetzner working assumption" | Cite DEC-62 and DEC-61; R2 backup bucket in EU jurisdiction | DEC-61, DEC-62 |
| P02:194, P02:195 (T14, T15) | In P02 scope | State column: "Moved out of P02 by DEC-63; reopens with the first tester build" | DEC-63 |
| P02:197 (T17) | `NOT_STARTED` | "Moved to the 3D track by DEC-63 and DEC-76" | DEC-63 |
| P02:198 (T18), P02 §19 | Close-out depends on "all" | "all except T14, T15, T17 (DEC-63)"; adjust the §19 criteria that need a signed archive | DEC-63 |
| P02:181 (T01) | `DONE`, including branch protection | "`DONE` except branch protection, deferred to the organization move (DEC-77)" | DEC-77 |
| P02:191 (T11) | "not yet run on GitHub" | Ledger records green `main` runs on 2026-10-03 | Ledger |
| P02:81, P02:148, P02:230 | "both iOS lanes", "lane cost sheet in ADR-P02" | One lane (DEC-51) | DEC-51 |
| P02:93, P02:148, P02:171 | "ADR-OBS-01 chooses" | Decided: ADR-0007, DEC-58, region per DEC-61 | DEC-58 |
| P02:89, P02:138, P02:205 | Generator list TS + Python; wave "trigger+worker" | TS, Swift, Kotlin, Python, kernel (DEC-53, DEC-55, DEC-59); "jobs+worker" | DEC-41, DEC-53 |
| P02:117 | "passes RNTL a11y label lint" | Native lint equivalents (DEC-49) | DEC-49 |
| P03:50 | "counsel was engaged in P00" | "counsel engagement is P00-T04; the owner engages one (2026-10-09)" | Owner answer |
| P03:52, P03:57, P03:148, P03:161 | OQ-03 outcome, DO-SEC-01 and the grace window "decide here, log DEC" | Cite DEC-60, DEC-64, DEC-65 as decided; keep only the Sentry DEC (OQ-21) open in T16 | DEC-60/64/65 |
| P03 §3 | OQ-19 is absent | Add: "OQ-19 resolved by DEC-66; LR-07 confirms withdrawal semantics" | DEC-66 |
| P03 §6/§7/§12 (first user table) | No region field | Add to the `identity` scope and to the first migration task: "`users.home_region` (`eu` at launch, DEC-61); no cross-module foreign keys (ADR-0009, DEC-67); the deletion-step coverage test and the cross-module `REFERENCES` migration lint land with the first table" | DEC-61, DEC-67 |
| P03:97, P03:115, P03:192 | Email adapter stub, no vendor | Cite OQ-20 | OQ-20 |
| P03:105, P04:84, P05:84, P06:106, P07:85 | "mobile TS client", TanStack hooks | Generated Swift and Kotlin clients (DEC-53) | DEC-53 |
| P04:13, P04:37, P04:136 | Requires the P01 render gate; no word on DEC-50 | Add a banner: "Waits on the 3D go/no-go (DEC-76). OQ-10 and OQ-34 are decided at phase start." | DEC-76 |
| P04:55, P04:90, P04:133 | "shared TS package" mapping engine | Cite OQ-34 | OQ-34 |
| P05:35, P05:69, P05:95, P05:129 | No DEC-50 mention; T02 "one TS interface" | Banner as P04; T02 follows P05:143 (native adapters); cite OQ-22 and OQ-23 | DEC-76 |
| P06 §6 (limit seam), P06 taxonomy tasks | No rule for pairs, suits or archive | Cite DEC-69: pair = 1, suit = 2 linked, archived items count | DEC-69 |
| P06:112, P06:155, P07:43, P07:73, P07:135 | Store "chosen in the phase that introduces it" | Cite OQ-27 (one ADR at P06 for both stores) | OQ-27 |
| P07 (worn, laundry, repair/lent) | Open behaviour | Cite DEC-70; repair/lent stays OQ-26 | DEC-70 |
| P08:52, P15:118 | Default occasion closes at P15-T03 | Decided: DEC-71 | DEC-71 |
| P09:52, P13:77, P14:263, P15:37 | Notification defaults and over-cap close at P15 | Decided: DEC-72, DEC-69 | DEC-69, DEC-72 |
| P09:65, P09:136, P09:151 | Thresholds, trace retention "tracked in doc 16" | Cite OQ-24, OQ-25, OQ-33 | New OQ rows |
| P10:11, P10:12, P10:37, P10:60, P10:118, P10:122, P10:164 | Plans the on-device 3D scene; `render/` paths that no longer exist | Banner: "Waits on the 3D go/no-go (DEC-76); the research also decides on-device versus server rendering." G0 collage tasks can be split out and run earlier | DEC-76 |
| P11 §3 | Depends on P10 | Add: "P10 waits on DEC-76, so P11 does too, unless the try-on path on user photos is split from the avatar-render path" | DEC-76 |
| P11:95, P11:96, P11:175, P11:198 vs P11:163, P11:197 | Two cost gates: pre-r6 prices and verified ones | Keep the verified gate ($0.012 per missing view, $0.0825 per try-on) | DEC-28, DEC-34 |
| P12:66, P12:84 | "existing `ExplanationPort`-family LLM port" | DEC-46 removed that port; name the summarization port P12 actually needs | DEC-46 |
| P13:42, P13:50, P13:215 | Family sharing "decision recorded" while OQ-09 was open | Cite DEC-74 | DEC-74 |
| P13:50 | Credit rollover out of scope (BIL-O4 experiment) | Cite DEC-73 | DEC-73 |
| P13 §3, P13 §12 | No task for store enrollment, signing or the name | Add the tasks moved by DEC-63 (T14, T15 content) and the OQ-18 and OQ-01 closes | DEC-63 |
| P13:75 vs P13:46 | "15 names" against 17 entitlements | 17 (doc 12:76, registry) | Registry |
| P13:46, P13:60, P13:97, P13:199 | OQ-12 has no task; 6 SKUs against "8 SKUs" | Add the OQ-12 experiment task or correct the count | OQ-12 |
| P14:22, P14:24, P14:182, P14:245 | Launch gates assume shipped 3D | "if the 3D track is go (DEC-76)" | DEC-76 |
| P14:56, P14:84, P14:144 | OQ-08 ratification | Cite DEC-75 (confirmed; P14 measures) | DEC-75 |
| P14 §12 | No task for the DEC-58 retention debt or DO-SEC-02 | Add both, citing OQ-31 | OQ-31 |
| P14:183 | "$60–85/mo" | Doc 12:228 says ≈ $35–75; reconcile | Doc 12 |
| P15:61, P15:69 | `assistant` → `outfit` import, `compose_outfit` tool | Doc 04:156–161 and `tools/depcruise/rules.cjs`:46 exclude `outfit` | Doc 04 |
| P08:76, P09:107, P10:72, P11:75, P12:76, P12:151, P13:87, P13:163, P15:72 | "TS mobile client", `features/…` paths | Generated Swift and Kotlin clients; native feature modules | DEC-49, DEC-53 |

## E. Planning-doc edits that follow today's decisions

| Where | Change | Source |
|---|---|---|
| `planning/SPINE.md`:28, :94 (path-guarded) | "When 3D resumes" → "3D resumes on the go/no-go of the garment 3D research (DEC-76)" | DEC-76 |
| `planning/SPINE.md`:40 (path-guarded) | "provider/region per OQ-07/OQ-14, Hetzner = working assumption" → "Hetzner, EU data center, one server at launch (DEC-61, DEC-62)" | DEC-62 |
| `planning/SPINE.md`:122 (path-guarded) | "no expiry (or 90-day — decide at P13)" → "no expiry (DEC-73)" | DEC-73 |
| doc 00:56 (non-goals) | Add: "Family sharing and shared closets — not in v1 (DEC-74)" | DEC-74 |
| doc 00 §9.1 RB-2 (00:189–200) | Kill line: add "Reopened 2026-10-09 by DEC-76; the research re-measures against current tools" | DEC-76 |
| doc 02:439, doc 02:457, doc 02:538 | Grace window, over-cap, worn, occasion and notification defaults listed as open | Cite DEC-65, DEC-69, DEC-70, DEC-71, DEC-72; §15 keeps nothing open | §A |
| doc 02:462 | Hard-coded "item 41" | Keep; cite `closet.max_items` and DEC-69 for what counts | DEC-69 |
| doc 03 §6 (03:328–343) | Ten ambiguous terms "to be logged" | Mark items 1–9 decided (DEC-70, 70, 71, 69, 69, 69, 73, 65, 74); item 10 → OQ-26 | §A |
| doc 03:115 | "1 credit = one G2 try-on image" | Try-on = 3 credits, missing view = 1 (DEC-34) | DEC-34 |
| doc 05:168, :289, :326, :333 | EAS allowance; "no-Mac-purchase decision stands"; A5 window "P02–P03"; one host as assumption | DEC-51; A5 window moves with DEC-63; DEC-62 | DEC-51/62/63 |
| doc 06:292 | `apps/api/drizzle/` | `packages/db/migrations/` (DEC-37; owner kept `packages/db` on 2026-10-04) | DEC-37 |
| doc 06:307, :323 (§8 step 1) | "Cascade map generated from Drizzle FK graph" | "each module's registered deletion step; a contract test asserts every table with a `user_id` column is covered (ADR-0009, DEC-67)" | DEC-67 |
| doc 08 (item model), doc 08:100, :106 | No pair or suit rule; laundry and worn as assumptions | Cite DEC-69 and DEC-70 | DEC-69/70 |
| doc 09:400 | "Open questions tracked in doc 16" (they were not) | Cite OQ-24, OQ-25 | New OQ rows |
| doc 11:42, :191 | PostHog region absent from the trust boundary; DPAs depend on the provider | Add the EU regions and Hetzner (DEC-61, DEC-62) | DEC-61/62 |
| doc 11:76 | DO-SEC-01 as a pending decision | Decided: DEC-64 | DEC-64 |
| doc 11 §7.2 (11:144–151) | No word on crash diagnostics | Add: "crash diagnostics are covered by `analytics` (DEC-66)" | DEC-66 |
| doc 11:198, :233 | Age "Decision (needs legal confirmation)"; "7-day grace window" | Cite DEC-60 and DEC-65 | DEC-60/65 |
| doc 11 §12 (11:211–224) | LR table has no Owner column; every row "Open" | Add an Owner column (P00 AC-3). Proposed owners: PO for all rows until counsel is engaged | P00 AC-3 |
| doc 12:117, :120, :266 (BIL-O4), :149, :269 (BIL-O5) | Rollover, top-up expiry and family sharing as open | Decided: DEC-73, DEC-74; BIL-O5 says "post-launch" while doc 16 said P13 | DEC-73/74 |
| doc 12:97 | Over-cap rule | Cite DEC-69 | DEC-69 |
| doc 13:71–77 | Device tiers "a P01 output", hypothesis | Floors confirmed by DEC-75; tiers measured at P14 | DEC-75 |
| doc 14:15, :69 | Crash section names no consent purpose | `analytics` (DEC-66) | DEC-66 |
| doc 16:129 (DEC-42), :135 (DEC-48), :141 (DEC-54), :145 (DEC-58) | "working assumption", "pending OQ-08", PostHog US | Add "Amended by DEC-62 / DEC-61 / DEC-75" notes | §A |
| `docs/SERVICES-SETUP.md`:23, :36–37, :244, :323, :464, :470 | Regions and provider as open choices; PostHog US; one free project | EU jurisdiction for R2, PostHog EU for the real account, Hetzner EU (DEC-61, DEC-62); the current accounts are test accounts | DEC-61/62 |
| `docs/observability/posthog.md`:85–88 | US host | Host comes from config; EU for the real account (DEC-61) | DEC-61 |
| `docs/modules/identity.md`:50 | Holds OQ-03 as open | Cite DEC-60, DEC-64, DEC-65 | §A |
| `.claude/plans/2026-10-04-repo-split-readiness-proposal.md` | §B ADR-0009 "draft" | Banner: "§B accepted 2026-10-09 (DEC-67, ADR-0009)" | DEC-67 |

## F. Stale text from earlier decisions (found by the sweep, not caused by today)

| Where | Problem | Correct fact |
|---|---|---|
| doc 02:3, 03:3 ("Draft for review"); doc 04:3, 06:3, 09:3, 10:3, 11:3, 12:3, 13:3, 14:3 ("Draft for ratification") | The ledger calls the planning package `ACCEPTED`, ratified 2026-08-24 | P00-T07 and P00-T08 add the "Ratified <date> by <name>" lines (P00 AC-4, AC-5) |
| doc 10:181–201 | Provider register: prices are dated, privacy cells are not | P00 AC-5 needs as-of-dated training and retention terms |
| doc 10:328 | Anthropic pricing review dated 2026-09-01 passed with no outcome; Gemini 2.5 Flash sunset 2026-10-16 | Record the outcome (AIC-O6) |
| doc 04:225, doc 05:175 vs doc 06:34 | OpenAPI "emitted by NestJS" versus authored spec | Authored spec is the source (doc 06; no swagger emitter in `apps/api/src`) |
| doc 04:275–276 | `tools/bootstrap/`; "ADRs in planning/16" | `scripts/`, `docs/adr/` (DEC-37) |
| doc 04:282, doc 06:19 | OQ-15 "open"; mobile imports shared-kernel | Resolved by DEC-55 |
| doc 04:307, doc 10:49, doc 13:40 | Idempotency by pg-boss singleton keys | Derived job id (DEC-57) |
| doc 06:17, :18, :29, :322 | TS client and TanStack hooks for mobile; "Trigger tasks" | DEC-53; DEC-41 |
| doc 06:38 | Base URL ends in `/v1` | Host only (OQ-16 resolved) |
| doc 06:202–204 | `ent.tryon.g2`, `ent.closet.limit` | Registry names `tryon.generative`, `closet.max_items` (DEC-55) |
| doc 08:22 vs doc 06:22, doc 03:202 | Taxonomy registry generated from `packages/contracts` or `shared-kernel` | Taxonomy lives in `closet` and reaches the apps through the API (`CLAUDE.md` invariants) |
| doc 07:289 vs doc 05:86 | Mid-tier target ≥30 fps versus 60/50 fps | Reconcile inside the DEC-76 research |
| doc 11:35, :103 | "SecureStore", "encrypted MMKV" | Keychain and Android Keystore (DEC-49); the local store is OQ-27 |
| doc 11:51; doc 15:216; doc 12:57; doc 14:111 | Dangling references: "R-SEC-face-misuse", "doc 16 legal-review register", doc 12 "§5.8", `templates/incident-review.md` | Point at the real anchors or create them |
| doc 13:144–147 | 3D budgets gate at P01, apply "from P04 onward" | Gate moves with DEC-76 |
| doc 13:181, doc 14:71, :190, doc 15:223 | Crash-free threshold cited from doc 13 and release checklist cited from doc 15; neither exists there | Add the anchors or fix the citations |
| doc 14:28 | Logs "30 d hot" | 14 days on the free tier, accepted debt until P14 (DEC-58) |
| doc 15:26–34, :213, :278 (path-guarded) | Node 22, pnpm 10, Temurin 21, Python 3.12; automerge "only dev-dependency patches" | DEC-56 pins and Renovate policy |
| doc 15:115, :203, :216 (path-guarded) | Two strict docs-check checks "human-approval-pending"; CODEOWNERS placeholders; Gradle/SwiftPM licence checks "known gap" | Owner items; see §J |
| `planning/research/r7-*.md`:15, :94, :102, :182 | Predates DEC-45, DEC-49, DEC-51 | Add a correction banner; research files are evidence and are not rewritten |
| `planning/PROGRESS.md`:29, :61, :62 | "none has run remotely yet"; "remove four stale keys" (done); "enable branch protection" | Runs are green as of 2026-10-03; keys removed; protection deferred (DEC-77) |
| `.claude/plans/` banners: `2026-10-03-repo-setup-proposal.md`:3, `2026-10-03-setup-automation-proposal.md`:13–15, `2026-09-27-ai-17-workflows-proposal.md`:3–8, `2026-09-27-observability-sync-proposal.md`:3–9, `s5-bootstrap-automation-human-proposals.md` (no banner) | Banners understate what landed | Refresh the banners (existing plan files are history; only the banner line changes) |
| `s5-bootstrap-automation-human-proposals.md`:43–47 | The owner's 2026-09-25 setup decisions have no DEC row; the proposed id DEC-56 was reused | Add a DEC row with the next free id |

## G. Defaults applied without asking (object if wrong)

1. **Credential rotation.** The keys that passed through agent sessions belong to test accounts that
   the owner replaces. Rotation happens by replacement; no test key is reused on a real account.
   `secrets/README.md`:99 ("same day") and `docs/SERVICES-SETUP.md`:731 ("at P14") should both say this.
2. **PostHog production project.** A new EU organization and project on the real account; the test
   project stays dev-only. This also answers the "free plan allows one project" conflict
   (`docs/SERVICES-SETUP.md`:470).
3. **R2 buckets.** EU jurisdiction, following DEC-61.
4. **Schema composition.** Modules export their table definitions through their public `index.ts`
   (owner decision 2026-10-04). Verify with `just arch-check` on P03's first table.
5. **Module repository tests.** They live in the owning module's `tests/` directory (the `CLAUDE.md`
   testing rule), with the database from the `packages/test-support` helpers.
   `.claude/rules/platform-jobs.md`:43 tells agents to stop here and needs the owner's edit.
6. **PostgreSQL on the server.** Coolify service or compose stack is decided inside P02-T07 by the
   platform work; no owner input needed.
7. **P00 status.** `NOT_STARTED → IN_PROGRESS` when this proposal is applied.

## H. Deferred by the owner — ask again when

| Item | Ask again |
|---|---|
| Apple and Google Play enrollment: individual or organization | When store work starts (DEC-63) |
| Permanent bundle id (OQ-18) | Before the first signed build |
| Product name in the repository, trademark and domain check (OQ-01) | Before the bundle id is fixed; P13 at the latest |
| Branch protection, GitHub plan | At the move to a GitHub organization (DEC-77) |

## I. Open, but only evidence or counsel can close it

- **Counsel:** LR-01…LR-12 (all "Open"); OQ-06 (regional gating for face features); the DEC-61
  exclusion list; LR-07 for DEC-66; LR-09 for DEC-60; AIC-O2 (fal.ai privacy review).
- **Evals and spikes:** OQ-05 (content sources, P12), OQ-11 and AIC-O5 (try-on arms, P11), AIC-O1,
  AIC-O3 and AIC-O7 (P06 arms), BIL-O3 (weather comparison, P08), the P09 weight vector (OQ-24).
- **Store and pricing reviews:** OQ-02 and BIL-O1 (trial variant), OQ-12 (cap and weekly SKU),
  BIL-O2, BIL-O6, BIL-O8, AIC-O6, AIC-O4.
- **Waits on the 3D track:** OQ-10 (pose set), OQ-22, OQ-34.

## J. Owner actions (no decision needed)

1. **By 2026-10-11:** confirm the Grafana Cloud stack lands on the free plan when its trial ends
   (`docs/SERVICES-SETUP.md`:538; DEC-48 says exit before paid usage).
2. Engage counsel. P00's stop criterion gives two calendar weeks from P00 start.
3. Create the Hetzner server (EU) and the R2 buckets (EU jurisdiction) for P02-T07 and P02-T13.
4. Install the Renovate app; replace the placeholder handles in `CODEOWNERS`; set `APP_ENV` in
   `secrets/dev.enc.yaml`; approve or delete the stale `onboard/arthur-minasyan` branch.
5. Run on the Mac: `just dev`, `just ios-doctor && just ios-check`, `just android-deps-lock`, and the
   forced-crash runs of AI-28 (P02 AC-6).
6. Apply or reject the unapplied parts of five older proposals: `2026-10-03-repo-setup-proposal.md`
   (A4, C, D, E, F), `2026-10-03-setup-automation-proposal.md` (E1–E4),
   `s4-doc-refresh-human-proposals.md` (1, 2, 3, 5), `s5-bootstrap-automation-human-proposals.md`
   (1–3), `s6-claude-foundation-human-proposals.md` (A1–A4, B1, B1b, B2, C1).
7. `gh` on this machine is logged in as `D90-dev` and cannot see `ArtMin96/ai-stylist`; CI state was
   not verified on 2026-10-09.

## K. Code work the decisions create (not started)

| Work | Where | Decision |
|---|---|---|
| `users.home_region` column; region, storage jurisdiction and analytics host from config | P03 first user table; `apps/api/src/config.ts`; `.env.example`; both apps' config | DEC-61 |
| Allow-list the repo-root `.env` in the secret scan | `.gitleaks.toml` (tooling) | DEC-77 |
| Deletion-step coverage test; migration lint for cross-module `REFERENCES` | `apps/api/tests/`, `tools/` (P03, with the first table) | DEC-67 |
| No password provider in better-auth; reviewer demo account | `identity` (P03-T03) | DEC-64 |
| 7-day grace window | `identity` (P03-T10) | DEC-65 |
| Linked items for suits; archived items count toward `closet.max_items` | `closet` taxonomy and limit seam (P06) | DEC-69 |
| Stored "typical day" in onboarding and `context` | P03 onboarding, P08 | DEC-71 |
| Notification preferences default off | `notifications` schema (P03 / P09-T16) | DEC-72 |
| Credit ledger: monthly reset, non-expiring top-ups | `billing` (P11 shadow credits, P13) | DEC-73 |

## L. Garment 3D research brief (DEC-76)

- **Question.** Can a photo of a garment become a 3D garment that looks right on the A1 avatar, at
  a quality, cost and speed the product can ship, on every supported phone?
- **Owner's options to compare.** (1) A 3D generator tool: image to 3D object. (2) The same, plus
  on-device AI where the phone has it, with the service as fallback. (3) A service only.
- **Hard constraints.** Works on iOS 26+ and Android 10+ (DEC-75). Same quality on every phone. So
  option 2 passes only if the on-device output matches the server output side by side.
- **Renderer is open.** The owner does not require Filament (2026-10-09) and is considering
  three.js. The research compares Filament, three.js in a web view and server-side rendering on
  quality, cost and consistency. DEC-50 changes only through a new DEC.
- **Lanes.** Managed image-to-3D services; self-hosted open models and their licences; on-device
  options on iOS and Android; on-device versus server rendering; garment-specific methods (template
  plus texture projection, G3) as the baseline to beat.
- **Per candidate.** Output format against DEC-06 (glTF 2.0, KTX2, Draco or meshopt), mesh and
  texture quality on garments, rigging or attachment to the Anny body, price per item with the read
  date, latency, licence for a closed-source commercial app, data handling against DEC-29, EU
  processing against DEC-61.
- **Step 1.** Written comparison, facts from official pages with as-of dates.
- **Step 2.** The owner picks 2–3 candidates. Test set: about 30 real garment photos across
  categories. Starting pass criteria from RB-2: at least 60% rated "acceptable on avatar" by blind
  raters, at most $0.10 per garment at scale, spike budget at most $1,000. The owner confirms the
  criteria before any spend.
- **Output.** `.claude/plans/2026-10-09-garment-3d-research.md`; it moves to
  `planning/research/r8-*.md` on the owner's word. The result lands as an ADR and a DEC.
