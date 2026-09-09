import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ContextModule } from '../index.js';

describe('context module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [ContextModule] }).compile();
    expect(ref.get(ContextModule)).toBeInstanceOf(ContextModule);
    await ref.close();
  });
});
