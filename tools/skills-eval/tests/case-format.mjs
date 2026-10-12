// The case format `claude plugin eval` loads, as assertions for the skills-eval tests. The lists
// are the runner's own (its case schema in Claude Code 2.1.296 and
// https://code.claude.com/docs/en/plugin-evals.md): an unknown frontmatter key and a case without
// a grader are load errors, so every generated file is held to them here, where it costs nothing.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PROMPT_KEYS = [
  'name',
  'description',
  'tags',
  'plugins',
  'runs',
  'expected_outcome',
  'model',
  'max_turns',
  'timeout_seconds',
  'allowed_tools',
  'append_system_prompt',
  'env',
];
const GRADER_KEYS = {
  llm: ['type', 'weight', 'arm'],
  tool_used: ['type', 'weight', 'arm', 'tool', 'input_match', 'min', 'max'],
};
const MAX_TURNS = 200;
const MAX_TIMEOUT_SECONDS = 3600;

/**
 * `{ fields, body }` of a generated file. Every value must be one line of JSON (which is also
 * YAML) or a flow list of plain words, so a value that leaked a raw newline fails to parse here.
 */
export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(match, `no frontmatter block in: ${text.slice(0, 60)}`);
  const pairs = match[1].split('\n').map((line) => {
    const at = line.indexOf(': ');
    const raw = line.slice(at + 2);
    const value = raw.startsWith('[') ? raw.slice(1, -1).split(', ') : JSON.parse(raw);
    return [line.slice(0, at), value];
  });
  return { fields: Object.fromEntries(pairs), body: match[2] };
}

/** One generated case directory as `{ path in it: text }`. */
export function readCaseDir(dir) {
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  const pairs = files.map((entry) => {
    const file = path.join(entry.parentPath, entry.name);
    return [path.relative(dir, file), readFileSync(file, 'utf8')];
  });
  return Object.fromEntries(pairs);
}

function assertWholeNumber(value, max, what) {
  assert.ok(Number.isInteger(value) && value >= 1 && value <= max, `${what} is ${value}`);
}

function assertGrader(name, text) {
  const { fields, body } = parseFrontmatter(text);
  const allowed = GRADER_KEYS[fields.type];
  assert.ok(allowed, `${name}: grader type ${fields.type}`);
  const unknown = Object.keys(fields).filter((key) => !allowed.includes(key));
  assert.deepEqual(unknown, [], `${name}: unknown keys`);
  if (fields.arm !== undefined) assert.ok(['with-only', 'both'].includes(fields.arm), name);
  if (fields.type === 'llm') assert.notEqual(body.trim(), '', `${name}: no rubric`);
  if (fields.type === 'tool_used') {
    assert.equal(typeof fields.tool, 'string', name);
    assert.doesNotThrow(() => new RegExp(fields.input_match), name);
    for (const bound of ['min', 'max']) {
      const value = fields[bound];
      if (value !== undefined) assert.ok(Number.isInteger(value) && value >= 0, name);
    }
  }
}

/** Asserts that one case, as `{ path in the case directory: text }`, is one the runner loads. */
export function assertLoadableCase(files) {
  const { fields, body } = parseFrontmatter(files['prompt.md']);
  const unknown = Object.keys(fields).filter((key) => !PROMPT_KEYS.includes(key));
  assert.deepEqual(unknown, [], 'prompt.md: unknown keys');
  assert.match(fields.name, /^[a-z0-9-]+$/);
  assertWholeNumber(fields.max_turns, MAX_TURNS, 'max_turns');
  assertWholeNumber(fields.timeout_seconds, MAX_TIMEOUT_SECONDS, 'timeout_seconds');
  assert.notEqual(body.trim(), '', 'prompt.md: empty prompt');

  const graders = Object.keys(files).filter((file) => /^graders\/[a-z0-9-]+\.md$/.test(file));
  assert.ok(graders.length >= 1, 'a case needs at least one grader');
  for (const grader of graders) assertGrader(grader, files[grader]);

  const caseYaml = files['case.yaml'];
  if (caseYaml === undefined) return;
  assert.match(caseYaml, /^schema_version: "1\.1"$/m);
  assert.match(caseYaml, new RegExp(`^name: "${fields.name}"$`, 'm'));
  const script = /^ {2}scaffold_script: (\S+)$/m.exec(caseYaml)?.[1];
  assert.ok(files[script] !== undefined, `case.yaml: no scaffold script ${script}`);
}
