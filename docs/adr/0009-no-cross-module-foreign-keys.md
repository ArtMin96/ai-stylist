# ADR-0009 — No cross-module foreign keys

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** owner (human choice between options A–C, 2026-10-09 session); BE
- **Decision-log entry:** DEC-67 in [16-risks-open-questions-and-decision-log.md](../../planning/16-risks-open-questions-and-decision-log.md)
- **Related:** doc 06 §8 (deletion propagation) · `.claude/plans/2026-10-04-repo-split-readiness-proposal.md` §B · phase P03

## Context

P03 adds the first domain tables. Doc 06 §8 step 1 builds the account-deletion cascade "from the Drizzle FK graph", which assumes that every module's tables hold a foreign key to `users`. Modules may import each other only through their public API (`CLAUDE.md`, `just arch-check`); a foreign key into another module's table couples two modules at the schema level, below that rule. Foreign keys also cannot cross databases, so they would block moving a module to its own service later (repo-split readiness audit, 2026-10-04). The rule has to exist before the first table, because removing foreign keys later costs one migration per table.

## Options considered

| Option                                               | Pros                                                                                                                                | Cons                                                                                                 | Evidence (primary source + as-of date)         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| A (chosen): no foreign key crosses a module boundary | Module boundaries hold at the data layer; a later split stays possible; deletion is already event-driven for R2, providers and jobs | The database no longer guarantees cleanup; a module that misses its deletion step leaves orphan rows | Repo-split proposal §B (2026-10-04); doc 06 §8 |
| B: foreign keys to `users` only                      | The database guarantees cleanup of user rows                                                                                        | Every module stays tied to `identity`'s table and to one database; a standing exception              | Owner question round, 2026-10-09               |
| C: foreign keys everywhere                           | Simplest; the cascade comes from the FK graph, as doc 06 is written                                                                 | Schema-level coupling between modules; blocks a split                                                | Doc 06 §8 step 1 (2026-08-24)                  |

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
