# ADR-0010 — P00 ratification of the decision log

- **Status:** Proposed
- **Date:** 2026-10-09
- **Deciders:** product owner
- **Decision-log entry:** DEC-68 in [16-risks-open-questions-and-decision-log.md](../../planning/16-risks-open-questions-and-decision-log.md)
- **Related:** NFR-TEAM-110 · P00-T01 and P00 AC-1 in [P00](../../planning/phases/P00-product-validation-and-decisions.md) · phase P00

## Context

P00-T01 planned 33 ADR files in `planning/adr/`, one for each of DEC-01…DEC-33. Since then P02 created `docs/adr/` and used numbers 0001–0007, eight of the 33 decisions were superseded (DEC-03, 04, 12, 14, 17, 23, 27, 30), and the log grew past DEC-59. NFR-TEAM-110 asks for an ADR template and a decision log seeded with every SPINE decision. Both exist. What is missing is the product owner's formal ratification of the log.

## Options considered

| Option                                                                 | Pros                                                                                  | Cons                                                                       | Evidence (primary source + as-of date) |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| A (chosen): one ratification ADR; doc 16 stays the per-decision record | No decision is written twice, so nothing can drift; one sign-off covers the whole log | P00 AC-1 changes                                                           | Doc 16 decision log (2026-10-09)       |
| B: one ADR per standing decision not yet named in ADR-0001–0007        | Per-decision files for the live set                                                   | About 15 files that restate doc 16 rows and go stale when a row is amended | `docs/adr/` (2026-10-09)               |
| C: 33 ADRs as P00-T01 is written                                       | Matches the original plan                                                             | Includes 8 superseded decisions; the most duplication                      | P00 §12 (2026-08-24)                   |

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
