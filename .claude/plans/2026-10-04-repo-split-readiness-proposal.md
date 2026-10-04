# Proposal: repo-split readiness (module and domain separation)

> Status: OPEN (2026-10-04), partly applied on PR #15. Do-now items 1, 4, 5, 7 and 8, the E
> registry for the error-shape constants and the D event gate are DONE (marked below); everything
> else is open. The owner asked that the codebase stay
> cleanly separated so it can later be split into separate repositories. This plan comes from an
> `architecture-reviewer` audit with a repo-split lens of branch `claude/project-next-steps-r6nu70`
> @ `16b9c30` (verdict APPROVE: that branch adds no boundary violation), followed by a lead review.
> Items marked **ADR** need a human decision recorded in `docs/adr/` and doc 16. Nothing here reopens
> a recorded decision without the evidence cited. SPINE §2 ("no microservices until measured need")
> still holds; this plan keeps the seams clean, it does not schedule a split.

## Proven blockers: decide before P03 adds its first domain table

### A. Home of the composed Drizzle schema and migrations (ADR-0008, draft)

- **Problem:** `packages/db/src/schema/index.ts:1-3`, `packages/db/README.md` and ADR-0001 plan to
  re-export each module's `apps/api/src/modules/<name>/internal/schema.ts` from `packages/db`.
  depcruise `public-api-only-external` (`tools/depcruise/rules.cjs:87-93`) rejects exactly that import.
  The reviewer ran the documented layout in a scratch copy against the real rules: exit 1. That layout
  would also make a shared package import app code, which blocks splitting either one off.
- **Options:**
  1. A one-path ADR exception to the rule.
  2. Move `packages/db` into `apps/api`. Its only users are the API and the seed CLI, and doc 06:292
     already says `apps/api/drizzle/`.
  3. One migration stream per module. This overrides doc 06:299.
- **Recommendation:** option 2. It puts database ownership in the API repository and weakens no rule.
  The `CLAUDE.md` layout line is human-only.

### B. No cross-module foreign keys (ADR-0009, draft)

- **Problem:** doc 06 §8 builds the deletion cascade "from the Drizzle FK graph". Foreign keys to
  `users` from every module cannot cross databases, so they would block one service per module.
- **Proposal:**
  - `user_id` is a typed `Id<'user'>` column with no foreign key.
  - Each module deletes its own rows through the event chain doc 06 §8 already defines.
  - A test checks that every module holding user rows registers a deletion step.
  - A migration lint rejects a cross-module `REFERENCES`.
  - This amends doc 06 §8 step 1.

## Do now (cheap, prevents drift)

1. **DONE (`c56fbaf`): a RuleTester suite runs all shared examples, 298 cases, under `just lint --fixtures`.** ESLint redaction rule vs the shared examples. Add a RuleTester test that runs every
   `forbidden-log-keys.examples.json` example through `tools/eslint/rules/no-log-request-body.mjs`.
   Today its fixture covers 2 keys. Owner: tooling-engineer.
2. **Python kernel emitter.** `gen-kernel.mjs` writes the forbidden words and examples into
   `workers/ml/generated/`. ml-engineer then deletes the hand copy in `redaction.py` and the
   repo-path read in `test_redaction.py`, which would fail collection outside the monorepo.
   Decision record: a DEC row extending DEC-55; ADR-0005 already names Python as a possible emitter.
3. **Worker HTTP contract in `packages/contracts`.** `apps/api/src/jobs/segmentation-client.ts` and
   `workers/ml/segmentation/.../schemas.py` define the same shapes by hand. Generate both from one
   schema. First settle whether `MaskLabel` restates the `closet` taxonomy.
4. **DONE (`b61c260`): resolved through the `@ai-stylist/contracts/events/*` export.** Seed-data test path. `packages/seed-data/tests/demo-event.test.ts:12` reads
   `../../contracts/events/` by path; use the `@ai-stylist/contracts/events/*` export.
5. **DONE (`9ed4262`): 18 fixtures, 17/17 rules caught; `check-fixtures.sh` now fails when a rule has none.** Missing arch-check fixtures. 10 of the 17 depcruise rules have no failing fixture, including
   `allowed-edges-only`, `modules-not-platform`, `platform-leaf`, `public-api-only-external` and
   `no-cycles`. Yet every module contract claims "every rule has a failing fixture". Add one fixture
   per rule. Owner: tooling-engineer.
6. **Make shared-kernel packable.** Add `registry` to `files` and `./registry/*` to `exports`. Tools
   then resolve the registry through the package instead of a repo path. This changes the lockfile,
   so a human must grant it.
