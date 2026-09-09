import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { MediaModule } from '../index.js';

describe('media module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [MediaModule] }).compile();
    expect(ref.get(MediaModule)).toBeInstanceOf(MediaModule);
    await ref.close();
  });
});
