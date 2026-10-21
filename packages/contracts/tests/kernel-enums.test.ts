// Pins every OpenAPI enum and id pattern that restates a shared-kernel value (phase §14,
// shared-kernel row: "enums referenced by contracts stay in sync"; .claude/rules/contracts.md
// invariant 6). The contract restates them so the generated Swift and Kotlin clients carry them;
// this test fails as soon as the contract and the kernel drift apart.
import {
  CONSENT_PURPOSES,
  type ConsentPurpose as KernelConsentPurpose,
  ID_PREFIXES,
  type IdKind,
  newId,
} from '@ai-stylist/shared-kernel';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { ConsentPurpose } from '../gen/ts-client/index.js';
import bundle from '../gen/openapi.bundle.json' with { type: 'json' };

const schemas = bundle.components.schemas;

describe('OpenAPI enums mirror the shared kernel', () => {
  it('ConsentPurpose equals CONSENT_PURPOSES value for value, in order', () => {
    expect(schemas.ConsentPurpose.enum).toEqual([...CONSENT_PURPOSES]);
    expectTypeOf<ConsentPurpose>().toEqualTypeOf<KernelConsentPurpose>();
  });
});

describe('OpenAPI id patterns use the shared-kernel prefixes', () => {
  const idSchemas = [
    ['UserId', 'user'],
    ['ConsentRecordId', 'consentRecord'],
  ] as const satisfies readonly (readonly [keyof typeof schemas, IdKind])[];

  it.each(idSchemas)('%s matches newId(%s) and no other kind', (schemaName, kind) => {
    const { pattern } = schemas[schemaName];
    const matches = (value: string): boolean => new RegExp(pattern).test(value);

    expect(pattern.startsWith(`^${ID_PREFIXES[kind]}_`)).toBe(true);
    expect(matches(newId(kind))).toBe(true);
    expect(matches(newId('event'))).toBe(false);
  });
});
