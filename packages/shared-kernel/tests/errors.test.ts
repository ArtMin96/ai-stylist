import { describe, expect, expectTypeOf, it } from 'vitest';

import errorCodesJson from '../registry/error-codes.json' with { type: 'json' };
import { ERROR_CODES, type ErrorCode, PROBLEM_TYPE_BASE, problem } from '../src/index.js';

describe('error codes come from registry/error-codes.json', () => {
  it('codes, with status, title and description, in order', () => {
    expect(ERROR_CODES).toEqual(errorCodesJson.codes);
    expect(Object.keys(ERROR_CODES)).toEqual(Object.keys(errorCodesJson.codes));
  });

  it('ErrorCode stays the union of the registered codes, not string', () => {
    expectTypeOf<'NOT_FOUND'>().toExtend<ErrorCode>();
    expectTypeOf<string>().not.toExtend<ErrorCode>();
  });
});

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

  it('has a 415 code of its own, so an unsupported Content-Type is not a 400 validation failure', () => {
    expect(problem('UNSUPPORTED_MEDIA_TYPE')).toEqual({
      type: `${PROBLEM_TYPE_BASE}/UNSUPPORTED_MEDIA_TYPE`,
      title: 'Unsupported media type',
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('includes the codes doc 06 §2 names', () => {
    expect(ERROR_CODES).toHaveProperty('CLOSET_LIMIT_REACHED');
    expect(ERROR_CODES).toHaveProperty('ENTITLEMENT_REQUIRED');
    expect(ERROR_CODES).toHaveProperty('CONTEXT_STALE');
  });

  it('includes the P03 codes: a terminal age refusal, a missing consent, a refused measurement', () => {
    expect(ERROR_CODES).toMatchObject({
      AGE_GATE_FAILED: { status: 403, title: 'Minimum age not met' },
      CONSENT_REQUIRED: { status: 403, title: 'Consent required' },
      MEASUREMENT_IMPLAUSIBLE: { status: 400, title: 'Measurement outside the accepted range' },
    });
    expect(ERROR_CODES.CONSENT_REQUIRED.status).toBe(ERROR_CODES.ENTITLEMENT_REQUIRED.status);
    expect(ERROR_CODES.MEASUREMENT_IMPLAUSIBLE.status).toBe(ERROR_CODES.VALIDATION_FAILED.status);
  });
});
