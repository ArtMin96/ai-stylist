# @ai-stylist/seed-data

Synthetic fixtures and factories for local seeding and tests.

**Never real user data.** Every value comes from a seeded `@faker-js/faker` instance
(`syntheticRandom(seed)`), so the same seed reproduces the same rows. Do not copy production
records, screenshots, exports, or "anonymised" dumps into this package — root `CLAUDE.md`
"Security and privacy rules".

- `demoEvent()` — a valid `demo.outbox-flow.requested.v1` envelope, validated against
  `packages/contracts/events/*.json` in `tests/`.
- `scripts/seed.ts` — `just db-seed`: inserts one pending demo row into `platform_outbox` at
  `DATABASE_URL` (env or repo-root `.env`; run `just db-migrate` first). Each run uses a fresh
  seed, so repeated runs add rows. `--accounts N` is accepted but ignored until `identity` ships
  its factories. `just db-reset --yes` runs it after migrating.
