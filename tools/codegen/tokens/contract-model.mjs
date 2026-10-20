// A checked component contract + the in-memory token model -> the API model the component-API
// emitters read (ADR-0011 follow-up 7, DEC-87): the axes, the allowed combinations and one ready,
// merged look per combination and context (owner decision 2026-10-20: base, then state, then
// size, then the size's icon slot). Also the reference grammar the checker (contracts.mjs)
// shares. Only run buildApi on a contract that passed CC-01 to CC-08.
// tools/codegen/tokens/README.md, "Component contracts".
import { contextsOf, typedValue } from './declarations.mjs';
import { contextId, galleryTitle, memberId, tokensTypeName } from './naming.mjs';
import { resolveComponents } from './normalise.mjs';
import { CONTEXTS, isColourProperty, splitState } from './syntax.mjs';

/** The state every variant has before any state applies: its base entry is this look. */
export const BASE_STATE = 'enabled';

/**
 * The leading-icon slot (the leading icon, or the loading spinner in its place). It depends on the
 * size only, never on the variant (.impeccable/components/button.yaml, `leadingIcon`; DESIGN.md
 * "Buttons"), so every look reads it from the shared size entry `<id>-<size>` (`slotEntryOf`), even
 * where the variant's own entry holds that size's height and padding.
 */
export const ICON_SLOT = ['iconSize', 'iconGap'];

/** The shared size entry holding a size's icon slot: `button`, `compact` -> `button-compact`. */
export const slotEntryOf = (id, size) => `${id}-${size}`;

export const isToken = (node) => Object.hasOwn(node, '$value');
export const finding = (rule, at, message) => ({ rule, at, message });

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
 * `borderColor` ring also gets `borderWidth` from `<id>-outline-ring` (.impeccable/components
 * README, "Fields": the ring's width). A missing ring width or a property whose type differs
 * between looks is a CC-06 finding. The gallery's `title` is `<board> <gallery.title>` and its
 * `slug` the kebab of that title (`C01 Buttons`, `c01-buttons`).
 */
export function buildApi(contract, file, model) {
  const findings = [];
  const combinations = allowedCombinations(contract);
  const contexts = tableContexts(contract, model);
  const ring = `${contract.id}-outline-ring`;
  const looks = {};
  for (const context of contexts) {
    const resolved = resolveComponents(model, context);
    looks[context] = combinations.map((combo) => {
      const values = lookValues(contract, combo, { resolved, context, model });
      if (values.borderColor) {
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
  const { title, label, include } = contract.gallery;
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
    gallery: {
      ...galleryTitle(contract.board, title),
      label,
      items: include === 'all' ? combinations : include,
    },
  };
  return { findings: uniqueFindings(findings), api };
}

/**
 * One look's typed values (`typedValue`): the base entry's properties, then the state's, then the
 * size entry's, later overriding earlier. A size entry that is the base itself adds nothing: the
 * base is already applied, and applying it again would undo the state (the destructive-filled
 * disabled label weight). Last, the icon slot replaces any slot value with the shared size
 * entry's (ICON_SLOT). An overlay state adds a field named after its component that holds that
 * component's instance for the context (`focusRing: FocusRingTokens.hcDark`) and changes no colour
 * (owner decision 2026-10-20: focused is the focus ring drawn over the enabled look).
 */
function lookValues(contract, { variant, size, state }, { resolved, context, model }) {
  const tokens = contract.tokens[variant];
  const base = resolveReference(tokens.base, model).component;
  const props = propertiesOf(resolved[base]);
  const overlays = {};
  const stateReference = state === BASE_STATE ? undefined : tokens.states[state];
  if (stateReference) {
    const r = resolveReference(stateReference, model);
    if (r.state === null) overlays[memberId(r.component)] = r.component;
    else Object.assign(props, propertiesOf(resolved[r.component][r.state]));
  }
  const sizeEntry = resolveReference(tokens.sizes[size], model).component;
  if (sizeEntry !== base) Object.assign(props, propertiesOf(resolved[sizeEntry]));
  // The icon slot comes from the shared size entry only (ICON_SLOT), after everything else.
  for (const name of ICON_SLOT) delete props[name];
  Object.assign(props, slotOf(resolved[slotEntryOf(contract.id, size)]));
  const values = Object.fromEntries(
    Object.entries(props).map(([name, token]) => [name, typedValue(token)]),
  );
  for (const [name, component] of Object.entries(overlays)) {
    const type = tokensTypeName(component);
    const value = { t: 'ref', namespace: type, member: contextId(context) };
    values[name] = { type, value, overlay: true };
  }
  return values;
}

const propertiesOf = (group) =>
  Object.fromEntries(Object.entries(group).filter(([, node]) => isToken(node)));

/** The ICON_SLOT tokens of a resolved size entry, in ICON_SLOT order (CC-08 guarantees both). */
const slotOf = (group) => Object.fromEntries(ICON_SLOT.map((name) => [name, group[name]]));

/**
 * The merged look's fields: colours first, then `borderWidth`, then the other properties, then
 * overlays, each group in first-appearance order. A field some look lacks is optional; a field
 * whose type differs between looks is a CC-06 finding.
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
  const isPlain = (name) => !isColourProperty(name) && name !== 'borderWidth' && !isOverlay(name);
  const ordered = [
    ...names.filter((name) => isColourProperty(name)),
    ...names.filter((name) => name === 'borderWidth'),
    ...names.filter(isPlain),
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
