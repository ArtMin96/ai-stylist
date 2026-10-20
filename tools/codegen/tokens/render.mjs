// Walks the declaration tree (declarations.mjs) for one target language. A dialect object spells
// each construct (emit-swift.mjs, emit-kotlin.mjs); this file owns order and spacing only, so the
// two languages cannot drift apart in structure.
import { TIERS } from './declarations.mjs';

/** `{ <File>.<ext>: text }` for the three tiers. */
export function renderTiers(dialect, tiers, source) {
  return Object.fromEntries(
    TIERS.map(({ tier, file, title }) => {
      const blocks = tiers[tier].map((decl) => renderDeclaration(dialect, decl).join('\n'));
      const text = [...dialect.header(source, title), '', blocks.join('\n\n'), ''].join('\n');
      return [`${file}.${dialect.extension}`, text];
    }),
  );
}

function renderDeclaration(dialect, decl) {
  if (decl.kind === 'namespace') return renderNamespace(dialect, decl, 0);
  return dialect[decl.kind](decl);
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

function renderNamespace(dialect, ns, depth) {
  const pad = dialect.indent.repeat(depth);
  const members = ns.members.map((m) =>
    m.kind === 'namespace'
      ? renderNamespace(dialect, m, depth + 1)
      : dialect.constant(m, depth + 1),
  );
  return [
    ...(ns.doc ? [dialect.doc(ns.doc, pad)] : []),
    `${pad}${dialect.namespaceHead(ns.name)} {`,
    ...joinMembers(members),
    `${pad}}`,
  ];
}

/** `0xFFFA_FAFA`: eight hex digits in two groups (swift-format GroupNumericLiterals). */
const argbLiteral = (argb) => {
  const hex = argb.toString(16).toUpperCase().padStart(8, '0');
  return `0x${hex.slice(0, 4)}_${hex.slice(4)}`;
};

/** One non-list value in the dialect's spelling (`dialect.spell`: string, role, ref, double). */
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
    default:
      throw new Error(`gen-tokens: no ${dialect.extension} spelling for a ${value.t} value`);
  }
}

/**
 * `prefix` + the value + `suffix`. A list stays on one line when it fits in `dialect.limit`, else
 * it takes one item per line with a trailing comma (both formatters' multi-line collection style).
 */
export function valueLines(dialect, prefix, { value, type }, pad, suffix = '') {
  if (value.t !== 'list') return [`${prefix}${scalar(dialect, value, type)}${suffix}`];
  const { open, close, empty } = dialect.list;
  const itemType = type === 'doubleList' ? 'double' : 'string';
  const items = value.items.map((item) => scalar(dialect, item, itemType));
  if (items.length === 0) return [`${prefix}${empty}${suffix}`];
  const single = `${prefix}${open}${items.join(', ')}${close}${suffix}`;
  if (single.length <= dialect.limit) return [single];
  return [
    `${prefix}${open}`,
    ...items.map((item) => `${pad}${dialect.indent}${item},`),
    `${pad}${close}${suffix}`,
  ];
}
