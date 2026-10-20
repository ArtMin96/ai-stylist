// Reads the emitted Swift or Kotlin token files back into one name -> value table, for the DEC-87
// golden parity test (parity.test.mjs). It reads the generated text, not the declaration tree both
// emitters share, so it catches a dialect that spells a name, value or type differently. Only the
// spelling is normalised: `.onPrimary` and `AppColorRole.ON_PRIMARY` are `role:ON_PRIMARY`,
// `[a, b]` and `listOf(a, b)` are one list, `UInt32` and `Long` are `argb`. The grammar is the
// emitters' own output (emit-swift.mjs, emit-kotlin.mjs), not Swift or Kotlin in general.
import { ktEnumEntry } from '../naming.mjs';

const SWIFT = {
  open: /^(?:nonisolated )?public (?:enum|struct) (\w+)\b.*\{$/,
  field: /^public let (\w+): (.+)$/,
  value: /^public static let (\w+)(?:: (.+?))? = (.*)$/,
  enumCase: /^case (\w+)$/,
  lookupCase: /^case \.(\w+): (\w+)$/,
  anonymous: /^(public subscript\(|switch ).*\{$/,
};
const KOTLIN = {
  open: /^object (\w+) \{$/,
  header: /^(data class|enum class) (\w+)\($/,
  field: /^val (\w+): (.+),$/,
  value: /^val (\w+): (.+?) =(?: (.*))?$/,
  enumCase: /^([A-Z0-9_]+)\((\w+)::(\w+)\),$/,
  anonymous: /^companion object \{$/,
};

const unescape = (id) => id.replace(/`/g, '');
const canonicalType = (type) =>
  type
    .replace(/^(UInt32|Long)$/, 'argb')
    .replace(/^\[(\w+)\]$/, 'list<$1>')
    .replace(/^List<(\w+)>$/, 'list<$1>');

/** `{ name -> value }` of every `*.swift` file in `files` (`{ file: text }`). */
export const swiftTable = (files) => readTable(files, '.swift', readSwiftLine);

/** `{ name -> value }` of every `*.kt` file in `files` (`{ file: text }`). */
export const kotlinTable = (files) => readTable(files, '.kt', readKotlinLine);

function readTable(files, extension, readLine) {
  const table = {};
  for (const [file, text] of Object.entries(files)) {
    if (!file.endsWith(extension)) continue;
    const state = { table, stack: [], pending: null, header: null, cases: {} };
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (state.pending) continueValue(state, line);
      else if (line && !/^(\/\/|\/\*\*|package )/.test(line)) readLine(state, line);
    }
    for (const [type, cases] of Object.entries(state.cases)) {
      table[`${type}.cases`] = cases.join(',');
    }
  }
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1)));
}

const path = (state, name) =>
  [...state.stack.filter((frame) => frame !== null), name].filter(Boolean).join('.');

function readSwiftLine(state, line) {
  let m;
  if ((m = SWIFT.open.exec(line))) state.stack.push(m[1]);
  else if (SWIFT.anonymous.test(line)) state.stack.push(null);
  else if (line === '}') state.stack.pop();
  else if ((m = SWIFT.field.exec(line))) addType(state, m[1], m[2]);
  else if ((m = SWIFT.enumCase.exec(line))) addCase(state, path(state, ''), ktEnumEntry(m[1]));
  else if ((m = SWIFT.lookupCase.exec(line))) {
    state.table[`${path(state, '')}[${ktEnumEntry(unescape(m[1]))}]`] = unescape(m[2]);
  } else if ((m = SWIFT.value.exec(line))) startValue(state, m[1], m[2], m[3]);
  else if (!/^nonisolated public enum \w+ \{\}$/.test(line)) unread(line);
}

function readKotlinLine(state, line) {
  let m;
  if (state.header) readKotlinHeader(state, line);
  else if ((m = KOTLIN.open.exec(line))) state.stack.push(m[1]);
  else if ((m = KOTLIN.header.exec(line))) state.header = { kind: m[1], name: m[2] };
  else if (KOTLIN.anonymous.test(line)) state.stack.push(null);
  else if (line === '}') state.stack.pop();
  else if ((m = KOTLIN.enumCase.exec(line))) {
    addCase(state, path(state, ''), m[1]);
    state.table[`${m[2]}[${m[1]}]`] = unescape(m[3]);
  } else if ((m = KOTLIN.value.exec(line))) startValue(state, m[1], m[2], m[3] ?? '');
  else if (!/^(object \w+|operator fun get\(.*)$/.test(line)) unread(line);
}

/** The parameters of a `data class X(` or `enum class X(` header, up to `)` or `) {`. */
function readKotlinHeader(state, line) {
  const { kind, name } = state.header;
  let m;
  if (line === ')' || line === ') {') {
    state.header = null;
    if (line === ') {') state.stack.push(name);
  } else if (kind === 'data class' && (m = KOTLIN.field.exec(line))) {
    state.stack.push(name);
    addType(state, m[1], m[2]);
    state.stack.pop();
  }
}

function unread(line) {
  throw new Error(`parity-table: cannot read ${JSON.stringify(line)}`);
}

function addType(state, name, type) {
  state.table[`${path(state, unescape(name))}:type`] = canonicalType(type);
}

function addCase(state, type, id) {
  (state.cases[type] ??= []).push(id);
}

function startValue(state, name, type, text) {
  state.pending = { name: path(state, unescape(name)), type, text };
  if (balanced(text) && text) finishValue(state);
}

function continueValue(state, line) {
  state.pending.text += ` ${line}`;
  if (balanced(state.pending.text)) finishValue(state);
}

function finishValue(state) {
  const { name, type, text } = state.pending;
  state.pending = null;
  const value = new Parser(text).expression();
  if (value.kind !== 'call' && type) state.table[`${name}:type`] = canonicalType(type);
  flatten(state.table, name, value);
}

/** Bracket depth outside string literals is zero. */
function balanced(text) {
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '\\') i += 1;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
  }
  return depth === 0;
}

/** A call becomes `<name>:init` plus one entry per argument; any other value one entry. */
function flatten(table, name, value) {
  if (value.kind !== 'call') {
    table[name] = canonical(value);
    return;
  }
  table[`${name}:init`] = value.callee;
  for (const [label, arg] of value.args) flatten(table, `${name}.${label}`, arg);
}

function canonical(value) {
  if (value.kind === 'list') return `list:[${value.items.map(canonical).join(',')}]`;
  if (value.kind === 'string') return `str:${JSON.stringify(value.text)}`;
  const token = value.text;
  if (/^0x/.test(token)) return `argb:${token.slice(2).replace(/_/g, '')}`;
  if (/^-?[\d.]+(e-?\d+)?$/.test(token)) return `num:${Number(token)}`;
  if (token.startsWith('.')) return `role:${ktEnumEntry(unescape(token.slice(1)))}`;
  if (token.startsWith('AppColorRole.')) return `role:${token.slice('AppColorRole.'.length)}`;
  return `ref:${unescape(token)}`;
}

/** Expressions of the emitters' output: calls with labels, lists, strings, other tokens. */
class Parser {
  constructor(text) {
    this.text = text;
    this.at = 0;
  }

  expression() {
    this.skip();
    if (this.peek('"')) return { kind: 'string', text: this.string() };
    if (this.peek('[')) return { kind: 'list', items: this.items('[', ']') };
    const token = this.token();
    if (!this.peek('(')) return { kind: 'token', text: token };
    if (token === 'listOf' || token === 'emptyList') {
      return { kind: 'list', items: this.items('(', ')') };
    }
    return { kind: 'call', callee: token, args: this.arguments() };
  }

  arguments() {
    this.expect('(');
    const args = [];
    for (this.skip(); !this.peek(')'); this.skip()) {
      const label = unescape(this.token());
      this.skip();
      if (!this.peek(':') && !this.peek('=')) throw this.error('a `label:` or `label =`');
      this.at += 1;
      args.push([label, this.expression()]);
      this.comma();
    }
    this.at += 1;
    return args;
  }

  items(open, close) {
    this.expect(open);
    const items = [];
    for (this.skip(); !this.peek(close); this.skip()) {
      items.push(this.expression());
      this.comma();
    }
    this.at += 1;
    return items;
  }

  string() {
    const m = /^"((?:[^"\\]|\\.)*)"/.exec(this.text.slice(this.at));
    if (!m) throw this.error('a string');
    this.at += m[0].length;
    return m[1].replace(/\\(.)/g, '$1');
  }

  token() {
    const m = /^[\w.`$-]+/.exec(this.text.slice(this.at));
    if (!m) throw this.error('a name or literal');
    this.at += m[0].length;
    return m[0];
  }

  comma() {
    this.skip();
    if (this.peek(',')) this.at += 1;
  }

  expect(ch) {
    if (!this.peek(ch)) throw this.error(`\`${ch}\``);
    this.at += 1;
  }

  peek(ch) {
    return this.text[this.at] === ch;
  }

  skip() {
    while (/\s/.test(this.text[this.at] ?? '')) this.at += 1;
  }

  error(what) {
    return new Error(`parity-table: expected ${what} at ${this.at} in ${this.text}`);
  }
}
