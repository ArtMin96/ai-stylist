// Walks the declaration tree (declarations.mjs) for one target language. A dialect object spells
// each construct (emit-swift.mjs, emit-kotlin.mjs); this file owns order, line breaks and blank
// lines, so the two languages cannot drift apart in structure.
import { TIERS } from './declarations.mjs';

/** `{ <File>.<ext>: text }` for the three tiers. */
export function renderTiers(dialect, tiers, source) {
  return Object.fromEntries(
    TIERS.map(({ tier, file, title }) => [
      `${file}.${dialect.extension}`,
      renderFile(dialect, tiers[tier], source, title),
    ]),
  );
}

const API_TITLE = 'Component API surface: enums, test IDs, merged looks, gallery';
const TABLE_TITLE = 'Icon glyph table: compiled path segments per glyph, in viewBox units';

/**
 * The component API files of one dialect (api-declarations.mjs): `apiFile`, plus one
 * `<Name>Glyphs.<ext>` per icon set holding its glyph table.
 */
export function renderApiFiles(dialect, { api, tables }, source, apiFile) {
  const table = ({ name, decls }) => [
    `${name}.${dialect.extension}`,
    renderFile(dialect, decls, source, TABLE_TITLE),
  ];
  return {
    [apiFile]: renderFile(dialect, api, source, API_TITLE),
    ...Object.fromEntries(tables.map(table)),
  };
}

/** One generated file: the dialect's header, then the declarations separated by a blank line. */
export function renderFile(dialect, decls, source, title) {
  const blocks = decls.map((decl) => renderDeclaration(dialect, decl, 0).join('\n'));
  return [...dialect.header(source, title), '', blocks.join('\n\n'), ''].join('\n');
}

/** One declaration at `depth` levels of indentation. */
export function renderDeclaration(dialect, decl, depth) {
  if (decl.kind === 'namespace') return renderNamespace(dialect, decl, depth);
  return dialect[decl.kind](decl, depth);
}

/** A blank line separates two members whenever either spans several lines. */
export function joinMembers(memberLines) {
  const out = [];
  memberLines.forEach((lines, i) => {
    const previous = memberLines[i - 1];
    if (previous && (previous.length > 1 || lines.length > 1)) out.push('');
    out.push(...lines);
  });
  return out;
}

/** A namespace; `access: 'private'` (a Spec's context holder) makes it and its members private. */
function renderNamespace(dialect, ns, depth) {
  const pad = dialect.indent.repeat(depth);
  const doc = ns.doc ? [dialect.doc(ns.doc, pad)] : [];
  if (ns.members.length === 0) return [...doc, `${pad}${dialect.emptyNamespace(ns.name)}`];
  const inner = depth + 1;
  const member = (m) =>
    m.kind === 'namespace'
      ? renderNamespace(dialect, m, inner)
      : dialect.constant(m, inner, ns.access);
  const head = `${pad}${dialect.namespaceHead(ns.name, ns.access)} {`;
  return [...doc, head, ...joinMembers(ns.members.map(member)), `${pad}}`];
}

/** `0xFFFA_FAFA`: eight hex digits in two groups (swift-format GroupNumericLiterals). */
const argbLiteral = (argb) => {
  const hex = argb.toString(16).toUpperCase().padStart(8, '0');
  return `0x${hex.slice(0, 4)}_${hex.slice(4)}`;
};

/** One non-list, non-struct value in the dialect's spelling (`dialect.spell`). */
function scalar(dialect, value, type) {
  switch (value.t) {
    case 'number':
      return type === 'int' ? String(value.n) : dialect.spell.double(value.n);
    case 'color':
      return argbLiteral(value.argb);
    case 'string':
      return dialect.spell.string(value.s);
    case 'role':
      return dialect.spell.role(value.id);
    case 'ref':
      return dialect.spell.ref(value.namespace, value.member);
    case 'case':
      return dialect.spell.enumCase(value.type, value.id);
    case 'bool':
      return String(value.b);
    case 'union':
      return dialect.spell.unionCase(value.type, value.case);
    case 'none':
      return dialect.spell.none;
    case 'platform':
      // One value per platform (a touch target: pt on iOS, dp on Android); each dialect its own.
      return scalar(dialect, value.values[dialect.platform], type);
    default:
      throw new Error(`gen-tokens: no ${dialect.extension} spelling for a ${value.t} value`);
  }
}

/** The item type of a list type: `doubleList`, `stringList` or `list:<Struct>`. */
const itemTypeOf = (type) => {
  if (type.startsWith('list:')) return type.slice('list:'.length);
  return type === 'doubleList' ? 'double' : 'string';
};

/**
 * The parts of a bracketed value: a struct value or a union case with a payload (a call), or a
 * list.
 */
function bracketed(dialect, value, type) {
  if (value.t === 'init' || value.t === 'union') {
    const callee =
      value.t === 'init' ? value.struct : dialect.spell.unionCase(value.type, value.case);
    return {
      open: `${callee}(`,
      close: ')',
      items: value.args.map((arg) => ({ label: dialect.argLabel(arg.name), ...arg })),
      lastComma: dialect.callTrailingComma,
    };
  }
  const itemType = itemTypeOf(type);
  return {
    open: dialect.list.open,
    close: dialect.list.close,
    items: value.items.map((item) => ({ label: '', type: itemType, value: item })),
    lastComma: value.items.length > 1 || dialect.list.singleItemTrailingComma,
  };
}

const isBracketed = (value) =>
  value.t === 'init' ||
  (value.t === 'union' && value.args.length > 0) ||
  (value.t === 'list' && value.items.length > 0);

/** A value on one line, in the dialect's spelling (an enum field's value). */
export function inline(dialect, value, type) {
  if (value.t === 'list' && value.items.length === 0) return dialect.list.empty;
  if (!isBracketed(value)) return scalar(dialect, value, type);
  const { open, close, items } = bracketed(dialect, value, type);
  const parts = items.map((item) => `${item.label}${inline(dialect, item.value, item.type)}`);
  return `${open}${parts.join(', ')}${close}`;
}

/**
 * `prefix` + the value + `suffix` at indentation `pad`. A value stays on one line when it fits in
 * `dialect.limit`; otherwise a struct value or list takes one item per line. A dialect with
 * `wrapAfterAssign` (ktlint multiline-expression-wrapping) starts it on the line after the `=`;
 * a list item has no `=` and starts where it stands. A single value too long for its line (a
 * gallery sentence) goes on the line after its `=`, one indent in, in both dialects.
 */
export function valueLines(dialect, prefix, { value, type }, pad, suffix = '') {
  const text = inline(dialect, value, type);
  const single = `${prefix}${text}${suffix}`;
  if (single.length <= dialect.limit) return [single];
  const assigns = prefix.trimEnd().endsWith('=');
  if (!isBracketed(value)) {
    return assigns ? [prefix.trimEnd(), `${pad}${dialect.indent}${text}${suffix}`] : [single];
  }
  const afterAssign = dialect.wrapAfterAssign && assigns;
  const outer = afterAssign ? pad + dialect.indent : pad;
  const inner = outer + dialect.indent;
  const { open, close, items, lastComma } = bracketed(dialect, value, type);
  const body = items.flatMap((item, i) => {
    const comma = i < items.length - 1 || lastComma ? ',' : '';
    return valueLines(dialect, `${inner}${item.label}`, item, inner, comma);
  });
  const head = afterAssign ? [prefix.trimEnd(), `${outer}${open}`] : [prefix + open];
  return [...head, ...body, `${outer}${close}${suffix}`];
}
