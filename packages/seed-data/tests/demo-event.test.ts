// The factory output must validate against the canonical event schemas in packages/contracts
// (not a copy: read from the contracts package on disk, since its exports map only exposes
// generated TypeScript).
import { readFile } from 'node:fs/promises';

import { Ajv2020, type AnySchema } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import { demoEvent, syntheticRandom } from '../src/index.js';

const CONTRACTS_EVENTS = new URL('../../contracts/events/', import.meta.url);

async function loadSchema(name: string): Promise<AnySchema> {
  return JSON.parse(await readFile(new URL(name, CONTRACTS_EVENTS), 'utf8')) as AnySchema;
}

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
ajv.addSchema([await loadSchema('envelope.json'), await loadSchema('demo.event.json')]);
const validateEnvelope = ajv.getSchema('https://contracts.ai-stylist.app/events/envelope.json');
const validateDemo = ajv.getSchema(
  'https://contracts.ai-stylist.app/events/demo.outbox-flow.requested.v1.json',
);
if (!validateEnvelope || !validateDemo) throw new Error('contracts event schema $id missing');

describe('demoEvent()', () => {
  it('produces an envelope valid against envelope.json and demo.event.json', () => {
    const event = demoEvent();
    expect(validateEnvelope(event), JSON.stringify(validateEnvelope.errors)).toBe(true);
    expect(validateDemo(event), JSON.stringify(validateDemo.errors)).toBe(true);
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    expect(demoEvent({}, syntheticRandom(1))).toEqual(demoEvent({}, syntheticRandom(1)));
    expect(demoEvent({}, syntheticRandom(1)).id).not.toBe(demoEvent({}, syntheticRandom(2)).id);
  });

  it('applies envelope and payload overrides while staying valid', () => {
    const event = demoEvent({ correlationId: 'corr-42', payload: { note: 'hello outbox' } });
    expect(event.correlationId).toBe('corr-42');
    expect(event.payload.note).toBe('hello outbox');
    expect(event.payload.demoId).toBe(event.aggregate.id);
    expect(validateDemo(event), JSON.stringify(validateDemo.errors)).toBe(true);
  });
});
