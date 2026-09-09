import { describe, expect, it } from 'vitest';

import {
  CANONICAL_UNITS,
  ENTITLEMENTS,
  REASON_CODES,
  REASON_CODE_NAMESPACES,
  convert,
} from '../src/index.js';

describe('entitlement registry', () => {
  it('holds exactly the 17 names from doc 12 §3.1', () => {
    expect(Object.keys(ENTITLEMENTS)).toHaveLength(17);
    for (const name of Object.keys(ENTITLEMENTS)) expect(name).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
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
});
