// Pins the event contracts: the committed JSON Schemas validate their own examples, the
// analytics taxonomy validates against its schema, and the generated TS types line up with
// the shared-kernel envelope type (AC-2: generated outputs are consumed by compiling code).
import { readFile } from 'node:fs/promises';

import { type EventEnvelope as KernelEnvelope, newId } from '@ai-stylist/shared-kernel';
import { Ajv2020, type AnySchema } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  AnalyticsTaxonomy,
  DemoOutboxFlowRequestedV1,
  DemoOutboxFlowRequestedV1Payload,
  EventEnvelope,
} from '../gen/events-ts/index.js';

type SchemaDoc = AnySchema & { examples?: unknown[] };

async function loadJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8')) as T;
}

const envelopeSchema = await loadJson<SchemaDoc>('../events/envelope.json');
const demoSchema = await loadJson<SchemaDoc>('../events/demo.event.json');
const taxonomySchema = await loadJson<SchemaDoc>('../events/analytics/events.schema.json');
const taxonomy = await loadJson<AnalyticsTaxonomy>('../events/analytics/events.json');

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
ajv.addSchema([envelopeSchema, demoSchema, taxonomySchema]);

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
