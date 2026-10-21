// Pins the event contracts: the committed JSON Schemas validate their own examples, the
// analytics taxonomy validates against its schema, and the generated TS types line up with
// the shared-kernel envelope type (AC-2: generated outputs are consumed by compiling code).
import { readFile } from 'node:fs/promises';

import {
  CONSENT_PURPOSES,
  CORRELATION_ID_EXAMPLES,
  type ConsentPurpose as KernelConsentPurpose,
  type EventAggregate,
  type EventEnvelope as KernelEnvelope,
  type EventType,
  type Id,
  type IdKind,
  LENGTH_UNITS,
  MASS_UNITS,
  MEASUREMENT_DEFINITIONS,
  isId,
  newId,
} from '@ai-stylist/shared-kernel';
import { Ajv2020, type AnySchema, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  AnalyticsTaxonomy,
  DemoOutboxFlowRequestedV1,
  DemoOutboxFlowRequestedV1Payload,
  EventEnvelope,
  IdentityAccountCreatedV1,
  IdentityAccountCreatedV1Payload,
  IdentityAccountDeletionRequestedV1,
  IdentityAccountDeletionRequestedV1Payload,
  IdentityAccountExportRequestedV1,
  IdentityAccountExportRequestedV1Payload,
  IdentityConsentChangedV1,
  IdentityConsentChangedV1Payload,
  ProfileMeasurementsUpdatedV1,
  ProfileMeasurementsUpdatedV1Payload,
} from '../gen/events-ts/index.js';
import bundle from '../gen/openapi.bundle.json' with { type: 'json' };

type SchemaDoc = AnySchema & { examples?: unknown[] };

/** The parts of an event schema node these tests read; other keywords pass through as `unknown`. */
type SchemaNode = {
  readonly [keyword: string]: unknown;
  readonly $ref?: string;
  readonly type?: string;
  readonly enum?: readonly unknown[];
  readonly format?: string;
  readonly pattern?: string;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, SchemaNode>>;
};

/** An event example as committed: the envelope fields the P03 cases read. */
type EventExample = {
  readonly [field: string]: unknown;
  readonly producer: string;
  readonly aggregate: { readonly kind: string; readonly id: string };
  readonly subjectUserId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

type EventSchemaDoc = SchemaNode & {
  readonly $id: string;
  readonly $defs: Readonly<Record<string, SchemaNode>>;
  readonly examples: readonly EventExample[];
};

/**
 * The P03 domain events (phase P03 §7; the export event: doc 04 §9.1 step 1), each with its
 * producing module, its aggregate (the id kind of `aggregate.id`, also `aggregate.kind`) and its
 * payload properties, all required. Schema file: `events/<type>.event.json`.
 */
const P03_EVENTS = [
  {
    type: 'identity.account.created.v1',
    producer: 'identity',
    aggregate: 'user',
    payload: ['userId', 'createdAt'],
  },
  {
    type: 'identity.consent.changed.v1',
    producer: 'identity',
    aggregate: 'user',
    payload: ['userId', 'consentRecordId', 'purpose', 'status', 'policyVersion', 'changedAt'],
  },
  {
    type: 'identity.account.deletion_requested.v1',
    producer: 'identity',
    aggregate: 'user',
    payload: ['userId', 'deletionRequestId', 'requestedAt', 'graceEndsAt'],
  },
  {
    type: 'identity.account.export_requested.v1',
    producer: 'identity',
    aggregate: 'user',
    payload: ['exportId', 'userId', 'requestedAt'],
  },
  {
    type: 'profile.measurements.updated.v1',
    producer: 'profile',
    aggregate: 'profile',
    payload: ['userId', 'changed'],
  },
] as const satisfies readonly {
  type: EventType;
  producer: string;
  aggregate: IdKind;
  payload: readonly string[];
}[];
type P03EventType = (typeof P03_EVENTS)[number]['type'];

const schemaIdOf = (type: string): string => `https://contracts.ai-stylist.app/events/${type}.json`;

async function loadJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8')) as T;
}

