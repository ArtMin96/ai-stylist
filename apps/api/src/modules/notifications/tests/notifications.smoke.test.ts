import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { NotificationsModule } from '../index.js';

describe('notifications module', () => {
  it('exposes a Nest module class from index.ts that compiles into a testing module', async () => {
    const ref = await Test.createTestingModule({ imports: [NotificationsModule] }).compile();
    expect(ref.get(NotificationsModule)).toBeInstanceOf(NotificationsModule);
    await ref.close();
  });
});
