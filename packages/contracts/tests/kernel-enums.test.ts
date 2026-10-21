// Pins every OpenAPI enum, id pattern and list key that restates a shared-kernel value (phase §14,
// shared-kernel row: "enums referenced by contracts stay in sync"; .claude/rules/contracts.md
// invariant 6). The contract restates them so the generated Swift and Kotlin clients carry them;
// this test fails as soon as the contract and the kernel drift apart.
import {
  CLIMATE_TOLERANCES,
  CONSENT_PURPOSES,
  type ClimateTolerance as KernelClimateTolerance,
  type ConsentPurpose as KernelConsentPurpose,
  DEFAULT_STARTING_SHAPE,
  ENTITLEMENTS,
  ENTITLEMENT_GRANT_KINDS,
  ENTITLEMENT_LIFECYCLE_STATES,
  type EntitlementGrantKind as KernelEntitlementGrantKind,
  type EntitlementLifecycleState as KernelEntitlementLifecycleState,
  type EntitlementName as KernelEntitlementName,
  FIT_CHOICES,
  type FitChoice as KernelFitChoice,
  GARMENT_GROUPS,
  type GarmentGroup as KernelGarmentGroup,
  ID_PREFIXES,
  type IdKind,
  LENGTH_UNITS,
  MASS_UNITS,
  MATERIALS,
  MEASUREMENT_DEFINITIONS,
  MEASUREMENT_SOURCES,
  type Material as KernelMaterial,
  type MeasurementSource as KernelMeasurementSource,
  OCCASION_PRESETS,
  type OccasionPreset as KernelOccasionPreset,
  PREFERENCE_KINDS,
  PRESENTATIONS,
  type PreferenceKind as KernelPreferenceKind,
  type Presentation as KernelPresentation,
  SIZE_SYSTEMS,
  STARTING_SHAPES,
  STYLE_TYPES,
  type SizeSystem as KernelSizeSystem,
  type StyleType as KernelStyleType,
  UNIT_SYSTEMS,
  type UnitSystem as KernelUnitSystem,
  newId,
} from '@ai-stylist/shared-kernel';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ClimateTolerance,
  ConsentPurpose,
  EntitlementGrantKind,
  EntitlementLifecycleState,
  EntitlementName,
  FitChoice,
  GarmentGroup,
  Material,
  MeasurementSource,
  OccasionPreset,
  PreferenceKind,
  Presentation,
  SizeSystem,
  StyleType,
  UnitSystem,
} from '../gen/ts-client/index.js';
import bundle from '../gen/openapi.bundle.json' with { type: 'json' };

const schemas = bundle.components.schemas;

/** The parts of a bundled schema these pins read; other keywords pass through as `unknown`. */
type SchemaNode = {
  readonly [keyword: string]: unknown;
  readonly $ref?: string;
  readonly enum?: readonly unknown[];
  readonly properties?: Readonly<Record<string, SchemaNode>>;
};
const schemasByName: Readonly<Record<string, SchemaNode>> = schemas;

/** The component schema a local `$ref` (`#/components/schemas/<name>`) points at. */
function deref(node: SchemaNode | undefined): SchemaNode {
  const name = node?.$ref?.replace('#/components/schemas/', '');
  const target = name === undefined ? undefined : schemasByName[name];
  if (target === undefined) throw new Error(`unresolved $ref: ${String(node?.$ref)}`);
  return target;
}

describe('OpenAPI enums mirror the shared kernel', () => {
  it('ConsentPurpose equals CONSENT_PURPOSES value for value, in order', () => {
    expect(schemas.ConsentPurpose.enum).toEqual([...CONSENT_PURPOSES]);
    expectTypeOf<ConsentPurpose>().toEqualTypeOf<KernelConsentPurpose>();
  });

  const profileEnums = [
    ['Presentation', PRESENTATIONS],
    ['ClimateTolerance', CLIMATE_TOLERANCES],
    ['FitChoice', FIT_CHOICES],
    ['GarmentGroup', GARMENT_GROUPS],
    ['StyleType', STYLE_TYPES],
    ['PreferenceKind', PREFERENCE_KINDS],
    ['Material', MATERIALS],
    ['OccasionPreset', OCCASION_PRESETS],
    ['SizeSystem', SIZE_SYSTEMS],
    ['UnitSystem', UNIT_SYSTEMS],
    ['MeasurementSource', MEASUREMENT_SOURCES],
    ['LengthUnit', LENGTH_UNITS],
    ['MassUnit', MASS_UNITS],
  ] as const satisfies readonly (readonly [keyof typeof schemas, readonly string[]])[];

  it.each(profileEnums)('%s equals the kernel list value for value, in order', (name, values) => {
    expect(schemas[name].enum).toEqual([...values]);
  });

  it('generated profile enum types equal the kernel types', () => {
    expectTypeOf<Presentation>().toEqualTypeOf<KernelPresentation>();
    expectTypeOf<ClimateTolerance>().toEqualTypeOf<KernelClimateTolerance>();
    expectTypeOf<FitChoice>().toEqualTypeOf<KernelFitChoice>();
    expectTypeOf<GarmentGroup>().toEqualTypeOf<KernelGarmentGroup>();
    expectTypeOf<StyleType>().toEqualTypeOf<KernelStyleType>();
    expectTypeOf<PreferenceKind>().toEqualTypeOf<KernelPreferenceKind>();
    expectTypeOf<Material>().toEqualTypeOf<KernelMaterial>();
    expectTypeOf<OccasionPreset>().toEqualTypeOf<KernelOccasionPreset>();
    expectTypeOf<SizeSystem>().toEqualTypeOf<KernelSizeSystem>();
    expectTypeOf<UnitSystem>().toEqualTypeOf<KernelUnitSystem>();
    expectTypeOf<MeasurementSource>().toEqualTypeOf<KernelMeasurementSource>();
  });
});

