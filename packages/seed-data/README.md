# @ai-stylist/seed-data

Synthetic fixtures and factories for local seeding and tests.

**Never real user data.** Every value comes from a seeded `@faker-js/faker` instance
(`syntheticRandom(seed)`), so the same seed reproduces the same rows. Do not copy production
records, screenshots, exports, or "anonymised" dumps into this package — root `CLAUDE.md`
"Security and privacy rules".

- `demoEvent()` — a valid `demo.outbox-flow.requested.v1` envelope, validated against
  `packages/contracts/events/*.json` in `tests/`.
- `scripts/seed.ts` — `just db-seed`: inserts one demo outbox row into `DATABASE_URL`.
