// Validated frontmatter -> the DTCG 2025.10 token model plus resolver, in memory only (DEC-87 D8:
// it is never written to the repo). Shape: a `primitives` set (scales, type styles and the
// context-independent colours), a `theme` modifier whose five contexts each hold the colour roles
// and the component values their scheme declares, and a `components` set (one group per
// component, one subgroup per state) with the component values every scheme shares.
// Values use the DTCG 2025.10 formats: colour objects, `{ value, unit }` dimensions and durations,
// cubicBezier arrays, typography composites and `{group.key}` aliases. Only run it on frontmatter
// that validate() accepted.
import { PADDING_IDS } from './naming.mjs';
import { colorRoles, componentGroups } from './structure.mjs';
import {
  CONTEXTS,
  dynamicTypeName,
  iconSizeNamed,
  isPlainObject,
  parseColor,
  parseCubicBezier,
  parseDimension,
  parseDurationMs,
  parsePadding,
  parseReference,
} from './syntax.mjs';

/**
 * Sources each context resolves, in order; a later source overrides an earlier one. S7 High
 * Contrast keeps the S1/S2 value of every token it does not redefine (DESIGN.md "High contrast").
 * S3 Viridian over S2 Garden Dark is an assumption (paper text on a dark ground) that the README
 * flags until DESIGN.md states the brand fallback.
 */
export const CONTEXT_SOURCES = {
  light: ['light'],
  dark: ['dark'],
  brand: ['dark', 'brand'],
  'hc-light': ['light', 'hc-light'],
  'hc-dark': ['dark', 'hc-dark'],
};

/** The `$extensions` key of a dimension that names an icon size: `{ 'app.iconSize': 'icon-md' }`. */
export const ICON_SIZE_EXTENSION = 'app.iconSize';

/** Builds the in-memory model from validated frontmatter. */
export function normalise(frontmatter) {
  const { roles, roleOfKey } = colorRoles(frontmatter.colors);
  const colorOf = (key) => colorToken(frontmatter.colors[key]);
  const contexts = Object.fromEntries(CONTEXTS.map((c) => [c, { colors: {}, components: {} }]));
  const fixedColors = {};
  for (const role of roles) {
    if (role.fixed) {
      fixedColors[role.key] = colorOf(role.key);
      continue;
    }
    for (const [scheme, key] of role.schemes) contexts[scheme].colors[role.key] = colorOf(key);
  }
  const lookup = { roleOfKey, frontmatter };
  const single = (value) => singleValueToken(value, lookup);
  const primitives = {
    colors: fixedColors,
    typography: mapValues(frontmatter.typography, typographyToken),
    rounded: mapValues(frontmatter.rounded, dimensionToken),
    spacing: mapValues(frontmatter.spacing, dimensionToken),
    elevation: mapValues(frontmatter.elevation, (v) => groupOr(v, single)),
    motion: mapValues(frontmatter.motion, (v) => groupOr(v, single)),
  };
  return {
    roles: roles.map(({ key, fixed }) => ({ key, fixed })),
    sets: {
      primitives,
      components: componentSet(frontmatter, lookup, contexts),
    },
    modifiers: { theme: { contexts } },
    resolver: {
      version: '2025.10',
      sets: ['primitives', 'components'],
      modifiers: { theme: { contexts: structuredClone(CONTEXT_SOURCES), default: 'light' } },
      resolutionOrder: ['primitives', 'theme', 'components'],
    },
  };
}

/** Every colour role resolved for one context: role key -> DTCG colour value, in role order. */
export function resolveColors(model, context) {
  const declared = {};
  for (const source of model.resolver.modifiers.theme.contexts[context]) {
    Object.assign(declared, model.modifiers.theme.contexts[source].colors);
  }
  const fixed = model.sets.primitives.colors;
  return Object.fromEntries(
    model.roles.map(({ key, fixed: isFixed }) => [key, (isFixed ? fixed : declared)[key].$value]),
  );
}

/**
 * Every component resolved for one context: the tokens every scheme shares, then the context's
 * own values (CONTEXT_SOURCES order, later overriding earlier). Each group lists its shared
 * properties first, then its scheme-dependent ones; colours stay role aliases.
 */
export function resolveComponents(model, context) {
  const resolved = structuredClone(model.sets.components);
  for (const source of model.resolver.modifiers.theme.contexts[context]) {
    const declared = structuredClone(model.modifiers.theme.contexts[source].components);
    for (const [component, group] of Object.entries(declared)) {
      for (const [key, node] of Object.entries(group)) {
        if (Object.hasOwn(node, '$value')) resolved[component][key] = node;
        else Object.assign(resolved[component][key], node);
      }
    }
  }
  return resolved;
}

const mapValues = (object, fn) =>
  Object.fromEntries(Object.entries(object).map(([key, value]) => [key, fn(value)]));

const groupOr = (value, fn) => (isPlainObject(value) ? mapValues(value, fn) : fn(value));

const hex2 = (n) => n.toString(16).padStart(2, '0');

