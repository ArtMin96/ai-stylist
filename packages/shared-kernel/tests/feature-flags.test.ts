// The feature-flag and owners registries (planning/14 §11, NFR-OBS-080) come from registry/*.json.
// JSON Schema validation (shape, kebab-case keys, expiresAt required unless kill-switch) runs in
// packages/contracts/tests/kernel-registries.test.ts; this file pins the exports to the JSON and
// checks the cross-references a schema cannot express: every owner and role member is a declared
// person, expiresAt follows createdAt, and a rollout flag expires within 90 days.
import fc from 'fast-check';
import { describe, expect, expectTypeOf, it } from 'vitest';

import flagsJson from '../registry/feature-flags.json' with { type: 'json' };
import flagsSchema from '../registry/feature-flags.schema.json' with { type: 'json' };
import ownersJson from '../registry/owners.json' with { type: 'json' };
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KINDS,
  FEATURE_FLAG_REGISTRY,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
  type FeatureFlags,
  OWNERS_REGISTRY,
  type OwnersRegistry,
} from '../src/index.js';

const DAY_MS = 86_400_000;
const MAX_ROLLOUT_DAYS = 90;

/** doc 14 §11 rules beyond the schema; returns one message per violation. */
function flagPolicyErrors(
  flags: Readonly<Record<string, FeatureFlagDefinition>>,
  owners: OwnersRegistry,
): string[] {
  const people = new Set(owners.people.map((p) => p.id));
  const errors: string[] = [];
  for (const [key, flag] of Object.entries(flags)) {
    if (!people.has(flag.owner)) errors.push(`${key}: owner '${flag.owner}' is not in owners.json`);
    if (flag.expiresAt === undefined) {
      if (flag.kind !== 'kill-switch') errors.push(`${key}: ${flag.kind} flag needs expiresAt`);
      continue;
    }
    const days = (Date.parse(flag.expiresAt) - Date.parse(flag.createdAt)) / DAY_MS;
    if (!(days > 0)) errors.push(`${key}: expiresAt must follow createdAt`);
    if (flag.kind === 'rollout' && days > MAX_ROLLOUT_DAYS) {
      errors.push(`${key}: rollout flag expires ${days} days after createdAt (max 90)`);
    }
  }
  return errors;
}

/** Person ids are unique and every role member is a declared person. */
function ownerReferenceErrors(owners: OwnersRegistry): string[] {
  const ids = owners.people.map((p) => p.id);
  const people = new Set(ids);
  const errors = ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `duplicate id ${id}`);
  for (const [role, members] of Object.entries(owners.roles)) {
    for (const id of members) {
      if (!people.has(id)) errors.push(`role ${role}: '${id}' is not in people`);
    }
  }
  return errors;
}

const demoFlag: FeatureFlagDefinition = {
  owner: 'arthur-minasyan',
  purpose: 'fixture',
  kind: 'rollout',
  createdAt: '2026-09-27',
  expiresAt: '2026-12-26',
  rolloutPlan: 'fixture',
  offBehavior: 'fixture',
  defaultWhenUnavailable: false,
};

function isoDatePlusDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

describe('feature-flag registry comes from registry/feature-flags.json', () => {
  it('exports the JSON flags, in order', () => {
    expect(FEATURE_FLAG_REGISTRY).toEqual(flagsJson.flags);
    expect(Object.keys(FEATURE_FLAG_REGISTRY)).toEqual(Object.keys(flagsJson.flags));
  });

  it('FEATURE_FLAG_KINDS equals the schema enum', () => {
    expect([...FEATURE_FLAG_KINDS]).toEqual(flagsSchema.$defs.FeatureFlag.properties.kind.enum);
  });

  it('types the keys and the port', () => {
    expectTypeOf<FeatureFlagKey>().toEqualTypeOf<'demo-outbox-flow'>();
    expectTypeOf<FeatureFlags['isEnabled']>().toEqualTypeOf<
      (key: FeatureFlagKey) => Promise<boolean>
    >();
    expectTypeOf(FEATURE_FLAGS).toExtend<symbol>();
    expect(FEATURE_FLAGS).toBe(Symbol.for('ai-stylist.feature-flags'));
  });

  it('registers the P02 rollback-demo flag (NFR-OBS-080)', () => {
    const flag = FEATURE_FLAG_REGISTRY['demo-outbox-flow'];
    expect(flag.kind).toBe('rollout');
    expect(flag.owner).toBe('arthur-minasyan');
  });

  it('meets the doc 14 §11 policy: known owner, expiry after creation, rollout ≤ 90 days', () => {
    expect(flagPolicyErrors(FEATURE_FLAG_REGISTRY, OWNERS_REGISTRY)).toEqual([]);
  });
});

describe('flag policy check', () => {
  it('fails a rollout flag past 90 days, one without expiresAt, and an unknown owner', () => {
    const { expiresAt: _dropped, ...noExpiry } = demoFlag;
    expect(
      flagPolicyErrors(
        {
          'too-long': { ...demoFlag, expiresAt: '2026-12-27' },
          'no-expiry': noExpiry,
          'no-expiry-experiment': { ...noExpiry, kind: 'experiment' },
          'expires-at-creation': { ...demoFlag, expiresAt: '2026-09-27' },
          'unknown-owner': { ...demoFlag, owner: 'nobody' },
        },
        OWNERS_REGISTRY,
      ),
    ).toEqual([
      'too-long: rollout flag expires 91 days after createdAt (max 90)',
      'no-expiry: rollout flag needs expiresAt',
      'no-expiry-experiment: experiment flag needs expiresAt',
      'expires-at-creation: expiresAt must follow createdAt',
      "unknown-owner: owner 'nobody' is not in owners.json",
    ]);
  });

  it('exempts kill-switch flags from expiry and caps only rollout flags at 90 days', () => {
    const { expiresAt: _dropped, ...noExpiry } = demoFlag;
    expect(
      flagPolicyErrors(
        {
          'ai-tryon': { ...noExpiry, kind: 'kill-switch' },
          'long-experiment': { ...demoFlag, kind: 'experiment', expiresAt: '2027-06-01' },
        },
        OWNERS_REGISTRY,
      ),
    ).toEqual([]);
  });

  it('accepts a rollout flag iff it expires 1–90 days after createdAt', () => {
    fc.assert(
      fc.property(fc.integer({ min: -30, max: 400 }), (days) => {
        const flag = { ...demoFlag, expiresAt: isoDatePlusDays(demoFlag.createdAt, days) };
        const ok = flagPolicyErrors({ f: flag }, OWNERS_REGISTRY).length === 0;
        expect(ok).toBe(days >= 1 && days <= MAX_ROLLOUT_DAYS);
      }),
    );
  });
});

describe('owners registry comes from registry/owners.json', () => {
  it('exports the JSON people and roles', () => {
    expect(OWNERS_REGISTRY.people).toEqual(ownersJson.people);
    expect(OWNERS_REGISTRY.roles).toEqual(ownersJson.roles);
  });

  it('has unique person ids and no dangling role member', () => {
    expect(ownerReferenceErrors(OWNERS_REGISTRY)).toEqual([]);
  });

  it('fails a duplicate person id and a role member missing from people', () => {
    expect(
      ownerReferenceErrors({
        people: [...OWNERS_REGISTRY.people, { id: 'arthur-minasyan', name: 'Duplicate' }],
        roles: { 'on-call': ['arthur-minasyan', 'ghost'] },
      }),
    ).toEqual(['duplicate id arthur-minasyan', "role on-call: 'ghost' is not in people"]);
  });
});
