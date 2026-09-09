import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AdminModule } from '../index.js';

describe('admin module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [AdminModule] }).compile();
    expect(ref.get(AdminModule)).toBeInstanceOf(AdminModule);
    await ref.close();
  });
});
