import fc from 'fast-check';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CANONICAL_UNITS,
  CLIMATE_TOLERANCES,
  CONSENT_PURPOSES,
  DEFAULT_CLIMATE_TOLERANCE,
  DEFAULT_PRESENTATION,
  DEFAULT_STARTING_SHAPE,
  ENTITLEMENTS,
  ENTITLEMENT_GRANT_KINDS,
  ENTITLEMENT_LIFECYCLE_STATES,
  type EntitlementLevel,
  FIT_CHOICES,
  GARMENT_GROUPS,
  INCHES_PER_FOOT,
  MATERIALS,
  type Measurement,
  OCCASION_PRESETS,
  PREFERENCE_KINDS,
  PRESENTATIONS,
  REASON_CODES,
  REASON_CODE_NAMESPACES,
  SIZE_SYSTEMS,
  STARTING_SHAPES,
  STARTING_SHAPE_BASE_MESH,
  STYLE_TYPES,
  type StartingShape,
  compareEntitlementLevels,
  convert,
} from '../src/index.js';

// Round-trip tolerance, relative to max(1, |x|): the 9 decimal places the fixed-value case below
// already asserts. The factors are exact by definition, so only IEEE-754 rounding (~1e-16) remains;
// 1e-9 sits far above that and far below the 0.1-unit display precision.
const ROUND_TRIP_TOLERANCE = 1e-9;
// Covers every body measurement (≤ 300 kg, ≤ 230 cm) with wide headroom.
const QUANTITY = fc.double({ min: 0, max: 10_000, noNaN: true });

function expectRoundTrip(original: number, roundTripped: number): void {
  const tolerance = ROUND_TRIP_TOLERANCE * Math.max(1, Math.abs(original));
  expect(Math.abs(roundTripped - original)).toBeLessThanOrEqual(tolerance);
}

describe('entitlement registry', () => {
  it('holds exactly the 17 names from doc 12 §3.1', () => {
    expect(Object.keys(ENTITLEMENTS)).toHaveLength(17);
    for (const name of Object.keys(ENTITLEMENTS)) expect(name).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
  });

  it('lists the levels of each level entitlement lowest first, as doc 12 §1.2 ranks the plans', () => {
    const levelsByName = Object.fromEntries(
      Object.entries(ENTITLEMENTS).flatMap(([name, definition]) =>
        'levels' in definition ? [[name, definition.levels]] : [],
      ),
    );
    expect(levelsByName).toEqual({
      'avatar.level': ['A1', 'A1_all_poses'],
      'tryon.generative': ['G0', 'G2'],
      'trends.level': ['basic', 'personalized'],
    });
    for (const definition of Object.values(ENTITLEMENTS)) {
      expect('levels' in definition).toBe(definition.kind === 'level');
    }
  });

  it('compares two levels of one entitlement by the registry order (AC-9)', () => {
    expect(compareEntitlementLevels('tryon.generative', 'G2', 'G0')).toBeGreaterThan(0);
    expect(compareEntitlementLevels('tryon.generative', 'G0', 'G2')).toBeLessThan(0);
    expect(compareEntitlementLevels('avatar.level', 'A1', 'A1')).toBe(0);
    expect(compareEntitlementLevels('trends.level', 'personalized', 'basic')).toBeGreaterThan(0);
    expectTypeOf<EntitlementLevel<'tryon.generative'>>().toEqualTypeOf<'G0' | 'G2'>();
  });

  it('grant kinds are the four of doc 12 §3.2; lifecycle states the five of doc 03 §4.3', () => {
    expect([...ENTITLEMENT_GRANT_KINDS]).toEqual([
      'plan_grant',
      'trial_grant',
      'promo_grant',
      'grandfather_grant',
    ]);
    expect([...ENTITLEMENT_LIFECYCLE_STATES]).toEqual([
      'trial',
      'free',
      'active_paid',
      'grace',
      'cancelled_active',
    ]);
  });
});

describe('reason-code registry', () => {
  it('every code sits in a doc 09 §7 namespace', () => {
    for (const code of Object.keys(REASON_CODES)) {
      expect(REASON_CODE_NAMESPACES.some((ns) => code.startsWith(ns))).toBe(true);
    }
  });
});

