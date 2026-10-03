#!/usr/bin/env node
// Analytics taxonomy gate (planning/14 §9, NFR-PRV-110; P02-T09 AC-9): every analytics event the
// native apps build must be registered in packages/contracts/events/analytics/events.json, and
// every property key it carries must be declared for that event. Run by `just lint`; the cases
// under tools/analytics/fixtures/ are proven by `just lint --fixtures` (check-fixtures.sh here).
// Rules, the call shapes scanned and the known limits: tools/analytics/README.md.
//
// Usage: node tools/analytics/check-events.mjs [--root <dir>]
//   --root <dir>  tree whose apps/ios/**/*.swift and apps/android/**/*.kt are scanned (default:
//                 the repo root). The taxonomy and the generated Kotlin constants always come
//                 from this repo, never from the scanned tree, so a fixture holds no copy of them.
// Output: `<file>:<line>: <rule>: <detail>` per finding on stdout, then a summary line.
// Exit: 0 clean, 1 on any finding, 2 on a usage error or an unreadable taxonomy.
// Node built-ins only: it runs before `pnpm install`, on Linux and macOS alike.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { CLOSE, OPEN, closing, lex, splitTopLevel, trim } from './lex.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const TAXONOMY = 'packages/contracts/events/analytics/events.json';
const KOTLIN_CONSTANTS = path.join(
  'packages/contracts/gen/kotlin-client/analytics/src/main/kotlin',
  'app/aistylist/contracts/analytics/AnalyticsTaxonomy.kt',
);
const TREES = [
  { dir: 'apps/ios', lang: 'swift', ext: '.swift' },
  { dir: 'apps/android', lang: 'kotlin', ext: '.kt' },
];
// Build output, dependency caches and generated code. Hidden directories (.build, .gradle,
// .kotlin, .swiftpm) are skipped as a class.
const SKIP_DIRS = new Set(['build', 'DerivedData', 'node_modules', 'gen', 'generated']);

