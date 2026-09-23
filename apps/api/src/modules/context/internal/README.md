# context/internal

Implementation of the `context` module: application services, domain rules, Drizzle
`schema.ts` (re-exported from `packages/db/src/schema/index.ts`), repositories, mappers.
Nothing here may be imported from outside `modules/context/`; expose behaviour through
`../index.ts` only. Contract: `docs/modules/context.md`.
P02 skeleton: only this README so far (`../index.ts` exports an empty Nest module).
