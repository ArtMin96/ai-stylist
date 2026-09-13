Fill every section; delete nothing; if a section truly does not apply write `N/A — <reason>`.

- **Phase / task:** P##-T## · **Requirements:** REQ/NFR IDs
- **Type:** migration · **Skill:** `.agents/skills/db-migration/SKILL.md` (owns `packages/db/migrations/` and `modules/<name>/internal/schema.ts`)
- **Labels:** `type:migration`, `mod:<owner>`, `phase:P##`

## Context

Which feature needs the new shape and why now. Link the phase task, doc 06 (`planning/06-data-api-and-event-contracts.md`, expand → migrate → contract policy), and the module contract's data-ownership section.

<Need: <…>. Links: `planning/phases/P##-*.md` §T## · doc 06 §<n> · `docs/modules/<name>.md` · ADR-NNNN>

## Scope

Tables/columns/indexes (incl. pgvector) in one owning module's `internal/schema.ts`. A change spanning two modules' tables is a data-ownership question first.

- In scope: <tables, columns, indexes, constraints>
- Out of scope: <wire shape (→ Contract change), repository/query code (→ backend-module issue)>
- Non-goals: <…>

## Expand step / Contract step

Additive change deployable before the code that uses it; drop / NOT NULL / type narrowing only in a later migration after no code reads the old shape.

- Expand (this issue): <add nullable column / new table / new index CONCURRENTLY>
- Code cut-over: <issue ID that starts reading/writing the new shape>
- Contract (separate later issue, needs explicit human authorization): <drop / NOT NULL / rename — issue ID or `N/A — purely additive`>

## Down file

Every migration ships its rollback; classify it honestly.

- Down file path: `packages/db/migrations/<…>.down.sql` (or drizzle equivalent)
- Rollback class: <safe (no data loss) | lossy — detail: <what is lost>>
- Proven with `just db-rollback` on: <local | scratch database restored from the staging backup — run link>

## Data backfill

Idempotent, batched, resumable; never a single UPDATE on a live table.

- Backfill needed: <no | yes — script `<path>`, batch size <n>, resume key <…>, idempotency note <…>>
- Volume estimate + runtime: <rows, minutes> · Runs as: <pg-boss job | one-off script with human trigger>

## Scratch-database test

Staging apply runs first on a scratch database restored from the latest staging backup (`docs/SERVICES-SETUP.md` §3) via the affected-module CI lane. Region choice is gated by P00 / OQ-07 — do not pick one here.

- Scratch-database run: <link | `OPEN — waiting on OQ-07 region memo`> · Local Testcontainers run: `just test <module>` → `<…>`

## Modules touched

- Owning module (schema file): <name> · Composed entry `packages/db/`: <touched? yes/no> · Single-writer packages: <lockfiles? none>

## Acceptance criteria

1. AC-1: migration applies on empty and on seeded DB — proof: `just db-reset` then `just db-migrate` → `<applied N migrations>`
2. AC-2: rollback works — proof: `just db-rollback --yes` → `<rolled back …>`, then `just db-migrate` again clean
3. AC-3: schema matches drizzle definition — proof: drizzle-kit check in `just typecheck` / `just test <module>` → `<no drift>`
4. AC-4: integration tests (Testcontainers Postgres + pgvector) pass — proof: `just test <module>` → `<n passed>`

## Architecture guardrails

- [ ] Table definitions live only in `apps/api/src/modules/<name>/internal/schema.ts`; composed in `packages/db/`; not imported by other modules (public API only via `index.ts`)
- [ ] No domain logic in DB models; no provider SDK types in the schema
- [ ] Enumerations/units/reason codes referenced from `shared-kernel`, never re-declared as DB enums without the registry as source
- [ ] Naming, IDs (UUIDv7, no sequential IDs in URLs), timestamps, soft-delete and deletion-propagation rules follow doc 06 / doc 11 §13
- [ ] `recommendation` tables carry reason traces (explanations from the decision trace)
- [ ] Destructive statements (DROP, TRUNCATE, narrowing) require explicit human authorization with the exact SQL — never agent-initiated
- [ ] `just arch-check` and `just lint --fixtures` stay green

## Search-before-write

Existing table/column that already stores this? Existing fixture/factory to extend?

- Behaviour in one sentence: <…>
- Candidates checked: `<schema.ts / table>` — reused / extended / does not fit because <…>

## Data, security, privacy

- Sensitive columns added (doc 11 §6 class): <measurements | selfies/face | photos | precise location | wardrobe history | tokens | none> → at-rest encryption / column-level restrictions: <…>
- Deletion cascade (doc 11 §13.2) updated for the new table/column: <yes — how | N/A>
- Logging: new columns added to the forbidden-field list if sensitive: <…> · New env keys (`.env.example`): <none | KEY>
- `security-privacy-review` skill required: <yes — sensitive column | no — reason>

## Risks and rollback

- Blast radius: <locks, table size, downtime risk, index build time>
- Kill switch: <code behind flag until migration verified | N/A>
- Rollback steps: `just db-rollback --yes` (down file above) → revert PR #… → <data recovery note if lossy>

## Test plan

- Integration (Testcontainers): `apps/api/src/modules/<name>/tests/` — migrate up, seed, query, roll back
- Fixtures/factories from `packages/seed-data` / `packages/test-support` updated (synthetic only): <…>
- Skips: none, or `<test> — issue <ID>`

## Dependencies / blocked by

- Contract change issue (wire shape): <ID | N/A> · Module code issue (consumer): <ID>
- Staging PostgreSQL (`docs/SERVICES-SETUP.md` §3): <ready | blocked by P00 / OQ-07>

## Definition of done

- [ ] Up + down applied and rolled back with pasted output (local; scratch database when available)
- [ ] Backfill script idempotent and reviewed, or `N/A`; sensitivity note in PR
- [ ] `just test <module>` · `just lint` · `just typecheck` · `just arch-check` green; `just ci-parity` green before PR
- [ ] Contract step tracked as a separate issue with human authorization noted
- [ ] `docs/modules/<name>.md` data-ownership section + `PROGRESS.md` updated
- [ ] `db-migration` skill followed; PR uses `templates/pull-request.md`; human review
