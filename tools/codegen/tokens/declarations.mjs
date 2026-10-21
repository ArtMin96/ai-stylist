// The in-memory DTCG model -> one language-neutral declaration tree in DEC-87's three tiers:
// reference scales -> scheme roles -> component tokens. Every name and value is decided here once,
// so the Swift and Kotlin emitters (emit-swift.mjs, emit-kotlin.mjs) only spell it.
//
// Declarations: namespace { name, doc, members } · struct { name, doc, fields, nested, instances,
// lookup } · roles { name, doc, valuesType, cases: [{ name, id }] }. Members: const { name, type,
// value } or a nested namespace. Types: double, int, string, color, role, textStyle, stringList,
// doubleList, list:<Struct>, or the name of a nested struct. Values: number, color (32-bit ARGB),
// string, list, role (a role id, never a resolved colour), ref (another constant), init (a struct
// value { struct, args }).
import { contextId, memberId, nestedTypeName, roundTo, tokensTypeName } from './naming.mjs';
import { CONTEXT_SOURCES, resolveColors, resolveComponents } from './normalise.mjs';
import { CONTEXTS, splitScheme } from './syntax.mjs';

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
  ['name', 'string'],
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
  const { primitives } = model.sets;
  const scale = (group, doc) => ({
    kind: 'namespace',
    name: NAMESPACE_OF[group],
    doc,
    members: membersOf(primitives[group], (key) => memberId(key, group)),
  });
  /** A scale whose namespace ends with `all`: every step, named by its DESIGN.md key. */
  const steppedScale = (group, doc) => {
    const namespace = scale(group, doc);
    return { ...namespace, members: [...namespace.members, scaleSteps(group, primitives[group])] };
  };
  const typography = Object.entries(primitives.typography).map(([key, token]) => ({
    kind: 'const',
    name: memberId(key),
    type: 'textStyle',
    value: textStyleValue(key, token),
  }));
  const allStyles = {
    kind: 'const',
    name: 'all',
    type: 'list:textStyle',
    value: { t: 'list', items: typography.map(({ name }) => ref('AppTypography', name)) },
  };
  return {
    reference: [
      {
        kind: 'struct',
        name: 'AppScaleStep',
        doc: 'One step of a scale: its DESIGN.md key (`spacing-4`, `rounded-full`) and value (pt/dp).',
        fields: [
          { name: 'name', type: 'string' },
          { name: 'value', type: 'double' },
        ],
        nested: [],
        instances: [],
      },
      steppedScale('spacing', 'Spacing scale (`spacing`): pt on iOS, dp on Android.'),
      steppedScale('rounded', 'Corner radii (`rounded`): pt on iOS, dp on Android.'),
      {
        kind: 'struct',
        name: 'AppTextStyle',
        doc: 'A type style: sizes in pt/sp, letter spacing in pt/sp, line height as a height.',
        fields: TEXT_STYLE_FIELDS.map(([name, type]) => ({ name, type })),
        nested: [],
        instances: [],
      },
      {
        kind: 'namespace',
        name: 'AppTypography',
        doc: 'Type styles (`typography`), each with its DESIGN.md key, Dynamic Type style, M3 roles.',
        members: [...typography, allStyles],
      },
      scale('elevation', 'Elevation (`elevation`): sizes in pt/dp, colours as roles or ARGB.'),
      scale('motion', 'Motion (`motion`): durations in ms, curves as cubic-bezier points.'),
    ],
    scheme: [
      {
        kind: 'roles',
        name: 'AppColorRole',
        valuesType: 'AppColors',
        doc: 'Colour roles, each with its DESIGN.md key: resolve one with `AppColors` for a context.',
        cases: model.roles.map(({ key }) => ({ name: memberId(key), id: key })),
      },
      colorsDeclaration(model),
    ],
    component: componentDeclarations(model),
  };
}

const isToken = (node) => Object.hasOwn(node, '$value');

const ref = (namespace, member) => ({ t: 'ref', namespace, member });

/**
 * `all`: one `AppScaleStep` per token of the scale, in model (DESIGN.md) order, its name the
 * DESIGN.md key (`spacing-4`, `rounded-full`) and its value a reference to the scale's constant.
 */
function scaleSteps(group, tokens) {
  const namespace = NAMESPACE_OF[group];
  const step = (key) => ({
    t: 'init',
    struct: 'AppScaleStep',
    args: [
      { name: 'name', type: 'string', value: { t: 'string', s: `${group}-${key}` } },
      { name: 'value', type: 'double', value: ref(namespace, memberId(key, group)) },
    ],
  });
  const keys = Object.keys(tokens).filter((key) => isToken(tokens[key]));
  return {
    kind: 'const',
    name: 'all',
    type: 'list:AppScaleStep',
    value: { t: 'list', items: keys.map(step) },
  };
}

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

const round4 = (n) => roundTo(n, 4);

/** 32-bit ARGB from a DTCG colour (alpha rounded to the nearest of 255 steps). */
const argb = ({ hex, alpha }) => Math.round(alpha * 255) * 2 ** 24 + parseInt(hex.slice(1), 16);

