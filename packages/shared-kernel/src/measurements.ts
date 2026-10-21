// Body measurement definitions and their hard bounds (planning/07 §3.3; owner decision 2026-10-13).
// Two levels: outside the hard bounds a value is refused and never stored (doc 07 §3.3 severity 1);
// inside them but outside a registered conditional range it is stored only with the person's
// confirmation (doc 03 §2.1). No conditional range is registered yet, so only the refusal exists.
//
// Data lives in packages/shared-kernel/registry/measurement-definitions.json (schema beside it); the
// tests check the schema and what it cannot express (min < max, unit = the dimension's canonical
// unit). Values are SI (`cm`, `kg`); display conversion is `convert` in units.ts.
import registry from '../registry/measurement-definitions.json' with { type: 'json' };

import { type CANONICAL_UNITS, type Dimension } from './units.js';

/** Dimensions a body measurement can have. */
export type MeasurementDimension = Extract<Dimension, 'length' | 'mass'>;

type DefinitionIn<D extends MeasurementDimension> = {
  readonly dimension: D;
  /** The dimension's canonical unit: `cm` or `kg`. */
  readonly unit: (typeof CANONICAL_UNITS)[D];
  /** Smallest accepted value, inclusive. */
  readonly min: number;
  /** Largest accepted value, inclusive. */
  readonly max: number;
};

/** One measurement's dimension, stored unit and inclusive hard bounds (in that unit). */
export type MeasurementDefinition = DefinitionIn<'length'> | DefinitionIn<'mass'>;

/** Union of the registered measurement ids, e.g. `'height'`. */
export type MeasurementId = keyof typeof registry.measurements;

/**
 * Registry shape: `{ height: { dimension: 'length', unit: 'cm', min: 120, max: 230 }, … }`.
 * The JSON import types `dimension` and `unit` as `string`; the schema (validated in the tests)
 * narrows them.
 */
export const MEASUREMENT_DEFINITIONS = registry.measurements as {
  readonly [K in MeasurementId]: MeasurementDefinition;
};

/**
 * Why a value was refused: the measurement and the bound it failed. Never the value itself, so a
 * result is safe to log (measurements are sensitive, doc 11 §8).
 */
export type MeasurementBoundsViolation =
  | { readonly reason: 'not_finite'; readonly measurement: MeasurementId }
  | { readonly reason: 'below_min'; readonly measurement: MeasurementId; readonly min: number }
  | { readonly reason: 'above_max'; readonly measurement: MeasurementId; readonly max: number };

export type MeasurementBoundsResult =
  { readonly ok: true } | { readonly ok: false; readonly error: MeasurementBoundsViolation };

/**
 * Check `value`, in the measurement's stored unit, against its hard bounds (both inclusive).
 * NaN and ±Infinity are refused. Never clamps (the result carries no value, so the caller stores
 * exactly what it checked) and never throws.
 */
export function checkMeasurementBounds(
  measurement: MeasurementId,
  value: number,
): MeasurementBoundsResult {
  const { min, max } = MEASUREMENT_DEFINITIONS[measurement];
  if (!Number.isFinite(value)) return { ok: false, error: { reason: 'not_finite', measurement } };
  if (value < min) return { ok: false, error: { reason: 'below_min', measurement, min } };
  if (value > max) return { ok: false, error: { reason: 'above_max', measurement, max } };
  return { ok: true };
}
