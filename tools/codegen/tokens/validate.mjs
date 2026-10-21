// Our own DESIGN.md frontmatter rules, TK-01..TK-11 (catalog: tools/codegen/tokens/README.md).
// TK-12 is the pinned `@google/design.md` lint (upstream-lint.mjs). Every rule reports and the run
// continues, so one pass lists every finding; only TK-01 stops early, when a group is unusable.
import { tokensTypeName, memberId, propertyIds } from './naming.mjs';
import { colorRoles, componentGroups } from './structure.mjs';
import {
  DYNAMIC_TYPE_STYLES,
  ICON_SIZE_KEY,
  M3_ROLES,
  iconSizeNamed,
  isIconSizeProperty,
  META_KEYS,
  TOKEN_GROUPS,
  dynamicTypeName,
  isColourProperty,
  isKebab,
  isPlainObject,
  isPropertyName,
  isShorthand,
  parseColor,
  parseCubicBezier,
  parseDimension,
  parseDurationMs,
  parsePadding,
  parseReference,
  splitScheme,
} from './syntax.mjs';
import { checkPairing, checkVariantsAgree } from './twin-rule.mjs';

const TYPE_KEYS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'dynamicType',
  'm3Roles',
];
/** Groups whose keys name a type, role or style, so they must start with a letter. */
const NAMED_GROUPS = ['colors', 'typography', 'components'];
const SCALE_GROUPS = ['rounded', 'spacing', 'elevation', 'motion'];
/** Which groups an entry of each group may reference (motion: a shared curve). */
const REFERABLE = {
  components: ['colors', 'typography', 'rounded', 'spacing', 'elevation', 'motion'],
  elevation: ['colors', 'rounded', 'spacing'],
  motion: ['motion'],
};
/** A padding part may reference only the spacing scale. */
const PADDING_REFERABLE = ['spacing'];

/** Validates parsed frontmatter + body; returns `{ rule, at, message }` findings in file order. */
export function validate({ frontmatter, body }) {
  const findings = [];
  const add = (rule, at, message) => findings.push({ rule, at, message });
  if (!checkTopLevel(frontmatter, add)) return findings;
  const ctx = { fm: frontmatter, colours: colorRoles(frontmatter.colors), add };
  checkColors(ctx);
  checkPairing(ctx, body);
  checkTypography(frontmatter.typography, add);
  checkScale(ctx, 'rounded');
  checkScale(ctx, 'spacing');
  checkSingleValues(ctx, 'elevation');
  checkSingleValues(ctx, 'motion');
  checkComponents(ctx);
  checkIdentifiers(ctx);
  return findings;
}

function checkTopLevel(fm, add) {
  for (const key of Object.keys(fm)) {
    if (!META_KEYS.includes(key) && !TOKEN_GROUPS.includes(key)) {
      add('TK-01', key, 'unknown top-level key: the generator would drop it');
    }
  }
  const missing = TOKEN_GROUPS.filter((group) => !isPlainObject(fm[group]));
  for (const group of missing) add('TK-01', group, 'required token group missing or not a mapping');
  return missing.length === 0;
}

/** TK-11 colour literals. */
function checkColors({ fm, add }) {
  for (const [key, value] of Object.entries(fm.colors)) {
    if (!parseColor(value)) {
      const text = `${JSON.stringify(value)} is not #RRGGBB, #RRGGBBAA, rgb() or rgba()`;
      add('TK-11', `colors.${key}`, text);
    }
  }
}

