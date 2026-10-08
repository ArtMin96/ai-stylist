// `errorSummary` (../errors/error-shape.ts) is the rule for every field of a thrown value that
// platform logs (`err`), stores (`last_error`, a failed job's output) or sets on a span. A subclass
// can set `Error.name` to any string, free text included, so a name is kept only when it is
// identifier-shaped (dots allowed, at most 64 characters); any other name is reported as `Error`.
// `isError` is the Error test every walk uses; it must work on runtimes without `Error.isError`.
import vm from 'node:vm';

import { afterEach, describe, expect, it } from 'vitest';

import { errorSummary, isError } from '../errors/error-shape.js';

import { CANARY } from './redaction-canary.js';

function named(name: unknown): Error {
  const error = new Error('message');
  Object.defineProperty(error, 'name', { value: name });
  return error;
}

describe('errorSummary', () => {
  it.each([
    'Error',
    'TypeError',
    'PostgresError',
    'DrizzleQueryError',
    '$Wrapped_1',
    'grpc.ServiceError',
    `E${'x'.repeat(63)}`,
  ])('keeps the identifier-shaped name %s', (name) => {
    expect(errorSummary(named(name))).toEqual({ errorName: name });
  });

  it.each([
    ['free text', `duplicate key ${CANARY}`],
    ['a message-shaped name', `Error: ${CANARY}`],
    ['an empty name', ''],
    ['a leading digit', '1Error'],
    ['65 characters', `E${'x'.repeat(64)}`],
    ['a line break', 'Error\nat x'],
    ['a non-string name', 42],
  ])('reports %s as Error', (_label, name) => {
    expect(errorSummary(named(name))).toEqual({ errorName: 'Error' });
  });

  it('keeps the code-shaped code of an error whose name it replaces', () => {
    const error = Object.assign(named(`bad ${CANARY}`), { code: '23505' });
    expect(errorSummary(error)).toEqual({ errorName: 'Error', pgCode: '23505' });
  });
});

describe('isError', () => {
  const ctor = Error as unknown as Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(Error, 'isError');

  afterEach(() => {
    if (original !== undefined) Object.defineProperty(Error, 'isError', original);
  });

  it('recognises an Error of another realm where Error.isError exists', () => {
    if (original === undefined) return; // Node 22: the fallback test below is the one that applies
    expect(isError(vm.runInNewContext('new Error("x")'))).toBe(true);
  });

  // Node 22 has no `Error.isError`; calling it there threw a TypeError out of every log call.
  it('falls back to instanceof Error when Error.isError is missing', () => {
    delete ctor['isError'];
    expect(typeof ctor['isError']).toBe('undefined');

    expect(isError(new TypeError('x'))).toBe(true);
    expect(isError({ name: 'Error', message: 'x' })).toBe(false);
    expect(isError('Error')).toBe(false);
    expect(isError(null)).toBe(false);
    expect(errorSummary(Object.assign(new Error('x'), { code: '23505' }))).toEqual({
      errorName: 'Error',
      pgCode: '23505',
    });
  });
});
