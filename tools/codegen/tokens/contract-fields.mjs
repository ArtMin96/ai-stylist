// The control-contract fields beside the axes and tokens (.impeccable/components/README.md G4, G7,
// G8, G9) and their rules: CC-13 (touch target, over every variant's role), CC-14 (`icons`), CC-15
// (`accessibility.roles`, `selection`, `labelOverride`) and CC-16 (prop types and per-variant
// props), plus the prop helpers contract-parts.mjs shares. contracts.mjs runs the rules in its
// stages; `fieldsApi` adds the roles and the enum props to the API model, which
// api-declarations.mjs reads. tools/codegen/tokens/README.md, "Component contracts".
import {
  BASE_STATE,
  drawsIcon,
  finding,
  identifierFindings,
  isPropReference,
} from './contract-model.mjs';
import { apiTypeName, nestedTypeName } from './naming.mjs';

/** The accessibility roles (G7), in the order every `<Name>Role` lists them. */
export const ROLES = [
  'button',
  'toggle',
  'radio',
  'selectable',
  'disclosure',
  'menu',
  'text',
  'region',
  'decorative',
];
/** Roles a screen reader reads or skips but nobody activates (G9); every other role acts. */
const PASSIVE_ROLES = ['text', 'region', 'decorative'];
/** The values of the enum prop `accessibility.selection` names (G7): toggle and radio. */
const SELECTION_VALUES = ['multiple', 'single'];
/**
 * The type-name suffixes the API gives a control (api-declarations.mjs). An enum prop's type is
 * `<Name><Prop>`, so a prop named after one of them (`variant`, `size`) would collide (CC-16).
 */
const API_SUFFIXES = [
  'Variant',
  'Size',
  'State',
  'Role',
  'TestId',
  'Appearance',
  'Look',
  'Spec',
  'GalleryEntry',
  'Accessibility',
  'IconSource',
  'Part',
  'PartKind',
  'PartPosition',
];

/** `{props.label}` -> `label`. */
export const propNameOf = (reference) => reference.slice('{props.'.length, -1);
export const propOf = (contract, name) => contract.props.find((prop) => prop.name === name);
/** A prop or part applies to `variant` unless its `variants` (G8, G12) leave it out. */
export const appliesTo = (item, variant) => !item.variants || item.variants.includes(variant);
/** An enum prop's generated type: `chip` + `selection` -> `ChipSelection`. */
export const propTypeName = (contract, prop) => apiTypeName(contract.id, nestedTypeName(prop.name));
/** Each variant's role (G7): its own in `accessibility.roles`, else `accessibility.role`. */
const roleOf = (contract, variant) =>
  contract.accessibility.roles?.[variant] ?? contract.accessibility.role;
/** The roles the variants take, in ROLES order. */
const rolesUsed = (contract) =>
  ROLES.filter((role) => contract.variants.some((variant) => roleOf(contract, variant) === role));
/** `role text is` or `roles text and decorative are`. */
const rolesAre = (roles) =>
  roles.length === 1 ? `role ${roles[0]} is` : `roles ${roles.join(' and ')} are`;

/**
 * CC-13: a contract where some variant's role (G7) is interactive (any role outside
 * PASSIVE_ROLES: button, toggle, menu, …) needs `minTouchTarget` and an `action` prop; one whose
 * roles are all passive has no `action` prop and may leave the touch target out (G9: tags,
 * badges, the reason row).
 */
export function checkTouchTarget(contract, file) {
  const roles = rolesUsed(contract);
  const interactive = roles.filter((role) => !PASSIVE_ROLES.includes(role));
  const hasAction = contract.props.some(({ type }) => type === 'action');
  if (interactive.length === 0) {
    const message = `${rolesAre(roles)} never activated, so no prop is an action`;
    return hasAction ? [finding('CC-13', `${file} props`, message)] : [];
  }
  const [role] = interactive;
  const needs = (where, what) =>
    finding('CC-13', `${file} ${where}`, `role ${role} is interactive: it needs ${what}`);
  const out = [];
  if (contract.accessibility.minTouchTarget === undefined) {
    out.push(needs('accessibility', 'minTouchTarget'));
  }
  if (!hasAction) out.push(needs('props', 'an action prop'));
  return out;
}

/**
 * CC-14 (G4): every `icons` key is a variant, and its `states` keys are states that variant
 * allows (not `enabled`: the variant's own `leading` and `trailing` are that look). A source that
 * names a prop names an `icon` prop that applies to the variant; a glyph id is one of the glyphs of
 * the icon set beside the contract (`iconSets`; without exactly one there is no set to name).
 */
export function checkIcons(contract, file, iconSets) {
  if (contract.icons === undefined) return [];
  const out = [];
  const iconSet = iconSets.length === 1 ? iconSets[0] : null;
  for (const [variant, icons] of Object.entries(contract.icons)) {
    const at = (where) => `${file} icons.${variant}${where}`;
    const allowed = contract.combinations[variant];
    if (!allowed) {
      out.push(finding('CC-14', at(''), `"${variant}" is not a variant`));
      continue;
    }
    const layers = [['', icons]];
    for (const [state, own] of Object.entries(icons.states ?? {})) {
      const message =
        state === BASE_STATE
          ? `"${BASE_STATE}" is the variant's own icons; it takes no state entry`
          : `"${state}" is not allowed for ${variant}`;
      if (state === BASE_STATE || !allowed.states.includes(state)) {
        out.push(finding('CC-14', at(`.states.${state}`), message));
      }
      layers.push([`.states.${state}`, own]);
    }
    for (const [where, slots] of layers) {
      for (const side of ['leading', 'trailing']) {
        if (!drawsIcon(slots[side])) continue;
        const message = iconSourceProblem(contract, slots[side], variant, iconSet);
        if (message) out.push(finding('CC-14', at(`${where}.${side}`), message));
      }
    }
  }
  return out;
}

