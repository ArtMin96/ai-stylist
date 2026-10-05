# Proposal: human-applied text from the 2026-10-04 session (PR #15)

> Status: PARTLY APPLIED (2026-10-05, on PR #15, at the owner's request "apply all"). Applied: A, B,
> C (doc 04 §10 and doc 11 §13.1 amended; doc 06:292 stays with A), D, E, E2, F and the G decisions
> (APP_ENV required, in-process signer kept, AI-21 ACs amended, `MaskLabel` owned by the worker
> contract until P06-T01). Not applied, because the path guard denies agents these files and the
> owner must paste them: `planning/SPINE.md:35` (PostgreSQL 17 → 18, DEC-56) and E3
> (`.github/workflows/pr-gate.yml:122` step name). The descriptive text in `workers/ml/generated/`
> (its README, `pyproject.toml` description and package `__init__.py` docstring) still predates the
> kernel and worker-contract emitters; it is guard-protected generated-tree metadata, so the owner
> (or the generator's next edit) updates it. Original text below: These are the exact edits that agents
> may not make: files that are human-only per `.claude/rules/human-only.md`, or the enforcement layer
> (`.agents/**`, `.claude/rules/**`, `scripts/hooks/**`). They came out of the PR #15 work: P02-T13,
> the PR #13 review fixes and the repo-split audit. Each edit says where it goes and why. The
> repo-split decisions (ADR-0008, ADR-0009, the DEC-55 extension) are in
> `2026-10-04-repo-split-readiness-proposal.md`, not repeated here.

## A. `docs/SERVICES-SETUP.md` §6 (R2), human-only

1. **Keys list, around line 334.** Append to the `.env.example` keys bullet:
   "; `R2_LIVE_TEST` (machine-local opt-in for the live test suite, empty by default)".
2. **Verify step, around line 345.** Replace the paragraph that begins "No repo command exists until
   P02-T13 lands …" with:

   > With the four `R2_*` keys in `.env` (`just secrets-sync`; direnv loads them), run
   > `R2_LIVE_TEST=1 just test platform`. The suite
   > `apps/api/src/platform/tests/r2-storage.live.sec.test.ts` checks presigned PUT and GET against
   > the configured bucket: a signed upload succeeds, and R2 refuses another content type, another
   > size, an edited URL, another user's prefix and an expired URL. It overwrites one synthetic object
   > under `u/usr_0000000000000000000000TEST/`. Without `R2_LIVE_TEST=1` it is skipped. It refuses to
   > run with `APP_ENV` staging or prod. Paste one run on Linear AI-21.

## B. `planning/phases/P06-closet-capture-pipeline.md`, human-only

The platform storage port deliberately leaves the business rules for uploads to `media`
(`docs/modules/platform.md` invariant 19, `apps/api/src/platform/storage/README.md`). P06 has no
criterion that enforces them yet. Add to P06-T02's acceptance:

> `media` enforces the doc 11 §5.5 content-type allowlist (JPEG/PNG/HEIC) and maximum size before it
> requests a presigned PUT, and passes the exact client-declared size (a presigned PUT signs an exact
> `content-length`). `*.sec.test.ts` covers the wrong-type and over-size cases, plus "user A's URL
> used by user B after account deletion" (doc 11 §5.4). Workers fetch originals with HTTP
> decompression disabled (R2's handling of an unsigned `Content-Encoding` is not verified).

## C. Planning doc conflicts found by the audit, human-only

- `planning/04-architecture.md:426` (§10) lists `outfit` among the assistant's services, but §4.1
  and `tools/depcruise/rules.cjs:47` exclude it. Decide which is right and fix the other.
- `planning/SPINE.md:35` still says PostgreSQL 17 after DEC-56 (PostgreSQL 18).
- `planning/06-data-api-and-event-contracts.md:292` names `apps/api/drizzle/`, which does not exist.
  This resolves with ADR-0008.
- `planning/11-security-privacy-and-compliance.md:229`: the export is delivered by a 24 h signed URL,
  but §5.4 (and the storage port) cap GET URLs at 600 s. Pick one before the P03 export job; an
  amendment or an ADR.

## D. `.agents/skills/observability-analytics/references/opentelemetry.md`, enforcement layer

- **"What the span sanitizer does, in both languages" list.** Add:
  - "applies the attribute rule to every event's and every link's attributes (link ids kept) and to
    the process resource, sanitized once where it is built;"
  - "cuts every string of an array-valued URL attribute;"
  - "cuts the span name and every event name at the first `?` or `#`;"
  - "keeps `exception.type` only when it is name-shaped or code-shaped, else writes `Error`."
- **Logs row (around line 194).** Replace with: "allowlist serializers for request and response; the
  forbidden-key denylist at any depth; `msg` limited to the caller's own string (`hooks.logMethod`,
  interpolation arguments and non-string first arguments dropped); a Nest `Logger` context kept only
  when name-shaped; `childLogger` for child-logger bindings (redact paths only as a backstop for a raw
  `.child()`). Worker: a structlog processor chain with the same word list, pinned to the registry by
  a test; positional arguments dropped; a logged exception is `err: {type, code?, cause?}` only
  (`summarize_exc_info`)."

## E. `.claude/rules/contracts.md:17-18` and `.agents/skills/api-contract-change/SKILL.md:69`, enforcement layer

- **`.claude/rules/contracts.md:17-18`.** Replace with: "The pr-gate also runs spectral, oasdiff
  (`--fail-on WARN`) and the event-schema breaking check
  (`packages/contracts/scripts/events-breaking.mjs`) through `scripts/ci/contracts-spectral.sh` and
  `scripts/ci/contracts-breaking.sh`."
- **`api-contract-change/SKILL.md:69`.** After "…runs `scripts/ci/contracts-breaking.sh` against the
  PR base", add: ": oasdiff at `--fail-on WARN` plus the event-schema check, which needs a new
  `.vN+1` schema for any removed, newly required or retyped field, removed enum value or tightened
  `additionalProperties`."

## E2. TS-only registry lists, enforcement layer

`packages/shared-kernel/registry/log-redaction.json` is a new TS-only registry (like forbidden-log-keys).
- `.claude/rules/contracts.md` invariant 4: read "The forbidden-log-keys, log-redaction, owners and
  feature-flags registries there are TS-only …".
- `.agents/skills/api-contract-change/SKILL.md` line 86: read "plus the TS-only forbidden-log-keys,
  log-redaction, owners and feature-flags registries".
- `.claude/agents/contracts-engineer.md` `<context>`: add `log-redaction.json` with
  `packages/shared-kernel/src/log-redaction.ts` to the TS-only registry list.

## E3. `.github/workflows/pr-gate.yml:122`, human-applied

Rename the step to "Verify · No breaking changes against the base branch (oasdiff + event schemas)".

## F. `scripts/hooks/post-edit-lint.sh`, enforcement layer

- **Problem.** In a cloud container whose proxy blocks the GitHub API, this hook fails on every edit:
  it runs `just lint-file`, mise tries to install pnpm from GitHub and gets a 403. The edit still
  applies, but the hook output is noise and real lint failures are hidden.
- **Fix.** Export `MISE_OFFLINE=1` (and `MISE_AUTO_INSTALL=0`) in the hook before it calls `just`, so
  it uses the installed tools or reports a missing one clearly.

## G. Owner decisions (no text to paste)

- **`APP_ENV` default.** `apps/api/src/config.ts` defaults to `local`, so with both `NODE_ENV` and
  `APP_ENV` unset the dev routes are enabled, which contradicts the "fail closed" comment in
  `apps/api/src/dev/index.ts`. The option is to drop the default; `just bootstrap` already fills in
  `APP_ENV`.
- **AI-21 deviations.**
  - **Signer.** Keep the in-process SigV4 signer or switch to `@smithy/signature-v4`. To switch:
    `pnpm --filter @ai-stylist/api add @smithy/signature-v4@^5.7.4`, then add `@smithy` to
    `PROVIDER_SDKS` in `tools/depcruise/rules.cjs` and `tools/eslint/boundaries.mjs`.
  - **Recorded fixtures.** Accept the fake S3 plus the live suite in place of recorded R2 fixtures.
- **`MaskLabel` taxonomy.** The segmentation worker and API client define garment labels that
  `closet` should own. Decide the owner before the worker HTTP schemas move to `packages/contracts`
  (split proposal, do-now item 3).
