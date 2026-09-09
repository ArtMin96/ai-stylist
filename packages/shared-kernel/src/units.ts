// Canonical measurement units (planning/06 §2, §3.1): the API stores and returns SI
// (`cm`, `kg`); `unitSystem` only controls display, converted client-side with these helpers.
// Temperatures come from context facts (feels-like, thresholds; doc 09 §3.1) and are Celsius.

export const LENGTH_UNITS = ['cm'] as const;
export const MASS_UNITS = ['kg'] as const;
export const TEMPERATURE_UNITS = ['celsius'] as const;

export type LengthUnit = (typeof LENGTH_UNITS)[number];
export type MassUnit = (typeof MASS_UNITS)[number];
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];
export type Unit = LengthUnit | MassUnit | TemperatureUnit;

/** Canonical (stored) unit per dimension. */
export const CANONICAL_UNITS = {
  length: 'cm',
  mass: 'kg',
  temperature: 'celsius',
} as const satisfies Record<string, Unit>;

export type Dimension = keyof typeof CANONICAL_UNITS;

/** Display systems selectable in the profile (doc 06 §3.1 `locale.unitSystem`). */
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

/** Who produced a measurement value (doc 06 §3.1): estimated/derived values must carry confidence. */
export const MEASUREMENT_SOURCES = ['user', 'estimated', 'derived'] as const;
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

const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.45359237;

/** Display conversions only (doc 06 §3.1); storage stays SI. */
export const convert = {
  cmToInches: (cm: number): number => cm / CM_PER_INCH,
  inchesToCm: (inches: number): number => inches * CM_PER_INCH,
  kgToPounds: (kg: number): number => kg / KG_PER_POUND,
  poundsToKg: (pounds: number): number => pounds * KG_PER_POUND,
  celsiusToFahrenheit: (celsius: number): number => celsius * (9 / 5) + 32,
  fahrenheitToCelsius: (fahrenheit: number): number => (fahrenheit - 32) * (5 / 9),
} as const;
