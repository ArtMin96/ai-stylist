#!/usr/bin/env node
// shared-kernel JSON registries -> TypeScript / Swift / Kotlin / Python constants (OQ-15, DEC-55).
//
//   packages/shared-kernel/registry/{reason-codes,entitlements,units}.json  (+ *.schema.json)
//     ts      -> <out>/{reason-codes,entitlements,units}.ts   (packages/shared-kernel/src/gen)
//     swift   -> <out>/{ReasonCodes,Entitlements,Units}.swift (swift-client Sources/AIStylistKernel)
//     kotlin  -> <out>/{ReasonCodes,Entitlements,Units}.kt    (kotlin-client kernel/..., package
//                app.aistylist.contracts.kernel)
//   packages/shared-kernel/registry/{error-codes,measurement-definitions,starting-shapes}.json
//   (+ *.schema.json; TS imports them as JSON, so the ts run validates them and writes nothing)
//     swift   -> <out>/{ErrorCodes,MeasurementDefinitions,StartingShapes}.swift (same target)
//     kotlin  -> <out>/{ErrorCodes,MeasurementDefinitions,StartingShapes}.kt    (same package)
//   packages/shared-kernel/registry/{forbidden-log-keys,forbidden-log-keys.examples,log-redaction,
//   correlation}.json  (+ the `correlationId` rule of packages/contracts/events/envelope.json)
//     python  -> <out>/{__init__,forbidden_log_keys,log_redaction,correlation}.py
//                (workers/ml/generated/ai_stylist_generated/kernel, the registries the workers mirror)
//
// Usage: node tools/codegen/gen-kernel.mjs <ts|swift|kotlin|python> <out-dir>
// Called by generate.sh (ts), gen-swift.sh (swift), gen-kotlin.sh (kotlin) and gen-python.sh
// (python); not run by hand.
// Every run validates each registry of its list (all six above for ts, swift and kotlin, so an
// invalid client-facing registry fails the ts run even where the native lanes are skipped) against
// its JSON Schema (Ajv, draft 2020-12, with ajv-formats, resolved from the packages/contracts
// devDependencies) plus the cross-references a schema cannot express (and, for python, that the
// envelope's correlationId rule is portable), and exits 1 on any finding. Deterministic: registry
// order is preserved, output is byte-identical per input.
// <out-dir> holds only generated files and is replaced wholesale. Never edit the output by hand.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAjv, requireFromContracts } from './ajv.mjs';
import { emitKotlin } from './kernel/emit-kotlin.mjs';
import { emitPython } from './kernel/emit-python.mjs';
import { emitSwift } from './kernel/emit-swift.mjs';
import { emitTs } from './kernel/emit-ts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Registry files resolve through the package export `@ai-stylist/shared-kernel/registry/*` (a root
// devDependency), not a repo path.
const requireRegistry = createRequire(import.meta.url);
const registryFile = (file) =>
  requireRegistry.resolve(`@ai-stylist/shared-kernel/registry/${file}`);
// Every registry a native app reads (.claude/rules/contracts.md invariant 6). emitTs writes only
// the first three; TS imports the other three as JSON.
const NATIVE_REGISTRIES = [
  'reason-codes',
  'entitlements',
  'units',
  'error-codes',
  'measurement-definitions',
  'starting-shapes',
];
const WORKER_REGISTRIES = [
  'forbidden-log-keys',
  'forbidden-log-keys.examples',
  'log-redaction',
  'correlation',
];
const EMITTERS = {
  ts: [emitTs, NATIVE_REGISTRIES],
  swift: [emitSwift, NATIVE_REGISTRIES],
  kotlin: [emitKotlin, NATIVE_REGISTRIES],
  python: [emitPython, WORKER_REGISTRIES],
};

const [lang, outArg] = process.argv.slice(2);
if (!lang || !Object.hasOwn(EMITTERS, lang) || !outArg) {
  console.error('usage: gen-kernel.mjs <ts|swift|kotlin|python> <out-dir>');
  process.exit(2);
}
const outDir = path.resolve(outArg);

const ajv = await createAjv();
const [emit, REGISTRIES] = EMITTERS[lang];
const ENVELOPE = 'packages/contracts/events/envelope.json';

/** Schema validation per file; returns the parsed registries keyed by name. */
async function loadRegistries(errors) {
  const reg = {};
  for (const name of REGISTRIES) {
    const rel = `packages/shared-kernel/registry/${name}.json`;
    let data;
    let schema;
    try {
      data = JSON.parse(await readFile(registryFile(`${name}.json`), 'utf8'));
      schema = JSON.parse(await readFile(registryFile(`${name}.schema.json`), 'utf8'));
    } catch (err) {
      errors.push(`${rel}: ${err.message}`);
      continue;
    }
    const validate = ajv.compile(schema);
    if (validate(data)) {
      reg[name] = data;
      continue;
    }
    for (const e of validate.errors ?? []) {
      errors.push(`${rel}: ${e.instancePath || '/'} ${e.message} ${JSON.stringify(e.params)}`);
    }
  }
  return reg;
}

