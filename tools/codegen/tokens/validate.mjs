// Our own DESIGN.md frontmatter rules, TK-01..TK-11 (catalog: tools/codegen/tokens/README.md).
// TK-12 is the pinned `@google/design.md` lint (upstream-lint.mjs). Every rule reports and the run
// continues, so one pass lists every finding; only TK-01 stops early, when a group is unusable.
import { tokensTypeName, memberId, propertyIds } from './naming.mjs';
import { colorRoles, componentGroups, unpairedLines } from './structure.mjs';
import {
  DYNAMIC_TYPE_STYLES,
  M3_ROLES,
  META_KEYS,
  TOKEN_GROUPS,
  dynamicTypeName,
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
/** Which groups an entry of each group may reference. */
const REFERABLE = {
  components: ['colors', 'typography', 'rounded', 'spacing', 'elevation', 'motion'],
  elevation: ['colors', 'rounded', 'spacing'],
  motion: [],
};

/** Validates parsed frontmatter + body; returns `{ rule, at, message }` findings in file order. */
export function validate({ frontmatter, body }) {
  const findings = [];
  const add = (rule, at, message) => findings.push({ rule, at, message });
  if (!checkTopLevel(frontmatter, add)) return findings;
  const ctx = { fm: frontmatter, colours: colorRoles(frontmatter.colors), add };
  checkColors(ctx, body);
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

/** TK-11 colour literals; TK-02 light/dark pairing and the `Unpaired by design:` line. */
function checkColors({ fm, colours, add }, body) {
  for (const [key, value] of Object.entries(fm.colors)) {
    if (!parseColor(value)) {
      const text = `${JSON.stringify(value)} is not #RRGGBB, #RRGGBBAA, rgb() or rgba()`;
      add('TK-11', `colors.${key}`, text);
    }
  }
  const { lines, malformed } = unpairedLines(body);
  for (const text of malformed) {
    add('TK-02', 'body', `"${text}" must read exactly \`Unpaired by design: <token>, …\``);
  }
  if (lines.length > 1) add('TK-02', 'body', 'more than one `Unpaired by design:` line');
  const listed = new Set();
  for (const token of lines.flat()) {
    if (listed.has(token)) add('TK-02', 'body', `\`${token}\` is listed twice`);
    listed.add(token);
    if (!Object.hasOwn(fm.colors, token)) {
      add('TK-02', 'body', `\`${token}\` on the unpaired line is not a colour token`);
    } else if (!colours.unpaired.includes(token)) {
      add('TK-02', `colors.${token}`, 'is listed as unpaired by design but has a light/dark twin');
    }
  }
  for (const key of colours.unpaired) {
    if (!listed.has(key)) {
      const gap = pairingGap(key);
      add('TK-02', `colors.${key}`, `${gap} and is not on the \`Unpaired by design:\` line`);
    }
  }
}

function pairingGap(key) {
  const { scheme } = splitScheme(key);
  if (scheme === 'light') return 'has no `-dark` twin';
  if (scheme === 'dark') return 'has no `-light` twin';
  return scheme ? 'has no `-light` + `-dark` base' : 'has no scheme suffix';
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
      checkSingleValue(ctx, group, at, value, scheme);
    } else if (Object.keys(value).length === 0) {
      ctx.add('TK-07', at, 'an empty mapping holds no value');
    } else {
      for (const [field, v] of Object.entries(value)) {
        if (isPlainObject(v) || Array.isArray(v)) {
          ctx.add('TK-07', `${at}.${field}`, 'nested deeper than one level: use single values');
        } else {
          checkSingleValue(ctx, group, `${at}.${field}`, v, scheme);
        }
      }
    }
  }
}

function checkSingleValue(ctx, group, at, value, scheme) {
  if (typeof value === 'number') return;
  if (isShorthand(value)) {
    ctx.add('TK-07', at, `${JSON.stringify(value)} is CSS shorthand: one value per entry`);
    return;
  }
  const ref = parseReference(value);
  if (ref) {
    checkReference(ctx, at, ref, scheme, REFERABLE[group]);
  } else if (parseColor(value)) {
    ctx.add('TK-04', at, 'a colour outside `colors` must be a `{colors.<token>}` role reference');
  } else if (group === 'motion') {
    if (parseDurationMs(value) === null && parseCubicBezier(value) === null) {
      ctx.add('TK-11', at, `${JSON.stringify(value)} is not a duration or cubic-bezier()`);
    }
  } else if (parseDimension(value) === null) {
    ctx.add('TK-11', at, `${JSON.stringify(value)} is not a px dimension, number or {reference}`);
  }
}

/** TK-06 the reference resolves and is allowed here; TK-03 a colour stays in its scheme. */
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
  if (ref.group !== 'typography' && isPlainObject(fm[ref.group][ref.key])) {
    add('TK-06', at, `\`${text}\` names a group of values, not a single value`);
    return;
  }
  const target = ref.group === 'colors' ? splitScheme(ref.key).scheme : null;
  if (target !== null && target !== scheme) {
    const from = scheme ? `a ${scheme} entry` : 'a scheme-independent entry';
    add('TK-03', at, `${from} references the ${target} colour \`${ref.key}\``);
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
  const colourProp = prop.endsWith('Color');
  if (ref && !(colourProp && ref.group !== 'colors')) {
    checkReference(ctx, at, ref, scheme, REFERABLE.components);
  } else if (colourProp || parseColor(value)) {
    ctx.add('TK-04', at, 'a component colour must be a `{colors.<token>}` role reference');
  } else if (prop === 'padding') {
    if (!parsePadding(value)) ctx.add('TK-11', at, 'padding takes 1–4 parts, each 0 or Npx');
  } else if (typeof value !== 'number' && parseDimension(value) === null) {
    ctx.add('TK-11', at, `${JSON.stringify(value)} is not a px dimension, number or {reference}`);
  }
}

function checkVariantsAgree({ colours, add }, variants) {
  const signature = (props) => {
    const entries = isPlainObject(props) ? Object.entries(props) : [];
    return new Map(entries.map(([p, v]) => [p, valueSignature(colours, v)]));
  };
  const [first, ...rest] = variants;
  const expected = signature(first.props);
  for (const variant of rest) {
    const actual = signature(variant.props);
    const props = new Set([...expected.keys(), ...actual.keys()]);
    const differing = [...props].filter((p) => expected.get(p) !== actual.get(p));
    if (differing.length === 0) continue;
    const names = differing.map((p) => `\`${p}\``).join(', ');
    const message = `differs from \`${first.key}\` on ${names}: scheme variants must agree`;
    add('TK-05', `components.${variant.key}`, message);
  }
}

const valueSignature = (colours, value) => {
  const ref = parseReference(value);
  if (ref?.group === 'colors') return `role:${colours.roleOfKey.get(ref.key) ?? ref.key}`;
  return JSON.stringify(value);
};

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