/** What is wrong with one `icons` source of `variant`, or null. */
function iconSourceProblem(contract, source, variant, iconSet) {
  if (!isPropReference(source)) {
    const listed = !iconSet || iconSet.glyphs.includes(source);
    return listed ? null : `glyph "${source}" is not in ${iconSet.file}`;
  }
  const prop = propOf(contract, propNameOf(source));
  if (!prop) return `${source} names no prop`;
  if (prop.type !== 'icon') return `${source} is a ${prop.type} prop, not an icon prop`;
  return appliesTo(prop, variant) ? null : `${source} does not apply to ${variant}`;
}

/**
 * CC-15 (G7): every `accessibility.roles` key is a variant. `selection` is given exactly when some
 * variant is `selectable`, and names an `enum` prop with the values `multiple` and `single` that
 * applies to every selectable variant. `labelOverride` names an optional `string` prop: it
 * replaces the label only when it is passed.
 */
export function checkAccessibility(contract, file) {
  const out = [];
  const { roles = {}, selection, labelOverride } = contract.accessibility;
  const at = (where) => `${file} accessibility.${where}`;
  for (const variant of Object.keys(roles).filter((v) => !contract.variants.includes(v))) {
    out.push(finding('CC-15', at(`roles.${variant}`), `"${variant}" is not a variant`));
  }
  const selectable = contract.variants.filter((v) => roleOf(contract, v) === 'selectable');
  const selectionMessage = selectionProblem(contract, selection, selectable);
  if (selectionMessage) out.push(finding('CC-15', at('selection'), selectionMessage));
  const overrideMessage = labelOverrideProblem(contract, labelOverride);
  if (overrideMessage) out.push(finding('CC-15', at('labelOverride'), overrideMessage));
  return out;
}

function selectionProblem(contract, selection, selectable) {
  if (selection === undefined) {
    if (selectable.length === 0) return null;
    return `${selectable.join(', ')}: a selectable role needs the selection prop`;
  }
  if (selectable.length === 0) return 'no variant is selectable, so nothing reads the selection';
  const prop = propOf(contract, propNameOf(selection));
  if (!prop) return `${selection} names no prop`;
  const values = prop.values ?? [];
  const exact =
    values.length === SELECTION_VALUES.length && SELECTION_VALUES.every((v) => values.includes(v));
  if (prop.type !== 'enum' || !exact) {
    return `${selection} is not an enum prop with the values ${SELECTION_VALUES.join(' and ')}`;
  }
  const missing = selectable.filter((variant) => !appliesTo(prop, variant));
  return missing.length === 0 ? null : `${selection} does not apply to ${missing.join(', ')}`;
}

function labelOverrideProblem(contract, labelOverride) {
  if (labelOverride === undefined) return null;
  const prop = propOf(contract, propNameOf(labelOverride));
  if (!prop) return `${labelOverride} names no prop`;
  if (prop.type !== 'string') return `${labelOverride} is a ${prop.type} prop, not text`;
  if (!prop.required) return null;
  return `${labelOverride} is required, so it would always replace the label`;
}

/**
 * CC-16 (G8): prop names are unique and a prop's `variants` are variants. Only an `enum` prop has
 * `values`, and it must have them: each a case that is no keyword, the `default` one of them (or
 * null), and its type `<Name><Prop>` no other API type (`variant` would be `<Name>Variant`).
 */
export function checkProps(contract, file) {
  const out = [];
  contract.props.forEach((prop, i) => {
    const at = (where = '') => `${file} props.${i}${where}`;
    if (contract.props.findIndex(({ name }) => name === prop.name) !== i) {
      out.push(finding('CC-16', at(), `"${prop.name}" is not unique`));
    }
    for (const variant of (prop.variants ?? []).filter((v) => !contract.variants.includes(v))) {
      out.push(finding('CC-16', at('.variants'), `"${variant}" is not a variant`));
    }
    if (prop.type === 'enum') out.push(...enumPropFindings(contract, prop, at));
    else if (prop.values) out.push(finding('CC-16', at('.values'), `a ${prop.type} prop has none`));
  });
  return out;
}

function enumPropFindings(contract, prop, at) {
  if (!prop.values) return [finding('CC-16', at(), `the enum prop "${prop.name}" needs values`)];
  const out = identifierFindings(prop.values, at('.values'), 'value', 'CC-16');
  const fallback = prop.default;
  if (fallback !== undefined && fallback !== null && !prop.values.includes(fallback)) {
    const message = `${JSON.stringify(fallback)} is not one of its values`;
    out.push(finding('CC-16', at('.default'), message));
  }
  const suffix = nestedTypeName(prop.name);
  if (API_SUFFIXES.includes(suffix)) {
    const message = `its type ${propTypeName(contract, prop)} is the API's own ${suffix} type`;
    out.push(finding('CC-16', at(), message));
  }
  return out;
}

/**
 * The roles in use (`<Name>Role`, G7) with each variant's, the enum props with their types and
 * values (`<Name><Prop>`, G8), and the touch target (`{ ios, android }`, or null without one:
 * `<Name>Accessibility`), for the API model.
 */
export function fieldsApi(contract) {
  return {
    minTouchTarget: contract.accessibility.minTouchTarget ?? null,
    roles: rolesUsed(contract),
    variantRoles: Object.fromEntries(contract.variants.map((v) => [v, roleOf(contract, v)])),
    enums: contract.props
      .filter(({ type }) => type === 'enum')
      .map((prop) => ({
        prop: prop.name,
        type: propTypeName(contract, prop),
        values: prop.values,
      })),
  };
}