function colorToken(text) {
  const { r, g, b, alpha } = parseColor(text);
  return {
    $type: 'color',
    $value: {
      colorSpace: 'srgb',
      components: [r / 255, g / 255, b / 255],
      alpha,
      hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`,
    },
  };
}

function dimensionToken(value) {
  const px = typeof value === 'number' ? value : parseDimension(value).value;
  return { $type: 'dimension', $value: { value: px, unit: 'px' } };
}

function typographyToken(style) {
  const fontSize = parseDimension(style.fontSize).value;
  const lineHeight =
    typeof style.lineHeight === 'number'
      ? style.lineHeight
      : parseDimension(style.lineHeight).value / fontSize;
  const spacing = parseDimension(style.letterSpacing, ['px', 'em']);
  const letterSpacingPx = spacing.unit === 'em' ? spacing.value * fontSize : spacing.value;
  return {
    $type: 'typography',
    $value: {
      fontFamily: style.fontFamily.split(',').map((f) => f.trim().replace(/^['"]|['"]$/g, '')),
      fontSize: { value: fontSize, unit: 'px' },
      fontWeight: style.fontWeight,
      lineHeight,
      letterSpacing: { value: letterSpacingPx, unit: 'px' },
    },
    $extensions: {
      'app.dynamicType': dynamicTypeName(style.dynamicType),
      'app.m3Roles': [...style.m3Roles],
      // Absent: drawn as written (TEXT_TRANSFORMS).
      'app.textTransform': style.textTransform ?? 'none',
    },
  };
}

/** `$type` of an alias into a group whose every entry has one type. */
const GROUP_TYPES = { typography: 'typography', rounded: 'dimension', spacing: 'dimension' };

/**
 * Alias tokens point at the role (`{colors.primary}`), never at a scheme's colour key; any other
 * alias takes the `$type` of the single value it names. TK-06 rules out groups and alias chains,
 * so an elevation or motion target is a literal and is typed in one step.
 */
function referenceToken(ref, lookup) {
  if (ref.group === 'colors') {
    return { $type: 'color', $value: `{colors.${lookup.roleOfKey.get(ref.key)}}` };
  }
  const target = lookup.frontmatter[ref.group][ref.key];
  const type = GROUP_TYPES[ref.group] ?? singleValueToken(target, lookup).$type;
  return { $type: type, $value: `{${ref.group}.${ref.key}}` };
}

/** A shadow colour in `elevation` may be a literal (TK-04); everywhere else it is an alias. */
function singleValueToken(value, lookup) {
  if (typeof value === 'number') return { $type: 'number', $value: value };
  const ref = parseReference(value);
  if (ref) return referenceToken(ref, lookup);
  const ms = parseDurationMs(value);
  if (ms !== null) return { $type: 'duration', $value: { value: ms, unit: 'ms' } };
  const curve = parseCubicBezier(value);
  if (curve) return { $type: 'cubicBezier', $value: curve };
  if (parseColor(value)) return colorToken(value);
  return dimensionToken(value);
}

/**
 * A component's properties as tokens. A `{spacing.<key>}` reference, whole or as a padding part,
 * resolves to that step's px value, so a look holds the same number whichever way DESIGN.md writes
 * it. An `iconSize` that names an icon size (`icon-md`, iconSizeNamed) is that size's px value and
 * keeps the key in `$extensions['app.iconSize']`, which the component API reads (contract-model.mjs).
 * Every other reference stays an alias.
 */
function componentTokens(props, lookup) {
  const tokens = {};
  const spacing = (key) => dimensionToken(lookup.frontmatter.spacing[key]);
  for (const [prop, value] of Object.entries(props)) {
    const ref = parseReference(value);
    if (prop === 'padding') {
      const { top, end, bottom, start } = parsePadding(value);
      [top, end, bottom, start].forEach((side, i) => {
        tokens[PADDING_IDS[i]] = side.ref ? spacing(side.ref.key) : dimensionToken(side.px);
      });
    } else if (ref?.group === 'spacing') {
      tokens[prop] = spacing(ref.key);
    } else if (iconSizeNamed(prop, value)) {
      const key = iconSizeNamed(prop, value);
      const size = dimensionToken(lookup.frontmatter.components[key].size);
      tokens[prop] = { ...size, $extensions: { [ICON_SIZE_EXTENSION]: key } };
    } else {
      tokens[prop] = singleValueToken(value, lookup);
    }
  }
  return tokens;
}

/**
 * The components set: every component and state in first-appearance order (a state may be empty),
 * holding the tokens all its scheme variants share. The tokens that differ by scheme go into each
 * declaring scheme's theme context, written into `contexts`.
 */
function componentSet(frontmatter, lookup, contexts) {
  const set = {};
  for (const { component, slots } of componentGroups(frontmatter.components)) {
    const group = {};
    for (const [state, variants] of slots) {
      const { shared, byScheme } = splitVariants(variants, lookup);
      if (state === '') Object.assign(group, shared);
      else group[state] = shared;
      for (const [scheme, tokens] of byScheme) {
        Object.assign(slotOf(contexts[scheme], component, state), tokens);
      }
    }
    set[component] = group;
  }
  return set;
}

/**
 * One state's scheme variants as tokens. `shared` holds each property whose token is the same in
 * every variant; `byScheme` (scheme -> tokens) holds the rest, such as a colour role that differs
 * between light and dark or a high-contrast width (TK-05). A property is in exactly one of them.
 */
function splitVariants(variants, lookup) {
  const declared = variants.map(({ scheme, props }) => ({
    scheme,
    tokens: componentTokens(props, lookup),
  }));
  const shared = {};
  const byScheme = new Map();
  for (const [prop, token] of Object.entries(declared[0].tokens)) {
    if (declared.every(({ tokens }) => sameToken(tokens[prop], token))) {
      shared[prop] = token;
      continue;
    }
    for (const { scheme, tokens } of declared) {
      if (!byScheme.has(scheme)) byScheme.set(scheme, {});
      byScheme.get(scheme)[prop] = tokens[prop];
    }
  }
  return { shared, byScheme };
}

const sameToken = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** One component state's node in a theme context, created on first use. */
function slotOf(context, component, state) {
  context.components[component] ??= {};
  const group = context.components[component];
  if (state === '') return group;
  group[state] ??= {};
  return group[state];
}
