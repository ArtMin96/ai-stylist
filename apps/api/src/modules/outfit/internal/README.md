# outfit/internal

Implementation of the `outfit` module: application services, domain rules, Drizzle
`schema.ts` (re-exported from `packages/db/src/schema/index.ts`), repositories, mappers.
Nothing here may be imported from outside `modules/outfit/`; expose behaviour through
`../index.ts` only. Contract: `docs/modules/outfit.md`.
P02 skeleton: only this README so far (`../index.ts` exports an empty Nest module).