/** `{ type, value }` of one token: aliases stay references, literals become numbers or ARGB. */
export function typedValue(token) {
  const v = token.$value;
  if (typeof v === 'string') return { type: TYPE_OF_TOKEN[token.$type], value: aliasValue(v) };
  const number = (n) => ({ t: 'number', n });
  switch (token.$type) {
    case 'color':
      return { type: 'color', value: { t: 'color', argb: argb(v) } };
    case 'cubicBezier':
      return { type: 'doubleList', value: { t: 'list', items: v.map(number) } };
    case 'number':
      return { type: 'double', value: { t: 'number', n: round4(v) } };
    default:
      return { type: 'double', value: { t: 'number', n: round4(v.value) } };
  }
}

/** `{colors.surface-2}` -> role `surface2`; `{rounded.full}` -> ref `AppRadius.full`. */
function aliasValue(alias) {
  const [group, key] = alias.slice(1, -1).split('.');
  if (group === 'colors') return { t: 'role', id: memberId(key) };
  return { t: 'ref', namespace: NAMESPACE_OF[group], member: memberId(key, group) };
}

function textStyleValue(key, { $value: v, $extensions: ext }) {
  const values = {
    name: { t: 'string', s: key },
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

function colorsDeclaration(model) {
  const fields = model.roles.map(({ key }) => ({ name: memberId(key), type: 'color' }));
  return {
    kind: 'struct',
    name: 'AppColors',
    doc: 'Every colour role resolved for one context (DESIGN.md schemes; ARGB).',
    fields,
    nested: [],
    instances: CONTEXTS.map((context) => {
      const resolved = Object.values(resolveColors(model, context));
      const args = fields.map(({ name, type }, i) => ({
        name,
        type,
        value: { t: 'color', argb: argb(resolved[i]) },
      }));
      return { name: contextId(context), value: { t: 'init', struct: 'AppColors', args } };
    }),
    lookup: { roleType: 'AppColorRole', valueType: 'color' },
  };
}

/**
 * One `<Component>Tokens` struct per component: its properties, then one nested struct per state,
 * and one instance per context from `resolveComponents` (colours stay role keys).
 */
function componentDeclarations(model) {
  const resolved = CONTEXTS.map((context) => [context, resolveComponents(model, context)]);
  return Object.keys(model.sets.components).map((component) => {
    const name = tokensTypeName(component);
    const contexts = contextsOf(component);
    const groups = resolved
      .filter(([context]) => contexts.includes(context))
      .map(([context, all]) => [context, all[component]]);
    const [, first] = groups[0];
    const fields = fieldsOf(first);
    const states = Object.keys(first).filter((key) => !isToken(first[key]));
    const nested = states.map((state) => ({
      kind: 'struct',
      name: nestedTypeName(state),
      fields: fieldsOf(first[state]),
      nested: [],
      instances: [],
    }));
    // A compound state (G2) names its field in lowerCamelCase: `selected-pressed` -> selectedPressed.
    const stateField = (state) => memberId(state);
    return {
      kind: 'struct',
      name,
      doc: `Component \`${component}\` per context: colours are role keys, sizes in pt/dp.`,
      fields: [
        ...fields,
        ...states.map((state, i) => ({ name: stateField(state), type: nested[i].name })),
      ],
      nested,
      instances: groups.map(([context, group]) => {
        const where = `${component} (${context})`;
        const stateArgs = states.map((state, i) => ({
          name: stateField(state),
          type: nested[i].name,
          value: {
            t: 'init',
            struct: nested[i].name,
            args: argsOf(nested[i].fields, group[state], `${where}.${state}`),
          },
        }));
        const args = [...argsOf(fields, group, where), ...stateArgs];
        return { name: contextId(context), value: { t: 'init', struct: name, args } };
      }),
    };
  });
}

/**
 * The contexts a component has instances for. A component named by a scheme-suffixed key is
 * unpaired by design (structure.mjs), so only the contexts that draw from that scheme get one:
 * `banner-dark` -> dark, brand, hc-dark (CONTEXT_SOURCES), and asking for `.light` does not compile.
 */
export function contextsOf(component) {
  const { scheme } = splitScheme(component);
  if (scheme === null) return CONTEXTS;
  return CONTEXTS.filter((context) => CONTEXT_SOURCES[context].includes(scheme));
}

/** The typed fields of a resolved group's properties (its states excluded), in model order. */
const fieldsOf = (group) =>
  Object.keys(group)
    .filter((key) => isToken(group[key]))
    .map((key) => ({ name: key, type: typedValue(group[key]).type }));

/** The arguments of one context's instance, in field order; every context declares every field. */
function argsOf(fields, group, where) {
  return fields.map(({ name, type }) => {
    const node = group?.[name];
    const typed = node && isToken(node) ? typedValue(node) : null;
    if (!typed || typed.type !== type) {
      throw new Error(`gen-tokens: ${where} has no ${type} \`${name}\` like the other contexts`);
    }
    return { name, ...typed };
  });
}
