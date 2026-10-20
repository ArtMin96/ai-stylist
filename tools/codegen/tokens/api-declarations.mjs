// Component API models (contract-model.mjs) -> one language-neutral declaration tree for the
// generated component API surface (ADR-0011 follow-up 7, DEC-87: `ComponentAPI.swift`,
// `ComponentApi.kt`). Per contract, with `<Name>` from its id (`button` -> `Button`): the variant,
// size and state enums, the test-ID constants, the merged look (`<Name>Appearance`), one look per
// allowed combination (`<Name>Look`), the per-context tables (`<Name>Spec`) and the gallery entry
// type. An icon set (`kind: icon-set`) gets its enums and glyph types here and its glyph table in
// a file of its own (icon-declarations.mjs). Then `GalleryComponent` (the gallery sections of
// every contract, in board order) and `ComponentGallery` (the control cells). Every name and value
// is decided here; emit-api-swift.mjs and emit-api-kotlin.mjs only spell it with the token
// dialects.
import { testIdOf } from './contract-model.mjs';
import { iconSetDeclarations } from './icon-declarations.mjs';
import { isIconSet } from './icon-set.mjs';
import { apiTypeName, contextId, memberId, testIdName } from './naming.mjs';

/**
 * `{ api, tables }`: the declarations of the API file in emission order (each contract's in file
 * order, then the gallery), and one `{ name, decls }` per icon set for its glyph-table file.
 */
export function apiDeclarations(apis) {
  const iconSets = new Map(apis.filter(isIconSet).map((api) => [api, iconSetDeclarations(api)]));
  const controls = apis.filter((api) => !isIconSet(api));
  return {
    api: [
      ...apis.flatMap((api) => iconSets.get(api)?.api ?? componentDeclarations(api)),
      galleryComponentDeclaration(apis),
      galleryDeclaration(controls),
    ],
    tables: [...iconSets.values()].map(({ table }) => table),
  };
}

/**
 * `GalleryComponent`: one case per contract in board order (`C01` first), its id the contract
 * id, with the gallery section's `title` and `slug`. The galleries switch over it exhaustively, so
 * a new contract fails their build until it has a renderer.
 */
function galleryComponentDeclaration(apis) {
  const byBoard = [...apis].sort((a, b) => a.board.localeCompare(b.board));
  return {
    kind: 'enum',
    name: 'GalleryComponent',
    doc: 'The gallery sections of the components, in board order, each with its contract id.',
    cases: byBoard.map(({ id, gallery }) => ({
      name: memberId(id),
      id,
      values: {
        title: { t: 'string', s: gallery.title },
        slug: { t: 'string', s: gallery.slug },
      },
    })),
    fields: [
      {
        name: 'title',
        type: 'string',
        doc: 'The section title: the board and the contract `gallery.title`.',
      },
      {
        name: 'slug',
        type: 'string',
        doc: 'The kebab-case title: the section id is `ds-gallery-section-<slug>`.',
      },
    ],
  };
}

/** `{ variant, size, state }` as the arguments of a struct value, each an enum case. */
function comboArgs(api, combo) {
  return ['variant', 'size', 'state'].map((axis) => {
    const type = apiTypeName(api.id, pascalAxis(axis));
    return { name: axis, type, value: { t: 'case', type, id: memberId(combo[axis]) } };
  });
}

const pascalAxis = (axis) => axis[0].toUpperCase() + axis.slice(1);

const struct = (name, doc, fields, extra = {}) => ({
  kind: 'struct',
  name,
  doc,
  fields,
  nested: [],
  instances: [],
  ...extra,
});

