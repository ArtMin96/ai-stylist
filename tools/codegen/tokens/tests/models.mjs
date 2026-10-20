// Token models shared by the normaliser, emitter and parity tests: the synthetic fixture, the
// repository DESIGN.md, and the fixture after an edit. Not a test file (no `.test.mjs`), so
// scripts/test/design-tokens.test.sh only runs it through its importers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { declarations } from '../declarations.mjs';
import { normalise } from '../normalise.mjs';
import { parseDesignMd } from '../parse.mjs';
import { formatFinding, loadTokens } from '../pipeline.mjs';
import { validate } from '../validate.mjs';

const TOKENS_DIR = path.resolve(import.meta.dirname, '..');
export const VALID = readFileSync(path.join(TOKENS_DIR, 'fixtures', '_valid', 'DESIGN.md'), 'utf8');
export const REPO_DESIGN_MD = readFileSync(
  path.resolve(TOKENS_DIR, '..', '..', '..', 'DESIGN.md'),
  'utf8',
);

/** The model of valid DESIGN.md text. */
export function modelOf(text) {
  const { findings, model } = loadTokens(text);
  assert.deepEqual(findings, [], findings.map(formatFinding).join('\n'));
  return model;
}

/** The model of the valid fixture after `edit(frontmatter, parsed)`, which must leave it valid. */
export function modelOfEdited(edit) {
  const parsed = parseDesignMd(VALID);
  edit(parsed.frontmatter, parsed);
  const findings = validate(parsed);
  assert.deepEqual(findings, [], findings.map(formatFinding).join('\n'));
  return normalise(parsed.frontmatter);
}

/** The first capture group of every match of the global `pattern` in `text`. */
export const firstGroups = (text, pattern) => [...text.matchAll(pattern)].map((m) => m[1]);

/** `{ <File>.<ext>: text }` from one emitter for a model. */
export const emitted = (emit, model) => emit(declarations(model), 'DESIGN.md');

/**
 * The lines of `text` from the one starting with `head` to the first `}` or `)` at its indent plus
 * `wrap` spaces (4 for a Kotlin value wrapped after its `=`).
 */
export function block(text, head, wrap = 0) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trimStart().startsWith(head));
  assert.ok(start >= 0, `no line starts with ${head}`);
  const pad = /^ */.exec(lines[start])[0] + ' '.repeat(wrap);
  const closes = (line) => line === `${pad}}` || line === `${pad})`;
  const end = lines.findIndex((line, i) => i > start && closes(line));
  assert.ok(end > start, `no closing line for ${head}`);
  return lines.slice(start, end + 1).join('\n');
}
