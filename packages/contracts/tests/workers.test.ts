// Pins the internal API <-> segmentation-worker HTTP contract (workers/segmentation/segmentation.v1.json):
// every message's examples validate, the closed shapes reject what the hand-written twins reject,
// and the generated TS types (`@ai-stylist/contracts/workers`, gen/workers-ts) line up with it.
// The Pydantic twin in workers/ml/generated is generated from the same file (`just generate`).
import { readFile } from 'node:fs/promises';

import { Ajv2020, type AnySchema } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  HealthResponse,
  MaskLabel,
  SegmentRequest,
  SegmentResponse,
  SegmentationWorkerV1,
} from '@ai-stylist/contracts/workers';

type Def = { examples?: unknown[]; enum?: string[] };
type WorkerSchema = AnySchema & { $id: string; $defs: Record<string, Def> };

const schema = JSON.parse(
  await readFile(new URL('../workers/segmentation/segmentation.v1.json', import.meta.url), 'utf8'),
) as WorkerSchema;

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(schema);

function validator(def: string) {
  const validate = ajv.getSchema(`${schema.$id}#/$defs/${def}`);
  if (!validate) throw new Error(`no $defs/${def}`);
  return (value: unknown) => [validate(value), JSON.stringify(validate.errors)] as const;
}

const MESSAGES = ['SegmentRequest', 'SegmentResponse', 'HealthResponse'] as const;

describe('segmentation.v1.json', () => {
  it.each(MESSAGES)('%s ships an example that validates, alone and as a message', (name) => {
    const examples = schema.$defs[name]?.examples ?? [];
    expect(examples.length).toBeGreaterThan(0);
    const validate = validator(name);
    const validateAny = ajv.getSchema(schema.$id)!;
    for (const example of examples) {
      const [ok, errors] = validate(example);
      expect(ok, errors).toBe(true);
      expect(validateAny(example), JSON.stringify(validateAny.errors)).toBe(true);
    }
  });

  it('MaskLabel is the closet garment classes plus the segmentation-only background', () => {
    expect(schema.$defs.MaskLabel?.enum).toEqual([
      'top',
      'bottom',
      'dress',
      'outerwear',
      'shoes',
      'accessory',
      'background',
    ]);
  });

  it('SegmentRequest takes an object reference only and rejects anything else', () => {
    const validate = validator('SegmentRequest');
    const ok = { request_id: 'req_1', image_ref: 'u/usr_example/media/garment.jpg' };
    expect(validate(ok)[0]).toBe(true);
    expect(validate({ ...ok, hint: 'background' })[0]).toBe(true);
    for (const bad of [
      { ...ok, hint: 'hat' },
      { ...ok, request_id: '' },
      { ...ok, request_id: 'r'.repeat(129) },
      { ...ok, image_ref: 'k'.repeat(1025) },
      { ...ok, image_bytes: 'AAAA' },
      { request_id: 'req_1' },
    ]) {
      expect(validate(bad)[0], JSON.stringify(bad)).toBe(false);
    }
  });

  it('SegmentResponse requires provenance + confidence and bounds every score', () => {
    const validate = validator('SegmentResponse');
    const [example] = schema.$defs.SegmentResponse!.examples as Array<Record<string, unknown>>;
    const { provenance: _p, ...noProvenance } = example!;
    expect(validate(noProvenance)[0]).toBe(false);
    expect(
      validate({ ...example, provenance: { generated: true, model: 'stub', confidence: 1.5 } })[0],
    ).toBe(false);
    expect(validate({ ...example, masks: [{ label: 'top', mask_ref: 'm', score: -0.1 }] })[0]).toBe(
      false,
    );
    expect(validate({ ...example, masks: [{ label: 'top', mask_ref: '', score: 0.1 }] })[0]).toBe(
      false,
    );
  });

  it('the generated TS types are the contract', () => {
    expectTypeOf<MaskLabel>().toEqualTypeOf<
      'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory' | 'background'
    >();
    expectTypeOf<SegmentRequest['hint']>().toEqualTypeOf<MaskLabel | undefined>();
    expectTypeOf<SegmentResponse['masks'][number]['label']>().toEqualTypeOf<MaskLabel>();
    expectTypeOf<SegmentResponse['provenance']>().toEqualTypeOf<{
      generated: boolean;
      model: string;
      confidence: number;
    }>();
    expectTypeOf<HealthResponse['status']>().toEqualTypeOf<'ok'>();
    expectTypeOf<SegmentationWorkerV1>().toEqualTypeOf<
      SegmentRequest | SegmentResponse | HealthResponse
    >();
    const request: SegmentRequest = { request_id: 'req_1', image_ref: 'k', hint: 'top' };
    expect(validator('SegmentRequest')(request)[0]).toBe(true);
  });
});
