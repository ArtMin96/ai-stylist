// The bundled OpenAPI contract as the contract tests read it: the bundle itself, its component
// schemas, and an Ajv validator for any component schema, resolving `$ref`s inside the bundle.
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import bundle from '../gen/openapi.bundle.json' with { type: 'json' };

export { bundle };

/** The bundle's component schemas, typed from the JSON. */
export const schemas = bundle.components.schemas;

const BUNDLE_ID = 'https://contracts.ai-stylist.app/openapi.bundle.json';

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
// The bundle's components are a schema container, not a keyword: refs point into it.
ajv.addKeyword('components');
ajv.addSchema({ $id: BUNDLE_ID, components: bundle.components });

/** The validator of component schema `name`; throws when the bundle has no such schema. */
export function validatorFor(name: keyof typeof schemas) {
  const validate = ajv.getSchema(`${BUNDLE_ID}#/components/schemas/${name}`);
  if (!validate) throw new Error(`no schema ${name} in the bundle`);
  return validate;
}