const envelopeSchema = await loadJson<SchemaDoc>('../events/envelope.json');
const demoSchema = await loadJson<SchemaDoc>('../events/demo.event.json');
const taxonomySchema = await loadJson<SchemaDoc>('../events/analytics/events.schema.json');
const taxonomy = await loadJson<AnalyticsTaxonomy>('../events/analytics/events.json');
const p03Schemas = new Map<string, EventSchemaDoc>(
  await Promise.all(
    P03_EVENTS.map(
      async ({ type }) =>
        [type, await loadJson<EventSchemaDoc>(`../events/${type}.event.json`)] as const,
    ),
  ),
);

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
ajv.addSchema([envelopeSchema, demoSchema, taxonomySchema, ...p03Schemas.values()]);

const validateEnvelope = ajv.getSchema('https://contracts.ai-stylist.app/events/envelope.json');
const validateDemo = ajv.getSchema(
  'https://contracts.ai-stylist.app/events/demo.outbox-flow.requested.v1.json',
);
const validateTaxonomy = ajv.getSchema(
  'https://contracts.ai-stylist.app/events/analytics/events.schema.json',
);
if (!validateEnvelope || !validateDemo || !validateTaxonomy) throw new Error('schema $id missing');

describe('demo.outbox-flow.requested.v1', () => {
  const [example] = demoSchema.examples ?? [];

  it('ships an example that validates against the envelope and its own schema', () => {
    expect(example).toBeDefined();
    expect(validateEnvelope(example), JSON.stringify(validateEnvelope.errors)).toBe(true);
    expect(validateDemo(example), JSON.stringify(validateDemo.errors)).toBe(true);
  });

  it('accepts an optional W3C traceparent and rejects a malformed one (doc 14 §3)', () => {
    const base = example as Record<string, unknown>;
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const traced = { ...base, traceparent };
    expect(validateEnvelope(traced), JSON.stringify(validateEnvelope.errors)).toBe(true);
    for (const malformed of [
      '00-abc-def-01',
      '00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01',
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7',
      '4bf92f3577b34da6a3ce929d0e0e4736',
      '',
    ]) {
      expect(validateEnvelope({ ...base, traceparent: malformed }), malformed).toBe(false);
    }
    expect(validateEnvelope({ ...base, traceparent: { traceId: 'x' } })).toBe(false);
  });

  it('accepts an optional usr_ subjectUserId, absent or present, and rejects any other value', () => {
    const base = example as Record<string, unknown>;
    expect(base).not.toHaveProperty('subjectUserId');
    expect(validateEnvelope(base), JSON.stringify(validateEnvelope.errors)).toBe(true);
    const subjectUserId = newId('user');
    const withSubject = { ...base, subjectUserId };
    expect(validateEnvelope(withSubject), JSON.stringify(validateEnvelope.errors)).toBe(true);
    for (const malformed of [
      'usr_not-a-ulid',
      newId('event'),
      subjectUserId.toLowerCase(),
      `usr_8${subjectUserId.slice(5)}`,
      '',
    ]) {
      // The schema pattern agrees with the kernel parser the job queue keys users by (`isId`).
      expect(isId(malformed, 'user'), malformed).toBe(false);
      expect(validateEnvelope({ ...base, subjectUserId: malformed }), malformed).toBe(false);
    }
    const asObject = { ...base, subjectUserId: { kind: 'user', id: subjectUserId } };
    expect(validateEnvelope(asObject)).toBe(false);
  });

  it('accepts a correlationId of 1–128 [A-Za-z0-9._:-], rejects anything else (doc 14 §2)', () => {
    // The shared-kernel vectors every correlation id check (API and worker headers) is tested on.
    const base = example as Record<string, unknown>;
    for (const accepted of CORRELATION_ID_EXAMPLES.accepted) {
      expect(validateEnvelope({ ...base, correlationId: accepted }), accepted).toBe(true);
    }
    for (const rejected of CORRELATION_ID_EXAMPLES.rejected) {
      expect(validateEnvelope({ ...base, correlationId: rejected }), rejected).toBe(false);
    }
    expect(validateEnvelope({ ...base, correlationId: 7 })).toBe(false);
  });

  it('rejects an envelope with a malformed id or type', () => {
    const base = example as Record<string, unknown>;
    expect(validateEnvelope({ ...base, id: 'evt_not-a-ulid' })).toBe(false);
    expect(validateEnvelope({ ...base, type: 'demo.requested' })).toBe(false);
    expect(validateDemo({ ...base, type: 'demo.outbox-flow.requested.v2' })).toBe(false);
    expect(validateDemo({ ...base, payload: { demoId: 'x' } })).toBe(false);
  });

  it('is typed as the shared-kernel envelope narrowed by the generated payload', () => {
    const event: KernelEnvelope<'demo.outbox-flow.requested.v1', DemoOutboxFlowRequestedV1Payload> =
      {
        id: newId('event'),
        type: 'demo.outbox-flow.requested.v1',
        occurredAt: '2026-09-10T12:00:00Z',
        producer: 'platform',
        aggregate: { kind: 'demo_run', id: 'demo-run-1' },
        sequence: 1,
        actor: { kind: 'system' },
        correlationId: 'corr-1',
        payload: { demoId: 'demo-run-1', requestedAt: '2026-09-10T12:00:00Z' },
      };
    expect(validateEnvelope(event), JSON.stringify(validateEnvelope.errors)).toBe(true);
    expect(validateDemo(event), JSON.stringify(validateDemo.errors)).toBe(true);
    // A kernel-typed event is assignable to the generated wire type (and only widens it).
    const wire: EventEnvelope = event;
    expect(wire.id).toBe(event.id);
    expectTypeOf<
      DemoOutboxFlowRequestedV1['type']
    >().toEqualTypeOf<'demo.outbox-flow.requested.v1'>();
  });
});

