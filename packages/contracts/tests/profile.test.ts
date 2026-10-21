// Pins the shape rules of the profile contract (packages/contracts/openapi/modules/profile.yaml)
// that the kernel pins in kernel-enums.test.ts do not cover: every measurement carries value,
// unit, source and the confidence rule (P03-T02.2 AC-3), hard exclusions stay apart from soft
// dislikes (AC-5), and onboarding steps line up across progress, update and resume step.
import { MEASUREMENT_DEFINITIONS, MEASUREMENT_SOURCES } from '@ai-stylist/shared-kernel';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import bundle from '../gen/openapi.bundle.json' with { type: 'json' };

const schemas = bundle.components.schemas;
const BUNDLE_ID = 'https://contracts.ai-stylist.app/openapi.bundle.json';

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
// The bundle's components are a schema container, not a keyword: refs point into it.
ajv.addKeyword('components');
ajv.addSchema({ $id: BUNDLE_ID, components: bundle.components });

function validatorFor(name: keyof typeof schemas) {
  const validate = ajv.getSchema(`${BUNDLE_ID}#/components/schemas/${name}`);
  if (!validate) throw new Error(`no schema ${name} in the bundle`);
  return validate;
}

/** A value inside the hard bounds that describes no one: the registry's lower bound. */
const syntheticValue = (id: keyof typeof MEASUREMENT_DEFINITIONS): number =>
  MEASUREMENT_DEFINITIONS[id].min;

describe('measurement schemas (AC-3)', () => {
  const validateLength = validatorFor('LengthMeasurement');
  const validateMass = validatorFor('MassMeasurement');

  it('LengthMeasurement ships one valid example per source, in kernel order', () => {
    const { examples } = schemas.LengthMeasurement;
    expect(examples.map((example) => example.source)).toEqual([...MEASUREMENT_SOURCES]);
    for (const example of examples) {
      expect(validateLength(example), JSON.stringify(validateLength.errors)).toBe(true);
    }
  });

  it('estimated and derived examples carry confidence', () => {
    for (const example of schemas.LengthMeasurement.examples) {
      if (example.source !== 'user') expect(example).toHaveProperty('confidence');
    }
  });

  it.each(MEASUREMENT_SOURCES)('MassMeasurement accepts a %s value in kg', (source) => {
    const value = { value: syntheticValue('weight'), unit: 'kg', source, confidence: 0.5 };
    expect(validateMass(value), JSON.stringify(validateMass.errors)).toBe(true);
  });

  it('requires value, unit and source, and only the stored SI unit', () => {
    const height = { value: syntheticValue('height'), unit: 'cm', source: 'user' };
    expect(schemas.LengthMeasurement.required).toEqual(['value', 'unit', 'source']);
    expect(schemas.MassMeasurement.required).toEqual(['value', 'unit', 'source']);
    expect(validateLength({ ...height, unit: 'in' })).toBe(false);
    expect(validateLength({ ...height, unit: 'kg' })).toBe(false);
    expect(validateMass({ ...height, value: syntheticValue('weight') })).toBe(false);
    for (const key of ['value', 'unit', 'source'] as const) {
      const { [key]: _dropped, ...rest } = height;
      expect(validateLength(rest), key).toBe(false);
    }
  });

  it.each(MEASUREMENT_SOURCES.filter((source) => source !== 'user'))(
    'refuses a %s value without confidence, in a measurement and in a replacement',
    (source) => {
      const length = { value: syntheticValue('height'), unit: 'cm', source };
      const mass = { value: syntheticValue('weight'), unit: 'kg', source };
      const replace = validatorFor('MeasurementsReplacement');
      expect(validateLength(length)).toBe(false);
      expect(validateMass(mass)).toBe(false);
      expect(replace({ measurements: { height: length } })).toBe(false);
      expect(validateLength({ ...length, confidence: 0.5 })).toBe(true);
      expect(validateMass({ ...mass, confidence: 0.5 })).toBe(true);
    },
  );

  it('accepts a user value without confidence', () => {
    const height = { value: syntheticValue('height'), unit: 'cm', source: 'user' };
    const weight = { value: syntheticValue('weight'), unit: 'kg', source: 'user' };
    expect(validateLength(height), JSON.stringify(validateLength.errors)).toBe(true);
    expect(validateMass(weight), JSON.stringify(validateMass.errors)).toBe(true);
  });

  it('keeps confidence within 0..1', () => {
    const estimated = { value: syntheticValue('chest'), unit: 'cm', source: 'estimated' };
    expect(validateLength({ ...estimated, confidence: 1 })).toBe(true);
    expect(validateLength({ ...estimated, confidence: 1.5 })).toBe(false);
    expect(validateLength({ ...estimated, confidence: -0.1 })).toBe(false);
  });

  it('a replacement holds the measurement set only, and may be empty', () => {
    const validate = validatorFor('MeasurementsReplacement');
    expect(validate({ measurements: {} })).toBe(true);
    expect(validate({ measurements: {}, unitSystem: 'imperial' })).toBe(false);
  });
});

describe('preferences (AC-5)', () => {
  const lists = ['softDislikes', 'hardExclusions'] as const;

  it.each(['Preferences', 'PreferencesUpdate'] as const)(
    '%s keeps hard exclusions and soft dislikes as two properties',
    (name) => {
      const { properties } = schemas[name];
      for (const list of lists) expect(properties).toHaveProperty(list);
    },
  );

  it('the only kind of either list is material', () => {
    const validate = validatorFor('PreferenceItem');
    expect(schemas.PreferenceKind.enum).toEqual(['material']);
    expect(validate({ kind: 'material', value: 'wool' })).toBe(true);
    expect(validate({ kind: 'colour', value: 'wool' })).toBe(false);
    expect(validate({ kind: 'material', value: 'attr.material.wool' })).toBe(false);
  });

  it('a partial update needs at least one member and refuses null', () => {
    const validate = validatorFor('PreferencesUpdate');
    expect(validate({})).toBe(false);
    expect(validate({ climateTolerance: null })).toBe(false);
    expect(validate({ clear: ['climateTolerance', 'typicalDay'] })).toBe(true);
    expect(validate({ clear: ['styleTypes'] })).toBe(false);
  });

  it('a usual size is a short label text', () => {
    const validate = validatorFor('UsualSize');
    for (const size of schemas.UsualSize.properties.size.examples) {
      expect(validate({ system: 'EU', group: 'shoes', size }), size).toBe(true);
    }
    expect(validate({ system: 'EU', group: 'shoes', size: '' })).toBe(false);
    expect(validate({ system: 'EU', group: 'shoes', size: '123456789' })).toBe(false);
    expect(validate({ system: 'EU', group: 'shoes', size: '39;' })).toBe(false);
  });
});

describe('onboarding progress', () => {
  const snakeCase = (key: string): string => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  const stepKeys = Object.keys(schemas.OnboardingSteps.properties);

  it('progress keys are the OnboardingStep values in camelCase, in flow order', () => {
    expect(stepKeys.map(snakeCase)).toEqual(schemas.OnboardingStep.enum);
    expect(schemas.OnboardingSteps.required).toEqual(stepKeys);
  });

  it('an update names the same steps, at least one', () => {
    const validate = validatorFor('OnboardingProgressUpdate');
    expect(Object.keys(schemas.OnboardingStepsUpdate.properties)).toEqual(stepKeys);
    expect(validate({ steps: {} })).toBe(false);
    expect(validate({ steps: { heightWeight: 'skipped' } })).toBe(true);
    expect(validate({ steps: { heightWeight: 'pending' } })).toBe(false);
  });
});
