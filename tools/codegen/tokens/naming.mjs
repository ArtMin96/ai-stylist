// Identifier rules for the token emitters (DEC-87 D6 neutral names). Reuses the shared-kernel
// emitters' helpers (tools/codegen/kernel/naming.mjs); adds what tokens need on top: scale prefixes
// for numeric keys, component type names, padding expansion and Kotlin keyword escaping.
import { camel, pascal, upperSnake } from '../kernel/naming.mjs';

export { docText, ktStr, num, swiftIdent, swiftStr } from '../kernel/naming.mjs';

/** A numeric scale key (`spacing."4"`) cannot be an identifier on its own: `space4`, `radius12`. */
const SCALE_PREFIX = {
  spacing: 'space',
  rounded: 'radius',
  elevation: 'elevation',
  motion: 'motion',
};

/** `surface-2` -> `surface2`; in a scale group, `4` -> `space4`. */
export function memberId(key, group) {
  const id = camel(key);
  return /^\d/.test(id) ? `${SCALE_PREFIX[group] ?? 'value'}${id}` : id;
}

/** `button-primary` -> `ButtonPrimaryTokens`. */
export const tokensTypeName = (component) => `${pascal(component)}Tokens`;

/** `button` + `Variant` -> `ButtonVariant`: a type of a component contract's generated API. */
export const apiTypeName = (id, suffix) => `${pascal(id)}${suffix}`;

/** A test-ID constant: `primary-outline`, `compact`, `enabled` -> `primaryOutlineCompactEnabled`. */
export const testIdName = ({ variant, size, state }) => memberId(`${variant}-${size}-${state}`);

/**
 * A gallery section's title and slug: `C01` + `Buttons` -> `C01 Buttons`, `c01-buttons`. The
 * schema allows only letters, digits and single spaces in `gallery.title`, so the slug is kebab.
 */
export function galleryTitle(board, title) {
  const full = `${board} ${title}`;
  return { title: full, slug: full.toLowerCase().replace(/ /g, '-') };
}

/** `pressed` -> `Pressed`: a nested namespace (a component state, an elevation or motion group). */
export const nestedTypeName = (key) => pascal(key);

/** CSS `padding` becomes four members, in this order. */
export const PADDING_IDS = ['paddingTop', 'paddingEnd', 'paddingBottom', 'paddingStart'];

/** Identifiers a component property generates. */
export const propertyIds = (prop) => (prop === 'padding' ? PADDING_IDS : [prop]);

/** `hc-light` -> `hcLight` (the AppColors instance of a context). */
export const contextId = (context) => camel(context);

/** `onPrimary` -> `ON_PRIMARY` (Kotlin enum entry, as the shared-kernel Kotlin emitter does). */
export const ktEnumEntry = (id) => upperSnake(id);

const KOTLIN_KEYWORDS = new Set(
  (
    'as break class continue do else false for fun if in interface is null object package return ' +
    'super this throw true try typealias typeof val var when while'
  ).split(' '),
);
/** Backtick-escape Kotlin hard keywords. */
export const ktIdent = (s) => (KOTLIN_KEYWORDS.has(s) ? `\`${s}\`` : s);
