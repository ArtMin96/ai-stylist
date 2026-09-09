import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { BillingModule } from '../index.js';

describe('billing module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [BillingModule] }).compile();
    expect(ref.get(BillingModule)).toBeInstanceOf(BillingModule);
    await ref.close();
  });
});
