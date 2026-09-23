#!/usr/bin/env node
// shared-kernel JSON registries -> TypeScript / Swift / Kotlin constants (OQ-15, planning/16).
//
//   packages/shared-kernel/registry/{reason-codes,entitlements,units}.json  (+ *.schema.json)
//     ts      -> <out>/{reason-codes,entitlements,units}.ts   (packages/shared-kernel/src/gen)
//     swift   -> <out>/{ReasonCodes,Entitlements,Units}.swift (swift-client Sources/AIStylistKernel)
//     kotlin  -> <out>/{ReasonCodes,Entitlements,Units}.kt    (kotlin-client kernel/..., package
//                app.aistylist.contracts.kernel)
//
// Usage: node tools/codegen/gen-kernel.mjs <ts|swift|kotlin> <out-dir>
// Called by generate.sh (ts), gen-swift.sh (swift) and gen-kotlin.sh (kotlin); not run by hand.
// Every run validates each registry against its JSON Schema (Ajv, draft 2020-12, resolved from the
// packages/contracts devDependency) plus the cross-references a schema cannot express, and exits 1
// on any finding. Deterministic: registry order is preserved, output is byte-identical per input.
// <out-dir> holds only generated files and is replaced wholesale. Never edit the output by hand.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { emitKotlin } from './kernel/emit-kotlin.mjs';
import { emitSwift } from './kernel/emit-swift.mjs';
import { emitTs } from './kernel/emit-ts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY_DIR = path.join(ROOT, 'packages/shared-kernel/registry');
const REGISTRIES = ['reason-codes', 'entitlements', 'units'];
const EMITTERS = { ts: emitTs, swift: emitSwift, kotlin: emitKotlin };

const [lang, outArg] = process.argv.slice(2);
if (!lang || !(lang in EMITTERS) || !outArg) {
  console.error('usage: gen-kernel.mjs <ts|swift|kotlin> <out-dir>');
  process.exit(2);
}
const outDir = path.resolve(outArg);

const requireFromContracts = createRequire(path.join(ROOT, 'packages/contracts/package.json'));
const { Ajv2020 } = await import(
  pathToFileURL(requireFromContracts.resolve('ajv/dist/2020.js')).href
);
const ajv = new Ajv2020({ strict: true, allErrors: true });

/** Schema validation per file; returns the parsed registries keyed by name. */
async function loadRegistries(errors) {
  const reg = {};
  for (const name of REGISTRIES) {
    const rel = `packages/shared-kernel/registry/${name}.json`;
    let data;
    let schema;
    try {
      data = JSON.parse(await readFile(path.join(REGISTRY_DIR, `${name}.json`), 'utf8'));
      schema = JSON.parse(await readFile(path.join(REGISTRY_DIR, `${name}.schema.json`), 'utf8'));
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
}

const errors = [];
const reg = await loadRegistries(errors);
checkReferences(reg, errors);
let files = {};
if (errors.length === 0) {
  try {
    files = EMITTERS[lang](reg);
  } catch (err) {
    errors.push(err.message);
  }
}
if (errors.length > 0) {
  console.error('gen-kernel.mjs: invalid shared-kernel registry (nothing written):');
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
