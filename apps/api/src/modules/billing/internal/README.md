# billing/internal

Implementation of the `billing` module: application services, domain rules, Drizzle
`schema.ts` (re-exported from `packages/db/src/schema/index.ts`), repositories, mappers.
Nothing here may be imported from outside `modules/billing/`; expose behaviour through
`../index.ts` only. Contract: `docs/modules/billing.md`.
