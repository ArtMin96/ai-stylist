// Token models and component-API models shared by the normaliser, emitter, contract and parity
// tests: the synthetic fixtures, the repository DESIGN.md and contracts, and the fixture after an
// edit. Not a test file (no `.test.mjs`), so scripts/test/design-tokens.test.sh only runs it
// through its importers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { apiDeclarations } from '../api-declarations.mjs';
import { checkContract, loadContracts } from '../contracts.mjs';
import { declarations } from '../declarations.mjs';
import { normalise } from '../normalise.mjs';
import { parseDesignMd } from '../parse.mjs';
import { formatFinding, loadTokens } from '../pipeline.mjs';
import { validate } from '../validate.mjs';

const TOKENS_DIR = path.resolve(import.meta.dirname, '..');
/**
 * The checkout whose `DESIGN.md` and `.impeccable/components/` the repository tests read: this
 * one, or `TOKENS_REPO_ROOT` (another worktree, to try its inputs before they are integrated).
 */
export const REPO_ROOT = process.env.TOKENS_REPO_ROOT
  ? path.resolve(process.env.TOKENS_REPO_ROOT)
  : path.resolve(TOKENS_DIR, '..', '..', '..');
export const VALID = readFileSync(path.join(TOKENS_DIR, 'fixtures', '_valid', 'DESIGN.md'), 'utf8');
export const REPO_DESIGN_MD = readFileSync(path.join(REPO_ROOT, 'DESIGN.md'), 'utf8');
/** Contract fixtures: `DESIGN.md` (their tokens), `_valid/` and one `CC-NN/` per rule. */
export const CONTRACT_FIXTURES = path.join(TOKENS_DIR, 'fixtures', 'contracts');
export const CONTRACT_TOKENS = readFileSync(path.join(CONTRACT_FIXTURES, 'DESIGN.md'), 'utf8');
export const VALID_CONTRACTS = path.join(CONTRACT_FIXTURES, '_valid');
export const REPO_CONTRACTS = path.join(REPO_ROOT, '.impeccable', 'components');

/**
 * `make()` on the first call, its result after. A test file builds the repository contracts' API
 * through this, so a defect there fails the tests that read it, not the fixture tests beside them.
 */
export function once(make) {
  let made;
  return () => (made ??= { value: make() }).value;
}

/** The API models of the contracts in `dir`, which must pass against `model`. */
export function apisOf(model, dir) {
  const { findings, apis } = loadContracts(dir, model);
  assert.deepEqual(findings, [], findings.map(formatFinding).join('\n'));
  return apis;
}

/** `{ <File>.<ext>: text }` from one API emitter for the contracts in `dir`. */
export const emittedApi = (emitApi, model, dir) =>
  emitApi(apiDeclarations(apisOf(model, dir)), 'components/*.yaml + DESIGN.md');

/**
 * `{ <File>.<ext>: text }` from one API emitter for the fixture icon set alone, after
 * `edit(text)`, which must leave it valid against `model`.
 */
export function emittedIconSet(emitApi, model, edit) {
  const text = edit(readFileSync(path.join(VALID_CONTRACTS, 'icon.yaml'), 'utf8'));
  const { findings, api } = checkContract(text, 'icon.yaml', model);
  assert.deepEqual(findings, [], findings.map(formatFinding).join('\n'));
  return emitApi(apiDeclarations([api]), 'icon.yaml + DESIGN.md');
}

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
