// LOG_REDACTION_RULES and LOG_REDACTION_EXAMPLES come from registry/log-redaction.json, the one
// source of the log and span error-shape rules the API and the workers apply (planning/11 §8).
// Schema validation: packages/contracts/tests/kernel-registries.test.ts. Here: the exports equal
// the JSON, and every vector behaves as labelled under the registry's own shapes.
import { describe, expect, it } from 'vitest';

import registry from '../registry/log-redaction.json' with { type: 'json' };
import { LOG_REDACTION_EXAMPLES, LOG_REDACTION_RULES } from '../src/index.js';

const { errorNameShape, codeShape, nestContextShape, maxCauseDepth } = LOG_REDACTION_RULES;
const { exceptionType, nestContext } = LOG_REDACTION_EXAMPLES;

/** The span `exception.type` rule the registry describes: kept when name- or code-shaped. */
const keepsExceptionType = (value: string): boolean =>
  errorNameShape.test(value) || codeShape.test(value);

describe('log redaction rules come from registry/log-redaction.json', () => {
  it('compiles each registry shape unchanged, without flags', () => {
    expect(errorNameShape.source).toBe(registry.errorNameShape);
    expect(codeShape.source).toBe(registry.codeShape);
    expect(nestContextShape.source).toBe(registry.nestContextShape);
    for (const re of [errorNameShape, codeShape, nestContextShape]) expect(re.flags).toBe('');
  });

  it('follows at most 5 cause links', () => {
    expect(maxCauseDepth).toBe(registry.maxCauseDepth);
    expect(maxCauseDepth).toBe(5);
  });

  it('exports the registry vectors, in order', () => {
    expect([...exceptionType.kept]).toEqual(registry.vectors.exceptionType.kept);
    expect([...exceptionType.replaced]).toEqual(registry.vectors.exceptionType.replaced);
    expect([...nestContext.kept]).toEqual(registry.vectors.nestContext.kept);
    expect([...nestContext.redacted]).toEqual(registry.vectors.nestContext.redacted);
  });

  it('cannot be mutated at runtime', () => {
    for (const value of [
      LOG_REDACTION_RULES,
      errorNameShape,
      codeShape,
      nestContextShape,
      LOG_REDACTION_EXAMPLES,
      exceptionType,
      exceptionType.kept,
      exceptionType.replaced,
      nestContext,
      nestContext.kept,
      nestContext.redacted,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it('uses ASCII-only shapes, so JavaScript and Python (re.ASCII) agree', () => {
    for (const source of [registry.errorNameShape, registry.codeShape, registry.nestContextShape]) {
      expect(source).toMatch(/^\^[\x20-\x7e]+\$$/);
    }
  });
});

describe('exception.type vectors', () => {
  it.each(exceptionType.kept)('keeps %j (name- or code-shaped)', (value) => {
    expect(keepsExceptionType(value)).toBe(true);
  });

  it.each(exceptionType.replaced)('replaces %j with Error', (value) => {
    expect(keepsExceptionType(value)).toBe(false);
  });

  it('covers a dotted name, a SQLSTATE, a system code and an over-long name', () => {
    expect(exceptionType.kept).toContain('grpc.ServiceError');
    expect(exceptionType.kept.some((v) => !errorNameShape.test(v) && codeShape.test(v))).toBe(true);
    expect(exceptionType.kept).toContain('ECONNREFUSED');
    expect(exceptionType.replaced.some((v) => /^\w{65,}$/.test(v))).toBe(true);
  });

  it('includes a trailing newline and a non-ASCII letter, which only a full ASCII match rejects', () => {
    expect(exceptionType.replaced).toContain('TypeError\n');
    expect(exceptionType.replaced.some((v) => [...v].some((ch) => ch.charCodeAt(0) > 0x7f))).toBe(
      true,
    );
  });
});

describe('Nest logger context vectors', () => {
  it.each(nestContext.kept)('keeps %j', (value) => {
    expect(nestContextShape.test(value)).toBe(true);
  });

  it.each(nestContext.redacted)('redacts %j', (value) => {
    expect(nestContextShape.test(value)).toBe(false);
  });

  it('keeps the Nest framework and ProblemFilter contexts', () => {
    for (const name of ['RoutesResolver', 'InstanceLoader', 'ProblemFilter']) {
      expect(nestContext.kept).toContain(name);
    }
  });

  it('redacts an AWS-key-shaped string, a tok_ token, a stack trace and an email', () => {
    const { redacted } = nestContext;
    expect(redacted.some((v) => /^AKIA[0-9A-Z]{16}$/.test(v))).toBe(true);
    expect(redacted.some((v) => /^tok_[0-9a-f]{32}$/.test(v))).toBe(true);
    expect(redacted.some((v) => /\n\s+at \S/.test(v))).toBe(true);
    expect(redacted.some((v) => /^[^@\s]+@[^@\s]+\.[a-z]+$/.test(v))).toBe(true);
  });

  it('narrows the context below a class name: a dotted name is redacted', () => {
    const dotted = nestContext.redacted.filter((v) => errorNameShape.test(v));
    expect(dotted).toContain('grpc.ServiceError');
  });
});

describe('vector lists', () => {
  it('never label one value both ways', () => {
    expect(exceptionType.kept.filter((v) => exceptionType.replaced.includes(v))).toEqual([]);
    expect(nestContext.kept.filter((v) => nestContext.redacted.includes(v))).toEqual([]);
  });
});
