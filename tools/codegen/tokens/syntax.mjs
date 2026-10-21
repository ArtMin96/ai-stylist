// Key and value grammar of the DESIGN.md frontmatter, shared by the validator and the normaliser
// (tools/codegen/tokens/README.md). Pure parsers: each returns null when the text does not match.

/** Scheme suffixes, longest first so `-hc-light` wins over `-light`. */
export const SCHEMES = ['hc-light', 'hc-dark', 'light', 'dark', 'brand'];
/** The five DEC-87 resolver contexts, in emission order. */
export const CONTEXTS = ['light', 'dark', 'brand', 'hc-light', 'hc-dark'];

/** The toggles a caller sets (G2): each combines with an interaction as `<toggle>-<interaction>`. */
export const TOGGLES = ['selected', 'expanded'];

/**
 * The compound toggle states (.impeccable/components/README.md G2): a toggle joined with the
 * interaction drawn while it is on (`selected-pressed`).
 */
export const COMPOUND_STATES = [
  'selected-pressed',
  'selected-focused',
  'selected-disabled',
  'expanded-pressed',
  'expanded-focused',
];

/**
 * Component states: the DESIGN.md "Components" state list (after default), `expanded`, and the
 * compound toggle states (G2).
 */
export const STATES = [
  'pressed',
  'focused',
  'disabled',
  'loading',
  'error',
  ...TOGGLES,
  ...COMPOUND_STATES,
];

/** The toggle of a compound state (`selected-pressed` -> `selected`); null for any other state. */
export const toggleOf = (state) =>
  COMPOUND_STATES.includes(state) ? TOGGLES.find((t) => state.startsWith(`${t}-`)) : null;

/** STATES longest first, so a compound suffix wins over the interaction it ends with. */
const STATES_LONGEST_FIRST = [...STATES].sort((a, b) => b.length - a.length);

/** The 15 Material 3 type roles (Compose `Typography` property names). */
export const M3_ROLES = [
  'displayLarge',
  'displayMedium',
  'displaySmall',
  'headlineLarge',
  'headlineMedium',
  'headlineSmall',
  'titleLarge',
  'titleMedium',
  'titleSmall',
  'bodyLarge',
  'bodyMedium',
  'bodySmall',
  'labelLarge',
  'labelMedium',
  'labelSmall',
];

/** SwiftUI `Font.TextStyle` cases available on iOS. */
export const DYNAMIC_TYPE_STYLES = [
  'largeTitle',
  'title',
  'title2',
  'title3',
  'headline',
  'subheadline',
  'body',
  'callout',
  'footnote',
  'caption',
  'caption2',
];

export const TOKEN_GROUPS = [
  'colors',
  'typography',
  'rounded',
  'spacing',
  'elevation',
  'motion',
  'components',
];
export const META_KEYS = ['version', 'name', 'description'];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NUMBER = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const BYTE = '(\\d{1,3})';

export const isKebab = (key) => KEBAB.test(key);
/** Component property and map-field names are lowerCamelCase, as in the DESIGN.md format. */
export const isPropertyName = (name) => /^[a-z][A-Za-z0-9]*$/.test(name);
/** A property or field that holds a colour: `color` or any `…Color` (`backgroundColor`). */
export const isColourProperty = (name) => name === 'color' || name.endsWith('Color');
/** S7 High Contrast schemes: their variants may change more than colours (the 3 px focus ring). */
export const isHighContrast = (scheme) => scheme === 'hc-light' || scheme === 'hc-dark';
export const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** `dynamicType: .title2` and `dynamicType: title2` both name `title2`. */
export const dynamicTypeName = (v) => (typeof v === 'string' ? v.replace(/^\./, '') : null);

/** `surface-2-hc-dark` -> `{ base: 'surface-2', scheme: 'hc-dark' }`; no suffix: scheme null. */
export function splitScheme(key) {
  for (const scheme of SCHEMES) {
    const suffix = `-${scheme}`;
    if (key.endsWith(suffix) && key.length > suffix.length) {
      return { base: key.slice(0, -suffix.length), scheme };
    }
  }
  return { base: key, scheme: null };
}

/**
 * `button-primary-pressed` -> `{ component: 'button-primary', state: 'pressed' }`. The longest
 * state suffix wins (G2): `chip-choice-selected-pressed` is `chip-choice` -> `selected-pressed`.
 */
export function splitState(base) {
  for (const state of STATES_LONGEST_FIRST) {
    const suffix = `-${state}`;
    if (base.endsWith(suffix) && base.length > suffix.length) {
      return { component: base.slice(0, -suffix.length), state };
    }
  }
  return { component: base, state: null };
}

/**
 * An icon-size component key on the C02 scale: `icon-<step>`, the step a lowercase name that
 * starts with a letter (`icon-md`, `icon-hero`), so it can name an enum case on its own. The
 * contract schema's `iconSize` pattern is the same.
 */
export const ICON_SIZE_KEY = /^icon-[a-z][a-z0-9]*$/;