7. **DONE (`7df23b7`, `cd8966f`): `--fail-on WARN` in both places; `packages/contracts/scripts/events-breaking.mjs` (package-relative, `pnpm run breaking:events`) wired through `scripts/ci/contracts-breaking.sh`.** One oasdiff threshold. `packages/contracts/package.json` uses `--fail-on WARN`,
   `scripts/ci/contracts-breaking.sh` uses `ERR`. Add a breaking-change gate for
   `packages/contracts/events/*.json`.
8. **DONE (`ae53a8a`).** Port list in the platform contract. `docs/modules/platform.md:91` should say that three ports
   move (`CLOCK`, `OUTBOX_WRITER`, `STORAGE_PROVIDER`) and that `HEALTH_PROBE` stays platform-internal.
   It imports `@ai-stylist/contracts/types`, which `shared-kernel-pure` forbids.

## Before the first split

- **C. Port homes.**
  - Generic ports (`CLOCK`, `OUTBOX_WRITER`, `STORAGE_PROVIDER`) go to `packages/shared-kernel`. Use
    `Symbol.for(...)` for their tokens so two installed copies still share one token.
    `STORAGE_PROVIDER` serves both `media` and `avatar`, and §4.1 has no avatar→media edge.
  - Domain-capability ports (weather, holidays, push, billing provider) go in the owning module's
    `index.ts`, so they travel with that module.
  - `InMemoryStorageProvider` moves to `platform/storage/`, with a module-test fake in
    `packages/test-support`.
  - Narrow `PLATFORM_PORTS` / `dev-ports-only` in the same PR.
- **D. Contracts + shared-kernel as one versioned artifact.**
  - Needs a JS + `.d.ts` build; today packages ship `.ts` source and `apps/api` compiles with
    `rootDir: "../.."`.
  - The event-schema compatibility gate exists (do-now item 7) and is package-relative, so it travels with the package.
  - Per platform: a SwiftPM release repo or artifact (the local-path dependency in
    `apps/ios/Packages/Core/Package.swift`), a Maven publication (replacing Android `srcDir`
    includes), and a Python wheel.
- **E. Shared worker observability package.** Extract `workers/ml/observability` (`redaction`,
  `tracing`, `correlation`) before a second worker service exists. Otherwise each new service copies
  it, as `.claude/rules/workers-python.md` rule 6 currently says. The error-shape constants
  are DONE: `packages/shared-kernel/registry/log-redaction.json` (`LOG_REDACTION_RULES` /
  `LOG_REDACTION_EXAMPLES`) is read by the API and pinned by worker tests. Still open: the span
  attribute lists in `tracing.py` / `span-sanitizer.ts`.
- **F. Native repo layout (ADR).** `tools/analytics/check-events.mjs` and `e2e/smoke.yaml` check both
  apps together. Separate repositories would need the event taxonomy and the Maestro flows published
  from the contracts repository.
- **G. Tooling that assumes one repository.** The `justfile`, the single root `.env` (read by the API,
  the worker, `packages/db` and the seed CLI), `mise.toml`, CI path filters, docs-check's module
  bijection and the `.claude` / `.agents` layer. Each needs a per-repo copy or a versioned tooling
  package. Also some tests read across areas by path: `contracts/tests/kernel-registries.test.ts`,
  `platform/tests/metrics-catalog.test.ts` (reads `docs/observability`), and the storage tests that
  import `apps/api/src/config.ts`.
- **H. Segmentation client.** When `media` starts consuming segmentation (P06), move the client's
  port to `media/index.ts` and its adapter out of `jobs/` into `platform`.

## Fine as is

- `ALLOWED_EDGES` matches doc 04 §4.1 edge for edge. No module reaches platform or another module's
  internals, and all 13 module `index.ts` files import only `@nestjs/common`.
- shared-kernel purity; one generic outbox port with routing in `jobs/queues.ts`; codegen never
  writes into `apps/ios` or `apps/android`; `owners.json` and feature flags in shared-kernel
  (ADR-0007).
- The storage port's `userId` (added on this branch after the audit, following doc 11 §4.3 and §13.2):
  - The port builds `u/<userId>/<namespace>/<key>`, so per-user deletion lists exactly one prefix.
  - The caller still makes the authorization decision about which user it acts for. The port enforces
    only the storage layout.
  - It depends only on shared-kernel's `Id<'user'>`, which travels with any split.

## Doc conflicts escalated (human)

Also tracked, with doc 11:229 added, in section C of `2026-10-04-human-applied-followups-proposal.md`.

- `planning/04-architecture.md:426` (§10) lists `outfit` among the assistant's services; §4.1 and
  `rules.cjs:47` exclude it.
- `planning/SPINE.md:35` still says PostgreSQL 17 after DEC-56.
- `planning/06-data-api-and-event-contracts.md:292` names `apps/api/drizzle/`, which does not exist
  (and is the target of option A2).
