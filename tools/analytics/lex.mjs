// Comment- and string-aware scanning of Swift and Kotlin sources for check-events.mjs (README.md
// here). Not a parser: it only knows where comments, string and character literals, interpolations
// and `quoted` identifiers begin and end, which is enough to find calls and split their arguments.
// Node built-ins only.

export const OPEN = '([{';
export const CLOSE = ')]}';
const TYPE_ARGS = /^<[\w\s.,?*<>]*?>(?=\s*\()/;

// `masked` is the source with comments, literal contents and `quoted` identifiers blanked (same
// length, newlines kept), so its structure can be matched with plain regexes. `strings` maps each
// string literal's start offset to { end, text, dynamic }; dynamic when it interpolates (`\(…)` in
// Swift, `$x` / `${…}` in Kotlin). `lang` is 'swift' or 'kotlin'.
export function lex(src, lang) {
  const out = src.split('');
  const strings = new Map();
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  const endOfLine = (i) => (src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i));

  const lineComment = (start) => {
    const end = endOfLine(start);
    blank(start, end);
    return end;
  };
  const blockComment = (start) => {
    let i = start + 2;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const marker = src.startsWith('/*', i) || src.startsWith('*/', i);
      if (src.startsWith('/*', i)) depth++;
      if (src.startsWith('*/', i)) depth--;
      i += marker ? 2 : 1;
    }
    blank(start, i);
    return i;
  };
  // A `quoted` identifier (Kotlin test names, Swift keywords) never spans a line.
  const quotedIdentifier = (start) => {
    const end = src.indexOf('`', start + 1);
    if (end < 0 || end > endOfLine(start)) return start + 1;
    blank(start + 1, end);
    return end + 1;
  };
  const charLiteral = (start) => {
    const m = /^'(?:\\u[0-9a-fA-F]{4}|\\.|[^\\'\n])'/.exec(src.slice(start, start + 8));
    if (!m) return start + 1;
    blank(start + 1, start + m[0].length - 1);
    return start + m[0].length;
  };
  // Swift: "…", """…""" and #"…"# (any number of #); an escape or interpolation needs as many #.
  const swiftString = (start) => {
    let hashes = 0;
    while (src[start + hashes] === '#') hashes++;
    const quote = src.startsWith('"""', start + hashes) ? '"""' : '"';
    const close = quote + '#'.repeat(hashes);
    const escape = '\\' + '#'.repeat(hashes);
    const from = start + hashes + quote.length;
    let i = from;
    let dynamic = false;
    while (i < src.length && !src.startsWith(close, i)) {
      if (src.startsWith(`${escape}(`, i)) {
        dynamic = true;
        i = scan(i + escape.length + 1, true);
      } else if (src.startsWith(escape, i)) {
        i += escape.length + 1;
      } else if (src[i] === '\n' && quote === '"') {
        break;
      } else {
        i++;
      }
    }
    return { from, to: i, end: src.startsWith(close, i) ? i + close.length : i, dynamic };
  };
  // Kotlin: "…" (escapes) and """…""" (raw); both interpolate `$name` and `${…}`.
  const kotlinString = (start) => {
    const quote = src.startsWith('"""', start) ? '"""' : '"';
    const from = start + quote.length;
    let i = from;
    let dynamic = false;
    while (i < src.length && !src.startsWith(quote, i)) {
      const c = src[i];
      if (c === '\\' && quote === '"') {
        i += 2;
      } else if (c === '$' && src[i + 1] === '{') {
        dynamic = true;
        i = scan(i + 2, true);
      } else if (c === '$' && /[A-Za-z_]/.test(src[i + 1] ?? '')) {
        dynamic = true;
        i++;
      } else if (c === '\n' && quote === '"') {
        break;
      } else {
        i++;
      }
    }
    // A raw string may end in extra quotes ("""a""""): they belong to its content.
    while (quote === '"""' && src.startsWith('""""', i)) i++;
    return { from, to: i, end: src.startsWith(quote, i) ? i + quote.length : i, dynamic };
  };
  const stringLiteral = (start) => {
    const { from, to, end, dynamic } = lang === 'swift' ? swiftString(start) : kotlinString(start);
    strings.set(start, { end, text: src.slice(from, to), dynamic });
    blank(from, to);
    return end;
  };
  const isStringStart = (i) =>
    src[i] === '"' || (lang === 'swift' && src[i] === '#' && /^#+"/.test(src.slice(i, i + 8)));

  // Scans code from `start`. With `nested` (an interpolation), returns the offset just past the
  // bracket that closes it; otherwise scans to the end.
  function scan(start, nested) {
    let depth = 0;
    let i = start;
    while (i < src.length) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') {
        i = lineComment(i);
      } else if (c === '/' && src[i + 1] === '*') {
        i = blockComment(i);
      } else if (c === '`') {
        i = quotedIdentifier(i);
      } else if (c === "'" && lang === 'kotlin') {
        i = charLiteral(i);
      } else if (isStringStart(i)) {
        i = stringLiteral(i);
      } else if (nested && CLOSE.includes(c) && depth === 0) {
        return i + 1;
      } else {
        if (nested && OPEN.includes(c)) depth++;
        if (nested && CLOSE.includes(c)) depth--;
        i++;
      }
    }
    return i;
  }

  scan(0, false);
  return { masked: out.join(''), strings };
}

// Offset of the bracket that closes the one at `open` in masked text.
export function closing(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (OPEN.includes(masked[i])) depth++;
    if (CLOSE.includes(masked[i])) depth--;
    if (depth === 0) return i;
  }
  return masked.length;
}

// [from, to) without leading and trailing whitespace.
export function trim(masked, from, to) {
  let a = from;
  let b = to;
  while (a < b && /\s/.test(masked[a])) a++;
  while (b > a && /\s/.test(masked[b - 1])) b--;
  return [a, b];
}

// Top-level comma-separated, trimmed, non-empty ranges of masked[from, to). Brackets and a call's
// explicit type arguments (`mapOf<String, Value>(`) are skipped as one unit.
export function splitTopLevel(masked, from, to) {
  const parts = [];
  let depth = 0;
  let start = from;
  for (let i = from; i < to; i++) {
    const c = masked[i];
    if (OPEN.includes(c)) depth++;
    if (CLOSE.includes(c)) depth--;
    if (c === '<') {
      const typeArgs = TYPE_ARGS.exec(masked.slice(i, i + 200));
      if (typeArgs) i += typeArgs[0].length - 1;
    }
    if (c === ',' && depth === 0) {
      parts.push(trim(masked, start, i));
      start = i + 1;
    }
  }
  parts.push(trim(masked, start, to));
  return parts.filter(([a, b]) => b > a);
}
