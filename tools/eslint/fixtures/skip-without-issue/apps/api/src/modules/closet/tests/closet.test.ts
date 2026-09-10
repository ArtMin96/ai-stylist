// FIXTURE: violates no-skip-without-issue — `it.skip` whose title carries no issue ID.
declare const it: { skip(name: string, fn: () => void): void };

it.skip('ranks garments by warmth', () => {
  // no issue ID in the title
});