/** TK-08 typography entries; TK-09 each M3 role exactly once. */
function checkTypography(typography, add) {
  const roleCount = new Map(M3_ROLES.map((role) => [role, 0]));
  for (const [key, style] of Object.entries(typography)) {
    const bad = (message) => add('TK-08', `typography.${key}`, message);
    if (!isPlainObject(style)) {
      bad('must be a mapping of type properties');
      continue;
    }
    for (const k of Object.keys(style)) {
      if (!TYPE_KEYS.includes(k)) bad(`unknown property \`${k}\`: the generator would drop it`);
    }
    for (const k of TYPE_KEYS.filter((k) => style[k] === undefined)) bad(`missing \`${k}\``);
    const { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, dynamicType } = style;
    if (fontFamily !== undefined && !(typeof fontFamily === 'string' && fontFamily.trim())) {
      bad('`fontFamily` must be a non-empty string');
    }
    if (fontSize !== undefined && !(parseDimension(fontSize)?.value > 0)) {
      bad('`fontSize` must be a positive px dimension');
    }
    const weightOk = Number.isInteger(fontWeight) && fontWeight >= 1 && fontWeight <= 1000;
    if (fontWeight !== undefined && !weightOk) bad('`fontWeight` must be an integer 1–1000');
    const ratio = typeof lineHeight === 'number' ? lineHeight : parseDimension(lineHeight)?.value;
    if (lineHeight !== undefined && !(ratio > 0)) {
      bad('`lineHeight` must be a positive px dimension or number');
    }
    if (letterSpacing !== undefined && !parseDimension(letterSpacing, ['px', 'em'])) {
      bad('`letterSpacing` must be a px or em dimension (`0em`, not `0`)');
    }
    if (dynamicType !== undefined && !DYNAMIC_TYPE_STYLES.includes(dynamicTypeName(dynamicType))) {
      bad(`\`dynamicType\` must be one of ${DYNAMIC_TYPE_STYLES.join(', ')}`);
    }
    if (style.m3Roles === undefined) continue;
    if (!Array.isArray(style.m3Roles)) {
      bad('`m3Roles` must be a list (it may be empty)');
      continue;
    }
    for (const role of style.m3Roles.filter((r) => !roleCount.has(r))) {
      bad(`unknown M3 role ${JSON.stringify(role)}`);
    }
    for (const role of style.m3Roles.filter((r) => roleCount.has(r))) {
      roleCount.set(role, roleCount.get(role) + 1);
    }
  }
  for (const [role, count] of roleCount) {
    if (count !== 1) {
      add('TK-09', 'typography', `M3 role \`${role}\` appears ${count} times; each appears once`);
    }
  }
}

/** TK-11 rounded/spacing: px dimensions or plain numbers. */
function checkScale({ fm, add }, group) {
  for (const [key, value] of Object.entries(fm[group])) {
    if (typeof value === 'number' || parseDimension(value)) continue;
    add('TK-11', `${group}.${key}`, `${JSON.stringify(value)} is not a px dimension or a number`);
  }
}

/** TK-07 elevation/motion: one value per entry (or per field of a one-level mapping). */
function checkSingleValues(ctx, group) {
  for (const [key, value] of Object.entries(ctx.fm[group])) {
    const at = `${group}.${key}`;
    const { scheme } = splitScheme(key);
    if (Array.isArray(value)) {
      ctx.add('TK-07', at, 'a list is not a single value');
    } else if (!isPlainObject(value)) {
      checkSingleValue(ctx, { group, at, value, scheme, field: null });
    } else if (Object.keys(value).length === 0) {
      ctx.add('TK-07', at, 'an empty mapping holds no value');
    } else {
      for (const [field, v] of Object.entries(value)) {
        if (isPlainObject(v) || Array.isArray(v)) {
          ctx.add('TK-07', `${at}.${field}`, 'nested deeper than one level: use single values');
        } else {
          checkSingleValue(ctx, { group, at: `${at}.${field}`, value: v, scheme, field });
        }
      }
    }
  }
}

/**
 * One elevation or motion value. A shadow colour (an `elevation` field named `color` or `…Color`)
 * may be a literal colour or a `{colors.<token>}` reference: shadows are not themed roles. Every
 * other colour outside `colors` is a role reference (TK-04).
 */
function checkSingleValue(ctx, { group, at, value, scheme, field }) {
  if (typeof value === 'number') return;
  if (isShorthand(value)) {
    ctx.add('TK-07', at, `${JSON.stringify(value)} is CSS shorthand: one value per entry`);
    return;
  }
  const shadowColour = group === 'elevation' && field !== null && isColourProperty(field);
  const ref = parseReference(value);
  if (ref && shadowColour && ref.group !== 'colors') {
    ctx.add('TK-04', at, 'a shadow colour is a literal colour or a `{colors.<token>}` reference');
  } else if (ref) {
    checkReference(ctx, at, ref, scheme, REFERABLE[group]);
  } else if (parseColor(value)) {
    if (!shadowColour) {
      ctx.add('TK-04', at, 'a colour outside `colors` must be a `{colors.<token>}` role reference');
    }
  } else if (group === 'motion') {
    if (parseDurationMs(value) === null && parseCubicBezier(value) === null) {
      const text = `${JSON.stringify(value)} is not a duration, cubic-bezier() or linear`;
      ctx.add('TK-11', at, text);
    }
  } else if (parseDimension(value) === null) {
    ctx.add('TK-11', at, `${JSON.stringify(value)} is not a px dimension, number or {reference}`);
  }
}

