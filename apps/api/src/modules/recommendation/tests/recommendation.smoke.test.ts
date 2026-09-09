import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { RecommendationModule } from '../index.js';

describe('recommendation module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [RecommendationModule] }).compile();
    expect(ref.get(RecommendationModule)).toBeInstanceOf(RecommendationModule);
    await ref.close();
  });
});
