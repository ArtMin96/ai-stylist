// In-process tests for the Swift and Kotlin emitters (emit-swift.mjs, emit-kotlin.mjs) over the
// committed shared-kernel registries: the six files of each language and their banners, then the
// error codes, measurement definitions, starting shapes and entitlement levels. Each enum is read
// back from both outputs into one table that must equal its registry, in registry order, so Swift
// and Kotlin cannot drift from the JSON or from each other. No gate compiles the kernel yet, so the
// identifier-clash guard is tested here too. Run by scripts/test/kernel-emitters.test.sh.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

import { emitKotlin } from '../emit-kotlin.mjs';
import { emitSwift } from '../emit-swift.mjs';

// The registries of the swift and kotlin runs (NATIVE_REGISTRIES in gen-kernel.mjs), resolved
// through the same package export.
const NAMES = [
  'reason-codes',
  'entitlements',
  'units',
  'error-codes',
  'measurement-definitions',
  'starting-shapes',
];
const requireRegistry = createRequire(import.meta.url);
const readRegistry = async (name) => {
  const file = requireRegistry.resolve(`@ai-stylist/shared-kernel/registry/${name}.json`);
  return [name, JSON.parse(await readFile(file, 'utf8'))];
};
const reg = Object.fromEntries(await Promise.all(NAMES.map(readRegistry)));
const swift = emitSwift(reg);
const kotlin = emitKotlin(reg);

/** The top-level declaration that starts with `head`, through its closing brace. */
function block(text, head) {
  const start = text.indexOf(`\n${head}`);
  assert.ok(start >= 0, `missing: ${head}`);
  return text.slice(start + 1, text.indexOf('\n}\n', start) + 2);
}

/** A Swift or Kotlin literal as emitted: a string, a number, a string list or a case name. */
function literal(token) {
  if (token.startsWith('"')) return token.slice(1, -1).replace(/\\(.)/g, '$1');
  const list = /^(?:\[|listOf\()(.*)[\])]$/.exec(token);
  if (list) return list[1] === '' ? [] : list[1].split(', ').map(literal);
  if (/^-?\d/.test(token)) return Number(token);
  return token.replace(/^.*\./, '');
}

/** A Swift String-backed enum: raw value per case id, and each property's tokens by raw value. */
function readSwift(text, name) {
  const body = block(text, `public enum ${name}: String, CaseIterable, Sendable {`);
  const rawById = new Map(
    [...body.matchAll(/^ {2}case (\S+) = (".*")$/gm)].map(([, id, raw]) => [id, literal(raw)]),
  );
  const props = {};
  const propBlocks = /^ {2}public var (\w+): .+ \{\n {4}switch self \{\n([\s\S]*?)\n {4}\}/gm;
  for (const [, prop, cases] of body.matchAll(propBlocks)) {
    props[prop] = new Map(
      [...cases.matchAll(/^ {4}case \.(\S+): (.*)$/gm)].map(([, id, t]) => [rawById.get(id), t]),
    );
  }
  return { body, rawById, raws: [...rawById.values()], props };
}

const KT_ENTRY = /^ {4}([A-Z][A-Z0-9_]*)\((.*)\)[,;]$/gm;
const KT_TOKEN = /"(?:[^"\\]|\\.)*"|listOf\([^)]*\)|[\w.-]+/g;

