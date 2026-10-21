// A checked component contract + the in-memory token model -> the API model the component-API
// emitters read (ADR-0011 follow-up 7, DEC-87): the axes, the allowed combinations and one ready,
// merged look per combination and context (owner decision 2026-10-20: base, then state, then
// size, then the size's icon slots; G2: a compound state after its toggle). Also the reference
// grammar the checker (contracts.mjs) shares. Only run buildApi on a contract that passed CC-01 to
// CC-18. tools/codegen/tokens/README.md, "Component contracts".
import { contextsOf, typedValue } from './declarations.mjs';
import {
  apiTypeName,
  contextId,
  galleryTitle,
  ktEnumEntry,
  ktIdent,
  memberId,
  swiftIdent,
  tokensTypeName,
} from './naming.mjs';
import { ICON_SIZE_EXTENSION, resolveComponents } from './normalise.mjs';
import {
  CONTEXTS,
  iconStepOf,
  isColourProperty,
  isIconSizeProperty,
  splitState,
  toggleOf,
} from './syntax.mjs';

/** The state every variant has before any state applies: its base entry is this look. */
export const BASE_STATE = 'enabled';

/**
 * The icon slots: the leading one (the leading icon, or the loading spinner in its place) and the
 * trailing one after the label (.impeccable/components/README.md G3: a chevron, a pencil). A slot
 * follows the size (button.yaml `leadingIcon`; DESIGN.md "Buttons", "Chips and tags (C03)"): the
 * shared size entry `<id>-<size>` (`slotEntryOf`) holds it for every variant, even where the
 * variant's own entry holds that size's height and padding. A slot value the variant's own base or
 * state entry names wins over it (G6: the group and sort chip's gap 6 at 36).
 */
export const LEADING_SLOT = ['iconSize', 'iconGap'];
export const TRAILING_SLOT = ['trailingIconSize', 'trailingIconGap'];
export const ICON_SLOTS = [...LEADING_SLOT, ...TRAILING_SLOT];
/** The slot properties that name an icon size: `iconSize`, `trailingIconSize`. */
export const SLOT_SIZES = ICON_SLOTS.filter(isIconSizeProperty);

/** The shared size entry holding a size's icon slots: `button`, `compact` -> `button-compact`. */
export const slotEntryOf = (id, size) => `${id}-${size}`;

/** An `icons` source draws an icon: a glyph id or a `{props.…}` reference; `null` draws none. */
export const drawsIcon = (source) => source !== undefined && source !== null;

/** `{props.leadingIcon}`: an `icons` source or part colour that names a prop, not a glyph. */
export const isPropReference = (value) => /^\{props\.[a-z][A-Za-z0-9]*\}$/.test(value);

/**
 * One look's icon sources (G4) as `{ leading, trailing }`, each a glyph id, a `{props.…}`
 * reference, `null` or undefined: the state's entry in `icons`, else its toggle's for a compound
 * state (G2: a toggle state's icons apply to its compounds), else the variant's own.
 */
export function iconSourcesOf(contract, variant, state) {
  const icons = contract.icons?.[variant] ?? {};
  const layers = [icons.states?.[state], icons.states?.[toggleOf(state)], icons];
  const source = (side) => layers.find((layer) => layer && Object.hasOwn(layer, side))?.[side];
  return { leading: source('leading'), trailing: source('trailing') };
}

/**
 * The icon slots each used size draws, in `sizes` order: `[size, { leading, trailing }]` (G11).
 * With `icons` (G4) a look draws a slot when its icon sources (iconSourcesOf) name an icon there.
 * Without `icons` every look draws the leading slot (the button: its `leadingIcon` prop, or the
 * spinner while loading) and none a trailing one.
 */
export function slotsDrawn(contract) {
  const drawn = new Map();
  for (const { variant, size, state } of allowedCombinations(contract)) {
    const slots = drawn.get(size) ?? { leading: false, trailing: false };
    if (contract.icons === undefined) {
      slots.leading = true;
    } else {
      const { leading, trailing } = iconSourcesOf(contract, variant, state);
      slots.leading ||= drawsIcon(leading);
      slots.trailing ||= drawsIcon(trailing);
    }
    drawn.set(size, slots);
  }
  return contract.sizes.filter((size) => drawn.has(size)).map((size) => [size, drawn.get(size)]);
}

