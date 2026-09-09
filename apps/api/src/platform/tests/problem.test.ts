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

  it('maps plain errors with a 4xx statusCode (fastify plugins) by status', () => {
    const p = toProblem(Object.assign(new Error('slow down'), { statusCode: 429 }), '/');
    expect(p).toMatchObject({ status: 429, code: 'RATE_LIMITED', detail: 'slow down' });
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