// The calls that name an event. `AnalyticsEvent(…)` is the port's event type on both platforms and
// must be fully checkable. A PostHog capture is checked only where it names an event literally:
// the sinks forward `event.name` from an AnalyticsEvent that was checked where it was built.
const CALLS = [
  {
    kind: 'event',
    re: /\bAnalyticsEvent\s*(?:\.\s*init\s*)?\(/g,
    nameLabel: 'name',
  },
  {
    kind: 'capture',
    re: /\bPostHog(?:SDK\s*\.\s*shared)?\s*\.\s*capture\s*\(/g,
    nameLabel: 'event',
  },
];
const DECLARATION = /\b(?:class|struct|enum|fun|func|typealias)\s+$/;
const TAXONOMY_REF = /^(?:[a-z_]\w*\.)*AnalyticsTaxonomy\.(\w+)\.(\w+)$/;
const KOTLIN_MAP = /^(?:mapOf|mutableMapOf|emptyMap)\s*(?:<[\w\s.,?*<>]*?>)?\s*\(/;
const KOTLIN_TO = /^\sto\s/;
const NOT_STATIC = 'neither a plain string literal nor an AnalyticsTaxonomy constant';

class UsageError extends Error {}
function fatal(message) {
  throw new UsageError(message);
}

function parseArgs(argv) {
  if (argv.length === 0) return { root: REPO_ROOT };
  if (argv.length === 2 && argv[0] === '--root') return { root: path.resolve(argv[1]) };
  return fatal(`unknown arguments '${argv.join(' ')}' (use: --root <dir>)`);
}

// Event name -> Set of its declared property keys.
function loadTaxonomy() {
  let doc;
  try {
    doc = JSON.parse(readFileSync(path.join(REPO_ROOT, TAXONOMY), 'utf8'));
  } catch (err) {
    fatal(`cannot read ${TAXONOMY}: ${err.message}`);
  }
  if (!Array.isArray(doc?.events)) fatal(`${TAXONOMY}: "events" must be an array`);
  const events = new Map();
  for (const event of doc.events) {
    if (typeof event?.name !== 'string' || typeof event.properties !== 'object') {
      fatal(`${TAXONOMY}: every event needs a "name" and a "properties" object`);
    }
    events.set(event.name, new Set(Object.keys(event.properties ?? {})));
  }
  return events;
}

// `<Event>.<CONST>` -> string value, read from the generated AnalyticsTaxonomy.kt that the Android
// code compiles against, so the naming rule of tools/codegen/gen-kotlin.sh is never copied here.
function loadKotlinConstants() {
  const file = path.join(REPO_ROOT, KOTLIN_CONSTANTS);
  if (!existsSync(file)) {
    fatal(`${KOTLIN_CONSTANTS} is missing (written by \`just generate\`)`);
  }
  const constants = new Map();
  let owner = null;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const object = /^\s+object (\w+)\s*\{/.exec(line);
    if (object) owner = object[1];
    const constant = /^\s+const val (\w+): String = "([^"\\$]*)"/.exec(line);
    if (constant && owner) constants.set(`${owner}.${constant[1]}`, constant[2]);
  }
  return constants;
}

// One call argument; `name = expr` (Kotlin) or `name: expr` (Swift) sets its label.
function argument(masked, [from, to], lang) {
  const label = lang === 'kotlin' ? /^(\w+)\s*=(?!=)\s*/ : /^(\w+)\s*:(?!:)\s*/;
  const m = label.exec(masked.slice(from, to));
  if (!m) return { label: null, start: from, end: to };
  return { label: m[1], start: from + m[0].length, end: to };
}

// { value } for a plain string literal or an existing AnalyticsTaxonomy constant, { ref } for a
// taxonomy constant that is not generated, { dynamic: true } for anything else.
function resolve(ctx, start, end) {
  const literal = ctx.strings.get(start);
  if (literal && literal.end === end) {
    return literal.dynamic ? { dynamic: true } : { value: literal.text };
  }
  const ref = TAXONOMY_REF.exec(ctx.masked.slice(start, end).replace(/\s+/g, ''));
  if (!ref || ctx.lang !== 'kotlin') return { dynamic: true };
  const value = ctx.constants.get(`${ref[1]}.${ref[2]}`);
  return value === undefined ? { ref: ref[0] } : { value };
}

// Whether masked[i] starts the separator between a map entry's key and its value.
const keyEnds = (masked, i, lang) =>
  lang === 'swift' ? masked[i] === ':' : KOTLIN_TO.test(masked.slice(i, i + 4));

// Key ranges of a map literal (Kotlin `mapOf(k to v, …)`, Swift `[k: v, …]`), or null when the
// expression is not one. An entry whose key cannot be separated gets an empty range.
function mapKeys(ctx, start, end) {
  const { masked, lang } = ctx;
  const text = masked.slice(start, end);
  const kotlinMap = lang === 'kotlin' ? KOTLIN_MAP.exec(text) : null;
  let open = kotlinMap ? start + kotlinMap[0].length - 1 : -1;
  if (lang === 'swift' && text.startsWith('[')) open = start;
  if (open < 0 || closing(masked, open) !== end - 1) return null;
  const entries = splitTopLevel(masked, open + 1, end - 1);
  const emptyDictionary = entries.length === 1 && masked.slice(...entries[0]) === ':';
  if (lang === 'swift' && emptyDictionary) return [];
  return entries.map(([a, b]) => {
    let depth = 0;
    for (let i = a; i < b; i++) {
      if (OPEN.includes(masked[i])) depth++;
      if (CLOSE.includes(masked[i])) depth--;
      if (depth === 0 && keyEnds(masked, i, lang)) return trim(masked, a, i);
    }
    return [a, a];
  });
}

function report(ctx, offset, rule, detail) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (ctx.src.charCodeAt(i) === 10) line++;
  ctx.findings.push(`${ctx.rel}:${line}: ${rule}: ${detail}`);
}

