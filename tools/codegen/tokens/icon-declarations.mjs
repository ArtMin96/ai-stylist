// An icon-set API model (icon-set.mjs) -> its language-neutral declarations (C02 icons, Linear
// AI-201). With `<Name>` the contract `name` (`AppIcon`): `<Name>Name` (one case per glyph, in
// contract order, with its set, gallery test ID and glyph), `<Name>Set`, `<Name>Size` (the icon
// scale: one case per step, `icon-md` -> `md`, with its token size and stroke width),
// `<Name>Metrics` (the viewBox and the default size) and the
// glyph value types; then, for its own file, `<Name>Glyphs`: the glyph table, one nested
// namespace per glyph so no Kotlin class initialiser holds more than one glyph (the JVM's 64 KB
// method limit). emit-api-swift.mjs and emit-api-kotlin.mjs only spell it.
import { NAME_FIELDS, VIEW_BOX, iconTestIdOf } from './icon-set.mjs';
import { memberId, nestedTypeName } from './naming.mjs';
import { PATH_COMMANDS } from './svg-path.mjs';
import { iconStepOf } from './syntax.mjs';

const caseValue = (type, id) => ({ t: 'case', type, id: memberId(id) });

/** A size's case: its step without the token prefix (`icon-xs` -> `xs`, Kotlin `XS`). */
const sizeCaseOf = (id) => memberId(iconStepOf(id));

/** `{ api, table }`: the declarations of the API file and the glyph table's own file. */
export function iconSetDeclarations(api) {
  const type = (suffix) => `${api.name}${suffix}`;
  const owner = `\`${api.name}\` (${api.file}, board ${api.board})`;
  const glyphs = type('Glyphs');
  /** An enum of `ids`; `nameOf` names a case (the id by default), `values` fills `fields`. */
  const enumOf = (suffix, ids, doc, options = {}) => {
    const { fields = [], values = () => ({}), nameOf = memberId } = options;
    return {
      kind: 'enum',
      name: type(suffix),
      doc,
      cases: ids.map((id) => ({ name: nameOf(id), id, values: values(id) })),
      fields,
    };
  };
  const struct = (suffix, doc, fields) => ({
    kind: 'struct',
    name: type(suffix),
    doc,
    fields,
    nested: [],
    instances: [],
  });
  const nameFields = {
    set: { type: type('Set'), doc: 'The set the glyph belongs to (contract `set`).' },
    testId: { type: 'string', doc: 'The gallery test ID: `ds-icon-<id>` on both platforms.' },
    glyph: { type: type('Glyph'), doc: `The compiled glyph (\`${glyphs}\`).` },
  };
  const sizesById = Object.fromEntries(api.sizes.map((size) => [size.id, size]));
  const number = (n) => ({ t: 'number', n });
  const apiDecls = [
    enumOf(
      'Name',
      api.glyphs.map(({ id }) => id),
      `Glyphs of ${owner}, each with its contract id, in contract order.`,
      {
        fields: NAME_FIELDS.map((name) => ({ name, ...nameFields[name] })),
        values: (id) => {
          const { set } = api.glyphs.find((glyph) => glyph.id === id);
          return {
            set: caseValue(type('Set'), set),
            testId: { t: 'string', s: iconTestIdOf(id) },
            glyph: { t: 'ref', namespace: `${glyphs}.${nestedTypeName(id)}`, member: 'glyph' },
          };
        },
      },
    ),
    enumOf('Set', api.sets, `Glyph sets of ${owner}, in first-appearance order.`),
    enumOf(
      'Size',
      api.sizes.map(({ id }) => id),
      `The icon scale of ${owner}: each step a DESIGN.md \`components.icon-<step>\` token.`,
      {
        fields: [
          { name: 'size', type: 'double', doc: 'The icon box: pt on iOS, dp on Android.' },
          {
            name: 'strokeWidth',
            type: 'double',
            doc: 'The stroke width in viewBox units: drawn at strokeWidth x size / viewBox.',
          },
        ],
        values: (id) => ({
          size: number(sizesById[id].size),
          strokeWidth: number(sizesById[id].strokeWidth),
        }),
        nameOf: sizeCaseOf,
      },
    ),
    {
      kind: 'namespace',
      name: type('Metrics'),
      doc: `The viewBox every ${api.name} glyph is drawn in, and the default size.`,
      members: [
        { kind: 'const', name: 'viewBox', type: 'double', value: number(VIEW_BOX) },
        {
          kind: 'const',
          name: 'defaultSize',
          type: type('Size'),
          value: { t: 'case', type: type('Size'), id: sizeCaseOf(api.defaultSize) },
        },
      ],
    },
    struct('Glyph', `One ${api.name} glyph: its shapes, painted in order.`, [
      { name: 'shapes', type: `list:${type('Shape')}` },
    ]),
    struct('Shape', 'One path of a glyph and how it is painted, in viewBox units.', [
      { name: 'paint', type: type('Paint') },
      { name: 'segments', type: `list:${type('Segment')}` },
    ]),
    enumOf('Paint', api.paints, 'How a shape is painted: stroked, filled, or both.'),
    struct(
      'Segment',
      'One absolute path command; points are x, y pairs: 1 (move, line), 3 (cubic), 0 (close).',
      [
        { name: 'command', type: type('Command') },
        { name: 'points', type: 'doubleList' },
      ],
    ),
    enumOf('Command', PATH_COMMANDS, 'The path commands a compiled glyph uses.'),
  ];
  return { api: apiDecls, table: { name: glyphs, decls: [glyphTable(api, type, glyphs)] } };
}

/** `<Name>Glyphs`: per glyph a nested namespace holding its one `glyph` value. */
function glyphTable(api, type, name) {
  const segment = ({ command, points }) => ({
    t: 'init',
    struct: type('Segment'),
    args: [
      { name: 'command', type: type('Command'), value: caseValue(type('Command'), command) },
      {
        name: 'points',
        type: 'doubleList',
        value: { t: 'list', items: points.map((n) => ({ t: 'number', n })) },
      },
    ],
  });
  const shape = ({ paint, segments }) => ({
    t: 'init',
    struct: type('Shape'),
    args: [
      { name: 'paint', type: type('Paint'), value: caseValue(type('Paint'), paint) },
      {
        name: 'segments',
        type: `list:${type('Segment')}`,
        value: { t: 'list', items: segments.map(segment) },
      },
    ],
  });
  const glyph = ({ shapes }) => ({
    t: 'init',
    struct: type('Glyph'),
    args: [
      {
        name: 'shapes',
        type: `list:${type('Shape')}`,
        value: { t: 'list', items: shapes.map(shape) },
      },
    ],
  });
  return {
    kind: 'namespace',
    name,
    doc: `The ${api.name} glyph table (${api.file}): read a glyph as \`${type('Name')}.glyph\`.`,
    members: api.glyphs.map((g) => ({
      kind: 'namespace',
      name: nestedTypeName(g.id),
      members: [{ kind: 'const', name: 'glyph', type: type('Glyph'), value: glyph(g) }],
    })),
  };
}