/**
 * TK-06 the reference resolves to a single value (not a group, not another reference, so there
 * are no alias chains or cycles) and is allowed here; TK-03 a colour stays in its scheme.
 */
function checkReference({ fm, add }, at, ref, scheme, allowed) {
  const text = `{${ref.group}.${ref.key}}`;
  if (!allowed.includes(ref.group)) {
    const groups = allowed.join(', ') || 'none';
    add('TK-06', at, `\`${text}\` cannot be referenced here (allowed: ${groups})`);
    return;
  }
  if (!Object.hasOwn(fm[ref.group], ref.key)) {
    add('TK-06', at, `\`${text}\` does not resolve`);
    return;
  }
  const target = fm[ref.group][ref.key];
  if (ref.group !== 'typography' && isPlainObject(target)) {
    add('TK-06', at, `\`${text}\` names a group of values, not a single value`);
    return;
  }
  if (parseReference(target)) {
    add('TK-06', at, `\`${text}\` is itself a reference: point at the value`);
    return;
  }
  const targetScheme = ref.group === 'colors' ? splitScheme(ref.key).scheme : null;
  if (targetScheme !== null && targetScheme !== scheme) {
    const from = scheme ? `a ${scheme} entry` : 'a scheme-independent entry';
    add('TK-03', at, `${from} references the ${targetScheme} colour \`${ref.key}\``);
  }
}

/** TK-04/TK-06/TK-11 per property; TK-05 scheme variants of one component agree. */
function checkComponents(ctx) {
  for (const [key, props] of Object.entries(ctx.fm.components)) {
    const at = `components.${key}`;
    if (!isPlainObject(props) || Object.keys(props).length === 0) {
      ctx.add('TK-11', at, 'must be a non-empty mapping of properties');
      continue;
    }
    const { scheme } = splitScheme(key);
    for (const [prop, value] of Object.entries(props)) {
      checkComponentProperty(ctx, `${at}.${prop}`, prop, value, scheme);
    }
  }
  for (const group of componentGroups(ctx.fm.components)) {
    for (const variants of group.slots.values()) checkVariantsAgree(ctx, variants);
  }
}

function checkComponentProperty(ctx, at, prop, value, scheme) {
  const ref = parseReference(value);
  const colourProp = isColourProperty(prop);
  const iconSize = iconSizeNamed(prop, value);
  if (prop === 'padding' && !colourProp) {
    checkPadding(ctx, at, value, scheme);
  } else if (iconSize) {
    checkIconSizeReference(ctx, at, prop, { group: 'components', key: iconSize });
  } else if (ref?.group === 'components' && !colourProp) {
    checkIconSizeReference(ctx, at, prop, ref);
  } else if (ref && !(colourProp && ref.group !== 'colors')) {
    checkReference(ctx, at, ref, scheme, REFERABLE.components);
  } else if (colourProp || parseColor(value)) {
    ctx.add('TK-04', at, 'a component colour must be a `{colors.<token>}` role reference');
  } else if (typeof value !== 'number' && parseDimension(value) === null) {
    ctx.add('TK-11', at, `${JSON.stringify(value)} is not a px dimension, number or {reference}`);
  }
}

/** TK-11 a 1–4 part padding; TK-06 each reference part resolves in `spacing` (`0 {spacing.24}`). */
function checkPadding(ctx, at, value, scheme) {
  const sides = parsePadding(value);
  if (!sides) {
    ctx.add('TK-11', at, 'padding takes 1–4 parts, each 0, Npx or a {spacing.<key>} reference');
    return;
  }
  const refs = new Map(
    Object.values(sides)
      .filter((side) => side.ref)
      .map(({ ref }) => [`${ref.group}.${ref.key}`, ref]),
  );
  for (const ref of refs.values()) checkReference(ctx, at, ref, scheme, PADDING_REFERABLE);
}