const bundleSchemas = bundle.components.schemas;

function p03Schema(type: P03EventType): EventSchemaDoc {
  const doc = p03Schemas.get(type);
  if (doc === undefined) throw new Error(`no schema loaded for ${type}`);
  return doc;
}

function validatorOf(type: string): ValidateFunction {
  const validate = ajv.getSchema(schemaIdOf(type));
  if (!validate) throw new Error(`schema $id missing for ${type}`);
  return validate;
}

function exampleOf(doc: EventSchemaDoc): EventExample {
  const [example] = doc.examples;
  if (example === undefined) throw new Error(`${doc.$id} ships no example`);
  return example;
}

/** The `$defs` entry a local `$ref` (`#/$defs/<name>`) points at, else the node itself. */
function deref(doc: EventSchemaDoc, node: SchemaNode | undefined): SchemaNode {
  if (node === undefined) throw new Error(`${doc.$id}: missing schema node`);
  if (node.$ref === undefined) return node;
  const target = doc.$defs[node.$ref.replace('#/$defs/', '')];
  if (target === undefined) throw new Error(`${doc.$id}: unresolved $ref ${node.$ref}`);
  return target;
}

const payloadOf = (type: P03EventType): SchemaNode => {
  const doc = p03Schema(type);
  return deref(doc, doc.properties?.payload);
};

/** A `<prefix>_<ULID>` id pattern, as the envelope and the OpenAPI id schemas write it. */
const PREFIXED_ULID_PATTERN = /^\^[a-z]+_\[0-7\]\[0-9A-HJKMNP-TV-Z\]\{25\}\$$/;

type LeafKind = 'id' | 'enum' | 'timestamp' | 'policy version' | 'other';

