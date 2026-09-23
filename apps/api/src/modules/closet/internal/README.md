# closet/internal

Implementation of the `closet` module: application services, domain rules, Drizzle
`schema.ts` (re-exported from `packages/db/src/schema/index.ts`), repositories, mappers.
Nothing here may be imported from outside `modules/closet/`; expose behaviour through
`../index.ts` only. Contract: `docs/modules/closet.md`.
P02 skeleton: only this README so far (`../index.ts` exports an empty Nest module).
