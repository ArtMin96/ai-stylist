import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ProfileModule } from '../index.js';

describe('profile module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [ProfileModule] }).compile();
    expect(ref.get(ProfileModule)).toBeInstanceOf(ProfileModule);
    await ref.close();
  });
});
