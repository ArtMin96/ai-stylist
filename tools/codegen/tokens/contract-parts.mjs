// The gallery samples and the parts of a control contract (.impeccable/components/README.md G10,
// G12) and their rules: CC-17 (`gallery.props`), CC-18 (`parts`) and CC-19 (`gallery.labels`).
// contracts.mjs runs them in its stages; `partsApi` adds the parts and the samples to the API
// model, which api-declarations.mjs reads. tools/codegen/tokens/README.md, "Component contracts".
import { appliesTo, propNameOf, propOf, propTypeName } from './contract-fields.mjs';
import { finding, identifierFindings } from './contract-model.mjs';
import { ktEnumEntry, memberId } from './naming.mjs';
import { parseReference } from './syntax.mjs';

/** The prop whose gallery sample is `gallery.label`, not a `gallery.props` entry (G10). */
const LABEL_PROP = 'label';
/** Prop types a gallery cell needs a sample for (G10); bool and action come from the cell. */
const SAMPLED_TYPES = ['string', 'icon', 'enum', 'color', 'colorRole'];
const GLYPH_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** The prop type that fills each part kind (G12); a dot or a ring has no prop of its own. */
const PART_PROP_TYPE = { text: 'string', swatch: 'color' };
/** Part kinds and positions, in the order `<Name>PartKind` and `<Name>PartPosition` list them. */
const PART_KINDS = ['text', 'swatch', 'dot', 'ring'];
const PART_POSITIONS = ['before-label', 'after-label', 'line', 'outside'];

/** The resource key of a part's separator copy in each app: `ds_chip_detail_separator`. */
const separatorKeyOf = (id, part) =>
  `ds_${ktEnumEntry(id).toLowerCase()}_${ktEnumEntry(part).toLowerCase()}_separator`;

/**
 * CC-17 (G10): every `gallery.props` key is a prop other than `label` (whose sample is
 * `gallery.label`), and its sample fits the prop: an `icon` a glyph id (of the icon set beside the
 * contract), a `color` or `colorRole` a `{colors.<role>}` role, an `enum` one of its values, a
 * `string` text; a `bool` or `action` prop takes none (the cell sets it). Every required prop of
 * those types other than `label` has a sample, so no gallery cell needs a literal.
 */
export function checkGalleryProps(contract, file, model, iconSets) {
  const out = [];
  const samples = contract.gallery.props ?? {};
  const context = {
    iconSet: iconSets.length === 1 ? iconSets[0] : null,
    roles: new Set(model.roles.map(({ key }) => key)),
  };
  for (const [name, sample] of Object.entries(samples)) {
    const message = sampleProblem(propOf(contract, name), name, sample, context);
    if (message) out.push(finding('CC-17', `${file} gallery.props.${name}`, message));
  }
  const needsSample = (prop) =>
    prop.required && prop.name !== LABEL_PROP && SAMPLED_TYPES.includes(prop.type);
  for (const { name } of contract.props.filter(needsSample)) {
    if (Object.hasOwn(samples, name)) continue;
    const message = `the required prop "${name}" has no sample`;
    out.push(finding('CC-17', `${file} gallery.props`, message));
  }
  return out;
}

/**
 * CC-19: every `gallery.labels` key is a variant, whose gallery cells show that sample label
 * instead of `gallery.label` (the trial badges' own words).
 */
export function checkGalleryLabels(contract, file) {
  return Object.keys(contract.gallery.labels ?? {})
    .filter((variant) => !contract.variants.includes(variant))
    .map((variant) =>
      finding('CC-19', `${file} gallery.labels.${variant}`, `"${variant}" is not a variant`),
    );
}

/** What is wrong with one `gallery.props` sample, or null. */
function sampleProblem(prop, name, sample, { iconSet, roles }) {
  if (name === LABEL_PROP) return 'the label sample is gallery.label';
  if (!prop) return 'names no prop';
  switch (prop.type) {
    case 'icon':
      if (!GLYPH_ID.test(sample)) return `"${sample}" is not a glyph id`;
      if (!iconSet || iconSet.glyphs.includes(sample)) return null;
      return `"${sample}" is not in ${iconSet.file}`;
    case 'color':
    case 'colorRole': {
      const ref = parseReference(sample);
      const isRole = ref?.group === 'colors' && roles.has(ref.key);
      return isRole ? null : `"${sample}" is not a {colors.<role>} role of DESIGN.md`;
    }
    case 'enum':
      return prop.values.includes(sample) ? null : `"${sample}" is not one of its values`;
    case 'string':
      return null;
    default:
      return `a ${prop.type} prop takes no sample: the gallery cell sets it`;
  }
}

/**
 * CC-18 (G12): part names are unique identifiers and a part's `variants` are variants. A `text`
 * part is filled by the `string` prop of its name and a `swatch` by the `color` prop, each applying
 * to every variant the part does. A `ring`, and only a ring, sits `outside` and takes its `color`
 * from a `colorRole` prop. Only a text part has a `separator`, only a `line` takes the leading
 * `icon`, and at most one part of a variant takes it.
 */
