// Black-box tests for tools/codegen/gen-tokens.mjs. The pinned `@google/design.md` lint (TK-12) is
// replaced by a POSIX shell stub on DESIGN_MD_BIN that logs its arguments and fails on demand, so
// the real CLI never runs here. Run by scripts/test/design-tokens.test.sh (`just test tooling`).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const TOKENS_DIR = path.resolve(import.meta.dirname, '..');
const GEN = path.resolve(TOKENS_DIR, '..', 'gen-tokens.mjs');
const fixture = (name) => path.join(TOKENS_DIR, 'fixtures', name, 'DESIGN.md');
// realpath: on macOS the temporary directory is reached through a symlink.
const SCRATCH = realpathSync(mkdtempSync(path.join(tmpdir(), 'gen-tokens-test-')));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

const STUB = path.join(SCRATCH, 'design-md-stub');
const STUB_SCRIPT = [
  '#!/bin/sh',
  'printf "%s\\n" "$*" >>"$DESIGN_MD_STUB_LOG"',
  'if [ -n "${DESIGN_MD_STUB_FAIL:-}" ]; then',
  '  echo "stub: 1 error: letterSpacing is not a valid dimension" >&2',
  '  exit 1',
  'fi',
  '',
].join('\n');
writeFileSync(STUB, STUB_SCRIPT);
chmodSync(STUB, 0o755);

let runs = 0;

/** Runs the CLI with the stub as design.md; returns `{ status, stdout, stderr, lintCalls }`. */
function run(args, env = {}) {
  runs += 1;
  const log = path.join(SCRATCH, `lint-${runs}.log`);
  writeFileSync(log, '');
  const childEnv = { ...process.env, DESIGN_MD_BIN: STUB, DESIGN_MD_STUB_LOG: log, ...env };
  if (!env.DESIGN_MD_STUB_FAIL) delete childEnv.DESIGN_MD_STUB_FAIL;
  const result = spawnSync(process.execPath, [GEN, ...args], { encoding: 'utf8', env: childEnv });
  const lintCalls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, lintCalls };
}

test('no or unknown arguments: usage, exit 2', () => {
  for (const args of [[], ['--input'], ['--input', fixture('_valid'), '--emit']]) {
    const result = run(args);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /usage: gen-tokens\.mjs --input <DESIGN\.md>/);
  }
});

test('a valid file: the pinned lint runs once on it, then a summary of the model, exit 0', () => {
  const input = fixture('_valid');
  const result = run(['--input', input]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.lintCalls, [`lint ${input}`]);
  assert.match(
    result.stdout,
    /fixtures\/_valid\/DESIGN\.md is valid \(8 colour roles x 5 contexts, 3 components\)/,
  );
});

test('an invalid file: each finding with its rule id, exit 1', () => {
  const result = run(['--input', fixture('TK-05')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /1 finding\(s\) in tools\/codegen\/tokens\/fixtures\/TK-05/);
  assert.match(result.stderr, /TK-05 components\.button-primary-dark: differs/);
});

test('TK-12: a failing design.md lint fails the run and its output is shown', () => {
  const result = run(['--input', fixture('_valid')], { DESIGN_MD_STUB_FAIL: '1' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TK-12 design\.md lint: exited 1:/);
  assert.match(result.stderr, /stub: 1 error: letterSpacing is not a valid dimension/);
});

test('TK-12 and our rules are reported together', () => {
  const result = run(['--input', fixture('TK-07')], { DESIGN_MD_STUB_FAIL: '1' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /2 finding\(s\)/);
  assert.match(result.stderr, /TK-12 /);
  assert.match(result.stderr, /TK-07 motion\.press: "150ms linear" is CSS shorthand/);
});

test('TK-12: a missing design.md bin is a finding, not a crash', () => {
  const missing = path.join(SCRATCH, 'no-such-bin');
  const result = run(['--input', fixture('_valid')], { DESIGN_MD_BIN: missing });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TK-12 design\.md lint: `.*no-such-bin` not found/);
});

test('an unreadable input: exit 1 with the reason', () => {
  const result = run(['--input', path.join(SCRATCH, 'missing.md')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot read .*missing\.md/);
});
