#!/usr/bin/env node
// DESIGN.md frontmatter -> native design-token code (DEC-87; ADR-0011 follow-up 3).
//
// Usage: node tools/codegen/gen-tokens.mjs --input <DESIGN.md>
//          [--components <dir>] [--swift-out <dir>] [--kotlin-out <dir>]
// Runs the DEC-87 pipeline: the pinned @google/design.md lint (TK-12) plus our rules
// (TK-01..TK-11), the in-memory DTCG 2025.10 model and resolver, then the Swift and Kotlin
// emitters in three tiers (reference scales, scheme roles, component tokens). With --components,
// every approved component contract in <dir> (.impeccable/components/*.yaml, rules CC-01..CC-11)
// also becomes the component API surface: ComponentAPI.swift and ComponentApi.kt beside the tiers
// (ADR-0011 follow-up 7), plus <Name>Glyphs.swift / .kt per approved icon set (`kind: icon-set`,
// its compiled glyph table). Each output directory holds only generated files and is replaced
// wholesale; without one, nothing is written.
// Exit 0 with a summary (plus one line per directory written) when every input is valid,
// 1 on any finding (each printed) or a write error, 2 on a usage error.
// Called by tools/codegen/generate.sh (`just generate [--check]`), which names the two directories.
// Rules, the model, the emitted shape and the tests: tools/codegen/tokens/README.md.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { apiDeclarations } from './tokens/api-declarations.mjs';
import { loadContracts } from './tokens/contracts.mjs';
import { declarations } from './tokens/declarations.mjs';
import { emitApiKotlin } from './tokens/emit-api-kotlin.mjs';
import { emitApiSwift } from './tokens/emit-api-swift.mjs';
import { emitKotlin } from './tokens/emit-kotlin.mjs';
import { emitSwift } from './tokens/emit-swift.mjs';
import { formatFinding, loadTokens } from './tokens/pipeline.mjs';
import { CONTEXTS } from './tokens/syntax.mjs';
import { designMdBin, upstreamLint } from './tokens/upstream-lint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE =
  'usage: gen-tokens.mjs --input <DESIGN.md> [--components <dir>] ' +
  '[--swift-out <dir>] [--kotlin-out <dir>]';
const OPTIONS = {
  input: { type: 'string' },
  components: { type: 'string' },
  'swift-out': { type: 'string' },
  'kotlin-out': { type: 'string' },
};

function parseCli(argv) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: OPTIONS, strict: true }));
  } catch (err) {
    console.error(`gen-tokens: ${err.message}`);
    return null;
  }
  return values.input ? values : null;
}

/** A path as messages name it: repo-relative when inside the repo. */
function label(file) {
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return path.basename(file);
  return relative.split(path.sep).join('/');
}

/** Replaces `dir` with exactly `files` (`{ name: text }`). */
function writeOutput(dir, files) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
  console.log(`gen-tokens: ${label(dir)} (${Object.keys(files).join(', ')})`);
}

function main() {
  const options = parseCli(process.argv.slice(2));
  if (!options) {
    console.error(USAGE);
    process.exit(2);
  }
  const input = path.resolve(options.input);
  const source = label(input);
  let text;
  try {
    text = readFileSync(input, 'utf8');
  } catch (err) {
    console.error(`gen-tokens: cannot read ${options.input}: ${err.message}`);
    process.exit(1);
  }
  const { findings: own, model } = loadTokens(text);
  const findings = [...upstreamLint(designMdBin(ROOT), input), ...own];
  if (findings.length > 0) {
    console.error(`gen-tokens: ${findings.length} finding(s) in ${source}:`);
    for (const finding of findings) console.error(`  ${formatFinding(finding)}`);
    process.exit(1);
  }
  const components = Object.keys(model.sets.components).length;
  const roles = `${model.roles.length} colour roles x ${CONTEXTS.length} contexts`;
  console.log(`gen-tokens: ${source} is valid (${roles}, ${components} components)`);
  const api = options.components ? componentApi(path.resolve(options.components), model) : null;
  const outputs = [
    [options['swift-out'], emitSwift, emitApiSwift],
    [options['kotlin-out'], emitKotlin, emitApiKotlin],
  ].filter(([dir]) => dir);
  if (outputs.length === 0) return;
  const tiers = declarations(model);
  const apiSource = api && `${api.source} + ${source}`;
  try {
    for (const [dir, emit, emitApi] of outputs) {
      const files = { ...emit(tiers, source), ...(api ? emitApi(api.decls, apiSource) : {}) };
      writeOutput(path.resolve(dir), files);
    }
  } catch (err) {
    console.error(`gen-tokens: cannot write the output: ${err.message}`);
    process.exit(1);
  }
}

/**
 * The component contracts in `dir`, checked against `model` (CC-01..CC-11): `{ decls, source }`
 * for the API files. Exits 1 on any finding; a contract still `approved: pending` is named and
 * gets no API.
 */
function componentApi(dir, model) {
  const where = label(dir);
  const { findings, apis, pending = [] } = loadContracts(dir, model);
  if (findings.length > 0) {
    console.error(`gen-tokens: ${findings.length} finding(s) in ${where}:`);
    for (const finding of findings) console.error(`  ${formatFinding(finding)}`);
    process.exit(1);
  }
  const ids = apis.map(({ id }) => id).join(', ') || 'none';
  console.log(`gen-tokens: ${where} is valid (${apis.length} approved contract(s): ${ids})`);
  for (const file of pending) {
    console.log(`gen-tokens: ${where}/${file} is pending owner approval: no API emitted`);
  }
  return { decls: apiDeclarations(apis), source: `${where}/*.yaml` };
}

main();