describe('units', () => {
  it('stores SI', () => {
    expect(CANONICAL_UNITS).toEqual({ length: 'cm', mass: 'kg', temperature: 'celsius' });
  });

  it('display conversions invert', () => {
    expect(convert.inchesToCm(convert.cmToInches(172))).toBeCloseTo(172, 9);
    expect(convert.poundsToKg(convert.kgToPounds(63.5))).toBeCloseTo(63.5, 9);
    expect(convert.fahrenheitToCelsius(convert.celsiusToFahrenheit(-5))).toBeCloseTo(-5, 9);
    expect(convert.celsiusToFahrenheit(100)).toBe(212);
  });

  it('length round-trips metric → imperial → metric and back within tolerance', () => {
    fc.assert(
      fc.property(QUANTITY, (x) => {
        expectRoundTrip(x, convert.inchesToCm(convert.cmToInches(x)));
        expectRoundTrip(x, convert.cmToInches(convert.inchesToCm(x)));
        expectRoundTrip(x, convert.feetInchesToCm(convert.cmToFeetInches(x)));
      }),
    );
  });

  it('mass round-trips metric → imperial → metric and back within tolerance', () => {
    fc.assert(
      fc.property(QUANTITY, (x) => {
        expectRoundTrip(x, convert.poundsToKg(convert.kgToPounds(x)));
        expectRoundTrip(x, convert.kgToPounds(convert.poundsToKg(x)));
      }),
    );
  });

  it('splits a length into whole feet and inches in [0, 12)', () => {
    fc.assert(
      fc.property(QUANTITY, (cm) => {
        const { feet, inches } = convert.cmToFeetInches(cm);
        expect(Number.isInteger(feet) && feet >= 0).toBe(true);
        expect(inches).toBeGreaterThanOrEqual(0);
        expect(inches).toBeLessThan(INCHES_PER_FOOT);
      }),
    );
  });

  it('shows 5′10″ as 177.8 cm and back, leaving the stored SI value unchanged (phase §19 AC-2)', () => {
    const stored: Measurement<'cm'> = Object.freeze({
      value: convert.feetInchesToCm({ feet: 5, inches: 10 }),
      unit: 'cm',
      source: 'user',
    });
    const before = { ...stored };

    expect(stored.value).toBeCloseTo(177.8, 9);
    const { feet, inches } = convert.cmToFeetInches(stored.value);
    expect(feet).toBe(5);
    expect(inches).toBeCloseTo(10, 9);
    expect(convert.cmToInches(stored.value)).toBeCloseTo(70, 9);
    expect(stored).toEqual(before);
  });

  it('a display conversion never alters the SI value it was given', () => {
    fc.assert(
      fc.property(QUANTITY, QUANTITY, (cm, kg) => {
        const height: Measurement<'cm'> = Object.freeze({ value: cm, unit: 'cm', source: 'user' });
        const weight: Measurement<'kg'> = Object.freeze({ value: kg, unit: 'kg', source: 'user' });
        convert.cmToInches(height.value);
        convert.cmToFeetInches(height.value);
        convert.kgToPounds(weight.value);
        expect(height).toEqual({ value: cm, unit: 'cm', source: 'user' });
        expect(weight).toEqual({ value: kg, unit: 'kg', source: 'user' });
      }),
    );
  });
});

describe('P03 enums hold exactly the values decided on 2026-10-13', () => {
  it('consent purposes: the seven doc 11 §7.2 keys, no calendar', () => {
    expect([...CONSENT_PURPOSES]).toEqual([
      'core_service',
      'face_processing',
      'location_precise',
      'analytics',
      'ai_generative',
      'notifications',
      'training_data',
    ]);
  });

  it('climate tolerance, defaulting to neutral', () => {
    expect([...CLIMATE_TOLERANCES]).toEqual(['runs_cold', 'neutral', 'runs_hot']);
    expect(DEFAULT_CLIMATE_TOLERANCE).toBe('neutral');
  });

  it('presentation, defaulting to unspecified', () => {
    expect([...PRESENTATIONS]).toEqual(['feminine', 'masculine', 'androgynous', 'unspecified']);
    expect(DEFAULT_PRESENTATION).toBe('unspecified');
  });

  it('fit choice, garment group, style type and preference kind', () => {
    expect([...FIT_CHOICES]).toEqual(['fitted', 'regular', 'relaxed', 'oversized']);
    expect([...GARMENT_GROUPS]).toEqual(['tops', 'bottoms', 'dresses', 'outerwear', 'shoes']);
    expect([...STYLE_TYPES]).toEqual(['minimal', 'classic', 'smart_casual']);
    expect([...PREFERENCE_KINDS]).toEqual(['material']);
  });

  it('material: the 15 doc 08 §4.1 values', () => {
    expect([...MATERIALS]).toEqual([
      'cotton',
      'linen',
      'wool',
      'cashmere',
      'silk',
      'denim',
      'leather',
      'suede',
      'synthetic',
      'blend',
      'knit',
      'down',
      'canvas',
      'metal',
      'other',
    ]);
  });

  it('occasion preset and size system', () => {
    expect([...OCCASION_PRESETS]).toEqual(['work_day', 'dinner', 'travel', 'sport']);
    expect([...SIZE_SYSTEMS]).toEqual(['EU', 'US', 'UK', 'ALPHA']);
  });
});

describe('starting-shape registry', () => {
  it('holds exactly the five shapes on anny-adult-v1, in display order', () => {
    expect(Object.keys(STARTING_SHAPES)).toEqual([
      'from_measurements',
      'broad_shouldered',
      'curvy',
      'straight',
      'softer',
    ]);
    expect(STARTING_SHAPE_BASE_MESH).toBe('anny-adult-v1');
    expectTypeOf<StartingShape>().toEqualTypeOf<
      'from_measurements' | 'broad_shouldered' | 'curvy' | 'straight' | 'softer'
    >();
  });

  it('marks from_measurements, a registered shape, as the only default', () => {
    expect(DEFAULT_STARTING_SHAPE).toBe('from_measurements');
    expect(Object.keys(STARTING_SHAPES)).toContain(DEFAULT_STARTING_SHAPE);
  });
});
