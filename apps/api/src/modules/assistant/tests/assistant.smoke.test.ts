import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AssistantModule } from '../index.js';

describe('assistant module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [AssistantModule] }).compile();
    expect(ref.get(AssistantModule)).toBeInstanceOf(AssistantModule);
    await ref.close();
  });
});
