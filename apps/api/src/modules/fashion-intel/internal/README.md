# fashion-intel/internal

Implementation of the `fashion-intel` module: application services, domain rules, Drizzle
`schema.ts` (re-exported from `packages/db/src/schema/index.ts`), repositories, mappers.
Nothing here may be imported from outside `modules/fashion-intel/`; expose behaviour through
`../index.ts` only. Contract: `docs/modules/fashion-intel.md`.
