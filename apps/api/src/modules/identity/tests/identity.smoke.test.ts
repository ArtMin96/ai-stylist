import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { IdentityModule } from '../index.js';

describe('identity module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [IdentityModule] }).compile();
    expect(ref.get(IdentityModule)).toBeInstanceOf(IdentityModule);
    await ref.close();
  });
});
