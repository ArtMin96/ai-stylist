import { describe, expect, it } from 'vitest';

import { isLocalDatabaseUrl } from '../src/local-url.js';

describe('isLocalDatabaseUrl (db-reset guard)', () => {
  it.each([
    'postgres://ai_stylist:ai_stylist@localhost:5432/ai_stylist',
    'postgresql://u:p@127.0.0.1/db',
    'postgres://u:p@[::1]:5433/db',
  ])('accepts %s', (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it.each([
    'postgres://u:p@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require',
    'postgres://u:p@localhost.evil.example/db',
    'postgres://u:p@10.0.0.5/db',
    'mysql://u:p@localhost/db',
    'not a url',
    '',
  ])('refuses %s', (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });
});