/**
 * The event envelope's `correlationId` rule (Python only: the workers check caller ids against it
 * and the API checks them with Ajv on the schema itself). JSON Schema reads `pattern` as an ECMA-262
 * search; the worker compiles it with `re.ASCII` and `fullmatch`, which agree with it only for an
 * anchored, printable-ASCII source, so anything else fails here instead of drifting.
 */
async function loadCorrelationIdRule(errors) {
  let envelope;
  try {
    envelope = JSON.parse(
      await readFile(
        requireFromContracts.resolve('@ai-stylist/contracts/events/envelope.json'),
        'utf8',
      ),
    );
  } catch (err) {
    errors.push(`${ENVELOPE}: ${err.message}`);
    return undefined;
  }
  const rule = envelope.properties?.correlationId ?? {};
  const where = `${ENVELOPE}: properties.correlationId`;
  const { pattern, minLength, maxLength } = rule;
  if (typeof pattern !== 'string' || !/^\^[\x20-\x7e]*\$$/.test(pattern)) {
    errors.push(`${where}.pattern: must be an anchored (^…$), printable-ASCII string`);
  } else {
    try {
      new RegExp(pattern, 'u');
    } catch (err) {
      errors.push(`${where}.pattern: ${err.message}`);
    }
  }
  if (!Number.isInteger(minLength) || !Number.isInteger(maxLength) || minLength > maxLength) {
    errors.push(`${where}: minLength and maxLength must be integers, minLength <= maxLength`);
  }
  return { pattern, minLength, maxLength };
}

/**
 * Cross-references JSON Schema cannot express (declared namespace/stage/kind/canonical unit, each
 * measurement's dimension and bounds, the default starting shape).
 */
function checkReferences(reg, errors) {
  const rc = reg['reason-codes'];
  if (rc) {
    const namespaces = rc.namespaces.map((n) => n.name);
    if (new Set(namespaces).size !== namespaces.length) {
      errors.push('reason-codes.json: duplicate namespace name');
    }
    for (const [code, def] of Object.entries(rc.codes)) {
      if (!namespaces.includes(def.namespace)) {
        errors.push(`reason-codes.json: ${code}: namespace '${def.namespace}' is not declared`);
      } else if (!code.startsWith(`${def.namespace}-`)) {
        errors.push(`reason-codes.json: ${code}: code must start with '${def.namespace}-'`);
      }
      if (!rc.stages.includes(def.stage)) {
        errors.push(`reason-codes.json: ${code}: stage '${def.stage}' is not declared`);
      }
    }
  }
  const ent = reg.entitlements;
  if (ent) {
    for (const [name, def] of Object.entries(ent.entitlements)) {
      if (!ent.kinds.includes(def.kind)) {
        errors.push(`entitlements.json: ${name}: kind '${def.kind}' is not declared`);
      }
    }
  }
  if (reg.units) {
    for (const [dim, def] of Object.entries(reg.units.dimensions)) {
      if (!def.units.includes(def.canonical)) {
        errors.push(`units.json: dimensions.${dim}: canonical '${def.canonical}' is not in units`);
      }
    }
  }
  const md = reg['measurement-definitions'];
  if (md) {
    for (const [id, def] of Object.entries(md.measurements)) {
      const where = `measurement-definitions.json: ${id}`;
      if (!(def.min < def.max)) {
        errors.push(`${where}: min ${def.min} must be below max ${def.max}`);
      }
      // units.json is undefined here when it failed its own schema (already reported).
      if (!reg.units) continue;
      if (!Object.hasOwn(reg.units.dimensions, def.dimension)) {
        errors.push(`${where}: dimension '${def.dimension}' is not declared in units.json`);
      } else if (def.unit !== reg.units.dimensions[def.dimension].canonical) {
        errors.push(`${where}: unit '${def.unit}' is not the canonical unit of ${def.dimension}`);
      }
    }
  }
  const shapes = reg['starting-shapes'];
  if (shapes && !Object.hasOwn(shapes.shapes, shapes.default)) {
    errors.push(`starting-shapes.json: default '${shapes.default}' is not a declared shape`);
  }
  const lr = reg['log-redaction'];
  if (lr) {
    // Emitted verbatim for Python's `re.ASCII`; the shared-kernel tests run every vector in TS.
    for (const key of ['errorNameShape', 'codeShape', 'nestContextShape']) {
      if (/[^\x20-\x7e]/.test(lr[key])) {
        errors.push(`log-redaction.json: ${key}: must be printable ASCII`);
      }
    }
  }
}

const errors = [];
const reg = await loadRegistries(errors);
checkReferences(reg, errors);
const contracts = lang === 'python' ? { correlationId: await loadCorrelationIdRule(errors) } : {};
let files = {};
if (errors.length === 0) {
  try {
    files = emit(reg, contracts);
  } catch (err) {
    errors.push(err.message);
  }
}
if (errors.length > 0) {
  console.error(
    'gen-kernel.mjs: invalid shared-kernel registry or contract input (nothing written):',
  );
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  await writeFile(path.join(outDir, name), content);
}
console.log(
  `gen-kernel.mjs: ${lang} -> ${path.relative(ROOT, outDir) || outDir} (${Object.keys(files).join(', ')})`,
);
