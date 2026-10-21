// Avatar starting shapes (planning/07 §3.1; owner decision 2026-10-13): the body shape the avatar
// starts from at onboarding, all on one base mesh. Independent of presentation: any presentation
// goes with any shape (REQ-ONB-050).
//
// Data lives in packages/shared-kernel/registry/starting-shapes.json (schema beside it); the tests
// check the schema and that the default is a registered shape.
import registry from '../registry/starting-shapes.json' with { type: 'json' };

/** Union of the registered starting shape ids, e.g. `'from_measurements'`. */
export type StartingShape = keyof typeof registry.shapes;

export type StartingShapeDefinition = {
  /** For engineers; user-facing labels live in each app. */
  readonly description: string;
};

/** Registry shape, in display order: `{ from_measurements: { description: '…' }, … }`. */
export const STARTING_SHAPES: { readonly [K in StartingShape]: StartingShapeDefinition } =
  registry.shapes;

/**
 * The shape preselected when the person makes no choice. The JSON import types `default` as
 * `string`; the tests check it is a registered shape.
 */
export const DEFAULT_STARTING_SHAPE = registry.default as StartingShape;

/** Base mesh id every starting shape is tied to (doc 07 §3.1, §3.2 `baseMeshId`). */
export const STARTING_SHAPE_BASE_MESH: string = registry.baseMesh;
