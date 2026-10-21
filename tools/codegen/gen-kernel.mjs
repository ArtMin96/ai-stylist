#!/usr/bin/env node
// shared-kernel JSON registries -> TypeScript / Swift / Kotlin / Python constants (OQ-15, DEC-55).
//
//   packages/shared-kernel/registry/{reason-codes,entitlements,units,capture-rules}.json
//   (+ *.schema.json)
//     ts      -> <out>/{reason-codes,entitlements,units}.ts   (packages/shared-kernel/src/gen;
//                capture-rules is validated but has no TS output: only the native apps read it)
//     swift   -> <out>/{ReasonCodes,Entitlements,Units,CaptureRules}.swift (swift-client
//                Sources/AIStylistKernel)
//     kotlin  -> <out>/{ReasonCodes,Entitlements,Units,CaptureRules}.kt (kotlin-client kernel/...,
//                package app.aistylist.contracts.kernel)
//   packages/shared-kernel/registry/{forbidden-log-keys,forbidden-log-keys.examples,log-redaction,
//   correlation}.json  (+ the `correlationId` rule of packages/contracts/events/envelope.json)
//     python  -> <out>/{__init__,forbidden_log_keys,log_redaction,correlation}.py
//                (workers/ml/generated/ai_stylist_generated/kernel, the registries the workers mirror)
//
// Usage: node tools/codegen/gen-kernel.mjs <ts|swift|kotlin|python> <out-dir>
// Called by generate.sh (ts), gen-swift.sh (swift), gen-kotlin.sh (kotlin) and gen-python.sh
// (python); not run by hand.
// Every run validates each registry it emits against its JSON Schema (Ajv, draft 2020-12, with
// ajv-formats, resolved from the packages/contracts devDependencies) plus the cross-references a
// schema cannot express (and, for python, that the envelope's correlationId rule is portable), and
// exits 1 on any finding. Deterministic: registry order is preserved, output is byte-identical per
// input.
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
import { isIntKey, isNumberBlock } from './kernel/naming.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Registry files resolve through the package export `@ai-stylist/shared-kernel/registry/*` (a root
// devDependency), not a repo path.
const requireRegistry = createRequire(import.meta.url);
const registryFile = (file) =>
  requireRegistry.resolve(`@ai-stylist/shared-kernel/registry/${file}`);
const NATIVE_REGISTRIES = ['reason-codes', 'entitlements', 'units', 'capture-rules'];
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

/** Cross-references JSON Schema cannot express (declared namespace/stage/kind/canonical unit). */
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
  const cr = reg['capture-rules'];
  if (cr) checkCaptureRules(cr, errors);
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

/** capture-rules: declared modes, body parts, hints and lock reasons, and Int-typed keys. */
function checkCaptureRules(cr, errors) {
  const where = 'capture-rules.json';
  for (const [key, hint] of Object.entries(cr.hints)) {
    if (hint.lockReason === undefined) continue;
    if (!cr.lockReasons.includes(hint.lockReason)) {
      errors.push(`${where}: hints.${key}: lockReason '${hint.lockReason}' is not declared`);
    }
    if (hint.kind !== 'blocking') {
      errors.push(`${where}: hints.${key}: only a blocking hint has a lockReason`);
    }
  }
  for (const reason of cr.lockReasons) {
    if (!Object.values(cr.hints).some((h) => h.lockReason === reason)) {
      errors.push(`${where}: lockReasons: '${reason}' has no hint`);
    }
  }
  for (const [id, fam] of Object.entries(cr.families)) {
    const at = `${where}: families.${id}`;
    for (const m of fam.modes) {
      if (!cr.captureModes.includes(m)) errors.push(`${at}: mode '${m}' is not declared`);
    }
    for (const p of fam.wornRequiredParts) {
      if (!cr.bodyParts.includes(p)) errors.push(`${at}: body part '${p}' is not declared`);
    }
    const needsBodyCheck = fam.wornRequiredParts.length > 0;
    if (needsBodyCheck && !fam.modes.includes('worn')) {
      errors.push(`${at}: wornRequiredParts without the worn mode`);
    }
    if ((fam.wornHint !== undefined) !== needsBodyCheck) {
      errors.push(`${at}: wornHint is required exactly when wornRequiredParts is not empty`);
    }
    if (fam.wornHint !== undefined && cr.hints[fam.wornHint]?.lockReason !== 'body-parts-missing') {
      errors.push(`${at}: wornHint '${fam.wornHint}' is not a body-parts-missing hint`);
    }
  }
  // The emitters type these keys Int; a fraction would emit code that does not compile.
  const numbers = Object.entries(cr).filter(([, v]) => typeof v === 'number');
  for (const [block, values] of Object.entries(cr).filter(([, v]) => isNumberBlock(v))) {
    numbers.push(...Object.entries(values).map(([k, v]) => [`${block}.${k}`, v]));
  }
  for (const [key, value] of numbers) {
    if (isIntKey(key) && !Number.isInteger(value)) {
      errors.push(`${where}: ${key}: keys ending in Ms, Px or Evaluations must be integers`);
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