export function checkParts(contract, file) {
  const parts = contract.parts ?? [];
  const names = [...new Set(parts.map(({ name }) => name))];
  const out = identifierFindings(names, `${file} parts`, 'part', 'CC-18');
  parts.forEach((part, i) => {
    if (parts.findIndex(({ name }) => name === part.name) !== i) {
      out.push(finding('CC-18', `${file} parts.${i}`, `"${part.name}" is not unique`));
    }
    for (const [where, message] of partProblems(contract, part)) {
      out.push(finding('CC-18', `${file} parts.${i}${where}`, message));
    }
  });
  for (const variant of contract.variants) {
    const taking = parts.filter((part) => part.icon !== undefined && appliesTo(part, variant));
    if (taking.length < 2) continue;
    const message = `${variant}: ${taking.map(({ name }) => name).join(' and ')} take the icon`;
    out.push(finding('CC-18', `${file} parts`, message));
  }
  return out;
}

/** `[where, message]` for each problem of one part. */
function partProblems(contract, part) {
  const out = [];
  for (const variant of (part.variants ?? []).filter((v) => !contract.variants.includes(v))) {
    out.push(['.variants', `"${variant}" is not a variant`]);
  }
  const variants = contract.variants.filter((variant) => appliesTo(part, variant));
  const filledBy = PART_PROP_TYPE[part.kind];
  if (filledBy) {
    const problem = propProblem(propOf(contract, part.name), filledBy, variants);
    const message = `a ${part.kind} part takes the ${filledBy} prop "${part.name}"`;
    if (problem) out.push(['', `${message}: ${problem}`]);
  }
  const ring = part.kind === 'ring';
  if (ring !== (part.position === 'outside')) {
    out.push(['.position', 'a ring, and only a ring, sits outside']);
  }
  if (ring && part.color === undefined) out.push(['', 'a ring takes its colour from a prop']);
  if (!ring && part.color !== undefined) out.push(['.color', 'only a ring takes a colour prop']);
  if (ring && part.color !== undefined) {
    const problem = propProblem(propOf(contract, propNameOf(part.color)), 'colorRole', variants);
    if (problem) out.push(['.color', `${part.color}: ${problem}`]);
  }
  if (part.separator !== undefined && part.kind !== 'text') {
    out.push(['.separator', 'only a text part has a separator']);
  }
  if (part.icon !== undefined && part.position !== 'line') {
    out.push(['.icon', 'only a line takes the leading icon']);
  }
  return out;
}

/** What is wrong with `prop` as the `type` prop of `variants`, or null. */
function propProblem(prop, type, variants) {
  if (!prop) return 'there is no such prop';
  if (prop.type !== type) return `it is a ${prop.type} prop`;
  const missing = variants.filter((variant) => !appliesTo(prop, variant));
  return missing.length === 0 ? null : `it does not apply to ${missing.join(', ')}`;
}

/**
 * The parts (G12: kind, position, separator resource key, whether the line takes the leading icon,
 * the variants that draw it) and the gallery samples in prop order (G10) for the API model. An
 * icon sample needs the approved icon set's name enum (`nameType`); without one it is left out,
 * as the looks' icon sources are.
 */
export function partsApi(contract, nameType) {
  const parts = (contract.parts ?? []).map((part) => ({
    name: part.name,
    kind: part.kind,
    position: part.position,
    separatorKey: part.separator === undefined ? null : separatorKeyOf(contract.id, part.name),
    takesLeadingIcon: part.icon !== undefined,
    variants: contract.variants.filter((variant) => appliesTo(part, variant)),
  }));
  const samples = contract.gallery.props ?? {};
  const sampled = contract.props.filter(
    (prop) => Object.hasOwn(samples, prop.name) && (prop.type !== 'icon' || nameType),
  );
  const sample = (prop) => ({
    prop: prop.name,
    ...sampleValue(contract, prop, samples[prop.name], nameType),
  });
  return {
    parts,
    partKinds: PART_KINDS.filter((kind) => parts.some((part) => part.kind === kind)),
    partPositions: PART_POSITIONS.filter((at) => parts.some((part) => part.position === at)),
    samples: sampled.map(sample),
  };
}

/** A gallery sample's `{ type, value }`: text, an enum or glyph case, or a colour role. */
function sampleValue(contract, prop, sample, nameType) {
  if (prop.type === 'string') return { type: 'string', value: { t: 'string', s: sample } };
  if (prop.type === 'color' || prop.type === 'colorRole') {
    return { type: 'role', value: { t: 'role', id: memberId(parseReference(sample).key) } };
  }
  const type = prop.type === 'icon' ? nameType : propTypeName(contract, prop);
  return { type, value: { t: 'case', type, id: memberId(sample) } };
}
