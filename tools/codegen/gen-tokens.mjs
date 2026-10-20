#!/usr/bin/env node
// DESIGN.md frontmatter -> native design-token code (DEC-87; ADR-0011 follow-up 3).
//
// Usage: node tools/codegen/gen-tokens.mjs --input <DESIGN.md>
// Runs stages 1 and 2 of the DEC-87 pipeline: the pinned @google/design.md lint (TK-12) plus our
// rules (TK-01..TK-11), then the in-memory DTCG 2025.10 model and resolver. Exit 0 with a one-line
// summary when the input is valid, 1 on any finding (each printed), 2 on a usage error.
// Stage 3 (the Swift and Kotlin emitters, emit-swift.mjs and emit-kotlin.mjs, with their output
// directories and --check) and the `just generate` wiring land in later passes of Linear AI-189.
// Rules, the model and the tests: tools/codegen/tokens/README.md.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { formatFinding, loadTokens } from './tokens/pipeline.mjs';
import { CONTEXTS } from './tokens/syntax.mjs';
import { designMdBin, upstreamLint } from './tokens/upstream-lint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = 'usage: gen-tokens.mjs --input <DESIGN.md>';

function parseCli(argv) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: { input: { type: 'string' } }, strict: true }));
  } catch (err) {
    console.error(`gen-tokens: ${err.message}`);
    return null;
  }
  return values.input ? values : null;
}

/** The input as messages name it: repo-relative when inside the repo. */
function sourceLabel(file) {
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return path.basename(file);
  return relative.split(path.sep).join('/');
}

function main() {
  const options = parseCli(process.argv.slice(2));
  if (!options) {
    console.error(USAGE);
    process.exit(2);
  }
  const input = path.resolve(options.input);
  const source = sourceLabel(input);
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
}

main();
