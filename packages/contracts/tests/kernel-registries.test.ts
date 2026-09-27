// JSON Schema validation for the shared-kernel registries that tools/codegen/gen-kernel.mjs does not
// emit (TS-only data read straight from JSON): forbidden-log-keys, owners and feature-flags. They
// live in packages/shared-kernel/registry; Ajv lives here (as it does for gen-kernel.mjs). The
// cross-references a schema cannot express are checked in packages/shared-kernel/tests.
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
