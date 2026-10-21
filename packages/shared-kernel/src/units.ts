// Canonical measurement units (planning/06 §2, §3.1): the API stores and returns SI
// (`cm`, `kg`); `unitSystem` only controls display, converted client-side with these helpers.
// Temperatures come from context facts (feels-like, thresholds; doc 09 §3.1) and are Celsius.
//
// Data lives in packages/shared-kernel/registry/units.json (the single source for TS, Swift and
// Kotlin, OQ-15); `just generate` writes ./gen/units.ts. This file owns the types, the `satisfies`
// check and the `convert` helpers.
import {
  CANONICAL_UNITS as REGISTERED_CANONICAL_UNITS,
  CM_PER_INCH,
  KG_PER_POUND,
  LENGTH_UNITS,
  MASS_UNITS,
  MEASUREMENT_SOURCES,
  TEMPERATURE_UNITS,
  UNIT_SYSTEMS,
} from './gen/units.js';

export { LENGTH_UNITS, MASS_UNITS, TEMPERATURE_UNITS };

export type LengthUnit = (typeof LENGTH_UNITS)[number];
export type MassUnit = (typeof MASS_UNITS)[number];
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];
export type Unit = LengthUnit | MassUnit | TemperatureUnit;

/** Canonical (stored) unit per dimension. */
export const CANONICAL_UNITS = REGISTERED_CANONICAL_UNITS satisfies Record<string, Unit>;

export type Dimension = keyof typeof CANONICAL_UNITS;

/** Display systems selectable in the profile (doc 06 §3.1 `locale.unitSystem`). */
export { UNIT_SYSTEMS };
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

/** Who produced a measurement value (doc 06 §3.1): estimated/derived values must carry confidence. */
export { MEASUREMENT_SOURCES };
export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number];

/** A quantity that always carries its unit and provenance — never a bare number (doc 06 §2). */
export type Measurement<U extends Unit = Unit> = {
  readonly value: number;
  readonly unit: U;
  readonly source: MeasurementSource;
  /** Required when `source` is `estimated` or `derived` (0..1). */
  readonly confidence?: number;
  /** RFC 3339 UTC timestamp. */
  readonly measuredAt?: string;
};

/** Inches in one foot, by definition (not a measured factor, so it is not in units.json). */
export const INCHES_PER_FOOT = 12;

/** An imperial length shown as whole feet plus inches, e.g. 5′10″ (`inches` in [0, 12)). */
export type FeetInches = {
  readonly feet: number;
  readonly inches: number;
};

/** Display conversions only (doc 06 §3.1); storage stays SI. */
export const convert = {
  cmToInches: (cm: number): number => cm / CM_PER_INCH,
  inchesToCm: (inches: number): number => inches * CM_PER_INCH,
  /** Splits a non-negative length into whole feet and the remaining inches (unrounded). */
  cmToFeetInches: (cm: number): FeetInches => {
    const totalInches = cm / CM_PER_INCH;
    // `%` is exact, so `inches` stays in [0, 12) and `feet` is a whole number.
    const inches = totalInches % INCHES_PER_FOOT;
    return { feet: (totalInches - inches) / INCHES_PER_FOOT, inches };
  },
  feetInchesToCm: ({ feet, inches }: FeetInches): number =>
    (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH,
  kgToPounds: (kg: number): number => kg / KG_PER_POUND,
  poundsToKg: (pounds: number): number => pounds * KG_PER_POUND,
  celsiusToFahrenheit: (celsius: number): number => celsius * (9 / 5) + 32,
  fahrenheitToCelsius: (fahrenheit: number): number => (fahrenheit - 32) * (5 / 9),
} as const;
