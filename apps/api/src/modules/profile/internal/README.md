# profile/internal

Implementation of the `profile` module: application services, domain rules, Drizzle
`schema.ts` (re-exported from `packages/db/src/schema/index.ts`), repositories, mappers.
Nothing here may be imported from outside `modules/profile/`; expose behaviour through
`../index.ts` only. Contract: `docs/modules/profile.md`.
P02 skeleton: only this README so far (`../index.ts` exports an empty Nest module).