describe('OpenAPI entitlements mirror the entitlement registry', () => {
  it('EntitlementName holds the 17 registered names, in registry order', () => {
    expect(schemas.EntitlementName.enum).toEqual(Object.keys(ENTITLEMENTS));
    expect(schemas.EntitlementName.enum).toHaveLength(17);
    expectTypeOf<EntitlementName>().toEqualTypeOf<KernelEntitlementName>();
  });

  it('EntitlementGrantKind and EntitlementLifecycleState equal the kernel lists, in order', () => {
    expect(schemas.EntitlementGrantKind.enum).toEqual([...ENTITLEMENT_GRANT_KINDS]);
    expect(schemas.EntitlementLifecycleState.enum).toEqual([...ENTITLEMENT_LIFECYCLE_STATES]);
    expectTypeOf<EntitlementGrantKind>().toEqualTypeOf<KernelEntitlementGrantKind>();
    expectTypeOf<EntitlementLifecycleState>().toEqualTypeOf<KernelEntitlementLifecycleState>();
  });

  it('EntitlementLevel accepts every registered level and is not an enum', () => {
    const { pattern, maxLength } = schemas.EntitlementLevel;
    const levels = Object.values(ENTITLEMENTS).flatMap((definition) =>
      'levels' in definition ? definition.levels : [],
    );
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      expect(new RegExp(pattern).test(level) && level.length <= maxLength, level).toBe(true);
    }
    expect(schemas.EntitlementLevel).not.toHaveProperty('enum');
  });
});

describe('OpenAPI measurements mirror the measurement-definitions registry', () => {
  const definitions = Object.entries(MEASUREMENT_DEFINITIONS);

  it('BodyMeasurements holds exactly the registered ids, in registry order, none required', () => {
    const body = schemas.BodyMeasurements;
    expect(Object.keys(body.properties)).toEqual(definitions.map(([id]) => id));
    expect(body).not.toHaveProperty('required');
  });

  it.each(definitions)('%s is typed with the unit of its definition', (id, definition) => {
    const measurement = deref(schemasByName.BodyMeasurements?.properties?.[id]);
    expect(deref(measurement.properties?.unit).enum).toEqual([definition.unit]);
  });
});

describe('OpenAPI lists keyed by kernel values', () => {
  it('FitPreferences keys are the garment groups that take a fit choice', () => {
    expect(Object.keys(schemas.FitPreferences.properties)).toEqual(
      GARMENT_GROUPS.filter((group) => group !== 'shoes'),
    );
  });

  it('UsualSizeList allows one entry per size system and garment group, no more', () => {
    expect(schemas.UsualSizeList.maxItems).toBe(SIZE_SYSTEMS.length * GARMENT_GROUPS.length);
  });

  it('StartingShapeId accepts every registered starting shape; its example is the default', () => {
    const { pattern, examples } = schemas.StartingShapeId;
    for (const shape of Object.keys(STARTING_SHAPES)) {
      expect(new RegExp(pattern).test(shape), shape).toBe(true);
    }
    expect(examples).toEqual([DEFAULT_STARTING_SHAPE]);
    expect(schemas.StartingShapeId).not.toHaveProperty('enum');
  });
});

describe('OpenAPI id patterns use the shared-kernel prefixes', () => {
  const idSchemas = [
    ['UserId', 'user'],
    ['ConsentRecordId', 'consentRecord'],
    ['ProfileId', 'profile'],
    ['DataExportId', 'exportRequest'],
    ['AccountDeletionRequestId', 'deletionRequest'],
  ] as const satisfies readonly (readonly [keyof typeof schemas, IdKind])[];

  it.each(idSchemas)('%s matches newId(%s) and no other kind', (schemaName, kind) => {
    const { pattern } = schemas[schemaName];
    const matches = (value: string): boolean => new RegExp(pattern).test(value);

    expect(pattern.startsWith(`^${ID_PREFIXES[kind]}_`)).toBe(true);
    expect(matches(newId(kind))).toBe(true);
    expect(matches(newId('event'))).toBe(false);
  });
});
