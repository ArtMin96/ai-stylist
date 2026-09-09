import { describe, expect, it } from 'vitest';

import { ERROR_CODES, type ErrorCode, PROBLEM_TYPE_BASE, problem } from '../src/index.js';

describe('problem()', () => {
  it('builds an RFC 9457 body from the registry entry', () => {
    expect(problem('NOT_FOUND')).toEqual({
      type: `${PROBLEM_TYPE_BASE}/NOT_FOUND`,
      title: 'Not found',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('applies overrides but keeps the code', () => {
    const p = problem('VALIDATION_FAILED', {
      detail: 'height must be positive',
      instance: '/v1/me/profile',
      errors: [{ pointer: '/measurements/height/value', message: 'must be > 0' }],
    });
    expect(p.code).toBe('VALIDATION_FAILED');
    expect(p.status).toBe(400);
    expect(p.errors).toHaveLength(1);
    expect(p.instance).toBe('/v1/me/profile');
  });

  it('registry statuses are valid HTTP error statuses', () => {
    for (const code of Object.keys(ERROR_CODES) as ErrorCode[]) {
      const { status } = ERROR_CODES[code];
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
      expect(problem(code).status).toBe(status);
    }
  });

  it('includes the codes doc 06 §2 names', () => {
    expect(ERROR_CODES).toHaveProperty('CLOSET_LIMIT_REACHED');
    expect(ERROR_CODES).toHaveProperty('ENTITLEMENT_REQUIRED');
    expect(ERROR_CODES).toHaveProperty('CONTEXT_STALE');
  });
});