export const isToken = (node) => Object.hasOwn(node, '$value');

/** The icon size an `iconSize` token names (`icon-md`, normalise.mjs), or null for a number. */
export const iconSizeKeyOf = (token) => token?.$extensions?.[ICON_SIZE_EXTENSION] ?? null;
export const finding = (rule, at, message) => ({ rule, at, message });

/**
 * A `rule` finding at `at` for every id of `ids` that would be a keyword, or collide with another,
 * once spelled as a Swift case (`memberId`) and a Kotlin entry (`ktEnumEntry`).
 */
export function identifierFindings(ids, at, noun, rule) {
  const out = [];
  const seen = new Map();
  for (const id of ids) {
    const name = memberId(id);
    if (swiftIdent(name) !== name || ktIdent(name) !== name) {
      out.push(finding(rule, at, `${noun} "${id}" is a Swift or Kotlin keyword`));
    }
    for (const spelled of new Set([name, ktEnumEntry(name)])) {
      const other = seen.get(spelled);
      if (other !== undefined && other !== id) {
        out.push(finding(rule, at, `${noun}s "${other}" and "${id}" both become ${spelled}`));
      }
      seen.set(spelled, id);
    }
  }
  return out;
}

/** `{ variant, size, state }` joined by slashes into one lookup string (variant first). */
export const comboKey = ({ variant, size, state }) => `${variant}/${size}/${state}`;

/** A contract's test ID for one combination: `ds-button-primary-large-enabled`. */
export const testIdOf = (id, { variant, size, state }) => `ds-${id}-${variant}-${size}-${state}`;

/**
 * `{components.X}` -> `{ component, state }` in the model, or null. A whole component wins
 * (`button-action-selected`, `focus-ring`); otherwise `<component>-<state>` names a declared state
 * of that component (owner decision 2026-10-20: `{components.button-primary-pressed}` is
 * `button-primary` -> `pressed`; the contract is not rewritten).
 */
export function resolveReference(reference, model) {
  const key = reference.slice('{components.'.length, -1);
  const components = model.sets.components;
  if (Object.hasOwn(components, key)) return { component: key, state: null };
  const { component, state } = splitState(key);
  if (state === null || !Object.hasOwn(components, component)) return null;
  const group = components[component][state];
  return group && !isToken(group) ? { component, state } : null;
}

/** Every allowed variant x size x state, in the order of `variants`, `sizes` and `states`. */
export function allowedCombinations(contract) {
  return contract.variants.flatMap((variant) => {
    const allowed = contract.combinations[variant];
    if (!allowed) return [];
    const sizes = contract.sizes.filter((size) => allowed.sizes.includes(size));
    const states = contract.states.filter((state) => allowed.states.includes(state));
    return sizes.flatMap((size) => states.map((state) => ({ variant, size, state })));
  });
}

/** The contexts every base and size entry has instances for (contextsOf), in CONTEXTS order. */
export function tableContexts(contract, model) {
  const components = Object.values(contract.tokens).flatMap((tokens) =>
    [tokens.base, ...Object.values(tokens.sizes)].map((r) => resolveReference(r, model).component),
  );
  return CONTEXTS.filter((context) => components.every((c) => contextsOf(c).includes(context)));
}

/**
 * The API model of one checked contract (`{ findings, api }`): its axes, its allowed combinations,
 * the fields of its merged look, that look for every combination in every context of the table,
 * and its gallery. A field some look lacks is optional; so is an overlay. A look with a
 * `borderColor` ring and no `borderWidth` of its own gets the default width of `<id>-outline-ring`
 * (.impeccable/components README, "Fields": the ring's width; G5: an entry's own `borderWidth`
 * wins, the never-suggest chip's pressed 2 px). A ring with neither width, or a property whose
 * type differs between looks, is a CC-06 finding. The gallery's `title` is
 * `<board> <gallery.title>` and its `slug` the kebab of that title (`C01 Buttons`, `c01-buttons`).
 * The gallery keeps `labels`, each variant's own sample label (CC-19), `{}` without any.
 * With `iconSet` (the approved icon set beside it, `iconSetOf` in contracts.mjs), a slot size
 * (SLOT_SIZES) that names an icon size is that set's size enum case (`AppIconSize.md`) instead of
 * its number (CC-12 makes every drawn slot name one), and a contract with `icons` (G4) gives each
 * look its `leadingIcon` and `trailingIcon` sources (`<Name>IconSource`: a glyph of the set's name
 * enum, or the caller's icon prop). Without an approved icon set there is no glyph type to name,
 * so the look has no icon sources.
 */
