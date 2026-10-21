# Proposal: P03-T02 contract decisions for doc 16, and the planning lines they change (human-authorized only)

> Status: PROPOSED on 2026-10-21 (branch `feat/p03-t02-contracts` @ `bd1d7cb`, stacked on PR #47).

**Why:** P03-T02 (Linear AI-48) rests on owner decisions of 2026-10-13 and 2026-10-21 that doc 16 does
not record yet. The contracts engineers also reported planning lines that now disagree with the
contract. Agents may not edit `planning/**` prose or doc 16 (`.claude/rules/human-only.md`), so the
exact text is below. Sources: the "Lines for a human" sections of the P03-T02.1 to P03-T02.4 notes, the
P03-X01 notes and the security-fix notes (all from the lead session's scratchpad), and the contract
files on the branch.

## (a) Decision-log rows for `planning/16-risks-open-questions-and-decision-log.md`

Append to the "Decision log" table (`| ID | Decision | Rationale (one line) | Evidence |`). The ids are
placeholders: give them the next free ids after DEC-87 (DEC-88 is unused today), in this order. Add the
same dates to the "Amended" line at the top of doc 16.

| ID | Decision | Rationale (one line) | Evidence |
|---|---|---|---|
| DEC-a | **(2026-10-13) `identity` owns account recovery, the data-export request and the account-deletion request; `profile` owns onboarding progress.** The export and deletion endpoints are in `packages/contracts/openapi/modules/identity.yaml` (tag `identity`), onboarding progress in `profile.yaml`. The export-archive builder stays in `platform` (P03 phase file §6). | One owner per account-control flow, next to the sessions and consents it acts on | Owner decision 2026-10-13 (AI-48); `docs/modules/identity.md`, `docs/modules/profile.md` |
| DEC-b | **(2026-10-21) In P03 an account is created only with Sign in with Apple or Google Sign-In.** A passkey is added to a signed-in account (`registerPasskey`) and then signs in (`signInWithPasskey`). Passkey-first sign-up is not offered in P03; it can come later as an additive contract change. DEC-64 (the sign-in methods) stands. | better-auth 1.7.12 creates an account from a passkey only with the email and birth year in a URL query, which doc 11 §8 keeps out of logs | Owner decision 2026-10-21 on the P03-T02.1 report; `identity.yaml` |
| DEC-c | **(2026-10-21) Doc 11 §4.2 wins over doc 06 §2 "Auth" (line 45).** A session is an access token of about 15 minutes in `Authorization: Bearer`, plus a separate rotating refresh token that is sent only in the body of `refreshSession` (`POST /v1/auth/session/refresh`). Reuse of a rotated refresh token revokes the session family. | A stolen API-call token can no longer renew the session | Owner decision on security review finding B3; `608ceba`; `platform.yaml` `bearerAuth`, `identity.yaml` `SessionGrant` |
| DEC-d | **(2026-10-21) Doc 06 §2 "Idempotency" (line 43) is narrowed.** An `Idempotency-Key` is scoped to the caller and the operation. An operation whose answer carries a credential (the session access and refresh tokens, the deletion cancel token, the sign-up token) never stores or replays that answer and is marked `x-idempotency-replay: never`. A repeated key on one of them is 409 `CONFLICT`. | A replayed answer must never hand a stored credential to a second caller | Security review finding B1; `608ceba`; `platform.yaml` `IdempotencyKey`, `packages/contracts/tests/data-control.test.ts` |
| DEC-e | **(2026-10-21) A data export needs a recent sign-in, the same rule as account deletion.** `requestDataExport`, `requestAccountDeletion` and `getPasskeyRegistrationOptions` share the 403 `RecentSignInRequired` (`FORBIDDEN`). Recency counts from the sign-in that opened the session; a `refreshSession` renewal never resets it. | An export hands out all of a person's data, so a stolen session alone must not start one | Owner decision on security review finding N4; `608ceba`; `identity.yaml` |
| DEC-f | **(2026-10-21) P03-X03, P03-X04 and P03-X06 are stacked after P03-T02.** Order: P03-X03 (AI-87, error codes as a kernel JSON registry) → P03-X04 (AI-88, the kernel emitter for Swift and Kotlin) → P03-X06 (AI-95, the spectral `Idempotency-Key` rule), each stacked on the T02 PR. | Producers land before consumers (`CLAUDE.md`, Parallel sessions); the emitter lands before any native consumer (`.claude/rules/contracts.md` invariant 6) | Owner decision 2026-10-21 |

## (b) Planning lines that disagree with the contract

Each item names the file and line on `bd1d7cb`, the current text and the proposed text.

### 1. `planning/03-domain-model-and-glossary.md`

- **Line 31 (§1.2, Measurement):** the measurement sources. Contract: `MeasurementSource` in
  `profile.yaml`, kernel `registry/units.json` `measurementSources`.
  - Current: `` source (`user_entered | estimated | default`), confidence, recorded-at. ``
  - Proposed: `` source (`user | estimated | derived`), confidence (required for `estimated` and `derived`), recorded-at. ``
- **Line 115 (§1.10, Entitlement):** the grant spellings (doc 12 §3.2).
  - Current: `` with source (`trial | subscription | grant`), validity window, and state. ``
  - Proposed: `` with source (`plan_grant | trial_grant | promo_grant | grandfather_grant`, doc 12 §3.2), validity window, and state. ``

### 2. `planning/06-data-api-and-event-contracts.md`

- **Line 43 (§2, Idempotency), with DEC-d:**
  - Current: `Server stores key + request hash + response for 48 h; replay returns the stored response; same key with different body ⇒ `409`.`
  - Proposed: `A key is scoped to the caller and the operation. Server stores key + request hash + response for 48 h; replay returns the stored response; same key with different body ⇒ `409`. An operation whose answer carries a credential never stores or replays it (`x-idempotency-replay: never`); a repeated key on it ⇒ `409 CONFLICT` (DEC-d).`
- **Line 45 (§2, Auth), with DEC-c:**
  - Current: ``- **Auth:** better-auth session token in `Authorization: Bearer`; every request resolved to a principal + consent scopes (doc 11).``
  - Proposed: ``- **Auth:** short-lived access token in `Authorization: Bearer`; separate rotating refresh token (doc 11 §4.2), sent only in the body of `refreshSession`; every request resolved to a principal + consent scopes (doc 11).``
- **Line 58 (§3.1 sketch, `pronounSet`):** the contract has no pronoun field (owner decision 2026-10-13); `presentation` is one value, and style types moved to the preferences resource.
  - Current: `  "presentation": { "styleIdentity": ["minimal", "smart-casual"], "pronounSet": "she" },`
  - Proposed: `  "presentation": "feminine",            // feminine|masculine|androgynous|unspecified; style types: /v1/me/preferences styleTypes`
- **Line 66 (§3.1 sketch, `slim`):** `slim` is a value of `attr.leg-cut`, not a fit choice.
  - Current: `  "fitPreferences": { "tops": "regular", "bottoms": "slim" },`
  - Proposed: `  "fitPreferences": { "tops": "regular", "bottoms": "fitted" },   // fitted|regular|relaxed|oversized`
- **Line 69 (§3.1 sketch, sizing):** a sizing entry is `{ system, group, size }`.
  - Current: `  "sizingByRegion": [ { "region": "EU", "category": "cat.shoes", "size": "39" } ],`
  - Proposed: `  "sizingByRegion": [ { "system": "EU", "group": "shoes", "size": "39" } ],`
- **After line 74 (§3.1), new sentence:** `The contract splits this sketch into three resources, /v1/me/profile, /v1/me/measurements and /v1/me/preferences (packages/contracts/openapi/modules/profile.yaml); displayName is not carried in P03.`
- **Lines 201–203 (§3.6 sketch, grant source and value members):** `source` is per entitlement and uses
  the doc 12 §3.2 grant kinds. The value member follows the entitlement's kind (`billing.yaml`
  `ResolvedEntitlement`): `tryon.generative` is a `level` entitlement, and a cap is `limit`, not `value`.
  - Current, line 201: `  "source": "revenuecat",                     // revenuecat|server_grant (trial)|admin_grant`
  - Current, line 202: `  "entitlements": [ { "name": "tryon.generative", "granted": true },`
  - Current, line 203: `                    { "name": "closet.max_items", "value": null },        // null = unlimited`
  - Proposed: delete line 201. Line 202 becomes `  "entitlements": [ { "name": "tryon.generative", "source": "plan_grant", "level": "G2" },   // source: plan_grant|trial_grant|promo_grant|grandfather_grant; absent = Free-plan value`. Line 203 becomes `                    { "name": "closet.max_items", "source": "plan_grant", "limit": null },        // null = unlimited`
- **After line 223 (§4 envelope sketch), new line** (P03-X01; the `//` at column 37 like the other lines):
  - Proposed: `  "subjectUserId": "usr_…",          // the user the event is about (≠ actor); absent when none`
- **Line 235 (§4 catalog, consent row):** required by AI-64.
  - Current: `` | `identity.consent.changed.v1` | identity | scope, granted, at | ``
  - Proposed: `` | `identity.consent.changed.v1` | identity | purpose, granted, at | ``
- **Line 234 (§4 catalog), optional, so the catalog matches the schema:**
  - Current: `` | `identity.account.created.v1` | identity | userId, locale, consents | ``
  - Proposed: `` | `identity.account.created.v1` | identity | userId, createdAt | ``
- **After line 236 (§4 catalog), optional new row:** `` | `identity.account.export_requested.v1` | identity | exportId, userId, requestedAt | export job chain (doc 04 §9.1 step 1) | ``
- **Line 311 (§8 step 5):** `ACCOUNT_DELETED` is 410 (owner decision 2026-10-13; `packages/shared-kernel/src/errors.ts`).
  - Current: ``next mobile launch wipes local store on 401 + `ACCOUNT_DELETED` code``
  - Proposed: ``next mobile launch wipes local store on 410 `ACCOUNT_DELETED` ``

### 3. `planning/phases/P03-identity-consent-onboarding.md`

- **Line 242 (§19 AC-5), export link lifetime:** DEC-44 and doc 11 §13.1 keep the archive 24 h and mint
  each download link on request with a TTL of at most 10 min. No 24 h link exists.
  - Current: `export produces a machine-readable archive containing all P03 data classes, on a signed 24 h URL, works for any account state`
  - Proposed: `export produces a machine-readable archive containing all P03 data classes, kept 24 h, each download a presigned link of at most 10 min minted on request (DEC-44, doc 11 §13.1), works for any account state`
- The same wording is at line 67 (§4, `via signed URL 24 h`), line 89 (§5, `notification + signed link (24 h)`)
  and line 160 (the P03-T09 task text, `R2 signed link 24 h`). Proposed for each: `archive kept 24 h, download links ≤ 10 min (DEC-44)`.
- **Line 84 (§5, sign-in row), with DEC-b:**
  - Current: `Apple/Google/passkey → account + trial grant + consents in one round-trip sequence`
  - Proposed: `Apple/Google → account + trial grant + consents in one round-trip sequence (a passkey is added later and then signs in; DEC-b)`
- **Line 30 (§2, REQ-ONB-040), reported by P03-T02.2:** the row counts the requirement as delivered, but
  P03 delivers no mobility field and no size per brand.
  - Current: `| REQ-ONB-040 | Optional body-shape/fit/proportion/sizing/accessibility fields, skippable + editable | AC-1, AC-2 |`
  - Proposed: `| REQ-ONB-040 | Optional body-shape/fit/proportion/sizing/accessibility fields, skippable + editable (P03: sizes per region and garment group; no mobility field and no size per brand) | AC-1, AC-2 |`

## (c) Related: `planning/SPINE.md` §3 module table

The module contracts now name the 2026-10-13 ownership (DEC-a). SPINE §3 is silent on it, and outranks
the contracts, so a reader could see a conflict. Optional, with DEC-a:

- Line 63, current: `` | `identity` | Accounts, sessions, auth providers, consent records, age gate | users, sessions, consents | ``
- Proposed: `` | `identity` | Accounts, sessions, auth providers, account recovery, consent records, age gate, data-export and account-deletion requests | users, sessions, consents | ``
- Line 64, current: `` | `profile` | Measurements, body data, preferences, style identity, units/locale | profiles, measurements, preferences | ``
- Proposed: `` | `profile` | Measurements, body data, preferences, style identity, units/locale, onboarding progress | profiles, measurements, preferences | ``

## Not in this proposal

- `packages/shared-kernel/src/errors.ts:23`, the doc comment of `CONSENT_REQUIRED`, still names only the
  "not granted" case. That is a source file for contracts-engineer, not a planning line.
- The open engineering questions of the notes (response-enum growth before P06, the deletion re-auth
  window, the entitlement level spellings before P03-T07.4) are owner questions for their tasks, not
  line fixes.