/** Each declared payload leaf with the kind of data it can hold (`other` = anything else). */
function leafKinds(
  doc: EventSchemaDoc,
  node: SchemaNode | undefined,
  path = 'payload',
): (readonly [string, LeafKind])[] {
  const schema = deref(doc, node);
  if (schema.type === 'object') {
    return Object.entries(schema.properties ?? {}).flatMap(([name, child]) =>
      leafKinds(doc, child, `${path}.${name}`),
    );
  }
  if (schema.enum !== undefined) return [[path, 'enum']];
  if (schema.format === 'date-time') return [[path, 'timestamp']];
  if (schema.pattern !== undefined && PREFIXED_ULID_PATTERN.test(schema.pattern)) {
    return [[path, 'id']];
  }
  if (schema.pattern === bundleSchemas.PolicyVersion.pattern) return [[path, 'policy version']];
  return [[path, 'other']];
}

describe.each(P03_EVENTS)('$type', ({ type, producer, aggregate, payload: properties }) => {
  const doc = p03Schema(type);
  const validate = validatorOf(type);
  const example = exampleOf(doc);

  it('ships an example that validates against the envelope and its own schema', () => {
    expect(validateEnvelope(example), JSON.stringify(validateEnvelope.errors)).toBe(true);
    expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
  });

  it(`example: producer ${producer}, aggregate ${aggregate}, subjectUserId = payload.userId`, () => {
    expect(example.producer).toBe(producer);
    expect(example.aggregate.kind).toBe(aggregate);
    expect(isId(example.aggregate.id, aggregate), example.aggregate.id).toBe(true);
    expect(example.subjectUserId).toBe(example.payload.userId);
  });

  it('declares exactly its payload properties, all required, each an id, enum or timestamp', () => {
    const payload = deref(doc, doc.properties?.payload);
    expect(Object.keys(payload.properties ?? {})).toEqual([...properties]);
    expect(payload.required).toEqual([...properties]);
    expect(leafKinds(doc, payload).filter(([, kind]) => kind === 'other')).toEqual([]);
  });

  it('rejects another event type and a payload missing a required property', () => {
    expect(validate({ ...example, type: type.replace(/\.v1$/, '.v2') })).toBe(false);
    for (const name of properties) {
      const { [name]: _removed, ...rest } = example.payload;
      expect(validate({ ...example, payload: rest }), name).toBe(false);
    }
  });

  it('tolerates a payload property it does not declare (open content, doc 06 §4)', () => {
    const extended = { ...example, payload: { ...example.payload, addedLater: 'x' } };
    expect(validate(extended), JSON.stringify(validate.errors)).toBe(true);
  });
});

describe('P03 event ids use the API id patterns and the shared-kernel prefixes', () => {
  const idProperties = [
    ['identity.account.created.v1', 'userId', 'user', 'UserId'],
    ['identity.consent.changed.v1', 'userId', 'user', 'UserId'],
    ['identity.consent.changed.v1', 'consentRecordId', 'consentRecord', 'ConsentRecordId'],
    ['identity.account.deletion_requested.v1', 'userId', 'user', 'UserId'],
    [
      'identity.account.deletion_requested.v1',
      'deletionRequestId',
      'deletionRequest',
      'AccountDeletionRequestId',
    ],
    ['identity.account.export_requested.v1', 'exportId', 'exportRequest', 'DataExportId'],
    ['identity.account.export_requested.v1', 'userId', 'user', 'UserId'],
    ['profile.measurements.updated.v1', 'userId', 'user', 'UserId'],
  ] as const satisfies readonly (readonly [
    P03EventType,
    string,
    IdKind,
    keyof typeof bundleSchemas,
  ])[];

  it.each(idProperties)('%s payload.%s: newId(%s), pattern of %s', (type, name, kind, apiId) => {
    const pattern = payloadOf(type).properties?.[name]?.pattern;
    expect(pattern).toBe(bundleSchemas[apiId].pattern);
    const matches = (value: string): boolean => new RegExp(String(pattern)).test(value);
    expect(matches(newId(kind))).toBe(true);
    expect(matches(newId('event'))).toBe(false);
  });
});

