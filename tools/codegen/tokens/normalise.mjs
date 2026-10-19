// Validated frontmatter -> the DTCG 2025.10 token model plus resolver, in memory only (DEC-87 D8:
// it is never written to the repo). Shape: a `primitives` set (scales, type styles and the
// context-independent colours), a `theme` modifier whose five contexts each hold the colour roles
// their scheme declares, and a `components` set (one group per component, one subgroup per state).
// Values use the DTCG 2025.10 formats: colour objects, `{ value, unit }` dimensions and durations,
// cubicBezier arrays, typography composites and `{group.key}` aliases. Only run it on frontmatter
// that validate() accepted.
import { PADDING_IDS } from './naming.mjs';
import { colorRoles, componentGroups } from './structure.mjs';
import {
  CONTEXTS,
  dynamicTypeName,
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

/** Builds the in-memory model from validated frontmatter. */
export function normalise(frontmatter) {
  const { roles, roleOfKey } = colorRoles(frontmatter.colors);
  const colorOf = (key) => colorToken(frontmatter.colors[key]);
  const contexts = Object.fromEntries(CONTEXTS.map((c) => [c, { colors: {} }]));
  const fixedColors = {};
  for (const role of roles) {
    if (role.fixed) {
      fixedColors[role.key] = colorOf(role.key);
      continue;
    }
    for (const [scheme, key] of role.schemes) contexts[scheme].colors[role.key] = colorOf(key);
  }
  // Elevation and motion reference only colours, radii and spacing (TK-06), all typed up front.
  const single = (value) => singleValueToken(value, { roleOfKey, primitives: {} });
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
      components: componentSet(frontmatter, { roleOfKey, primitives }),
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
    },
  };
}

/**
 * Alias tokens point at the role (`{colors.primary}`), never at a scheme's colour key; any other
 * alias takes the `$type` of the single-value token it names (TK-06 rules out groups).
 */
function referenceToken(ref, { roleOfKey, primitives }) {
  if (ref.group === 'colors') {
    return { $type: 'color', $value: `{colors.${roleOfKey.get(ref.key)}}` };
  }
  const type = primitives[ref.group]?.[ref.key]?.$type ?? 'dimension';
  return { $type: type, $value: `{${ref.group}.${ref.key}}` };
}

function singleValueToken(value, lookup) {
  if (typeof value === 'number') return { $type: 'number', $value: value };
  const ref = parseReference(value);
  if (ref) return referenceToken(ref, lookup);
  const ms = parseDurationMs(value);
  if (ms !== null) return { $type: 'duration', $value: { value: ms, unit: 'ms' } };
  const curve = parseCubicBezier(value);
  if (curve) return { $type: 'cubicBezier', $value: curve };
  return dimensionToken(value);
}

function componentTokens(props, lookup) {
  const tokens = {};
  for (const [prop, value] of Object.entries(props)) {
    if (prop !== 'padding') {
      tokens[prop] = singleValueToken(value, lookup);
      continue;
    }
    const { top, end, bottom, start } = parsePadding(value);
    [top, end, bottom, start].forEach((px, i) => {
      tokens[PADDING_IDS[i]] = dimensionToken(px);
    });
  }
  return tokens;
}

/** Scheme variants agree (TK-05), so the first variant of each slot speaks for all of them. */
function componentSet(frontmatter, lookup) {
  const set = {};
  for (const { component, slots } of componentGroups(frontmatter.components)) {
    const group = {};
    for (const [state, variants] of slots) {
      const tokens = componentTokens(variants[0].props, lookup);
      if (state === '') Object.assign(group, tokens);
      else group[state] = tokens;
    }
    set[component] = group;
  }
  return set;
}
