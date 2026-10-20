// Icon-set contracts (`kind: icon-set`; C02 icons, Linear AI-201): the rules CC-09 to CC-11 and
// the API model the icon declarations (icon-declarations.mjs) read. contracts.mjs runs CC-01 and
// CC-02 first, as for every contract. Glyph path data compiles to absolute move / line / cubic /
// close segments (svg-path.mjs); sizes come from the `components.icon-<n>` tokens.
// tools/codegen/tokens/README.md, "Icon sets".
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { finding, identifierFindings, isToken } from './contract-model.mjs';
import { typedValue } from './declarations.mjs';
import { galleryTitle, memberId, nestedTypeName, swiftIdent } from './naming.mjs';
import { resolveComponents } from './normalise.mjs';
import { compilePath } from './svg-path.mjs';
import { CONTEXTS } from './syntax.mjs';

/** The `kind` of an icon-set contract; a contract without `kind` is a control (button). */
export const ICON_SET = 'icon-set';

export const isIconSet = (contractOrApi) => contractOrApi.kind === ICON_SET;

const SCHEMA = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'component-contract.schema.json'), 'utf8'),
);
/** The `paint` values, in schema order: every one becomes a `<Name>Paint` case. */
export const ICON_PAINTS = SCHEMA.$defs.iconPaint.enum;

/** The two properties of a `components.icon-<n>` token, in emission order. */
export const SIZE_FIELDS = ['size', 'strokeWidth'];

/**
 * The fields of the `<Name>Name` enum (icon-declarations.mjs). A glyph id may not become one of
 * them, nor a member every Swift raw-value enum already has.
 */
export const NAME_FIELDS = ['set', 'testId', 'glyph'];
const RESERVED_MEMBERS = new Set([...NAME_FIELDS, 'rawValue', 'allCases', 'hashValue']);
/** Nested type names Swift reads as a metatype (`AppIconGlyphs.Type`). */
const METATYPE_NAMES = new Set(['Type', 'Protocol']);

/** A glyph's gallery test ID: `ds-icon-<id>`, the same literal on both platforms. */
export const iconTestIdOf = (id) => `ds-icon-${id}`;

/**
 * The stages of an icon-set contract after CC-01 (contracts.mjs runs CC-02 with the first). Each
 * returns findings; the checker stops at the first stage that has any.
 */
export const ICON_SET_STAGES = [checkGlyphIds, checkSizes, checkPaths];

/**
 * CC-09: glyph ids are unique and become distinct Swift cases, Kotlin entries and nested type
 * names that are no keyword and no member the generated enum already has.
 */
function checkGlyphIds(contract, file) {
  const out = [];
  const seen = new Set();
  contract.glyphs.forEach(({ id }, i) => {
    const at = `${file} glyphs.${i}.id`;
    if (seen.has(id)) out.push(finding('CC-09', at, `"${id}" is not unique`));
    seen.add(id);
  });
  const at = `${file} glyphs`;
  out.push(...identifierFindings([...seen], at, 'glyph id', 'CC-09'));
  for (const id of seen) {
    const type = nestedTypeName(id);
    if (swiftIdent(type) !== type || METATYPE_NAMES.has(type)) {
      out.push(finding('CC-09', at, `glyph id "${id}" becomes the Swift type ${type}`));
    }
    const member = memberId(id);
    if (RESERVED_MEMBERS.has(member)) {
      out.push(finding('CC-09', at, `glyph id "${id}" becomes ${member}, which the enum has`));
    }
  }
  return out;
}

/**
 * CC-10: `defaultSize` is listed in `sizes`; each size names a `components.icon-<n>` token that
 * holds exactly `size` (n px) and `strokeWidth` (viewBox units) as literal numbers, has no state
 * and is the same in every context.
 */
function checkSizes(contract, file, model) {
  const out = [];
  if (!contract.sizes.includes(contract.defaultSize)) {
    const message = `"${contract.defaultSize}" is not in \`sizes\``;
    out.push(finding('CC-10', `${file} defaultSize`, message));
  }
  const resolved = CONTEXTS.map((context) => resolveComponents(model, context));
  contract.sizes.forEach((size, i) => {
    const at = `${file} sizes.${i}`;
    if (!Object.hasOwn(model.sets.components, size)) {
      out.push(finding('CC-10', at, `{components.${size}} is not a DESIGN.md component`));
      return;
    }
    out.push(...sizeTokenFindings(size, resolved, at));
  });
  return out;
}

function sizeTokenFindings(size, resolved, at) {
  const out = [];
  const token = `{components.${size}}`;
  const extra = Object.keys(resolved[0][size]).filter((key) => !SIZE_FIELDS.includes(key));
  if (extra.length > 0) {
    const message = `${token} has ${extra.join(', ')}, not only size and strokeWidth`;
    out.push(finding('CC-10', at, message));
  }
  for (const field of SIZE_FIELDS) {
    const values = resolved.map((components) => numberOf(components[size][field]));
    if (values.some((value) => value === null)) {
      out.push(finding('CC-10', at, `${token} has no ${field} number`));
    } else if (new Set(values).size > 1) {
      out.push(finding('CC-10', at, `${token} ${field} differs between contexts`));
    }
  }
  const n = Number(size.slice('icon-'.length));
  const px = numberOf(resolved[0][size].size);
  if (px !== null && px !== n) {
    out.push(finding('CC-10', at, `${token} size is ${px}, not the ${n} its name says`));
  }
  return out;
}

/** A literal dimension or number token's value; null for anything else (an alias, a state). */
function numberOf(node) {
  if (!node || !isToken(node)) return null;
  const { type, value } = typedValue(node);
  return type === 'double' && value.t === 'number' ? value.n : null;
}

/** CC-11: every shape's path data compiles (svg-path.mjs) and draws a line or a curve. */
function checkPaths(contract, file) {
  const out = [];
  contract.glyphs.forEach((glyph, g) => {
    glyph.shapes.forEach(({ d }, s) => {
      const at = `${file} glyphs.${g}.shapes.${s}.d`;
      const { error, segments } = compilePath(d);
      if (error) out.push(finding('CC-11', at, `${glyph.id}: cannot compile the path: ${error}`));
      else if (!segments.some(({ command }) => command === 'line' || command === 'cubic')) {
        out.push(finding('CC-11', at, `${glyph.id}: the path data draws nothing`));
      }
    });
  });
  return out;
}

/**
 * The API model of a checked icon-set contract: its sizes with their token values, the default
 * size, the sets in first-appearance order, the paints and every glyph with its compiled shapes.
 */
export function buildIconSet(contract, file, model) {
  const components = resolveComponents(model, CONTEXTS[0]);
  const api = {
    kind: ICON_SET,
    id: contract.id,
    name: contract.name,
    board: contract.board,
    file,
    gallery: galleryTitle(contract.board, contract.gallery.title),
    sizes: contract.sizes.map((id) => ({
      id,
      ...Object.fromEntries(SIZE_FIELDS.map((f) => [f, numberOf(components[id][f])])),
    })),
    defaultSize: contract.defaultSize,
    sets: [...new Set(contract.glyphs.map(({ set }) => set))],
    paints: ICON_PAINTS,
    glyphs: contract.glyphs.map(({ id, set, source, shapes }) => ({
      id,
      set,
      source,
      shapes: shapes.map(({ d, paint }) => ({ paint, segments: compilePath(d).segments })),
    })),
  };
  return { findings: [], api };
}
