#!/usr/bin/env node
// DESIGN.md frontmatter -> native design-token code (DEC-87; ADR-0011 follow-up 3).
//
// Usage: node tools/codegen/gen-tokens.mjs --input <DESIGN.md>
//          [--swift-out <dir>] [--kotlin-out <dir>]
// Runs the DEC-87 pipeline: the pinned @google/design.md lint (TK-12) plus our rules
// (TK-01..TK-11), the in-memory DTCG 2025.10 model and resolver, then the Swift and Kotlin
// emitters in three tiers (reference scales, scheme roles, component tokens). Each output
// directory holds only generated files and is replaced wholesale; without one, nothing is written.
// Exit 0 with a one-line summary (plus one line per directory written) when the input is valid,
// 1 on any finding (each printed) or a write error, 2 on a usage error.
// Called by tools/codegen/generate.sh (`just generate [--check]`), which names the two directories.
// Rules, the model, the emitted shape and the tests: tools/codegen/tokens/README.md.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { declarations } from './tokens/declarations.mjs';
import { emitKotlin } from './tokens/emit-kotlin.mjs';
import { emitSwift } from './tokens/emit-swift.mjs';
import { formatFinding, loadTokens } from './tokens/pipeline.mjs';
import { CONTEXTS } from './tokens/syntax.mjs';
import { designMdBin, upstreamLint } from './tokens/upstream-lint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = 'usage: gen-tokens.mjs --input <DESIGN.md> [--swift-out <dir>] [--kotlin-out <dir>]';
const OPTIONS = {
  input: { type: 'string' },
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
  const outputs = [
    [options['swift-out'], emitSwift],
    [options['kotlin-out'], emitKotlin],
  ].filter(([dir]) => dir);
  if (outputs.length === 0) return;
  const tiers = declarations(model);
  try {
    for (const [dir, emit] of outputs) writeOutput(path.resolve(dir), emit(tiers, source));
  } catch (err) {
    console.error(`gen-tokens: cannot write the output: ${err.message}`);
    process.exit(1);
  }
}

main();