describe('identity.consent.changed.v1 agrees with the consent API and the kernel', () => {
  const payload = payloadOf('identity.consent.changed.v1');
  const property = (name: string): SchemaNode => {
    const node = payload.properties?.[name];
    if (node === undefined) throw new Error(`no payload property ${name}`);
    return node;
  };

  it('names the purpose `purpose` (doc 11 §7.1), never `scope`, with CONSENT_PURPOSES in order', () => {
    expect(payload.properties).not.toHaveProperty('scope');
    expect(property('purpose').enum).toEqual([...CONSENT_PURPOSES]);
    expect(property('purpose').enum).toEqual(bundleSchemas.ConsentPurpose.enum);
    expectTypeOf<
      IdentityConsentChangedV1Payload['purpose']
    >().toEqualTypeOf<KernelConsentPurpose>();
  });

  it('takes status and policyVersion values of the API consent record', () => {
    expect(property('status').enum).toEqual(bundleSchemas.ConsentStatus.enum);
    expect(property('policyVersion').pattern).toBe(bundleSchemas.PolicyVersion.pattern);
    expect(property('policyVersion').maxLength).toBe(bundleSchemas.PolicyVersion.maxLength);
  });
});

describe('profile.measurements.updated.v1 agrees with the measurement-definitions registry', () => {
  const doc = p03Schema('profile.measurements.updated.v1');
  const changes = deref(doc, payloadOf('profile.measurements.updated.v1').properties?.changed);
  const definitions = Object.entries(MEASUREMENT_DEFINITIONS);

  it('keys the changes by the registered measurement ids, in registry order, at least one', () => {
    expect(Object.keys(changes.properties ?? {})).toEqual(definitions.map(([id]) => id));
    expect(changes.minProperties).toBe(1);
  });

  it.each(definitions)('%s names its stored unit and never a value', (id, definition) => {
    const change = deref(doc, changes.properties?.[id]);
    expect(Object.keys(change.properties ?? {})).toEqual(['unit']);
    expect(change.additionalProperties).toBe(false);
    const units = definition.dimension === 'length' ? LENGTH_UNITS : MASS_UNITS;
    expect(change.properties?.unit?.enum).toEqual([...units]);
    expect(change.properties?.unit?.enum).toEqual([definition.unit]);
  });

  it('refuses a change that carries a value: the change objects are closed (doc 11 §6)', () => {
    const validate = validatorOf('profile.measurements.updated.v1');
    const example = exampleOf(doc);
    const withValue = {
      ...example,
      payload: { ...example.payload, changed: { height: { unit: 'cm', value: 176 } } },
    };
    expect(validate(withValue)).toBe(false);
  });
});

