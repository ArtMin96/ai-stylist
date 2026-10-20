// The in-memory DTCG model -> one language-neutral declaration tree in DEC-87's three tiers:
// reference scales -> scheme roles -> component tokens. Every name and value is decided here once,
// so the Swift and Kotlin emitters (emit-swift.mjs, emit-kotlin.mjs) only spell it.
//
// Declarations: namespace { name, doc, members } · struct { name, doc, fields } ·
// roles { name, doc, valuesType, cases } · colors { name, doc, roleType, fields, instances }.
// Members: const { name, type, value } or a nested namespace. Types: double, int, string, color,
// role, textStyle, stringList, doubleList. Values: number, color (32-bit ARGB), string, list,
// role (a role id, never a resolved colour), ref (another constant), init (a struct value).
import { contextId, memberId, nestedTypeName, tokensTypeName } from './naming.mjs';
import { resolveColors } from './normalise.mjs';
import { CONTEXTS } from './syntax.mjs';

export const TIERS = [
  { tier: 'reference', file: 'ReferenceTokens', title: 'Tier 1 of 3: reference scales' },
  { tier: 'scheme', file: 'SchemeTokens', title: 'Tier 2 of 3: scheme roles' },
  { tier: 'component', file: 'ComponentTokens', title: 'Tier 3 of 3: component tokens' },
];

const NAMESPACE_OF = {
  spacing: 'AppSpacing',
  rounded: 'AppRadius',
  typography: 'AppTypography',
  elevation: 'AppElevation',
  motion: 'AppMotion',
};
const TYPE_OF_TOKEN = {
  color: 'role',
  dimension: 'double',
  number: 'double',
  duration: 'double',
  cubicBezier: 'doubleList',
  typography: 'textStyle',
};
const TEXT_STYLE_FIELDS = [
  ['fontFamily', 'string'],
  ['fontSize', 'double'],
  ['fontWeight', 'int'],
  ['lineHeight', 'double'],
  ['letterSpacing', 'double'],
  ['dynamicType', 'string'],
  ['m3Roles', 'stringList'],
];

/** `{ reference, scheme, component }`: the declarations of each tier, in emission order. */
export function declarations(model) {
  const { primitives, components } = model.sets;
  const scale = (group, doc) => ({
    kind: 'namespace',
    name: NAMESPACE_OF[group],
    doc,
    members: membersOf(primitives[group], (key) => memberId(key, group)),
  });
  return {
    reference: [
      scale('spacing', 'Spacing scale (`spacing`): pt on iOS, dp on Android.'),
      scale('rounded', 'Corner radii (`rounded`): pt on iOS, dp on Android.'),
      {
        kind: 'struct',
        name: 'AppTextStyle',
        doc: 'A type style: sizes in pt/sp, letter spacing in pt/sp, line height as a height.',
        fields: TEXT_STYLE_FIELDS.map(([name, type]) => ({ name, type })),
      },
      {
        kind: 'namespace',
        name: 'AppTypography',
        doc: 'Type styles (`typography`), each with its Dynamic Type style and M3 roles.',
        members: Object.entries(primitives.typography).map(([key, token]) => ({
          kind: 'const',
          name: memberId(key),
          type: 'textStyle',
          value: textStyleValue(token),
        })),
      },
      scale('elevation', 'Elevation (`elevation`): dimensions in pt/dp, colours as role keys.'),
      scale('motion', 'Motion (`motion`): durations in ms, curves as cubic-bezier points.'),
    ],
    scheme: [
      {
        kind: 'roles',
        name: 'AppColorRole',
        valuesType: 'AppColors',
        doc: 'Colour role keys: resolve one with `AppColors` for the active context.',
        cases: model.roles.map(({ key }) => memberId(key)),
      },
      colorsDeclaration(model),
    ],
    component: Object.entries(components).map(([component, group]) => ({
      kind: 'namespace',
      name: tokensTypeName(component),
      doc: `Component \`${component}\`: colours are role keys, sizes in pt/dp.`,
      members: membersOf(group, (prop) => prop),
    })),
  };
}

const isToken = (node) => Object.hasOwn(node, '$value');

/** Tokens become constants first, then each group becomes a nested namespace. */
function membersOf(group, idOf) {
  const entries = Object.entries(group);
  return [
    ...entries
      .filter(([, node]) => isToken(node))
      .map(([key, token]) => ({ kind: 'const', name: idOf(key), ...typedValue(token) })),
    ...entries
      .filter(([, node]) => !isToken(node))
      .map(([key, node]) => ({
        kind: 'namespace',
        name: nestedTypeName(key),
        members: membersOf(node, (field) => field),
      })),
  ];
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;

function typedValue(token) {
  const type = TYPE_OF_TOKEN[token.$type];
  const v = token.$value;
  if (typeof v === 'string') return { type, value: aliasValue(v) };
  if (token.$type === 'cubicBezier') {
    return { type, value: { t: 'list', items: v.map((n) => ({ t: 'number', n })) } };
  }
  if (token.$type === 'number') return { type, value: { t: 'number', n: round4(v) } };
  return { type, value: { t: 'number', n: round4(v.value) } };
}

/** `{colors.surface-2}` -> role `surface2`; `{rounded.full}` -> ref `AppRadius.full`. */
function aliasValue(alias) {
  const [group, key] = alias.slice(1, -1).split('.');
  if (group === 'colors') return { t: 'role', id: memberId(key) };
  return { t: 'ref', namespace: NAMESPACE_OF[group], member: memberId(key, group) };
}

function textStyleValue({ $value: v, $extensions: ext }) {
  const values = {
    fontFamily: { t: 'string', s: v.fontFamily[0] },
    fontSize: { t: 'number', n: round4(v.fontSize.value) },
    fontWeight: { t: 'number', n: v.fontWeight },
    lineHeight: { t: 'number', n: round4(v.lineHeight * v.fontSize.value) },
    letterSpacing: { t: 'number', n: round4(v.letterSpacing.value) },
    dynamicType: { t: 'string', s: ext['app.dynamicType'] },
    m3Roles: { t: 'list', items: ext['app.m3Roles'].map((s) => ({ t: 'string', s })) },
  };
  return {
    t: 'init',
    struct: 'AppTextStyle',
    args: TEXT_STYLE_FIELDS.map(([name, type]) => ({ name, type, value: values[name] })),
  };
}

/** 32-bit ARGB from a DTCG colour (alpha rounded to the nearest of 255 steps). */
const argb = ({ hex, alpha }) => Math.round(alpha * 255) * 2 ** 24 + parseInt(hex.slice(1), 16);

function colorsDeclaration(model) {
  const fields = model.roles.map(({ key }) => memberId(key));
  return {
    kind: 'colors',
    name: 'AppColors',
    roleType: 'AppColorRole',
    doc: 'Every colour role resolved for one context (DESIGN.md schemes; ARGB).',
    fields,
    instances: CONTEXTS.map((context) => {
      const resolved = Object.values(resolveColors(model, context));
      return {
        name: contextId(context),
        args: fields.map((name, i) => ({
          name,
          type: 'color',
          value: { t: 'color', argb: argb(resolved[i]) },
        })),
      };
    }),
  };
}
