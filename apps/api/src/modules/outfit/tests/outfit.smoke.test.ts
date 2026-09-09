import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { OutfitModule } from '../index.js';

describe('outfit module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [OutfitModule] }).compile();
    expect(ref.get(OutfitModule)).toBeInstanceOf(OutfitModule);
    await ref.close();
  });
});