// `strict` (AnalyticsEvent): whatever cannot be resolved statically is a `not-static` finding.
// Otherwise (a PostHog capture) only literal names and keys are checked.
function checkCall(ctx, call, open) {
  const strict = call.kind === 'event';
  const close = closing(ctx.masked, open);
  const ranges = splitTopLevel(ctx.masked, open + 1, close);
  const args = ranges.map((range) => argument(ctx.masked, range, ctx.lang));
  const positional = args.filter((a) => a.label === null);
  const nameArg = args.find((a) => a.label === call.nameLabel) ?? positional[0];
  const rest = positional.filter((a) => a !== nameArg);
  const propsArg = args.find((a) => a.label === 'properties') ?? rest[0];

  if (!nameArg) {
    if (strict) report(ctx, open, 'not-static', 'no event name argument');
    return;
  }
  const name = resolve(ctx, nameArg.start, nameArg.end);
  if (name.dynamic) {
    const shown = ctx.src.slice(nameArg.start, nameArg.end).replace(/\s+/g, ' ').slice(0, 60);
    const detail = `event name \`${shown}\` is ${NOT_STATIC}`;
    if (strict) report(ctx, nameArg.start, 'not-static', detail);
    return;
  }
  if (name.ref) {
    report(ctx, nameArg.start, 'unknown-event', `${name.ref} is not a generated constant`);
    return;
  }
  const declared = ctx.events.get(name.value);
  if (!declared) {
    report(ctx, nameArg.start, 'unknown-event', `'${name.value}' is not in ${TAXONOMY}`);
    return;
  }
  if (!propsArg) return;
  const keys = mapKeys(ctx, propsArg.start, propsArg.end);
  if (keys === null) {
    const detail = `the properties of '${name.value}' are not a map literal`;
    if (strict) report(ctx, propsArg.start, 'not-static', detail);
    return;
  }
  const allowed = [...declared].join(', ') || 'none';
  for (const [a, b] of keys) {
    const key = a === b ? { dynamic: true } : resolve(ctx, a, b);
    if (key.dynamic && strict) {
      report(ctx, a, 'not-static', `a property key of '${name.value}' is ${NOT_STATIC}`);
    } else if (key.ref) {
      report(ctx, a, 'undeclared-property', `${key.ref} is not a generated constant`);
    } else if (!key.dynamic && !declared.has(key.value)) {
      const detail = `'${key.value}' is not declared for '${name.value}' (${allowed})`;
      report(ctx, a, 'undeclared-property', detail);
    }
  }
}

function* sourceFiles(dir, ext) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const skipped = entry.name.startsWith('.') || SKIP_DIRS.has(entry.name);
    if (entry.isDirectory() && !skipped) yield* sourceFiles(full, ext);
    if (entry.isFile() && entry.name.endsWith(ext)) yield full;
  }
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const events = loadTaxonomy();
  const constants = loadKotlinConstants();
  if (!TREES.some((tree) => existsSync(path.join(root, tree.dir)))) {
    fatal(`nothing to scan: neither apps/ios nor apps/android exists under ${root}`);
  }
  const findings = [];
  let files = 0;
  let calls = 0;
  for (const { dir, lang, ext } of TREES) {
    for (const file of sourceFiles(path.join(root, dir), ext)) {
      files++;
      const src = readFileSync(file, 'utf8');
      if (!src.includes('AnalyticsEvent') && !src.includes('PostHog')) continue;
      const { masked, strings } = lex(src, lang);
      const rel = path.relative(root, file);
      const ctx = { src, masked, strings, lang, events, constants, rel, findings };
      for (const call of CALLS) {
        for (const m of masked.matchAll(call.re)) {
          if (DECLARATION.test(masked.slice(Math.max(0, m.index - 24), m.index))) continue;
          calls++;
          checkCall(ctx, call, m.index + m[0].length - 1);
        }
      }
    }
  }
  const scope = `${calls} call(s), ${files} Swift/Kotlin file(s), ${events.size} event(s) known`;
  if (findings.length === 0) {
    process.stdout.write(`check-events: ok (${scope})\n`);
    return 0;
  }
  process.stdout.write(`${findings.join('\n')}\n`);
  process.stderr.write(`check-events: ${findings.length} finding(s) (${scope})\n`);
  return 1;
}

// exitCode, never process.exit(): stdout to a pipe is asynchronous on macOS and would be cut off.
try {
  process.exitCode = main();
} catch (err) {
  const detail = err instanceof UsageError ? err.message : `internal error: ${err?.stack}`;
  process.stderr.write(`check-events: ${detail}\n`);
  process.exitCode = 2;
}