export function buildApi(contract, file, model, iconSet = null) {
  const findings = [];
  const combinations = allowedCombinations(contract);
  const contexts = tableContexts(contract, model);
  const ring = `${contract.id}-outline-ring`;
  const icons =
    iconSet && contract.icons !== undefined
      ? { sourceType: apiTypeName(contract.id, 'IconSource'), nameType: iconSet.nameType }
      : null;
  const table = { model, iconSizeType: iconSet?.sizeType ?? null, icons };
  const looks = {};
  for (const context of contexts) {
    const resolved = resolveComponents(model, context);
    looks[context] = combinations.map((combo) => {
      const values = lookValues(contract, combo, { ...table, resolved, context });
      if (values.borderColor && !values.borderWidth) {
        const width = resolved[ring]?.width;
        if (width && isToken(width)) values.borderWidth = typedValue(width);
        else {
          const message = `${comboKey(combo)} draws a ring, but {components.${ring}} has no width`;
          findings.push(finding('CC-06', `${file} tokens.${combo.variant}`, message));
        }
      }
      return { ...combo, values };
    });
  }
  const fields = fieldsOf(Object.values(looks).flat(), file, findings);
  const { title, label, labels = {}, include } = contract.gallery;
  const api = {
    id: contract.id,
    name: contract.name,
    board: contract.board,
    file,
    variants: contract.variants,
    sizes: contract.sizes,
    states: contract.states,
    combinations,
    contexts,
    fields,
    looks,
    iconSource: icons,
    gallery: {
      ...galleryTitle(contract.board, title),
      label,
      labels,
      items: include === 'all' ? combinations : include,
    },
  };
  return { findings: uniqueFindings(findings), api };
}

/**
 * One look's typed values (`typedValue`): the base entry's properties, then the state's, then the
 * size entry's, later overriding earlier. A compound state (G2) applies its toggle's entry first,
 * then its own (`selected`, then `selected-pressed`). A size entry that is the base itself adds
 * nothing: the base is already applied, and applying it again would undo the state (the
 * destructive-filled disabled label weight). Then the icon slots (ICON_SLOTS, in that order): each
 * value the base or a state entry names (G6), else the shared size entry's, which a size without a
 * drawn slot may lack (G11). An overlay state adds a field named after its component that holds
 * that component's instance for the context (`focusRing: FocusRingTokens.hcDark`) and changes no
 * colour (owner decision 2026-10-20: focused is the focus ring drawn over the enabled look). Last,
 * with `table.icons`, the icon sources (G4).
 */
function lookValues(contract, { variant, size, state }, table) {
  const { resolved, context, model, iconSizeType } = table;
  const tokens = contract.tokens[variant];
  const base = resolveReference(tokens.base, model).component;
  const props = propertiesOf(resolved[base]);
  const own = slotOf(props);
  const overlays = {};
  const stateReferences = [toggleOf(state), state]
    .filter((s) => s && s !== BASE_STATE)
    .map((s) => tokens.states[s])
    .filter(Boolean);
  for (const reference of stateReferences) {
    const r = resolveReference(reference, model);
    if (r.state === null) overlays[memberId(r.component)] = r.component;
    else {
      const stateProps = propertiesOf(resolved[r.component][r.state]);
      Object.assign(props, stateProps);
      Object.assign(own, slotOf(stateProps));
    }
  }
  const sizeEntry = resolveReference(tokens.sizes[size], model).component;
  if (sizeEntry !== base) Object.assign(props, propertiesOf(resolved[sizeEntry]));
  for (const name of ICON_SLOTS) delete props[name];
  const shared = slotOf(resolved[slotEntryOf(contract.id, size)] ?? {});
  for (const name of ICON_SLOTS) {
    const token = own[name] ?? shared[name];
    if (token) props[name] = token;
  }
  const values = Object.fromEntries(
    Object.entries(props).map(([name, token]) => [name, typedValue(token)]),
  );
  for (const name of SLOT_SIZES) {
    const iconSize = iconSizeKeyOf(props[name]);
    if (!iconSizeType || !iconSize) continue;
    const value = { t: 'case', type: iconSizeType, id: memberId(iconStepOf(iconSize)) };
    values[name] = { type: iconSizeType, value };
  }
  for (const [name, component] of Object.entries(overlays)) {
    const type = tokensTypeName(component);
    const value = { t: 'ref', namespace: type, member: contextId(context) };
    values[name] = { type, value, overlay: true };
  }
  if (table.icons) Object.assign(values, iconValues(contract, { variant, state }, table.icons));
  return values;
}

