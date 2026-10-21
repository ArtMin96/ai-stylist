// Component API models (contract-model.mjs) -> one language-neutral declaration tree for the
// generated component API surface (ADR-0011 follow-up 7, DEC-87: `ComponentAPI.swift`,
// `ComponentApi.kt`). Per contract, with `<Name>` from its id (`button` -> `Button`): the variant
// (with each variant's role and parts), size and state enums, the role enum, the enum props, the
// parts, the icon source, the test-ID constants, the merged look (`<Name>Appearance`), one look
// per allowed combination (`<Name>Look`), the per-context tables (`<Name>Spec`, each context's
// looks in a holder of its own) and the gallery entry type. An icon set (`kind: icon-set`) gets
// its enums and glyph types here and its glyph table in a file of its own
// (icon-declarations.mjs). Then `GalleryComponent` (the gallery sections of every contract, in
// board order) and `ComponentGallery` (the control cells and their samples). Every name and value
// is decided here; emit-api-swift.mjs and emit-api-kotlin.mjs only spell it with the token
// dialects.
import { testIdOf } from './contract-model.mjs';
import { iconSetDeclarations } from './icon-declarations.mjs';
import { isIconSet } from './icon-set.mjs';
import { apiTypeName, contextId, memberId, nestedTypeName, testIdName } from './naming.mjs';

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