describe('P03 event types', () => {
  const at = '2026-10-21T09:00:00Z';

  function kernelEvent<T extends P03EventType, P>(
    type: T,
    producer: string,
    aggregate: EventAggregate,
    subjectUserId: Id<'user'>,
    payload: P,
  ): KernelEnvelope<T, P> {
    return {
      id: newId('event'),
      type,
      occurredAt: at,
      producer,
      aggregate,
      sequence: 1,
      actor: { kind: 'user', id: subjectUserId },
      subjectUserId,
      correlationId: 'corr-p03-events',
      payload,
    };
  }

  it('are the shared-kernel envelope narrowed by each generated payload', () => {
    const userId = newId('user');
    const account: EventAggregate = { kind: 'user', id: userId };
    const created: IdentityAccountCreatedV1Payload = { userId, createdAt: at };
    const consent: IdentityConsentChangedV1Payload = {
      userId,
      consentRecordId: newId('consentRecord'),
      purpose: 'analytics',
      status: 'withdrawn',
      policyVersion: '0.1.0-draft',
      changedAt: at,
    };
    const deletion: IdentityAccountDeletionRequestedV1Payload = {
      userId,
      deletionRequestId: newId('deletionRequest'),
      requestedAt: at,
      graceEndsAt: '2026-10-28T09:00:00Z',
    };
    const dataExport: IdentityAccountExportRequestedV1Payload = {
      exportId: newId('exportRequest'),
      userId,
      requestedAt: at,
    };
    const measurements: ProfileMeasurementsUpdatedV1Payload = {
      userId,
      changed: { chest: { unit: 'cm' }, weight: { unit: 'kg' } },
    };
    const profile: EventAggregate = { kind: 'profile', id: newId('profile') };
    const events = [
      kernelEvent('identity.account.created.v1', 'identity', account, userId, created),
      kernelEvent('identity.consent.changed.v1', 'identity', account, userId, consent),
      kernelEvent('identity.account.deletion_requested.v1', 'identity', account, userId, deletion),
      kernelEvent('identity.account.export_requested.v1', 'identity', account, userId, dataExport),
      kernelEvent('profile.measurements.updated.v1', 'profile', profile, userId, measurements),
    ];

    for (const event of events) {
      expect(validateEnvelope(event), JSON.stringify(validateEnvelope.errors)).toBe(true);
      const validate = validatorOf(event.type);
      expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
      // A kernel-typed event is assignable to the generated wire type (and only widens it).
      const wire: EventEnvelope = event;
      expect(wire.payload).toBe(event.payload);
    }
    expectTypeOf<IdentityAccountCreatedV1['type']>().toEqualTypeOf<'identity.account.created.v1'>();
    expectTypeOf<IdentityConsentChangedV1['type']>().toEqualTypeOf<'identity.consent.changed.v1'>();
    expectTypeOf<
      IdentityAccountDeletionRequestedV1['type']
    >().toEqualTypeOf<'identity.account.deletion_requested.v1'>();
    expectTypeOf<
      IdentityAccountExportRequestedV1['type']
    >().toEqualTypeOf<'identity.account.export_requested.v1'>();
    expectTypeOf<
      ProfileMeasurementsUpdatedV1['type']
    >().toEqualTypeOf<'profile.measurements.updated.v1'>();
  });
});

describe('envelope.json ↔ shared-kernel EventEnvelope', () => {
  it('declares the same field set', () => {
    expectTypeOf<keyof EventEnvelope>().toEqualTypeOf<keyof KernelEnvelope>();
    expectTypeOf<EventEnvelope['actor']['kind']>().toEqualTypeOf<KernelEnvelope['actor']['kind']>();
  });

  it('requires exactly the doc 06 §4 mandatory fields', () => {
    const required = (envelopeSchema as { required: string[] }).required;
    expect([...required].sort()).toEqual(
      [
        'id',
        'type',
        'occurredAt',
        'producer',
        'aggregate',
        'sequence',
        'actor',
        'correlationId',
        'payload',
      ].sort(),
    );
  });
});

describe('analytics taxonomy', () => {
  it('validates against events.schema.json and registers app_opened', () => {
    expect(validateTaxonomy(taxonomy), JSON.stringify(validateTaxonomy.errors)).toBe(true);
    const names = taxonomy.events.map((e) => e.name);
    expect(names).toContain('app_opened');
    expect(new Set(names).size).toBe(names.length);
  });

  it('rejects an unregistered shape (camelCase name, unknown property type)', () => {
    expect(
      validateTaxonomy({
        version: 1,
        events: [{ name: 'appOpened', owner: 'platform', properties: {}, consentRequired: true }],
      }),
    ).toBe(false);
    expect(
      validateTaxonomy({
        version: 1,
        events: [
          {
            name: 'app_opened',
            owner: 'platform',
            properties: { x: 'date' },
            consentRequired: true,
          },
        ],
      }),
    ).toBe(false);
  });
});
