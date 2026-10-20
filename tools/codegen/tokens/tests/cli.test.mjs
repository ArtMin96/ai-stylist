// Black-box tests for tools/codegen/gen-tokens.mjs. The pinned `@google/design.md` lint (TK-12) is
// replaced by a POSIX shell stub on DESIGN_MD_BIN that logs its arguments and fails on demand, so
// the real CLI never runs here. Run by scripts/test/design-tokens.test.sh (`just test tooling`).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { REPO_ROOT } from './models.mjs';

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

test('output directories: each replaced by the three tier files of its language', () => {
  const swiftOut = path.join(SCRATCH, 'out', 'swift');
  const kotlinOut = path.join(SCRATCH, 'out', 'kotlin');
  mkdirSync(swiftOut, { recursive: true });
  writeFileSync(path.join(swiftOut, 'Stale.swift'), '// a file the last run wrote\n');
  const args = ['--input', fixture('_valid'), '--swift-out', swiftOut, '--kotlin-out', kotlinOut];
  const result = run(args);
  assert.equal(result.status, 0, result.stderr);
  const tiers = ['ReferenceTokens', 'SchemeTokens', 'ComponentTokens'];
  assert.deepEqual(readdirSync(swiftOut).sort(), tiers.map((t) => `${t}.swift`).sort());
  assert.deepEqual(readdirSync(kotlinOut).sort(), tiers.map((t) => `${t}.kt`).sort());
  assert.match(result.stdout, /\ngen-tokens: swift \(ReferenceTokens\.swift, SchemeTokens\.swift/);
  const kotlinScheme = readFileSync(path.join(kotlinOut, 'SchemeTokens.kt'), 'utf8');
  assert.match(kotlinScheme, /enum class AppColorRole/);
  const component = path.join(swiftOut, 'ComponentTokens.swift');
  const first = readFileSync(component, 'utf8');
  const again = run(args);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(readFileSync(component, 'utf8'), first, 'a second run writes the same bytes');
});

test('an invalid file writes nothing', () => {
  const out = path.join(SCRATCH, 'out', 'invalid');
  const result = run(['--input', fixture('TK-05'), '--swift-out', out]);
  assert.equal(result.status, 1);
  assert.equal(existsSync(out), false);
});

test('the repository DESIGN.md generates both languages', () => {
  const out = path.join(SCRATCH, 'out', 'repo');
  const input = path.join(REPO_ROOT, 'DESIGN.md');
  const args = ['--input', input, '--swift-out', `${out}/swift`, '--kotlin-out', `${out}/kotlin`];
  const result = run(args);
  assert.equal(result.status, 0, result.stderr);
  // The path prefix appears only when TOKENS_REPO_ROOT names a worktree inside this checkout.
  assert.match(result.stdout, /gen-tokens: (\S+\/)?DESIGN\.md is valid \(\d+ colour roles x 5/);
  const swift = readFileSync(path.join(out, 'swift', 'ComponentTokens.swift'), 'utf8');
  assert.match(swift, /^\/\/ Source: (\S+\/)?DESIGN\.md$/m);
});

test('--components: the API and glyph-table files join the tiers in each directory', () => {
  const out = path.join(SCRATCH, 'out', 'contracts');
  const components = path.join(TOKENS_DIR, 'fixtures', 'contracts', '_valid');
  const args = ['--input', fixture('contracts'), '--components', components];
  const result = run([...args, '--swift-out', `${out}/swift`, '--kotlin-out', `${out}/kotlin`]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /_valid is valid \(2 approved contract\(s\): button, icon\)/);
  const tiers = ['ReferenceTokens', 'SchemeTokens', 'ComponentTokens'];
  const swiftFiles = [
    ...tiers.map((t) => `${t}.swift`),
    'ComponentAPI.swift',
    'AppIconGlyphs.swift',
  ];
  assert.deepEqual(readdirSync(path.join(out, 'swift')).sort(), swiftFiles.sort());
  const kotlinFiles = [...tiers.map((t) => `${t}.kt`), 'ComponentApi.kt', 'AppIconGlyphs.kt'];
  assert.deepEqual(readdirSync(path.join(out, 'kotlin')).sort(), kotlinFiles.sort());
});

test('--components: a failing contract is a finding and nothing is written', () => {
  const out = path.join(SCRATCH, 'out', 'bad-contract');
  const cases = [
    ['CC-05', /CC-05 button\.yaml tokens\.primary\.states\.pressed: /],
    ['CC-08', /CC-08 button\.yaml sizes\.medium: \{components\.button-medium\} has no iconSize/],
    ['CC-11', /CC-11 icon\.yaml glyphs\.1\.shapes\.0\.d: info: cannot compile the path: /],
  ];
  for (const [rule, message] of cases) {
    const components = path.join(TOKENS_DIR, 'fixtures', 'contracts', rule);
    const args = ['--input', fixture('contracts'), '--components', components, '--swift-out', out];
    const result = run(args);
    assert.equal(result.status, 1, rule);
    assert.match(result.stderr, /1 finding\(s\) in tools\/codegen\/tokens\/fixtures\/contracts\//);
    assert.match(result.stderr, message);
    assert.equal(existsSync(out), false);
  }
});

const TYPE_LINE = /^(?:nonisolated public (?:enum|struct)|enum class|data class|object) (\w+)/gm;

test('the repository DESIGN.md and contracts generate the component API', (t) => {
  const out = path.join(SCRATCH, 'out', 'repo-api');
  const args = ['--input', path.join(REPO_ROOT, 'DESIGN.md')];
  args.push('--components', path.join(REPO_ROOT, '.impeccable', 'components'));
  args.push('--swift-out', `${out}/swift`, '--kotlin-out', `${out}/kotlin`);
  const result = run(args);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /is valid \(2 approved contract\(s\): button, icon\)/);
  const swift = readFileSync(path.join(out, 'swift', 'ComponentAPI.swift'), 'utf8');
  const kotlin = readFileSync(path.join(out, 'kotlin', 'ComponentApi.kt'), 'utf8');
  const source = /^\/\/ Source: (\S+\/)?\.impeccable\/components\/\*\.yaml \+ (\S+\/)?DESIGN\.md$/m;
  assert.match(swift, source);
  assert.match(swift, /\n {2}case primaryOutline = "primary-outline"\n/);
  const constant = 'textCompactEnabled: String = "ds-button-text-compact-enabled"';
  assert.ok(swift.includes(`public static let ${constant}`) && kotlin.includes(`val ${constant}`));
  assert.match(kotlin, /\nenum class ButtonVariant\(\n/);
  assert.match(swift, /\n {2}public let iconSize: AppIconSize\n {2}public let iconGap: Double\n/);
  assert.match(kotlin, /\n {4}val iconSize: AppIconSize,\n {4}val iconGap: Double,\n/);
  const glyphs = readFileSync(path.join(out, 'kotlin', 'AppIconGlyphs.kt'), 'utf8');
  assert.match(glyphs, /\nobject AppIconGlyphs \{\n/);
  for (const [file, text] of [
    ['ComponentAPI.swift', swift],
    ['ComponentApi.kt', kotlin],
  ]) {
    const types = [...text.matchAll(TYPE_LINE)].map((m) => m[1]).join(', ');
    t.diagnostic(`${file}: ${text.split('\n').length - 1} lines; ${types}`);
  }
});

test('an unreadable input: exit 1 with the reason', () => {
  const result = run(['--input', path.join(SCRATCH, 'missing.md')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot read .*missing\.md/);
});
