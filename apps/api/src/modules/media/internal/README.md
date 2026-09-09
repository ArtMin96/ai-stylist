# media/internal

Implementation of the `media` module: application services, domain rules, Drizzle
`schema.ts` (re-exported from `packages/db/src/schema/index.ts`), repositories, mappers.
Nothing here may be imported from outside `modules/media/`; expose behaviour through
`../index.ts` only. Contract: `docs/modules/media.md`.
