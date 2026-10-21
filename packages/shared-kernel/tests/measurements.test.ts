// The measurement-definition registry (planning/07 §3.3; owner decision 2026-10-13) comes from
// registry/measurement-definitions.json. JSON Schema validation runs in
// packages/contracts/tests/kernel-registries.test.ts; this file pins the ten definitions, checks what
// a schema cannot express (min < max, unit = canonical unit of the dimension) and proves the bounds
// check is symmetric, inclusive, never clamps and lets no NaN, infinite or negative value through.
import fc from 'fast-check';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CANONICAL_UNITS,
  MEASUREMENT_DEFINITIONS,
  type MeasurementId,
  checkMeasurementBounds,
} from '../src/index.js';

const ids = Object.keys(MEASUREMENT_DEFINITIONS) as MeasurementId[];
const idArb = fc.constantFrom(...ids);
const anyNumber = fc.oneof(fc.double(), fc.constantFrom(Number.NaN, Infinity, -Infinity, -0));

/** A measurement id paired with a value drawn from an arbitrary built on that id's definition. */
function idWith<T>(
  valueOf: (definition: (typeof MEASUREMENT_DEFINITIONS)[MeasurementId]) => fc.Arbitrary<T>,
): fc.Arbitrary<[MeasurementId, T]> {
  return idArb.chain((id) => fc.tuple(fc.constant(id), valueOf(MEASUREMENT_DEFINITIONS[id])));
}

describe('measurement-definition registry', () => {
  it('holds exactly the ten definitions decided on 2026-10-13, bound for bound', () => {
    const length = (min: number, max: number) => ({ dimension: 'length', unit: 'cm', min, max });
    expect(MEASUREMENT_DEFINITIONS).toEqual({
      height: length(120, 230),
      weight: { dimension: 'mass', unit: 'kg', min: 30, max: 300 },
      chest: length(60, 200),
      waist: length(45, 200),
      hips: length(55, 200),
      inseam: length(40, 120),
      shoulder: length(25, 70),
      sleeve: length(40, 100),
      thigh: length(30, 120),
      neck: length(25, 70),
    });
    expectTypeOf<MeasurementId>().toEqualTypeOf<
      | 'height'
      | 'weight'
      | 'chest'
      | 'waist'
      | 'hips'
      | 'inseam'
      | 'shoulder'
      | 'sleeve'
      | 'thigh'
      | 'neck'
    >();
  });

  it("stores every measurement in its dimension's canonical unit, with min < max", () => {
    for (const id of ids) {
      const { dimension, unit, min, max } = MEASUREMENT_DEFINITIONS[id];
      expect(unit, id).toBe(CANONICAL_UNITS[dimension]);
      expect(min, id).toBeLessThan(max);
    }
  });
});

describe('checkMeasurementBounds', () => {
  it('accepts a value iff it is finite and within the inclusive bounds', () => {
    fc.assert(
      fc.property(idArb, anyNumber, (id, value) => {
        const { min, max } = MEASUREMENT_DEFINITIONS[id];
        const inBounds = Number.isFinite(value) && value >= min && value <= max;
        expect(checkMeasurementBounds(id, value).ok).toBe(inBounds);
      }),
    );
  });

  it('accepts every value inside the bounds and hands back no substitute value (never clamps)', () => {
    fc.assert(
      fc.property(
        idWith(({ min, max }) => fc.double({ min, max, noNaN: true })),
        ([id, value]) => {
          expect(checkMeasurementBounds(id, value)).toStrictEqual({ ok: true });
        },
      ),
    );
  });

  it('accepts both bounds exactly and refuses the next value beyond each', () => {
    for (const id of ids) {
      const { min, max } = MEASUREMENT_DEFINITIONS[id];
      expect(checkMeasurementBounds(id, min).ok, id).toBe(true);
      expect(checkMeasurementBounds(id, max).ok, id).toBe(true);
      expect(checkMeasurementBounds(id, min - min * Number.EPSILON).ok, id).toBe(false);
      expect(checkMeasurementBounds(id, max + max * Number.EPSILON).ok, id).toBe(false);
    }
  });

  it('refuses below the lower bound and above the upper bound alike, naming only the bound', () => {
    fc.assert(
      fc.property(
        idWith(({ min, max }) =>
          fc.tuple(
            fc.double({ max: min, maxExcluded: true, noNaN: true, noDefaultInfinity: true }),
            fc.double({ min: max, minExcluded: true, noNaN: true, noDefaultInfinity: true }),
          ),
        ),
        ([id, [below, above]]) => {
          const { min, max } = MEASUREMENT_DEFINITIONS[id];
          expect(checkMeasurementBounds(id, below)).toEqual({
            ok: false,
            error: { reason: 'below_min', measurement: id, min },
          });
          expect(checkMeasurementBounds(id, above)).toEqual({
            ok: false,
            error: { reason: 'above_max', measurement: id, max },
          });
        },
      ),
    );
  });

  it('refuses NaN and ±Infinity as not finite, without echoing the value', () => {
    fc.assert(
      fc.property(idArb, fc.constantFrom(Number.NaN, Infinity, -Infinity), (id, value) => {
        expect(checkMeasurementBounds(id, value)).toEqual({
          ok: false,
          error: { reason: 'not_finite', measurement: id },
        });
      }),
    );
  });

  it('refuses every zero or negative value', () => {
    fc.assert(
      fc.property(idArb, fc.double({ max: 0, noNaN: true }), (id, value) => {
        expect(checkMeasurementBounds(id, value).ok).toBe(false);
      }),
    );
  });
});
