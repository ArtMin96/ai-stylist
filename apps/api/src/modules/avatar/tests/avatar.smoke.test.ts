import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AvatarModule } from '../index.js';

describe('avatar module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [AvatarModule] }).compile();
    expect(ref.get(AvatarModule)).toBeInstanceOf(AvatarModule);
    await ref.close();
  });
});