/**
 * TK-06 a component an icon-slot size names (`iconSize` or `…IconSize`: `icon-md` or
 * `{components.icon-md}`, iconSizeNamed), or any other `{components.<key>}` reference: only an
 * icon-slot size may name a component, and that component is an icon size
 * (`icon-<step>: { size: <n>px, strokeWidth: <w> }`, the C02 scale).
 */
function checkIconSizeReference({ fm, add }, at, prop, ref) {
  const text = `{components.${ref.key}}`;
  if (!isIconSizeProperty(prop)) {
    const message = 'only iconSize or a …IconSize property names a component';
    add('TK-06', at, `\`${text}\` cannot be referenced here: ${message}`);
    return;
  }
  if (!Object.hasOwn(fm.components, ref.key)) {
    add('TK-06', at, `\`${text}\` does not resolve`);
    return;
  }
  const target = fm.components[ref.key];
  const fields = isPlainObject(target) ? Object.keys(target).sort().join(',') : '';
  const isIconSize =
    ICON_SIZE_KEY.test(ref.key) &&
    fields === 'size,strokeWidth' &&
    parseDimension(target.size) !== null &&
    typeof target.strokeWidth === 'number';
  if (!isIconSize) {
    add('TK-06', at, `\`${text}\` is not an icon size: icon-<step> with size and strokeWidth`);
  }
}

/** TK-10 key spelling and generated-identifier collisions. */
function checkIdentifiers({ fm, colours, add }) {
  for (const group of TOKEN_GROUPS) {
    for (const key of Object.keys(fm[group])) {
      const at = `${group}.${key}`;
      if (!isKebab(key)) {
        add('TK-10', at, 'keys are lowercase kebab-case');
      } else if (NAMED_GROUPS.includes(group) && !/^[a-z]/.test(key)) {
        add('TK-10', at, 'must start with a letter: it names a type, role or style');
      }
    }
  }
  const roleSource = (role) => (role.fixed ? role.key : `${role.key}-light/-dark`);
  const rolePairs = colours.roles.map((r) => [roleSource(r), memberId(r.key)]);
  collide(add, 'colors', rolePairs);
  const stylePairs = Object.keys(fm.typography).map((k) => [k, memberId(k)]);
  collide(add, 'typography', stylePairs);
  for (const group of SCALE_GROUPS) {
    const scalePairs = Object.keys(fm[group]).map((k) => [k, memberId(k, group)]);
    collide(add, group, scalePairs);
    for (const [key, value] of Object.entries(fm[group])) {
      if (isPlainObject(value)) checkPropertyNames(add, `${group}.${key}`, Object.keys(value));
    }
  }
  const groups = componentGroups(fm.components);
  const typePairs = groups.map((g) => [g.component, tokensTypeName(g.component)]);
  collide(add, 'components', typePairs);
  for (const { component, slots } of groups) {
    for (const [state, variants] of slots) {
      const at = `components.${component}${state ? `-${state}` : ''}`;
      const keys = (props) => (isPlainObject(props) ? Object.keys(props) : []);
      const props = [...new Set(variants.flatMap((v) => keys(v.props)))];
      checkPropertyNames(add, at, props);
      const propPairs = props.flatMap((p) => propertyIds(p).map((id) => [p, id]));
      collide(add, at, propPairs);
    }
  }
}

function checkPropertyNames(add, at, names) {
  for (const name of names.filter((n) => !isPropertyName(n))) {
    add('TK-10', `${at}.${name}`, 'property names are lowerCamelCase (a-z, A-Z, 0-9)');
  }
}

function collide(add, at, pairs) {
  const sourcesById = new Map();
  for (const [source, id] of pairs) {
    if (!sourcesById.has(id)) sourcesById.set(id, new Set());
    sourcesById.get(id).add(source);
  }
  for (const [id, sources] of sourcesById) {
    if (sources.size < 2) continue;
    const names = [...sources].map((s) => `\`${s}\``).join(' and ');
    add('TK-10', at, `${names} generate the same identifier \`${id}\``);
  }
}