/** A Kotlin enum class: its constructor parameters, and each entry's argument tokens by name. */
function readKotlin(text, name) {
  const body = block(text, `enum class ${name}(`);
  const head = /^enum class \w+\((.*)\) \{$/m.exec(body)[1];
  const params = [...head.matchAll(/val (\w+):/g)].map(([, p]) => p);
  const entries = [...body.matchAll(KT_ENTRY)].map(([, id, args]) => {
    const tokens = args.match(KT_TOKEN);
    return { id, args: Object.fromEntries(params.map((p, i) => [p, tokens[i]])) };
  });
  const rawById = new Map(entries.map(({ id, args }) => [id, literal(args.value)]));
  return { body, params, entries, rawById, raws: [...rawById.values()] };
}

/** Decodes a token; a case reference goes through the read-back enum it names. */
const decode = (token, refs, prop) => {
  const value = literal(token);
  return refs[prop] ? refs[prop].get(value) : value;
};

/** Raw value -> { property: value } from the Swift read-back. */
const swiftTable = ({ raws, props }, refs = {}) =>
  Object.fromEntries(
    raws.map((raw) => [
      raw,
      Object.fromEntries(
        Object.entries(props).map(([p, byRaw]) => [p, decode(byRaw.get(raw), refs, p)]),
      ),
    ]),
  );

/** Raw value -> { property: value } from the Kotlin read-back. */
const kotlinTable = ({ entries }, refs = {}) =>
  Object.fromEntries(
    entries.map(({ args: { value, ...rest } }) => [
      literal(value),
      Object.fromEntries(Object.entries(rest).map(([p, t]) => [p, decode(t, refs, p)])),
    ]),
  );

/** Asserts both read-backs equal `expected`, in its key order. */
function assertBoth(s, k, expected, refs = { swift: {}, kotlin: {} }) {
  assert.deepEqual(s.raws, Object.keys(expected), 'Swift order');
  assert.deepEqual(k.raws, Object.keys(expected), 'Kotlin order');
  assert.deepEqual(swiftTable(s, refs.swift), expected);
  assert.deepEqual(kotlinTable(k, refs.kotlin), expected);
}

const STEMS = [
  'ReasonCodes',
  'Entitlements',
  'Units',
  'ErrorCodes',
  'MeasurementDefinitions',
  'StartingShapes',
];
const NEW_SOURCES = {
  ErrorCodes: 'error-codes',
  MeasurementDefinitions: 'measurement-definitions',
  StartingShapes: 'starting-shapes',
};

test('six files per language, banners naming the source, no mutable state, deterministic', () => {
  assert.deepEqual(
    Object.keys(swift),
    STEMS.map((s) => `${s}.swift`),
  );
  assert.deepEqual(
    Object.keys(kotlin),
    STEMS.map((s) => `${s}.kt`),
  );
  for (const [stem, name] of Object.entries(NEW_SOURCES)) {
    const from = `packages/shared-kernel/registry/${name}.json`;
    const banner = `// GENERATED by tools/codegen/gen-kernel.mjs from ${from}. DO NOT EDIT`;
    assert.ok(swift[`${stem}.swift`].startsWith(banner), stem);
    const header = `\n// Source: ${from}\npackage app.aistylist.contracts.kernel\n\n`;
    assert.ok(kotlin[`${stem}.kt`].includes(header), stem);
  }
  for (const text of [...Object.values(swift), ...Object.values(kotlin)]) {
    assert.ok(text.endsWith('}\n'), 'ends with one newline');
  }
  for (const text of Object.values(swift)) assert.doesNotMatch(text, /\bvar \w+ =|static var/);
  assert.deepEqual(emitSwift(reg), swift);
  assert.deepEqual(emitKotlin(reg), kotlin);
});

test('error codes: each wire code with its Int status, title and description', () => {
  const expected = Object.fromEntries(
    Object.entries(reg['error-codes'].codes).map(([code, { status, title, description }]) => [
      code,
      { status, title, description },
    ]),
  );
  const s = readSwift(swift['ErrorCodes.swift'], 'ErrorCode');
  const k = readKotlin(kotlin['ErrorCodes.kt'], 'ErrorCode');
  assert.deepEqual(k.params, ['value', 'status', 'title', 'description']);
  assertBoth(s, k, expected);
  for (const token of s.props.status.values()) assert.match(token, /^\d+$/);
  for (const { args } of k.entries) assert.match(args.status, /^\d+$/);
  assert.equal([...s.rawById].find(([, raw]) => raw === 'INTERNAL')?.[0], '`internal`');
  assert.match(k.body, /\n {8}fun fromValue\(value: String\): ErrorCode\? = entries\.firstOrNull/);
});

test('measurement definitions: dimension, stored unit and inclusive Double bounds', () => {
  const expected = Object.fromEntries(
    Object.entries(reg['measurement-definitions'].measurements).map(([id, def]) => [
      id,
      { dimension: def.dimension, unit: def.unit, minimum: def.min, maximum: def.max },
    ]),
  );
  const s = readSwift(swift['MeasurementDefinitions.swift'], 'MeasurementId');
  const k = readKotlin(kotlin['MeasurementDefinitions.kt'], 'MeasurementId');
  assert.deepEqual(Object.keys(s.props), ['dimension', 'unit', 'minimum', 'maximum']);
  assert.deepEqual(k.params, ['value', 'dimension', 'unit', 'minimum', 'maximum']);
  const refs = {
    swift: { dimension: readSwift(swift['Units.swift'], 'MeasurementDimension').rawById },
    kotlin: { dimension: readKotlin(kotlin['Units.kt'], 'MeasurementDimension').rawById },
  };
  assertBoth(s, k, expected, refs);
  for (const prop of ['minimum', 'maximum']) {
    for (const token of s.props[prop].values()) assert.match(token, /^\d+\.\d+$/);
    for (const { args } of k.entries) assert.match(args[prop], /^\d+\.\d+$/);
  }
});

test('starting shapes: the ids in display order, the default and the base mesh', () => {
  const shapes = reg['starting-shapes'];
  const expected = Object.fromEntries(Object.keys(shapes.shapes).map((id) => [id, {}]));
  const s = readSwift(swift['StartingShapes.swift'], 'StartingShape');
  const k = readKotlin(kotlin['StartingShapes.kt'], 'StartingShape');
  assertBoth(s, k, expected);

  const swiftConstants = block(swift['StartingShapes.swift'], 'public enum StartingShapes {');
  const swiftDefault = /static let defaultShape: StartingShape = \.(\S+)\n/.exec(swiftConstants);
  assert.equal(s.rawById.get(swiftDefault[1]), shapes.default);
  const swiftMesh = /static let baseMesh: String = (".*")\n/.exec(swiftConstants);
  assert.equal(literal(swiftMesh[1]), shapes.baseMesh);

  const ktConstants = block(kotlin['StartingShapes.kt'], 'object StartingShapes {');
  const ktDefault = /val DEFAULT_SHAPE: StartingShape = StartingShape\.(\S+)\n/.exec(ktConstants);
  assert.equal(k.rawById.get(ktDefault[1]), shapes.default);
  const ktMesh = /const val BASE_MESH: String = (".*")\n/.exec(ktConstants);
  assert.equal(literal(ktMesh[1]), shapes.baseMesh);
});

test('entitlements: each name keeps its kind and description and gains its levels', () => {
  const expected = Object.fromEntries(
    Object.entries(reg.entitlements.entitlements).map(([name, def]) => [
      name,
      { kind: def.kind, description: def.description, levels: def.levels ?? [] },
    ]),
  );
  const s = readSwift(swift['Entitlements.swift'], 'EntitlementName');
  const k = readKotlin(kotlin['Entitlements.kt'], 'EntitlementName');
  assert.deepEqual(k.params, ['value', 'kind', 'description', 'levels']);
  const refs = {
    swift: { kind: readSwift(swift['Entitlements.swift'], 'EntitlementValueKind').rawById },
    kotlin: { kind: readKotlin(kotlin['Entitlements.kt'], 'EntitlementValueKind').rawById },
  };
  assertBoth(s, k, expected, refs);
  const levelled = Object.values(expected).filter(({ levels }) => levels.length > 0);
  assert.ok(levelled.every(({ kind }) => kind === 'level'));
  assert.ok(levelled.length > 0);
});

test('two registry values that map to one identifier fail the run instead of emitting', () => {
  const clash = structuredClone(reg);
  clash.entitlements.entitlements['recs.context_full'] = { kind: 'boolean', description: 'x' };
  assert.throws(
    () => emitSwift(clash),
    /EntitlementName: 'recs\.context_full' maps to the identifier 'recsContextFull'/,
  );
  assert.throws(
    () => emitKotlin(clash),
    /EntitlementName: 'recs\.context_full' maps to the identifier 'RECS_CONTEXT_FULL'/,
  );
});
