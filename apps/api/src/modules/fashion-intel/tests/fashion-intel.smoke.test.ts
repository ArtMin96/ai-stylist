import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { FashionIntelModule } from '../index.js';

describe('fashion-intel module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [FashionIntelModule] }).compile();
    expect(ref.get(FashionIntelModule)).toBeInstanceOf(FashionIntelModule);
    await ref.close();
  });
});