const caseOf = (type, id) => ({ t: 'case', type, id: memberId(id) });

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
  const owner = `${name} (${api.file}, board ${api.board})`;
  /**
   * A closed set of ids; `fields` and `values(id)` add the enum's own fields, `nameOf` names a
   * case (`memberId` of a kebab id).
   */
  const enumOf = (enumName, ids, doc, fields = [], values = () => ({}), nameOf = memberId) => ({
    kind: 'enum',
    name: enumName,
    doc,
    cases: ids.map((id) => ({ name: nameOf(id), id, values: values(id) })),
    fields,
  });
  const axis = (suffix, ids, noun, fields, values) =>
    enumOf(type(suffix), ids, `${noun} of ${owner}, each with its contract id.`, fields, values);
  const keys = ['variant', 'size', 'state'].map((key) => ({
    name: key,
    type: type(pascalAxis(key)),
  }));
  const appearanceFields = api.fields.map(({ name: field, type: t, optional }) => ({
    name: field,
    type: optional ? `${t}?` : t,
  }));
  const looksType = `list:${type('Look')}`;
  const { fields: variantFields, values: variantValues } = variantExtras(api, type);
  return [
    axis('Variant', api.variants, 'Variants', variantFields, variantValues),
    axis('Size', api.sizes, 'Sizes'),
    axis('State', api.states, 'States'),
    axis('Role', api.roles, 'Accessibility roles'),
    ...api.enums.map(({ prop, type: enumType, values }) =>
      enumOf(enumType, values, `Values of the \`${prop}\` prop of ${owner}.`),
    ),
    ...partDeclarations(api, type, axis, enumOf),
    ...iconSourceDeclarations(api, name),
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
    ...accessibilityDeclarations(api, type, name),
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
      `Every allowed ${name} combination and its look, per context; each context in a holder.`,
      [{ name: 'looks', type: looksType }],
      {
        // Private, so only the Spec's own initialiser reaches a holder: on the JVM a holder read
        // first would build its Spec while the Spec class waits on that holder, leaving a null.
        nested: api.contexts.map((context) => ({
          kind: 'namespace',
          name: holderName(context),
          access: 'private',
          members: [
            {
              kind: 'const',
              name: 'spec',
              type: type('Spec'),
              value: specValue(api, context, type, appearanceFields),
            },
          ],
        })),
        instances: api.contexts.map((context) => ({
          name: contextId(context),
          value: { t: 'ref', namespace: holderName(context), member: 'spec' },
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
    struct(type('GalleryEntry'), `One ${name} gallery cell, its test ID and sample label.`, [
      ...keys,
      { name: 'testId', type: 'string' },
      { name: 'label', type: 'string' },
    ]),
  ];
}

/** The holder of one context's looks: `hc-light` -> `HcLight` (`ChipSpec.HcLight.spec`). */
const holderName = (context) => nestedTypeName(contextId(context));

/** The variant enum's own fields: its role (G7) and, with parts, the parts it draws (G12). */
function variantExtras(api, type) {
  const role = { name: 'role', type: type('Role'), doc: 'The accessibility role of the variant.' };
  const fields = [role];
  if (api.parts.length > 0) {
    fields.push({
      name: 'parts',
      type: `list:${type('Part')}`,
      doc: 'The parts the variant draws beside its label, in contract order.',
    });
  }
  const values = (variant) => ({
    role: caseOf(type('Role'), api.variantRoles[variant]),
    parts: {
      t: 'list',
      items: api.parts
        .filter(({ variants }) => variants.includes(variant))
        .map((part) => ({ t: 'case', type: type('Part'), id: part.name })),
    },
  });
  return { fields, values };
}

/**
 * `<Name>PartKind`, `<Name>PartPosition` and `<Name>Part` (G12), when the contract has parts:
 * each part with its kind, position, the resource key of its separator copy (none without one)
 * and whether its line opens with the variant's leading icon. A part is named by its prop name,
 * already lowerCamelCase (`outerRing`, Kotlin `OUTER_RING`), so its case is that name.
 */
function partDeclarations(api, type, axis, enumOf) {
  if (api.parts.length === 0) return [];
  const fields = [
    { name: 'kind', type: type('PartKind'), doc: 'What fills the part (contract `kind`).' },
    { name: 'position', type: type('PartPosition'), doc: 'Where it sits (contract `position`).' },
    {
      name: 'separatorKey',
      type: 'string?',
      doc: 'The string resource of the copy drawn before its text, in both apps (`separator`).',
    },
    {
      name: 'takesLeadingIcon',
      type: 'bool',
      doc: "Its line opens with the variant's leading icon instead of the label's (`icon`).",
    },
  ];
  const byName = Object.fromEntries(api.parts.map((part) => [part.name, part]));
  const values = (partName) => {
    const part = byName[partName];
    return {
      kind: caseOf(type('PartKind'), part.kind),
      position: caseOf(type('PartPosition'), part.position),
      separatorKey: part.separatorKey ? { t: 'string', s: part.separatorKey } : { t: 'none' },
      takesLeadingIcon: { t: 'bool', b: part.takesLeadingIcon },
    };
  };
  const doc = `Parts of \`${api.name}\` beside its label (${api.file} \`parts\`), in contract order.`;
  return [
    axis('PartKind', api.partKinds, 'Part kinds'),
    axis('PartPosition', api.partPositions, 'Part positions'),
    enumOf(
      type('Part'),
      api.parts.map((part) => part.name),
      doc,
      fields,
      values,
      (partName) => partName,
    ),
  ];
}

/**
 * `<Name>Accessibility` for a contract with `accessibility.minTouchTarget` (G9): the minimum touch
 * target, one name in both languages, each spelling its own platform's value (a `platform` value:
 * 44 pt in Swift, 48 dp in Kotlin).
 */
function accessibilityDeclarations(api, type, name) {
  if (!api.minTouchTarget) return [];
  const { ios, android } = api.minTouchTarget;
  const minTouchTarget = {
    t: 'platform',
    values: { ios: { t: 'number', n: ios }, android: { t: 'number', n: android } },
  };
  return [
    {
      kind: 'namespace',
      name: type('Accessibility'),
      doc: `The minimum touch target of ${name} (\`accessibility.minTouchTarget\`): pt on iOS, dp on Android.`,
      members: [{ kind: 'const', name: 'minTouchTarget', type: 'double', value: minTouchTarget }],
    },
  ];
}

/** `<Name>IconSource` (G4) beside an approved icon set: a glyph of its name enum, or the prop. */
function iconSourceDeclarations(api, name) {
  if (!api.iconSource) return [];
  const { sourceType, nameType } = api.iconSource;
  return [
    {
      kind: 'union',
      name: sourceType,
      doc: `Where an icon of ${name} comes from: a glyph of the icon set, or the caller's prop.`,
      cases: [
        {
          name: 'glyph',
          doc: `A glyph of the icon set (\`${nameType}\`).`,
          fields: [{ name: 'name', type: nameType }],
        },
        { name: 'prop', doc: "The caller's icon prop.", fields: [] },
      ],
    },
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
 * `ComponentGallery`: per control contract its gallery label, its samples (`gallery.props`, one
 * constant per prop: `<id><Prop>`) and its entries, in contract order, each with its sample label:
 * the variant's own `gallery.labels` entry (CC-19), else `gallery.label`. An icon set's gallery
 * reads its `<Name>Name` cases instead.
 */
function galleryDeclaration(apis) {
  return {
    kind: 'namespace',
    name: 'ComponentGallery',
    doc: 'The gallery: per component its synthetic label, samples and cells (contract `gallery`).',
    members: apis.flatMap((api) => {
      const entry = apiTypeName(api.id, 'GalleryEntry');
      const testIds = apiTypeName(api.id, 'TestId');
      const { label, labels } = api.gallery;
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
          {
            name: 'label',
            type: 'string',
            value: { t: 'string', s: labels[combo.variant] ?? label },
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
        ...api.samples.map(({ prop, type, value }) => ({
          kind: 'const',
          name: `${memberId(api.id)}${nestedTypeName(prop)}`,
          type,
          value,
        })),
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