/** `icon-md` -> `md`: the step of an icon-size key, the size enum's case. */
export const iconStepOf = (key) => key.slice('icon-'.length);

/**
 * A property that sizes an icon slot: `iconSize` (the leading slot) or any `…IconSize`
 * (`trailingIconSize`, .impeccable/components/README.md G3). Only these may name an icon size.
 */
export const isIconSizeProperty = (prop) => prop === 'iconSize' || prop.endsWith('IconSize');

/**
 * The component an icon-slot size (isIconSizeProperty) names, or null: the bare step key
 * (`icon-md`, which the pinned design.md lint accepts) or a reference (`{components.icon-md}`,
 * which that lint cannot resolve, so TK-12 fails on it). Any other property, or a number, names
 * none.
 */
export function iconSizeNamed(prop, value) {
  if (!isIconSizeProperty(prop) || typeof value !== 'string') return null;
  const ref = parseReference(value);
  if (ref) return ref.group === 'components' ? ref.key : null;
  return ICON_SIZE_KEY.test(value.trim()) ? value.trim() : null;
}

/** `{colors.primary-light}` -> `{ group: 'colors', key: 'primary-light' }`. */
export function parseReference(value) {
  if (typeof value !== 'string') return null;
  const m = /^\{([a-z]+)\.([a-z0-9-]+)\}$/.exec(value.trim());
  return m ? { group: m[1], key: m[2] } : null;
}

/** `#RRGGBB`, `#RRGGBBAA`, `rgb()` or `rgba()` -> `{ r, g, b, alpha }` (0–255 each, alpha 0–1). */
export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(text);
  if (hex) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
    const alpha = hex[2] === undefined ? 1 : parseInt(hex[2], 16) / 255;
    return { r, g, b, alpha };
  }
  const rgb = new RegExp(
    `^rgba?\\(\\s*${BYTE}\\s*,\\s*${BYTE}\\s*,\\s*${BYTE}\\s*(?:,\\s*(${NUMBER})\\s*)?\\)$`,
  ).exec(text);
  if (!rgb) return null;
  const [r, g, b] = rgb.slice(1, 4).map(Number);
  const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
  const inRange = [r, g, b].every((c) => c <= 255) && alpha >= 0 && alpha <= 1;
  return inRange ? { r, g, b, alpha } : null;
}

/** `16px` -> `{ value: 16, unit: 'px' }`; units: `px`, plus `em` where `units` allows it. */
export function parseDimension(value, units = ['px']) {
  if (typeof value !== 'string') return null;
  const m = new RegExp(`^(${NUMBER})(px|em)$`).exec(value.trim());
  if (!m || !units.includes(m[2])) return null;
  return { value: Number(m[1]), unit: m[2] };
}

/** `150ms` -> 150, `0.3s` -> 300 (milliseconds, rounded to the microsecond). */
export function parseDurationMs(value) {
  if (typeof value !== 'string') return null;
  const m = new RegExp(`^(${NUMBER})(ms|s)$`).exec(value.trim());
  if (!m) return null;
  return m[2] === 's' ? Math.round(Number(m[1]) * 1e6) / 1e3 : Number(m[1]);
}

/**
 * `cubic-bezier(0.2, 0, 0, 1)` -> `[0.2, 0, 0, 1]` (x1 and x2 within 0–1). The CSS keyword
 * `linear` is the curve `[0, 0, 1, 1]`.
 */
export function parseCubicBezier(value) {
  if (typeof value !== 'string') return null;
  if (value.trim() === 'linear') return [0, 0, 1, 1];
  const arg = `\\s*(${NUMBER})\\s*`;
  const m = new RegExp(`^cubic-bezier\\(${arg},${arg},${arg},${arg}\\)$`).exec(value.trim());
  if (!m) return null;
  const points = m.slice(1, 5).map(Number);
  return points[0] >= 0 && points[0] <= 1 && points[2] >= 0 && points[2] <= 1 ? points : null;
}

/** True when the text holds several space-separated values outside parentheses (CSS shorthand). */
export function isShorthand(value) {
  if (typeof value !== 'string') return false;
  let depth = 0;
  let parts = 1;
  const text = value.trim();
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (/\s/.test(ch) && depth === 0 && !/\s/.test(text[i - 1] ?? '')) parts += 1;
  }
  return parts > 1;
}

/**
 * CSS `padding` with 1–4 parts -> `{ top, end, bottom, start }`, each side `{ px }` (a part `0` or
 * `Npx`) or `{ ref }` (a part `{group.key}`, parseReference; the validator allows only `spacing`):
 * `0 {spacing.24}` mixes both.
 */
export function parsePadding(value) {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length < 1 || parts.length > 4) return null;
  const sides = parts.map((p) => {
    const ref = parseReference(p);
    if (ref) return { ref };
    const px = p === '0' ? 0 : parseDimension(p)?.value;
    return px === undefined ? null : { px };
  });
  if (sides.includes(null)) return null;
  const [top, end = top, bottom = top, start = end] = sides;
  return { top, end, bottom, start };
}