/** The icon-source fields of a look: `leadingIcon`, `trailingIcon` (ICON_SOURCE_FIELDS). */
export const ICON_SOURCE_FIELDS = { leading: 'leadingIcon', trailing: 'trailingIcon' };

/**
 * A look's `leadingIcon` and `trailingIcon` where it draws one (G4): `<Name>IconSource.glyph(name:)`
 * with the icon set's name case, or `.prop` for a `{props.…}` source (the caller's icon prop).
 */
function iconValues(contract, { variant, state }, { sourceType, nameType }) {
  const sources = iconSourcesOf(contract, variant, state);
  const values = {};
  for (const [side, field] of Object.entries(ICON_SOURCE_FIELDS)) {
    const source = sources[side];
    if (!drawsIcon(source)) continue;
    const value = isPropReference(source)
      ? { t: 'union', type: sourceType, case: 'prop', args: [] }
      : { t: 'union', type: sourceType, case: 'glyph', args: [glyphArgument(nameType, source)] };
    values[field] = { type: sourceType, value, iconSource: true };
  }
  return values;
}

/** The `name:` argument of `.glyph(name:)`: the glyph's case of the icon set's name enum. */
const glyphArgument = (nameType, glyph) => ({
  name: 'name',
  type: nameType,
  value: { t: 'case', type: nameType, id: memberId(glyph) },
});

const propertiesOf = (group) =>
  Object.fromEntries(Object.entries(group).filter(([, node]) => isToken(node)));

/** The ICON_SLOTS tokens a resolved group holds, in ICON_SLOTS order. */
const slotOf = (group) =>
  Object.fromEntries(
    ICON_SLOTS.filter((name) => group[name] && isToken(group[name])).map((name) => [
      name,
      group[name],
    ]),
  );

/**
 * The merged look's fields: colours first, then `borderWidth`, then the other properties, then the
 * icon sources (G4), then overlays, each group in first-appearance order. A field some look lacks
 * is optional; a field whose type differs between looks is a CC-06 finding.
 */
function fieldsOf(looks, file, findings) {
  const types = new Map();
  for (const { values } of looks) {
    for (const [name, { type }] of Object.entries(values)) {
      const seen = types.get(name);
      if (seen === undefined) types.set(name, type);
      else if (seen !== type) {
        const message = `the merged property ${name} is ${seen} in one look and ${type} in another`;
        findings.push(finding('CC-06', `${file} tokens`, message));
      }
    }
  }
  const names = [...types.keys()];
  const isOverlay = (name) => looks.some(({ values }) => values[name]?.overlay);
  const isIconSource = (name) => looks.some(({ values }) => values[name]?.iconSource);
  const isPlain = (name) =>
    !isColourProperty(name) && name !== 'borderWidth' && !isOverlay(name) && !isIconSource(name);
  const ordered = [
    ...names.filter((name) => isColourProperty(name)),
    ...names.filter((name) => name === 'borderWidth'),
    ...names.filter(isPlain),
    ...Object.values(ICON_SOURCE_FIELDS).filter((name) => names.includes(name)),
    ...names.filter(isOverlay),
  ];
  return ordered.map((name) => ({
    name,
    type: types.get(name),
    optional: looks.some(({ values }) => !Object.hasOwn(values, name)),
  }));
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.rule} ${f.at} ${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
