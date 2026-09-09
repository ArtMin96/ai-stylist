import { Faker, base, en } from '@faker-js/faker';
import { ulid } from 'ulid';

import { formatId, type Id, type IdKind } from '@ai-stylist/shared-kernel';

export const DEFAULT_SEED = 20260910;
/** Fixed "now" for date factories so output never depends on the wall clock. */
export const DEFAULT_REF_DATE = '2026-09-10T12:00:00.000Z';

/** Deterministic source of synthetic values: same seed ⇒ same sequence of factories. */
export type SyntheticRandom = {
  readonly faker: Faker;
  /** Reference instant for relative date factories (`faker.date.recent({ refDate })`). */
  readonly refDate: Date;
  /** Prefixed ULID whose random part comes from the seeded RNG (sortable, reproducible). */
  id<K extends IdKind>(kind: K, at?: Date): Id<K>;
};

export function syntheticRandom(
  seed: number = DEFAULT_SEED,
  refDate: Date | string = DEFAULT_REF_DATE,
): SyntheticRandom {
  const faker = new Faker({ locale: [en, base] });
  faker.seed(seed);
  const prng = () => faker.number.float({ min: 0, max: 1 });
  return {
    faker,
    refDate: new Date(refDate),
    id: (kind, at) => formatId(kind, ulid(at?.getTime(), prng)),
  };
}