function componentDeclarations(api) {
  const type = (suffix) => apiTypeName(api.id, suffix);
  const name = `\`${api.name}\``;
  const axis = (suffix, ids, noun) => ({
    kind: 'enum',
    name: type(suffix),
    doc: `${noun} of ${name} (${api.file}, board ${api.board}), each with its contract id.`,
    cases: ids.map((id) => ({ name: memberId(id), id })),
  });
  const keys = ['variant', 'size', 'state'].map((key) => ({
    name: key,
    type: type(pascalAxis(key)),
  }));
  const appearanceFields = api.fields.map(({ name: field, type: t, optional }) => ({
    name: field,
    type: optional ? `${t}?` : t,
  }));
  const looksType = `list:${type('Look')}`;
  return [
    axis('Variant', api.variants, 'Variants'),
    axis('Size', api.sizes, 'Sizes'),
    axis('State', api.states, 'States'),
    {
      kind: 'namespace',
      name: type('TestId'),
      doc: `Test IDs of ${name}: the iOS accessibilityIdentifier and the Android testTag.`,
      members: api.combinations.map((combo) => ({
        kind: 'const',
        name: testIdName(combo),
        type: 'string',
        value: { t: 'string', s: testIdOf(api.id, combo) },
      })),
    },
    struct(
      type('Appearance'),
      `One merged ${name} look (base, state, size): colours are role keys, sizes pt/dp.`,
      appearanceFields,
    ),
    struct(type('Look'), `An allowed ${name} combination and its merged look.`, [
      ...keys,
      { name: 'appearance', type: type('Appearance') },
    ]),
    struct(
      type('Spec'),
      `Every allowed ${name} combination and its look, one instance per context.`,
      [{ name: 'looks', type: looksType }],
      {
        instances: api.contexts.map((context) => ({
          name: contextId(context),
          value: specValue(api, context, type, appearanceFields),
        })),
        find: {
          name: 'appearance',
          doc: 'The merged look of an allowed combination; none when the contract does not allow it.',
          list: 'looks',
          keys,
          result: 'appearance',
          resultType: type('Appearance'),
        },
      },
    ),
    struct(type('GalleryEntry'), `One ${name} gallery cell and its test ID.`, [
      ...keys,
      { name: 'testId', type: 'string' },
    ]),
  ];
}

/** `<Name>Spec(looks: [<Name>Look(…), …])` for one context. */
function specValue(api, context, type, appearanceFields) {
  const look = ({ values, ...combo }) => ({
    t: 'init',
    struct: type('Look'),
    args: [
      ...comboArgs(api, combo),
      {
        name: 'appearance',
        type: type('Appearance'),
        value: {
          t: 'init',
          struct: type('Appearance'),
          args: appearanceFields.map(({ name, type: t }) => ({
            name,
            type: t,
            value: values[name]?.value ?? { t: 'none' },
          })),
        },
      },
    ],
  });
  const looks = { t: 'list', items: api.looks[context].map(look) };
  return {
    t: 'init',
    struct: type('Spec'),
    args: [{ name: 'looks', type: `list:${type('Look')}`, value: looks }],
  };
}

/**
 * `ComponentGallery`: per control contract its gallery label and its entries, in contract order.
 * An icon set's gallery reads its `<Name>Name` cases instead.
 */
function galleryDeclaration(apis) {
  return {
    kind: 'namespace',
    name: 'ComponentGallery',
    doc: 'The gallery: per component its synthetic label and its cells (contract `gallery`).',
    members: apis.flatMap((api) => {
      const entry = apiTypeName(api.id, 'GalleryEntry');
      const testIds = apiTypeName(api.id, 'TestId');
      const item = (combo) => ({
        t: 'init',
        struct: entry,
        args: [
          ...comboArgs(api, combo),
          {
            name: 'testId',
            type: 'string',
            value: { t: 'ref', namespace: testIds, member: testIdName(combo) },
          },
        ],
      });
      return [
        {
          kind: 'const',
          name: `${memberId(api.id)}Label`,
          type: 'string',
          value: { t: 'string', s: api.gallery.label },
        },
        {
          kind: 'const',
          name: memberId(api.id),
          type: `list:${entry}`,
          value: { t: 'list', items: api.gallery.items.map(item) },
        },
      ];
    }),
  };
}
