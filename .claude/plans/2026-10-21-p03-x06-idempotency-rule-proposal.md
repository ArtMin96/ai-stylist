# Proposal: spectral rule — `Idempotency-Key` on every mutating operation (P03-X06, AI-95)

> Status: APPLIED (2026-10-21, by the lead session on `feat/p03-x06-idempotency-lint`, owner decision 2026-10-21). Written by `tooling-engineer` on branch
> `feat/p03-x06-idempotency-lint` (base `4ba64f1`, the top of the P03 stack
> main ← #47 ← #48 ← X03 ← X04 ← this). `.spectral.yaml` is human-only
> (`.claude/rules/human-only.md`); by owner decision 2026-10-21 the lead session applies the patch
> below on this branch and sets this banner to APPLIED in the same commit. The test cases and the
> fixtures that prove the rule are already on the branch.

## What changes and why

Doc 06 §2 and §9 and P03 phase §7 ask every mutating route to take `Idempotency-Key`, and doc 06
§9 names "idempotency-header presence on mutating routes" as a spectral gate. `.spectral.yaml` has
no such rule, so nothing stops a contract change that leaves the header out.

1. `.spectral.yaml` gains one rule, `ai-stylist-mutating-operation-has-idempotency-key`
   (`severity: error`; the lint runs at `--fail-severity=warn`). What it checks:
   - **Methods:** every `post`, `put`, `patch` and `delete` operation. `get`, `head`, `options`
     and `trace` are not checked.
   - **Pass:** the operation's own `parameters` hold an entry with `name: Idempotency-Key` and
     `in: header`. A `$ref` counts: spectral lints the resolved bundle, so
     `$ref: './platform.yaml#/components/parameters/IdempotencyKey'` is seen as the header.
   - **`required` is not checked.** The header passes marked required or not.
   - **A path-item header does not count.** A header declared once on the path item, for all its
     operations, is reported: the rule checks the operation, and every operation of the contract
     declares it there today.
   - **Message** names the operation as spectral's JSON pointer, e.g.
     `#/paths/~1v1~1items/post changes data but declares no Idempotency-Key header parameter; ...`.
2. **The named exception** works under `/v1/auth/` only (owner decision 2026-10-13). An operation
   that the sign-in library serves and that cannot take the header carries a marker on the
   operation itself, with its reason as the value:
   `x-idempotency-key-exempt: <reason>`. The rule honours the marker only when the path starts
   with `/v1/auth/` (the trailing slash counts: `/v1/authorizations` is outside) and the value is
   a string with at least one non-space character. A marker anywhere else, `true`, or `''` is
   ignored, and the operation is checked like every other. Each exception is named one by one in
   the contract, so this file needs no further edit for one.
3. The first comment lines of `.spectral.yaml` name the new check and where its fixtures live.

Core functions only (`schema` plus two `given` JSONPaths); no custom function file, so the patch
touches `.spectral.yaml` alone. Checked against the installed `@stoplight/spectral-rulesets`
1.22.7 (`spectral:oas`): it has no rule that asks for a named header. Not checked in the online
Spectral documentation for that version: the rule was proven on the pinned CLI 6.16.3
(nimma 0.2.3) instead, by the trial below.

### For the contract leaves (P03-T02.1 to T02.3, `contracts-engineer`)

- Declare the header on each mutating operation, by
  `- $ref: './platform.yaml#/components/parameters/IdempotencyKey'`, never on the path item.
- The shared parameter stays without `required: true` (optional for the caller: doc 06 §2
  "accept"). The rule passes either way.
- An exception is named on the operation:
  `x-idempotency-key-exempt: <why the sign-in library's route cannot take the header>`, only under
  `/v1/auth/`, and listed with its reason in the PR. `x-idempotency-replay: never` is a different
  marker (the header is declared; the answer is never replayed) and grants no exception.

Sentence for `.agents/skills/api-contract-change/SKILL.md` (human-applied), appended to Workflow
step 5 after "Every mutating endpoint declares auth, idempotency behaviour, and the full error
surface;":

> Idempotency means the `Idempotency-Key` header on the operation itself, by
> `$ref: './platform.yaml#/components/parameters/IdempotencyKey'`, without `required: true`
> (`.spectral.yaml` rule `ai-stylist-mutating-operation-has-idempotency-key`); the only exception
> is a `/v1/auth/*` operation that the sign-in library serves and that cannot take the header,
> marked `x-idempotency-key-exempt: <reason>` and listed with its reason in the PR.

## Trial on the real contract (2026-10-21)

Run with the rule from a scratch copy of the patched ruleset,
`CONTRACTS_SPECTRAL_RULESET=<scratch>/spectral.yaml scripts/test/contracts-spectral.test.sh` →
`PASS  contracts-spectral: ...`, exit 0. The ticket's "two `get` operations on `main` @ `09b506e`"
is stale: the contract of this branch (`packages/contracts/gen/openapi.bundle.json`, last
regenerated in `bd1d7cb`) holds 31 operations (13 `get`, 12 `post`, 1 `put`, 3 `patch`,
2 `delete`). 18 are mutating, 9 of them under `/v1/auth/`. All 18 declare the header by `$ref`
to `#/components/parameters/IdempotencyKey`; 5 of them also carry `x-idempotency-replay: never`.
The rule reports none of them. No exception is granted and no operation carries
`x-idempotency-key-exempt`.

Mutation checks of the test (scratch rulesets, each run red on exactly the broken property): no
exception at all → `_clean` fails on `post /v1/auth/named-exception`; the marker honoured on every
path → the fixture misses `post /v1/marked` and `post /v1/authorizations`; any truthy marker →
misses `post /v1/auth/marker-without-reason`; the prefix without its trailing slash → misses
`post /v1/authorizations`; no `{{path}}` in the message → "message does not name the operation".

Turbo: `just lint` replays the contracts lint from cache when only `.spectral.yaml` changes,
because the file lies outside the package (`@ai-stylist/contracts:lint: cache hit, replaying logs
3ede99d448a420ad` on an unchanged tree). The branch therefore adds
`"inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/.spectral.yaml"]` to the `lint` task of the root
`turbo.json`. `scripts/ci/contracts-spectral.sh` and the test never go through turbo.

## Patch

Apply from the repository root with `git apply`. Generated with `diff -u` against `.spectral.yaml`
at `4ba64f1`; `git apply --check` was not run (the tooling-engineer command guard denies it).

```diff
--- a/.spectral.yaml
+++ b/.spectral.yaml
@@ -1,6 +1,8 @@
-# OpenAPI lint (planning/06 §9): naming, problem+json errors, operationIds. Runs on the bundled contract via
-# `pnpm --filter @ai-stylist/contracts lint:spectral`: inside lint:openapi (`just lint`) and in the PR gate
-# (`just ci-contracts-spectral`). Warnings fail (--fail-severity=warn).
+# OpenAPI lint (planning/06 §9): naming, problem+json errors, operationIds, and the Idempotency-Key
+# header on mutating operations. Runs on the bundled contract via
+# `pnpm --filter @ai-stylist/contracts lint:spectral`: inside lint:openapi (`just lint`) and in the PR
+# gate (`just ci-contracts-spectral`). Warnings fail (--fail-severity=warn). Rule fixtures:
+# tools/spectral/fixtures, proven by scripts/test/contracts-spectral.test.sh (`just test tooling`).
 extends:
   - spectral:oas
 rules:
@@ -45,3 +47,34 @@
                 propertyNames:
                   not:
                     pattern: '^[45][0-9]{2}$'
+
+  # Every POST, PUT, PATCH and DELETE operation declares the Idempotency-Key header parameter on the
+  # operation itself (doc 06 §2 and §9, P03 phase §7), by $ref to platform.yaml
+  # components/parameters/IdempotencyKey. Its `required` flag is not checked, and a header declared
+  # only on the path item does not count. Named exception, under /v1/auth/ only: an operation the
+  # sign-in library serves that cannot take the header carries `x-idempotency-key-exempt: <reason>`
+  # (a non-empty string). That marker anywhere else, or without a reason, is ignored.
+  ai-stylist-mutating-operation-has-idempotency-key:
+    description: POST, PUT, PATCH and DELETE operations declare the Idempotency-Key header parameter.
+    message: '{{path}} changes data but declares no Idempotency-Key header parameter; add the IdempotencyKey parameter of platform.yaml by $ref (doc 06 §2).'
+    severity: error
+    given:
+      - '$.paths[?(!@property.match(/^\/v1\/auth\//))][post,put,patch,delete]'
+      - '$.paths[?(@property.match(/^\/v1\/auth\//))][?(@property.match(/^(post|put|patch|delete)$/) && !(@["x-idempotency-key-exempt"] && @["x-idempotency-key-exempt"].match && @["x-idempotency-key-exempt"].match(/\S/)))]'
+    then:
+      function: schema
+      functionOptions:
+        schema:
+          type: object
+          required: [parameters]
+          properties:
+            parameters:
+              type: array
+              contains:
+                type: object
+                required: [name, in]
+                properties:
+                  name:
+                    const: Idempotency-Key
+                  in:
+                    const: header
```

## Proof after applying

1. `git apply --check` with the patch above, then `git apply`; set this banner to APPLIED.
2. `scripts/test/contracts-spectral.test.sh` (no `CONTRACTS_SPECTRAL_RULESET`) exits 0 and prints
   `PASS  contracts-spectral: ...`. Before the patch it exits 1 with
   `FAIL  contracts-spectral: idempotency-key-missing: ai-stylist-mutating-operation-has-idempotency-key does not report ...`.
3. `just lint` exits 0 and prints `@ai-stylist/contracts:lint: cache miss, executing` (the turbo
   input above), then spectral's "No results with a severity of 'warn' or higher found!".
4. `just format --check` and `just docs-check --strict` stay green; `just ci-parity --core` exits 0
   (it runs the tooling suite through `just test`).
