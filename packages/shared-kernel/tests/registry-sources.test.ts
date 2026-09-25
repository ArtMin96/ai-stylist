// The TS registries are generated from packages/shared-kernel/registry/*.json (OQ-15). These tests
// pin the public API to the JSON source, so a hand edit of src/gen or a skipped `just generate`
// fails here as well as in `just generate --check`.
import { describe, expect, it } from 'vitest';

import entitlementsJson from '../registry/entitlements.json' with { type: 'json' };
import reasonCodesJson from '../registry/reason-codes.json' with { type: 'json' };
import unitsJson from '../registry/units.json' with { type: 'json' };
import {
  CANONICAL_UNITS,
  CREDIT_METERS,
  ENTITLEMENTS,
  LENGTH_UNITS,
  MASS_UNITS,
  MEASUREMENT_SOURCES,
  REASON_CODES,
  REASON_CODE_NAMESPACES,
  TEMPERATURE_UNITS,
  UNIT_SYSTEMS,
  convert,
} from '../src/index.js';

describe('reason codes come from registry/reason-codes.json', () => {
  it('namespaces, in order', () => {
    expect([...REASON_CODE_NAMESPACES]).toEqual(reasonCodesJson.namespaces.map((n) => n.name));
  });

  it('codes, with namespace, stage, params and description', () => {
    expect(REASON_CODES).toEqual(reasonCodesJson.codes);
    expect(Object.keys(REASON_CODES)).toEqual(Object.keys(reasonCodesJson.codes));
  });
});

describe('entitlements come from registry/entitlements.json', () => {
  it('names, kinds and descriptions, in order', () => {
    expect(ENTITLEMENTS).toEqual(entitlementsJson.entitlements);
    expect(Object.keys(ENTITLEMENTS)).toEqual(Object.keys(entitlementsJson.entitlements));
  });

  it('credit meters', () => {
    expect([...CREDIT_METERS]).toEqual(entitlementsJson.creditMeters);
    expect([...CREDIT_METERS]).toEqual(['tryon', 'missing_view']);
  });
});

describe('units come from registry/units.json', () => {
  const { dimensions } = unitsJson;

  it('unit lists per dimension', () => {
    expect([...LENGTH_UNITS]).toEqual(dimensions.length.units);
    expect([...MASS_UNITS]).toEqual(dimensions.mass.units);
    expect([...TEMPERATURE_UNITS]).toEqual(dimensions.temperature.units);
  });

  it('canonical units, unit systems and measurement sources', () => {
    expect(CANONICAL_UNITS).toEqual({
      length: dimensions.length.canonical,
      mass: dimensions.mass.canonical,
      temperature: dimensions.temperature.canonical,
    });
    expect([...UNIT_SYSTEMS]).toEqual(unitsJson.unitSystems);
    expect([...MEASUREMENT_SOURCES]).toEqual(unitsJson.measurementSources);
  });

  it('conversions use the exact registry factors', () => {
    expect(unitsJson.conversionFactors).toEqual({ cmPerInch: 2.54, kgPerPound: 0.45359237 });
    expect(convert.inchesToCm(1)).toBe(unitsJson.conversionFactors.cmPerInch);
    expect(convert.poundsToKg(1)).toBe(unitsJson.conversionFactors.kgPerPound);
  });
});
