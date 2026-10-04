import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { PROBLEM_TYPE_BASE } from '@ai-stylist/shared-kernel';

import { toProblem } from '../problem.filter.js';

describe('toProblem', () => {
  it('maps HttpException status to the registry code and keeps the detail', () => {
    expect(toProblem(new NotFoundException('no such thing'), '/v1/x')).toEqual({
      type: `${PROBLEM_TYPE_BASE}/NOT_FOUND`,
      title: 'Not found',
      status: 404,
      code: 'NOT_FOUND',
      instance: '/v1/x',
      detail: 'no such thing',
    });
  });

  it('carries object responses as detail + extension members', () => {
    const p = toProblem(
      new BadRequestException({ detail: 'bad', errors: [{ pointer: '/a', message: 'x' }] }),
      '/',
    );
    expect(p.code).toBe('VALIDATION_FAILED');
    expect(p.detail).toBe('bad');
    expect(p['errors']).toEqual([{ pointer: '/a', message: 'x' }]);
  });

  it('maps a non-HttpException with a 4xx statusCode by status, without its message', () => {
    const p = toProblem(Object.assign(new Error('slow down'), { statusCode: 429 }), '/');
    expect(p).toEqual({
      type: `${PROBLEM_TYPE_BASE}/RATE_LIMITED`,
      title: 'Too many requests',
      status: 429,
      code: 'RATE_LIMITED',
      instance: '/',
    });
  });

  // A provider SDK's HTTP error (status 403) can quote the presigned URL it was given, signature
  // included: only an HttpException or a known Fastify request error may carry a `detail`.
  it('never echoes the message of a non-HttpException 4xx (a provider error quoting a signed URL)', () => {
    const message = 'https://x/y?X-Amz-Signature=CANARY';
    for (const thrown of [
      { status: 403, message },
      Object.assign(new Error(message), { status: 403 }),
      Object.assign(new Error(message), { statusCode: 403, code: 'AccessDenied' }),
      Object.assign(new Error(message), { statusCode: 400, code: 'FST_ERR_NOT_ALLOWLISTED' }),
    ]) {
      const p = toProblem(thrown, '/v1/x');
      expect(p).not.toHaveProperty('detail');
      expect(JSON.stringify(p)).not.toContain('CANARY');
    }
  });

  it('keeps the fixed detail of a known Fastify request error, never its message', () => {
    const spoofed = Object.assign(new Error('https://x/y?X-Amz-Signature=CANARY'), {
      code: 'FST_ERR_CTP_INVALID_JSON_BODY',
      statusCode: 400,
    });
    expect(toProblem(spoofed, '/v1/x')).toEqual({
      type: `${PROBLEM_TYPE_BASE}/VALIDATION_FAILED`,
      title: 'Request validation failed',
      status: 400,
      code: 'VALIDATION_FAILED',
      instance: '/v1/x',
      detail: "Body is not valid JSON but content-type is set to 'application/json'",
    });
  });

  it('maps 415 (Fastify: unsupported request content type) to UNSUPPORTED_MEDIA_TYPE', () => {
    const unsupported = Object.assign(new Error('Unsupported Media Type'), {
      code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE',
      statusCode: 415,
    });
    expect(toProblem(unsupported, '/v1/x')).toEqual({
      type: `${PROBLEM_TYPE_BASE}/UNSUPPORTED_MEDIA_TYPE`,
      title: 'Unsupported media type',
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      instance: '/v1/x',
      detail: 'Unsupported Media Type',
    });
  });

  it('never leaks internals for 5xx', () => {
    const p = toProblem(new Error('ECONNREFUSED postgres://user:secret@db/x'), '/v1/y');
    expect(p).toEqual({
      type: `${PROBLEM_TYPE_BASE}/INTERNAL`,
      title: 'Internal error',
      status: 500,
      code: 'INTERNAL',
      instance: '/v1/y',
    });
  });
});
