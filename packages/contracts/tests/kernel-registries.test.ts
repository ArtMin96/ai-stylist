// JSON Schema validation for the shared-kernel registries that TS reads straight from JSON (no
// generated TS): forbidden-log-keys (+ its word-split examples), log-redaction, correlation, owners,
// feature-flags, measurement-definitions, starting-shapes and error-codes. They live in
// packages/shared-kernel/registry; Ajv lives here (as it does for
// gen-kernel.mjs, which also validates the first four before emitting them for Python; their
// Python output is pinned by kernel-python.test.ts). It also checks the `levels` rule of
// entitlements.json, a registry gen-kernel.mjs emits for TS, Swift and Kotlin. The cross-references
// a schema cannot express are checked in packages/shared-kernel/tests.
import { readFile } from 'node:fs/promises';

import { Ajv2020, type SchemaObject } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

async function readRegistryFile<T>(file: string): Promise<T> {
  const url = new URL(`../../shared-kernel/registry/${file}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8')) as T;
}

async function loadRegistry(name: string): Promise<[schema: SchemaObject, data: unknown]> {
  return [
    await readRegistryFile<SchemaObject>(`${name}.schema.json`),
    await readRegistryFile<unknown>(`${name}.json`),
  ];
}

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);

async function validatorFor(name: string) {
  const [schema, data] = await loadRegistry(name);
  const validate = ajv.compile(schema);
  const check = (value: unknown): boolean => validate(value);
  return { data, check, errors: () => JSON.stringify(validate.errors) };
}

type RegistryValidator = Awaited<ReturnType<typeof validatorFor>>;

/** Expects the committed registry and a minimal hand-made one to pass the registry's schema. */
function expectBothValid({ data, check, errors }: RegistryValidator, minimal: unknown): void {
  expect(check(data), errors()).toBe(true);
  expect(check(minimal), errors()).toBe(true);
}

describe('forbidden-log-keys.json', async () => {
  const { data, check, errors } = await validatorFor('forbidden-log-keys');

  it('validates against its schema', () => {
    expect(check(data), errors()).toBe(true);
  });

  it('rejects mixed case, separators, duplicates and an empty list', () => {
    for (const keys of [['Token'], ['refresh_token'], ['api-key'], ['token', 'token'], []]) {
      expect(check({ keys }), JSON.stringify(keys)).toBe(false);
    }
  });
});

describe('forbidden-log-keys.examples.json', async () => {
  const registry = await validatorFor('forbidden-log-keys.examples');
  const { check } = registry;
  const minimal = { forbidden: ['userEmail'], allowed: ['userId'] };

  it('validates against its schema', () => {
    expectBothValid(registry, minimal);
  });

  it('rejects empty or duplicated lists, non-key entries, a missing list, unknown fields', () => {
    expect(check({ ...minimal, forbidden: [] })).toBe(false);
    expect(check({ ...minimal, allowed: ['userId', 'userId'] })).toBe(false);
    for (const key of ['', 'user email', '_token', 'user.email', 7]) {
      expect(check({ ...minimal, forbidden: [key] }), JSON.stringify(key)).toBe(false);
    }
    expect(check({ forbidden: minimal.forbidden })).toBe(false);
    expect(check({ ...minimal, notes: 'x' })).toBe(false);
  });
});

describe('log-redaction.json', async () => {
  const registry = await validatorFor('log-redaction');
  const { check } = registry;
  const vectors = {
    exceptionType: { kept: ['TypeError'], replaced: ['Error: boom'] },
    nestContext: { kept: ['ProblemFilter'], redacted: ['someone@example.test'] },
  };
  const minimal = {
    errorNameShape: '^[A-Za-z_$][\\w$.]{0,63}$',
    codeShape: '^[A-Z0-9_]{1,32}$',
    maxCauseDepth: 5,
    nestContextShape: '^[A-Z][a-z]+(?:[A-Z][a-z0-9]*)*$',
    vectors,
  };

  it('validates against its schema', () => {
    expectBothValid(registry, minimal);
  });

  it('rejects an unanchored or invalid shape', () => {
    for (const codeShape of ['[A-Z0-9_]{1,32}', '^[A-Z0-9_]{1,32}', '[A-Z]$', '^[A-Z$', '^$']) {
      expect(check({ ...minimal, codeShape }), codeShape).toBe(false);
    }
  });

  it('rejects a cause depth outside 1..16 or not an integer', () => {
    for (const maxCauseDepth of [0, 17, 2.5, '5']) {
      expect(check({ ...minimal, maxCauseDepth }), JSON.stringify(maxCauseDepth)).toBe(false);
    }
  });

  it('rejects a missing field, a missing or empty vector list, duplicates and unknown fields', () => {
    const { nestContextShape: _dropped, ...noNestShape } = minimal;
    expect(check(noNestShape)).toBe(false);
    expect(check({ ...minimal, vectors: { exceptionType: vectors.exceptionType } })).toBe(false);
    expect(
      check({ ...minimal, vectors: { ...vectors, nestContext: { kept: ['ProblemFilter'] } } }),
    ).toBe(false);
    expect(
      check({ ...minimal, vectors: { ...vectors, exceptionType: { kept: [], replaced: ['x'] } } }),
    ).toBe(false);
    expect(
      check({
        ...minimal,
        vectors: { ...vectors, exceptionType: { kept: ['A', 'A'], replaced: ['x'] } },
      }),
    ).toBe(false);
    expect(check({ ...minimal, notes: 'x' })).toBe(false);
  });
});

describe('owners.json', async () => {
  const { data, check, errors } = await validatorFor('owners');
  const person = { id: 'test-person', name: 'Test Person' };

  it('validates against its schema', () => {
    expect(check(data), errors()).toBe(true);
  });

  it('accepts a GitHub handle and no roles', () => {
    expect(check({ people: [{ ...person, githubHandle: 'test-person-1' }] }), errors()).toBe(true);
  });

  it('rejects contact details, non-kebab ids and a malformed handle', () => {
    expect(check({ people: [{ ...person, email: 'someone@example.test' }] })).toBe(false);
    expect(check({ people: [{ ...person, name: 'someone@example.test' }] })).toBe(false);
    expect(check({ people: [{ ...person, id: 'Test Person' }] })).toBe(false);
    expect(check({ people: [{ ...person, githubHandle: '@test-person' }] })).toBe(false);
    expect(check({ people: [person], roles: { 'on-call': [] } })).toBe(false);
  });
});

describe('feature-flags.json', async () => {
  const { data, check, errors } = await validatorFor('feature-flags');
  const rollout = {
    owner: 'test-person',
    purpose: 'fixture',
    kind: 'rollout',
    createdAt: '2026-09-27',
    expiresAt: '2026-12-26',
    rolloutPlan: 'internal → 5% → 25% → 100%',
    offBehavior: 'fixture',
    defaultWhenUnavailable: false,
  };
  const { expiresAt: _dropped, ...noExpiry } = rollout;
  const one = (flag: unknown, key = 'fixture-flag') => check({ flags: { [key]: flag } });

  it('validates against its schema', () => {
    expect(check(data), errors()).toBe(true);
  });

  it('requires expiresAt unless the flag is a kill-switch', () => {
    expect(one(rollout), errors()).toBe(true);
    expect(one(noExpiry)).toBe(false);
    expect(one({ ...noExpiry, kind: 'experiment' })).toBe(false);
    expect(one({ ...noExpiry, kind: 'kill-switch' }), errors()).toBe(true);
  });

  it('rejects an unknown kind, a non-date, a missing field and a non-kebab key', () => {
    expect(one({ ...rollout, kind: 'permanent' })).toBe(false);
    expect(one({ ...rollout, expiresAt: '26/12/2026' })).toBe(false);
    const { offBehavior: _off, ...noOffBehavior } = rollout;
    expect(one(noOffBehavior)).toBe(false);
    expect(one(rollout, 'demoOutboxFlow')).toBe(false);
  });
});

describe('measurement-definitions.json', async () => {
  const { data, check, errors } = await validatorFor('measurement-definitions');
  const length = { dimension: 'length', unit: 'cm', min: 10, max: 20 };
  const mass = { dimension: 'mass', unit: 'kg', min: 10, max: 20 };
  const one = (definition: unknown, id = 'fixture_length') =>
    check({ measurements: { [id]: definition } });

  it('validates against its schema', () => {
    expect(check(data), errors()).toBe(true);
    expect(one(length), errors()).toBe(true);
    expect(one(mass, 'fixture_mass'), errors()).toBe(true);
  });

  it('requires the canonical unit of the dimension', () => {
    expect(one({ ...length, unit: 'kg' })).toBe(false);
    expect(one({ ...mass, unit: 'cm' })).toBe(false);
    expect(one({ ...length, unit: 'inches' })).toBe(false);
  });

  it('rejects an unknown dimension, a zero, negative or non-number bound and a missing bound', () => {
    expect(one({ ...length, dimension: 'temperature', unit: 'celsius' })).toBe(false);
    for (const min of [0, -1, '10']) {
      expect(one({ ...length, min }), JSON.stringify(min)).toBe(false);
    }
    const { max: _dropped, ...noMax } = length;
    expect(one(noMax)).toBe(false);
  });

  it('rejects a non-snake id, an empty registry and unknown fields', () => {
    expect(one(length, 'Height')).toBe(false);
    expect(one(length, 'body-height')).toBe(false);
    expect(check({ measurements: {} })).toBe(false);
    expect(one({ ...length, conditionalRange: [12, 18] })).toBe(false);
    expect(check({ measurements: { fixture_length: length }, notes: 'x' })).toBe(false);
  });
});

describe('starting-shapes.json', async () => {
  const registry = await validatorFor('starting-shapes');
  const { check } = registry;
  const shape = { description: 'fixture' };
  const minimal = { baseMesh: 'fixture-mesh-v1', default: 'shape_a', shapes: { shape_a: shape } };

  it('validates against its schema', () => {
    expectBothValid(registry, minimal);
  });

  it('rejects an empty shape map, non-snake shape ids and a shape without a description', () => {
    expect(check({ ...minimal, shapes: {} })).toBe(false);
    for (const id of ['broad-shouldered', 'Curvy']) {
      expect(check({ ...minimal, shapes: { [id]: shape } }), id).toBe(false);
    }
    expect(check({ ...minimal, shapes: { shape_a: {} } })).toBe(false);
    expect(check({ ...minimal, shapes: { shape_a: { description: '' } } })).toBe(false);
  });

  it('rejects a non-kebab base mesh, a missing field and unknown fields', () => {
    expect(check({ ...minimal, baseMesh: 'base/anny-adult-v1' })).toBe(false);
    const { default: _dropped, ...noDefault } = minimal;
    expect(check(noDefault)).toBe(false);
    expect(check({ ...minimal, labels: {} })).toBe(false);
    expect(check({ ...minimal, shapes: { shape_a: { ...shape, morphs: {} } } })).toBe(false);
  });
});

describe('error-codes.json', async () => {
  const registry = await validatorFor('error-codes');
  const { check } = registry;
  const code = { status: 404, title: 'Fixture', description: 'fixture' };
  const minimal = { codes: { FIXTURE_CODE: code } };
  const one = (definition: unknown, name = 'FIXTURE_CODE') =>
    check({ codes: { [name]: definition } });

  it('validates against its schema', () => {
    expectBothValid(registry, minimal);
  });

  it('rejects a code name that is not upper case with digits and `_`', () => {
    for (const name of ['not_found', 'NotFound', 'NOT-FOUND', '_NOT_FOUND', '1_FOUND', 'X']) {
      expect(one(code, name), name).toBe(false);
    }
  });

  it('rejects a status outside 400..599 or not an integer', () => {
    for (const status of [200, 399, 600, 404.5, '404']) {
      expect(one({ ...code, status }), JSON.stringify(status)).toBe(false);
    }
  });

  it('rejects a missing or empty title or description, unknown fields and an empty registry', () => {
    const { title: _noTitle, ...noTitle } = code;
    const { description: _noDescription, ...noDescription } = code;
    expect(one(noTitle)).toBe(false);
    expect(one({ ...code, title: '' })).toBe(false);
    expect(one(noDescription)).toBe(false);
    expect(one({ ...code, description: '' })).toBe(false);
    expect(one({ ...code, retryable: true })).toBe(false);
    expect(check({ codes: {} })).toBe(false);
    expect(check({ ...minimal, notes: 'x' })).toBe(false);
  });
});

describe('entitlements.json', async () => {
  const { data, check, errors } = await validatorFor('entitlements');
  const level = { kind: 'level', description: 'fixture', levels: ['L1', 'L2'] };
  const flag = { kind: 'boolean', description: 'fixture' };
  const one = (definition: unknown) =>
    check({
      kinds: ['boolean', 'level'],
      entitlements: { 'fixture.one': definition },
      creditMeters: [],
    });

  it('validates against its schema', () => {
    expect(check(data), errors()).toBe(true);
    expect(one(level), errors()).toBe(true);
    expect(one(flag), errors()).toBe(true);
  });

  it('requires two or more distinct levels on a level entitlement and none on any other kind', () => {
    const { levels: _dropped, ...noLevels } = level;
    expect(one(noLevels)).toBe(false);
    expect(one({ ...level, levels: ['L1'] })).toBe(false);
    expect(one({ ...level, levels: ['L1', 'L1'] })).toBe(false);
    expect(one({ ...flag, levels: ['L1', 'L2'] })).toBe(false);
  });

  it('rejects a level that is not a ladder code or a snake_case word', () => {
    for (const bad of ['A1 + all poses', 'a-1', '', 'G2_All']) {
      expect(one({ ...level, levels: ['L1', bad] }), bad).toBe(false);
    }
  });
});

describe('correlation.json', async () => {
  const registry = await validatorFor('correlation');
  const { check } = registry;
  const minimal = {
    header: 'x-correlation-id',
    logKey: 'correlation_id',
    vectors: { accepted: ['corr-1'], rejected: [''] },
  };

  it('validates against its schema', () => {
    expectBothValid(registry, minimal);
  });

  it('rejects a header or log key that is not lowercase kebab or snake case', () => {
    for (const header of ['X-Correlation-Id', 'x_correlation_id', 'x-correlation-', '']) {
      expect(check({ ...minimal, header }), header).toBe(false);
    }
    for (const logKey of ['correlationId', 'correlation-id', 'correlation_', '']) {
      expect(check({ ...minimal, logKey }), logKey).toBe(false);
    }
  });

  it('rejects a missing field, a missing or empty vector list, duplicates and unknown fields', () => {
    const { logKey: _dropped, ...noLogKey } = minimal;
    expect(check(noLogKey)).toBe(false);
    expect(check({ ...minimal, vectors: { accepted: ['corr-1'] } })).toBe(false);
    expect(check({ ...minimal, vectors: { accepted: [], rejected: [''] } })).toBe(false);
    expect(check({ ...minimal, vectors: { accepted: ['a', 'a'], rejected: [''] } })).toBe(false);
    expect(check({ ...minimal, pattern: '^.*$' })).toBe(false);
  });
});
