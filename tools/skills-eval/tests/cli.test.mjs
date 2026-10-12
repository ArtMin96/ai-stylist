// Black-box tests for tools/skills-eval/skills-eval.mjs (`just skills-eval`). The tool runs as a
// child process on throwaway git checkouts with synthetic skills. Its whole PATH is a scratch
// directory holding git, tar and bash and, where a test says so, a launcher named `claude` for
// tests/claude-stub.mjs: the real CLI cannot be reached, no model is called, nothing is spent.
// Run by scripts/test/skills-eval.test.sh.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { READ_ONLY_NOTE } from '../cases.mjs';
import { summarize } from '../summary.mjs';
import { assertLoadableCase, parseFrontmatter, readCaseDir } from './case-format.mjs';
import { oneTaskResult, run, taskResult, triggerResult, twoQueryResult } from './results.mjs';

const TOOL_DIR = path.resolve(import.meta.dirname, '..');
const TOOL = path.join(TOOL_DIR, 'skills-eval.mjs');
const STUB = path.join(TOOL_DIR, 'tests', 'claude-stub.mjs');
// realpath: on macOS the temporary directory is reached through a symlink.
const SCRATCH = realpathSync(mkdtempSync(path.join(tmpdir(), 'skills-eval-test-')));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

const OWN_PATH = '.agents/skills/demo/';
const GUIDE = `${OWN_PATH}references/guide.md`;
const EVALS_FILE = `${OWN_PATH}evals/evals.json`;
const TRIGGER_FILE = `${OWN_PATH}evals/trigger-evals.json`;
const TODAY = new Date().toISOString().slice(0, 10);

function skillMd(description) {
  const lines = [
    '---',
    'name: demo',
    `description: ${description}`,
    '---',
    '',
    '# Demo',
    '',
    `Read \`${GUIDE}\` first. See also \`.agents/skills/other/SKILL.md\`.`,
    '',
  ];
  return lines.join('\n');
}

const SKILL_MD = skillMd('Tidy text files. Use for any tidy request.');
const OTHER_SKILL_MD = '---\nname: other\ndescription: The other thing.\n---\n\n# Other\n';
const CLAUDE_MD = [
  '# Synthetic contract',
  '',
  '## Session workflow',
  '',
  '1. **Orient:** read the plan.',
  '2. **Restate** the task.',
  '3. **Match a skill:** if a skill in `.agents/skills/` covers the task type, follow its',
  '   workflow.',
  '4. **Verify** the result.',
  '',
  '## Other rules',
  '',
].join('\n');
const STEP =
  '**Match a skill:** if a skill in `.agents/skills/` covers the task type, follow its workflow.';
const LAUNCH_PREFIX = 'env -u CLAUDE_EFFORT CLAUDE_CODE_EFFORT_LEVEL=high claude';
const NEEDED = /`claude plugin eval` needs Claude Code 2\.1\.269 or newer/;
const TASKS = {
  skill_name: 'demo',
  evals: [
    {
      id: 1,
      prompt: 'Tidy src/app.txt.\n\nKeep the "quoted" word.',
      expected_output: 'A tidy file.',
      files: [],
      assertions: [`The reply cites ${GUIDE}`, 'The reply shows the file'],
    },
    {
      id: 2,
      prompt: 'Review src/app.txt.',
      expected_output: 'One finding.',
      files: [],
      assertions: ['The reply lists one finding'],
    },
  ],
};
const OTHER_TASKS = {
  skill_name: 'other',
  evals: [{ id: 1, prompt: 'Do the other thing.', files: [], assertions: ['It is done'] }],
};
const DEMO_TRIGGERS = [
  { query: 'tidy this file for me', should_trigger: true },
  { query: 'make src/app.txt nicer', should_trigger: true, _teaches: 'a synonym' },
  { query: 'what is the weather', should_trigger: false, _near_miss_reason: 'unrelated' },
];
const OTHER_TRIGGERS = [
  { query: 'do the other thing', should_trigger: true },
  { query: 'tidy this file', should_trigger: false },
];

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const read = (...parts) => readFileSync(path.join(...parts), 'utf8');
const readJson = (...parts) => JSON.parse(read(...parts));
const FILES = {
  'CLAUDE.md': CLAUDE_MD,
  'src/app.txt': 'committed text\n',
  '.claude/settings.json': '{}\n',
  // Copies of the skill layer below the root: a snapshot must not hold them either.
  'docs/.agents/skills/demo/SKILL.md': 'An older copy of the demo skill.\n',
  'src/vendor/.claude/rules/note.md': 'A nested rule file.\n',
  '.agents/skills/demo/SKILL.md': SKILL_MD,
  [GUIDE]: `# Guide\n\nThis file is \`${GUIDE}\`.\n`,
  [EVALS_FILE]: json(TASKS),
  [TRIGGER_FILE]: json(DEMO_TRIGGERS),
  '.agents/skills/other/SKILL.md': OTHER_SKILL_MD,
  '.agents/skills/other/evals/evals.json': json(OTHER_TASKS),
  '.agents/skills/other/evals/trigger-evals.json': json(OTHER_TRIGGERS),
};

function onPath(name) {
  const dirs = (process.env.PATH ?? '').split(path.delimiter);
  const found = dirs.map((dir) => path.join(dir, name)).find((file) => existsSync(file));
  assert.ok(found, `${name} is not on PATH`);
  return found;
}

/** A directory to use as a whole PATH: git, tar and bash, so nothing finds the real `claude`. */
function scratchBin(name) {
  const dir = path.join(SCRATCH, name);
  mkdirSync(dir);
  for (const tool of ['git', 'tar', 'bash']) symlinkSync(onPath(tool), path.join(dir, tool));
  return dir;
}

const BARE_BIN = scratchBin('bin-bare');
const STUB_BIN = scratchBin('bin-stub');
const LAUNCHER = `#!/bin/sh\nexec '${process.execPath}' '${STUB}' "$@"\n`;
writeFileSync(path.join(STUB_BIN, 'claude'), LAUNCHER, { mode: 0o755 });

function git(root, args) {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1' };
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env });
}

/**
 * A committed checkout of the synthetic files in SCRATCH/<name>. `change` replaces files, and a
 * null text leaves one out. After the commit it gets an edit and an untracked file, which a
 * snapshot of HEAD must not contain.
 */
function fixtureRepo(name, change = {}) {
  const root = path.join(SCRATCH, name);
  for (const [file, text] of Object.entries({ ...FILES, ...change })) {
    if (text === null) continue;
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['add', '-A']);
  const author = ['-c', 'user.name=Synthetic Developer', '-c', 'user.email=dev@example.invalid'];
  git(root, [...author, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'chore: fixture']);
  writeFileSync(path.join(root, 'src', 'app.txt'), 'edited after the commit\n');
  writeFileSync(path.join(root, 'untracked.txt'), 'never committed\n');
  return root;
}

/** Runs the tool on a fixture with `bin` as its whole PATH. */
function invoke(root, args, { bin = STUB_BIN, env = {} } = {}) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [TOOL, '--root', root, ...args], {
    encoding: 'utf8',
    env: { PATH: bin, HOME: SCRATCH, TMPDIR: SCRATCH, ...env },
  });
  return { code: status, stdout, output: `${stdout}${stderr}` };
}

/** Result documents for the stub by unit (`<skill>-<mode>`); returns its settings for `invoke`. */
function stubbed(name, results, extra = {}) {
  const dir = path.join(SCRATCH, `${name}-results`);
  mkdirSync(dir);
  for (const [unit, result] of Object.entries(results)) {
    writeFileSync(path.join(dir, `${unit}.json`), JSON.stringify(result));
  }
  const log = path.join(SCRATCH, `${name}-calls.jsonl`);
  return { CLAUDE_STUB_LOG: log, CLAUDE_STUB_RESULTS: dir, ...extra };
}

/** The stub's `plugin eval` calls so far, in order. */
function calls(env) {
  if (!existsSync(env.CLAUDE_STUB_LOG)) return [];
  const lines = read(env.CLAUDE_STUB_LOG).trim().split('\n');
  return lines.map((line) => JSON.parse(line));
}

const ceilingOf = (call) => call.args[call.args.indexOf('--max-cost-usd') + 1];
const scoreboard = (root) => path.join(root, 'tools', 'skills-eval', 'scoreboard.json');

/** The run directory of the latest invocation on a fixture. */
function lastRunDir(root) {
  const parent = path.join(root, 'artifacts', 'skills-eval');
  const names = readdirSync(parent).sort();
  return path.join(parent, names.at(-1));
}

function noRunDir(root) {
  assert.ok(!existsSync(path.join(root, 'artifacts')), 'a run directory was written');
}

/** The cells of one row of the closing table: `[score, status, cost]` of a skill and mode. */
function row(text, skill, mode) {
  const cells = text.split('\n').map((line) => line.trim().split(/ {2,}/));
  const found = cells.find((line) => line.length === 5 && line[0] === skill && line[1] === mode);
  assert.ok(found, `no row for ${skill} ${mode} in:\n${text}`);
  return found.slice(2);
}

// --- generation (no claude on PATH) --------------------------------------------------------------

test('tasks --generate-only: plugin, cases and snapshot, with no claude on PATH', async (t) => {
  const root = fixtureRepo('tasks repo');
  const result = invoke(root, ['demo', 'tasks', '--generate-only'], { bin: BARE_BIN });
  assert.equal(result.code, 0, result.output);
  const runDir = lastRunDir(root);
  const plugin = path.join(runDir, 'demo-tasks', 'plugin');
  const copy = path.join(plugin, 'skills', 'demo');
  assert.match(path.basename(runDir), /^\d{8}T\d{6}\.\d{3}Z-demo-tasks$/);
  const closing = read(runDir, 'summary.txt');
  assert.ok(result.stdout.includes(`\n${closing}`), result.stdout);
  assert.deepEqual(row(closing, 'demo', 'tasks'), ['-', 'generated', '-']);
  assert.ok(closing.endsWith('\n--generate-only: nothing was run.\n'), closing);
  assert.ok(!existsSync(scoreboard(root)), 'a scoreboard was written');

  await t.test('the plugin holds only that skill, without its evals/', () => {
    const manifest = readJson(plugin, '.claude-plugin', 'plugin.json');
    assert.deepEqual(Object.keys(manifest), ['name', 'version', 'description']);
    assert.deepEqual(readdirSync(path.join(plugin, 'skills')), ['demo']);
    assert.deepEqual(readdirSync(copy).sort(), ['SKILL.md', 'references']);
  });

  await t.test('the copy names its own files by where they are; the source is kept', () => {
    const rewritten = SKILL_MD.replaceAll(OWN_PATH, `${copy}/`);
    assert.notEqual(rewritten, SKILL_MD);
    assert.ok(rewritten.includes('`.agents/skills/other/SKILL.md`'));
    assert.equal(read(copy, 'SKILL.md'), rewritten);
    assert.equal(read(copy, 'references', 'guide.md'), FILES[GUIDE].replace(OWN_PATH, `${copy}/`));
    assert.equal(read(root, OWN_PATH, 'SKILL.md'), SKILL_MD);
    assert.equal(git(root, ['status', '--porcelain', '--', '.agents']), '');
  });

  await t.test('one loadable case per task: the prompt, the checks, the Skill indicator', () => {
    assert.deepEqual(readdirSync(path.join(plugin, 'evals')).sort(), ['task-01', 'task-02']);
    const first = readCaseDir(path.join(plugin, 'evals', 'task-01'));
    const second = readCaseDir(path.join(plugin, 'evals', 'task-02'));
    assertLoadableCase(first);
    assertLoadableCase(second);
    assert.deepEqual(Object.keys(second).sort(), [
      'case.yaml',
      'graders/check-01.md',
      'graders/skill-fired.md',
      'prompt.md',
      'scaffold.sh',
    ]);
    const prompt = parseFrontmatter(first['prompt.md']);
    assert.equal(prompt.body, `${TASKS.evals[0].prompt}\n`);
    assert.equal(prompt.fields.append_system_prompt, `${STEP}\n\n${READ_ONLY_NOTE}`);
    const ownFile = parseFrontmatter(first['graders/check-01.md']);
    assert.deepEqual(ownFile.fields, { type: 'llm', arm: 'with-only' });
    assert.ok(ownFile.body.includes(`\`${OWN_PATH}\` is \`${copy}/\``), ownFile.body);
    assert.deepEqual(parseFrontmatter(first['graders/check-02.md']).fields, { type: 'llm' });
  });

  await t.test('the scaffold fills an empty workspace with HEAD, without the skill layer', () => {
    const workspace = path.join(SCRATCH, 'tasks workspace');
    mkdirSync(workspace);
    const script = path.join(plugin, 'evals', 'task-02', 'scaffold.sh');
    const env = { PATH: BARE_BIN, HOME: SCRATCH, TMPDIR: SCRATCH };
    execFileSync('bash', [script], { cwd: workspace, env });
    assert.ok(existsSync(path.join(runDir, 'snapshot.tar')));
    // No directory named .agents or .claude at any depth, so no copy of a skill is on disk.
    const unpacked = readdirSync(workspace, { recursive: true }).sort();
    assert.deepEqual(unpacked, ['CLAUDE.md', 'src', path.join('src', 'app.txt')]);
    assert.equal(read(workspace, 'src', 'app.txt'), 'committed text\n');
  });

  await t.test('run-config.json records the run: model, effort, runs, cost cap, commit', () => {
    const config = readJson(runDir, 'demo-tasks', 'run-config.json');
    const { scaffold, timestamp, runnerCommand, hash, ...fixed } = config;
    assert.deepEqual(fixed, {
      skill: 'demo',
      mode: 'tasks',
      model: 'claude-opus-5-5',
      judgeModel: null,
      effort: 'high',
      runs: 3,
      concurrency: 3,
      maxCostUsd: 10,
      // What is left minus the 3 case runs that can be in flight, 3 x 0.83.
      ceilingUsd: 7.51,
      estimateUsd: 4.98,
      caseGlob: null,
      cliVersion: null,
      gitSha: git(root, ['rev-parse', 'HEAD']).trim(),
      uncommittedSources: [],
      generateOnly: true,
      cases: ['task-01', 'task-02'],
    });
    assert.match(hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(timestamp, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.ok(runnerCommand.startsWith(`${LAUNCH_PREFIX} plugin eval `), runnerCommand);
    assert.equal(scaffold.entries, 3);
    assert.ok(scaffold.seconds < 30 && scaffold.snapshotBytes > 0, JSON.stringify(scaffold));
  });
});

test('triggers --generate-only: every skill in the plugin, one Skill-only case per query', () => {
  const root = fixtureRepo('triggers');
  const result = invoke(root, ['demo', 'triggers', '--generate-only'], { bin: BARE_BIN });
  assert.equal(result.code, 0, result.output);
  const runDir = lastRunDir(root);
  const plugin = path.join(runDir, 'demo-triggers', 'plugin');
  assert.deepEqual(readdirSync(path.join(plugin, 'skills')).sort(), ['demo', 'other']);
  assert.ok(!existsSync(path.join(plugin, 'skills', 'other', 'evals')));
  assert.ok(!existsSync(path.join(runDir, 'snapshot.tar')));
  const names = ['trigger-01-yes', 'trigger-02-yes', 'trigger-03-no'];
  assert.deepEqual(readdirSync(path.join(plugin, 'evals')).sort(), names);
  for (const name of names) {
    const files = readCaseDir(path.join(plugin, 'evals', name));
    assertLoadableCase(files);
    const { fields } = parseFrontmatter(files['prompt.md']);
    assert.deepEqual(fields.allowed_tools, ['Skill']);
    assert.equal(fields.append_system_prompt, STEP);
    assert.equal(files['case.yaml'], undefined);
  }
  const quiet = read(plugin, 'evals', 'trigger-03-no', 'graders', 'skill-not-fired.md');
  const { fields } = parseFrontmatter(quiet);
  assert.ok(new RegExp(fields.input_match).test('{"skill":"skills-eval:demo"}'));
  assert.deepEqual([fields.min, fields.max], [0, 0]);
  const config = readJson(runDir, 'demo-triggers', 'run-config.json');
  assert.equal(config.scaffold, null);
  assert.equal(config.runs, 1);
  assert.match(config.runnerCommand, / --runs 1 --ablation none /);
  assert.doesNotMatch(config.runnerCommand, /--scaffold/);
});

test('no argument selects every skill and both modes: all triggers, then all tasks', () => {
  const root = fixtureRepo('bare-generate');
  const result = invoke(root, ['--generate-only'], { bin: BARE_BIN });
  assert.equal(result.code, 0, result.output);
  const runDir = lastRunDir(root);
  assert.match(path.basename(runDir), /Z-all-all$/);
  const rows = result.stdout.split('\n').filter((line) => / generated /.test(line));
  const units = rows.map((line) => line.trim().split(/\s+/).slice(0, 2).join('-'));
  assert.deepEqual(units, ['demo-triggers', 'other-triggers', 'demo-tasks', 'other-tasks']);
  const made = readdirSync(runDir).sort();
  assert.deepEqual(made, [...units.toSorted(), 'snapshot.tar', 'summary.txt']);

  const oneSkill = invoke(root, ['other', '--generate-only'], { bin: BARE_BIN });
  assert.equal(oneSkill.code, 0, oneSkill.output);
  assert.match(path.basename(lastRunDir(root)), /Z-other-all$/);
  const unitDirs = readdirSync(lastRunDir(root)).filter((name) => !name.includes('.'));
  assert.deepEqual(unitDirs.sort(), ['other-tasks', 'other-triggers']);
});

// --- runs (the stub claude) ----------------------------------------------------------------------

test('the bare command scores what fits the budget, and running it again continues', async (t) => {
  const root = fixtureRepo('one-run');
  const first = {
    'demo-triggers': triggerResult(),
    'other-triggers': twoQueryResult(1),
    'demo-tasks': taskResult(),
    'other-tasks': oneTaskResult(),
  };
  const env = stubbed('one-run', first);
  const board = () => readJson(scoreboard(root));

  await t.test('first run: triggers, then tasks, each within what is left of the budget', () => {
    const result = invoke(root, [], { env });
    assert.equal(result.code, 0, result.output);
    // The runner's ceiling is what is left minus the runs that can be in flight. demo-triggers,
    // no record: 3 queries at 0.11, all 3 in flight, 10 - 0.33. other-triggers, from the 0.50 a
    // run that demo cost: 2 queries, 8.50 - 1.00. Tasks at 0.83 a case run with 3 in flight
    // (2.49): demo-tasks needs 4.98 under 7.00 - 2.49 and is left, other-tasks needs 2.49.
    const made = calls(env);
    const units = made.map((call) => call.unit);
    assert.deepEqual(units, ['demo-triggers', 'other-triggers', 'other-tasks']);
    assert.deepEqual(made.map(ceilingOf), ['9.67', '7.5', '4.51']);
    assert.deepEqual(
      made.map((call) => call.args[call.args.indexOf('--runs') + 1]),
      ['1', '1', '3'],
    );
    const text = read(lastRunDir(root), 'summary.txt');
    assert.ok(result.stdout.endsWith(`${text}skills-eval: run directory: ${lastRunDir(root)}\n`));
    const scoredNow = (score) => [score, 'scored now', '$1.5000'];
    assert.deepEqual(row(text, 'demo', 'triggers'), scoredNow('0.875 [0.646, 1.104]'));
    assert.deepEqual(row(text, 'other', 'triggers'), scoredNow('0.167 [-0.132, 0.465]'));
    assert.deepEqual(row(text, 'demo', 'tasks'), ['-', 'not run: budget', '-']);
    // One task, runs 1 and 0.5 with the skill: 0.75 +- 12.706 * 0.3536 / sqrt(2) = 3.1765.
    assert.match(row(text, 'other', 'tasks')[0], /^0\.750 \[-2\.42\d, 3\.92\d\]$/);
    const held = '$2.4900 held back for the runs in flight';
    const left = `\n  demo tasks: needs about $4.9800 and ${held}, $7.0000 is left\n`;
    assert.ok(text.includes(left), text);
    assert.match(text, /^Skill eval scores, .*, runs per case: 1 for triggers, 3 for tasks\)\n/);
    assert.match(text, /\nTotals: 3 scored now, 0 up to date, 1 not run, 0 failed; \$4\.5000 of /);
    const pooled = 'the 2 skills scored now: 0.571, N=14, n=5, 95% half-width 0.259';
    assert.ok(text.includes(`\nTrigger pass rate over ${pooled}\n`), text);
    assert.ok(text.endsWith('\nLeft: 1 of 4. Run `just skills-eval` again to continue.\n'), text);

    const stored = board();
    assert.deepEqual(Object.keys(stored), ['demo', 'other']);
    assert.deepEqual(Object.keys(stored.demo), ['triggers']);
    assert.deepEqual(Object.keys(stored.other), ['tasks', 'triggers']);
    const { hash, interval, gitSha, ...entry } = stored.demo.triggers.current;
    assert.deepEqual(entry, {
      date: TODAY,
      model: 'claude-opus-5-5',
      judgeModel: null,
      effort: 'high',
      cliVersion: '2.1.296',
      cases: 3,
      // One run per query is the default of triggers, and such a result is stored.
      runs: 1,
      score: 0.875,
      n: 8,
      passed: 7,
      costUsd: 1.5,
      costPerCaseRunUsd: 0.5,
    });
    assert.match(hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(gitSha, git(root, ['rev-parse', 'HEAD']).trim());
    assert.deepEqual(Object.keys(interval), ['low', 'high']);
  });

  await t.test('the repository gets only the run directories and the scoreboard', () => {
    const status = git(root, ['status', '--porcelain']).trim().split('\n');
    assert.deepEqual(status, ['M src/app.txt', '?? artifacts/', '?? tools/', '?? untracked.txt']);
    assert.deepEqual(readdirSync(path.join(root, 'tools', 'skills-eval')), ['scoreboard.json']);
    const text = read(scoreboard(root));
    assert.equal(text, `${JSON.stringify(JSON.parse(text), null, 2)}\n`);
    assert.ok(!text.includes('['), 'an array in the scoreboard: Prettier would refold it');
  });

  await t.test('second run: only what was left is scored', () => {
    const before = calls(env).length;
    const result = invoke(root, [], { env });
    assert.equal(result.code, 0, result.output);
    // demo-tasks is now estimated from the 0.50 a case run that other-tasks cost: 3.00 under
    // 10 - 3 x 0.50.
    const made = calls(env).slice(before);
    assert.deepEqual([made.length, made[0].unit, ceilingOf(made[0])], [1, 'demo-tasks', '8.5']);
    const text = read(lastRunDir(root), 'summary.txt');
    const upToDate = ['0.875 [0.646, 1.104]', `up to date (${TODAY})`, '-'];
    assert.deepEqual(row(text, 'demo', 'triggers'), upToDate);
    const scoredNow = ['0.875 [0.477, 1.273]', 'scored now', '$1.5000'];
    assert.deepEqual(row(text, 'demo', 'tasks'), scoredNow);
    assert.match(text, /\nTotals: 1 scored now, 3 up to date, 0 not run, 0 failed; \$1\.5000 of /);
    assert.ok(text.endsWith('\nNothing is left: every selected skill and mode is up to date.\n'));
    assert.equal(board().demo.tasks.current.score, 0.875);
  });

  await t.test('third run: all up to date, free, and claude is not needed', () => {
    const before = calls(env).length;
    const result = invoke(root, [], { bin: BARE_BIN, env });
    assert.equal(result.code, 0, result.output);
    assert.equal(calls(env).length, before);
    const totals = 'Totals: 0 scored now, 4 up to date, 0 not run, 0 failed; $0.0000 of $10.0000';
    assert.ok(result.stdout.includes(`\n${totals} spent\n`), result.stdout);
  });

  await t.test('--force scores an up-to-date unit again and keeps the previous entry', () => {
    const last = board().demo.triggers.current;
    const result = invoke(root, ['demo', 'triggers', '--force'], { env });
    assert.equal(result.code, 0, result.output);
    assert.equal(calls(env).at(-1).unit, 'demo-triggers');
    const note = `was 0.875 [0.646, 1.104] on ${TODAY}: the same inputs, scored again`;
    assert.ok(result.stdout.includes(`\n  demo triggers: ${note}\n`), result.stdout);
    assert.deepEqual(board().demo.triggers.previous, last);
  });

  await t.test('after a change: only what depends on it is scored, with a verdict each', () => {
    // A new description changes the routing of every skill and the tasks of this one.
    writeFileSync(path.join(root, OWN_PATH, 'SKILL.md'), skillMd('Tidy any text file.'));
    const every = (name) => ({ name, maxTurns: 4, arms: { with: [run(1), run(1), run(1)] } });
    const zero = (name) => {
      return { name, maxTurns: 15, arms: { with: [run(0), run(0)], without: [run(0), run(0)] } };
    };
    const changed = stubbed('one-run-changed', {
      'demo-triggers': triggerResult({ cases: ['a', 'b', 'c'].map(every) }),
      'other-triggers': twoQueryResult(6),
      'demo-tasks': taskResult({ cases: ['task-01', 'task-02'].map(zero) }),
    });
    const result = invoke(root, [], { env: changed });
    assert.equal(result.code, 0, result.output);
    const units = calls(changed).map((call) => call.unit);
    assert.deepEqual(units, ['demo-triggers', 'other-triggers', 'demo-tasks']);
    const text = read(lastRunDir(root), 'summary.txt');
    // Routing went from 7 of 8 to 9 of 9: inside the two intervals combined, 0.2292 and 0.3333.
    const same = `was 0.875 [0.646, 1.104] on ${TODAY}, now 1.000 [0.667, 1.000]`;
    const tie = 'no measurable change (difference +0.125, interval 0.405)';
    assert.ok(text.includes(`\n  demo triggers: ${same}: ${tie}\n`), text);
    // 1 of 6 to 6 of 6, and a tasks score from 0.875 to 0: both outside their intervals.
    const rose = 'now 1.000 [0.500, 1.000]: better (difference +0.833, interval 0.582)';
    const fell = 'now 0.000 [0.000, 0.000]: worse (difference -0.875, interval 0.398)';
    assert.ok(text.includes(`, ${rose}\n`), text);
    assert.ok(text.includes(`, ${fell}\n`), text);
    assert.equal(row(text, 'other', 'tasks')[1], `up to date (${TODAY})`);
    assert.equal(board().demo.tasks.previous.score, 0.875);
    assert.equal(board().demo.tasks.current.score, 0);
  });
});

test('a tasks run starts the runner with the effort pinned; a --case result is not stored', () => {
  const root = fixtureRepo('run-tasks');
  // CLAUDE_EFFORT is what a Claude Code session exports: it must not reach the runner.
  const env = stubbed('run-tasks', { 'demo-tasks': taskResult() }, { CLAUDE_EFFORT: 'max' });
  const args = ['demo', 'tasks', '--runs', '2', '--case', 'task-0*', '--judge-model', 'judge-x'];
  const result = invoke(root, args, { env });
  assert.equal(result.code, 0, result.output);
  const unitDir = path.join(lastRunDir(root), 'demo-tasks');
  const [call] = calls(env);
  const expected = [
    `plugin eval ${unitDir}/plugin --runs 2 --ablation with-without --concurrency 3`,
    '--model claude-opus-5-5 --judge-model judge-x --case task-0* --scaffold',
    // 10 minus the 3 case runs that can be in flight at 0.83 each.
    '--trust-plugin --no-publish --threshold 0 --max-cost-usd 7.51',
    `--output-dir ${unitDir}/results --json ${unitDir}/result.json --report ${unitDir}/report.html`,
  ];
  assert.equal(call.args.join(' '), expected.join(' '));
  assert.equal(call.effortLevel, 'high');
  assert.equal(call.claudeEffort, null);

  const summary = summarize(taskResult(), { skill: 'demo', mode: 'tasks' });
  assert.equal(read(unitDir, 'summary.txt'), summary);
  assert.ok(result.stdout.includes(summary), result.output);
  const config = readJson(unitDir, 'run-config.json');
  const launch = `${LAUNCH_PREFIX} ${expected.join(' ')}`;
  assert.equal(config.runnerCommand, launch.replace('task-0*', "'task-0*'"));
  assert.deepEqual(
    [config.cliVersion, config.judgeModel, config.runs, config.caseGlob, config.generateOnly],
    ['2.1.296', 'judge-x', 2, 'task-0*', false],
  );
  const notStored = ['0.875 [0.477, 1.273]', 'scored now, not stored', '$1.5000'];
  assert.deepEqual(row(result.stdout, 'demo', 'tasks'), notStored);
  assert.match(result.stdout, /\n {2}demo tasks: only the cases of --case ran\n/);
  assert.ok(!existsSync(scoreboard(root)), 'a --case result was stored');
});

test('a triggers run has one arm and no scaffold, and passes the options it was given', () => {
  const root = fixtureRepo('run-triggers');
  writeFileSync(path.join(root, OWN_PATH, 'SKILL.md'), `${SKILL_MD}\nAn uncommitted line.\n`);
  const results = { 'demo-triggers': triggerResult() };
  const env = stubbed('run-triggers', results, { CLAUDE_STUB_VERSION: '3.0.1' });
  const options = ['--effort', 'low', '--model', 'model-x', '--max-cost-usd', '2'];
  const result = invoke(root, ['demo', 'triggers', ...options, '--concurrency', '1'], { env });
  assert.equal(result.code, 0, result.output);
  const unitDir = path.join(lastRunDir(root), 'demo-triggers');
  const [call] = calls(env);
  const expected = [
    `plugin eval ${unitDir}/plugin --runs 1 --ablation none --concurrency 1 --model model-x`,
    // One run at a time: one run at 0.11 is held back from the 2.00.
    '--trust-plugin --no-publish --threshold 0 --max-cost-usd 1.89',
    `--output-dir ${unitDir}/results --json ${unitDir}/result.json --report ${unitDir}/report.html`,
  ];
  assert.equal(call.args.join(' '), expected.join(' '));
  assert.equal(call.effortLevel, 'low');
  const summary = summarize(triggerResult(), { skill: 'demo', mode: 'triggers' });
  assert.equal(read(unitDir, 'summary.txt'), summary);
  const { model, effort, cliVersion } = readJson(scoreboard(root)).demo.triggers.current;
  assert.deepEqual([model, effort, cliVersion], ['model-x', 'low', '3.0.1']);

  // The skill is read from the working tree, so the record names what differs from the commit.
  const config = readJson(unitDir, 'run-config.json');
  assert.deepEqual(config.uncommittedSources, [' M .agents/skills/demo/SKILL.md']);
  assert.match(result.stdout, /note: 1 skill source path\(s\) differ from HEAD/);
  assert.match(read(unitDir, 'plugin', 'skills', 'demo', 'SKILL.md'), /An uncommitted line\.\n$/);

  // A score measured with another setup is another score: the default setup runs it again.
  const again = invoke(root, ['demo', 'triggers'], { env });
  assert.equal(again.code, 0, again.output);
  assert.equal(calls(env).length, 2);
  assert.match(again.stdout, /: the same inputs, scored again\n/);
});

test('fewer runs than the default of the mode are printed and never stored', () => {
  const root = fixtureRepo('fewer-runs');
  const results = { 'demo-tasks': taskResult(), 'demo-triggers': triggerResult() };
  const env = stubbed('fewer-runs', results);
  const result = invoke(root, ['demo', 'tasks', '--runs', '2'], { env });
  assert.equal(result.code, 0, result.output);
  const notStored = ['0.875 [0.477, 1.273]', 'scored now, not stored', '$1.5000'];
  assert.deepEqual(row(result.stdout, 'demo', 'tasks'), notStored);
  const reason = '--runs 2 is fewer than the 3 a stored tasks score has';
  assert.ok(result.stdout.includes(`\n  demo tasks: ${reason}\n`), result.stdout);
  assert.match(result.stdout, /^Skill eval scores, .*, 2 runs per case\)$/m);
  assert.match(result.stdout, /\nLeft: 1 of 1\. Run `just skills-eval` again to continue\.\n/);
  assert.ok(!existsSync(scoreboard(root)), 'a tasks result of two runs was stored');

  // One run per query is the default of triggers, so naming it changes nothing: it is stored.
  const single = invoke(root, ['demo', 'triggers', '--runs', '1'], { env });
  assert.equal(single.code, 0, single.output);
  assert.equal(row(single.stdout, 'demo', 'triggers')[1], 'scored now');
  assert.equal(readJson(scoreboard(root)).demo.triggers.current.runs, 1);
});

test('a partial result is never stored, fails the command and stops the invocation', () => {
  const root = fixtureRepo('partial');
  const partial = triggerResult({ partial: true, partialReason: 'cost_ceiling' });
  const results = { 'demo-triggers': partial, 'other-triggers': twoQueryResult(5) };
  const env = stubbed('partial', results);
  const result = invoke(root, [], { env });
  assert.equal(result.code, 1, result.output);
  assert.equal(calls(env).length, 1);
  const text = read(lastRunDir(root), 'summary.txt');
  const unitSummary = read(lastRunDir(root), 'demo-triggers', 'summary.txt');
  assert.match(unitSummary, /^result: PARTIAL \(cost_ceiling\): /m);
  const stopped = ['-', 'not run: after the failure', '-'];
  assert.deepEqual(row(text, 'demo', 'triggers'), ['-', 'failed', '$1.5000']);
  assert.deepEqual(row(text, 'other', 'triggers'), stopped);
  assert.deepEqual(row(text, 'other', 'tasks'), stopped);
  assert.match(text, /\n {2}demo triggers: the result is partial\n/);
  assert.match(text, /\nTotals: 0 scored now, 0 up to date, 3 not run, 1 failed; \$1\.5000 of /);
  assert.ok(!existsSync(scoreboard(root)), 'a partial result was stored');
});

test('a runner that fails is a failed unit, with or without a result', () => {
  const failed = stubbed('failed', { 'demo-tasks': taskResult() }, { CLAUDE_STUB_EXIT: '1' });
  const withResult = invoke(fixtureRepo('failed'), ['demo', 'tasks'], { env: failed });
  assert.equal(withResult.code, 1, withResult.output);
  assert.match(withResult.output, /Run score per arm/);
  assert.match(withResult.output, /\n {2}demo tasks: the runner exited 1\n/);

  const silentRoot = fixtureRepo('silent');
  const silent = stubbed('silent', {}, { CLAUDE_STUB_EXIT: '1' });
  const noResult = invoke(silentRoot, ['demo'], { env: silent });
  assert.equal(noResult.code, 1, noResult.output);
  assert.equal(calls(silent).length, 1);
  assert.match(noResult.output, /demo triggers: the runner exited 1 and wrote no result\n/);
  const stopped = ['-', 'not run: after the failure', '-'];
  assert.deepEqual(row(noResult.stdout, 'demo', 'triggers'), ['-', 'failed', '-']);
  assert.deepEqual(row(noResult.stdout, 'demo', 'tasks'), stopped);
  assert.ok(!existsSync(scoreboard(silentRoot)));
});

test('a unit that needs more than the whole budget is left, with the budget it needs', () => {
  const root = fixtureRepo('small-budget');
  const env = stubbed('small-budget', { 'other-triggers': twoQueryResult(5) });
  const result = invoke(root, ['--max-cost-usd', '0.6'], { env });
  assert.equal(result.code, 0, result.output);
  // demo-triggers, 3 queries at 0.11 with 3 in flight, needs 0.33 under 0.60 - 0.33. The next one
  // that fits is other-triggers: 2 queries, 0.22 under 0.60 - 0.22.
  const [call, ...more] = calls(env);
  assert.deepEqual([call.unit, ceilingOf(call), more.length], ['other-triggers', '0.38', 0]);
  const text = read(lastRunDir(root), 'summary.txt');
  const inFlight = 'held back for the runs in flight';
  const triggers = `demo triggers: needs about $0.3300 and $0.3300 ${inFlight}, $0.6000 is left`;
  const tasks = `demo tasks: needs about $4.9800 and $2.4900 ${inFlight}, $0.0000 is left`;
  assert.ok(text.includes(`\n  ${triggers}\n`), text);
  assert.ok(text.includes(`\n  ${tasks}\n`), text);
  const left = 'Left: 3 of 4. Run `just skills-eval` again to continue.';
  const hint = 'The largest one needs --max-cost-usd 7.47 or more: it does not fit in $0.6000.';
  assert.ok(text.endsWith(`\n${left} ${hint}\n`), text);
});

test('--case counts only the cases it selects against the budget', () => {
  const root = fixtureRepo('case-budget');
  const env = stubbed('case-budget', { 'demo-tasks': taskResult() });
  // Both tasks need 2 x 1 x 0.83 = 1.66 and as much again in flight. The one that --case
  // selects needs 0.83 and 0.83 in flight, which fits in 2.00.
  const options = ['--runs', '1', '--case', 'task-01', '--max-cost-usd', '2'];
  const result = invoke(root, ['demo', 'tasks', ...options], { env });
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(calls(env).map(ceilingOf), ['1.17']);
  const about = 'about $0.8300 of $2.0000 left; the runner may spend $1.1700';
  assert.ok(
    result.stdout.includes(`\nskills-eval: demo tasks: 1 cases, ${about}\n`),
    result.stdout,
  );
  assert.equal(row(result.stdout, 'demo', 'tasks')[1], 'scored now, not stored');
});

// --- refusals and usage --------------------------------------------------------------------------

const PLAIN = fixtureRepo('plain');

test('a run is refused when claude is not on PATH', () => {
  const result = invoke(PLAIN, ['demo', 'tasks'], { bin: BARE_BIN });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /skills-eval: claude is not on PATH: /);
  assert.match(result.output, NEEDED);
  noRunDir(PLAIN);
});

test('a claude older than 2.1.269 is refused and the runner never starts', () => {
  const env = stubbed('old', {}, { CLAUDE_STUB_VERSION: '2.1.268' });
  const result = invoke(PLAIN, [], { env });
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /skills-eval: claude is 2\.1\.268: /);
  assert.match(result.output, NEEDED);
  assert.deepEqual(calls(env), []);
  noRunDir(PLAIN);
});

test('an unknown skill and a CLAUDE.md without the skill step refuse the invocation', () => {
  const unknown = invoke(PLAIN, ['nope']);
  assert.equal(unknown.code, 1, unknown.output);
  assert.match(unknown.output, /skills-eval: no skill 'nope' under \.agents\/skills/);
  noRunDir(PLAIN);

  const stepRoot = fixtureRepo('no-step', { 'CLAUDE.md': '# Contract\n\n## Session workflow\n' });
  const step = invoke(stepRoot, ['--generate-only']);
  assert.equal(step.code, 1, step.output);
  assert.match(step.output, /CLAUDE\.md: no list item "3\. \*\*Match a skill:\*\*"/);
  noRunDir(stepRoot);
});

test('an eval file the tool cannot use fails that unit only; the others go on', () => {
  const root = fixtureRepo('no-trigger-file', { [TRIGGER_FILE]: null });
  const env = stubbed('no-trigger-file', { 'demo-tasks': taskResult() });
  const missing = invoke(root, ['demo'], { env });
  assert.equal(missing.code, 1, missing.output);
  const units = calls(env).map((call) => call.unit);
  assert.deepEqual(units, ['demo-tasks']);
  assert.ok(missing.stdout.includes(`\n  demo triggers: ${TRIGGER_FILE} does not exist\n`));
  assert.deepEqual(row(missing.stdout, 'demo', 'triggers'), ['-', 'failed', '-']);
  const scored = ['0.875 [0.477, 1.273]', 'scored now', '$1.5000'];
  assert.deepEqual(row(missing.stdout, 'demo', 'tasks'), scored);

  const withFiles = { ...TASKS, evals: [{ ...TASKS.evals[0], files: ['fixtures/a.txt'] }] };
  const filesRoot = fixtureRepo('files', { [EVALS_FILE]: json(withFiles) });
  const files = invoke(filesRoot, ['demo', 'tasks', '--generate-only']);
  assert.equal(files.code, 1, files.output);
  assert.match(files.output, /evals\.json task 1: a non-empty "files" list is not supported/);

  const twice = { ...TASKS, evals: [TASKS.evals[0], { ...TASKS.evals[1], id: 1 }] };
  const sameIdRoot = fixtureRepo('same-id', { [EVALS_FILE]: json(twice) });
  const sameId = invoke(sameIdRoot, ['demo', 'tasks']);
  assert.equal(sameId.code, 1, sameId.output);
  assert.match(sameId.output, /two cases would be named task-01: task ids must be unique/);
});

test('usage errors exit 2 with the usage line', () => {
  const cases = [
    [['demo', 'tasks', 'more'], /give at most one skill name and one mode/],
    [['demo', 'scores'], /the mode must be tasks or triggers, got 'scores'/],
    [['../demo', 'tasks'], /'\.\.\/demo' is not a skill name/],
    [['demo', '--case', 'task-01'], /--case selects the cases of one skill and mode/],
    [['all', 'tasks', '--case', 'task-01'], /--case selects the cases of one skill and mode/],
    [['demo', 'tasks', '--runs', '0'], /--runs must be a whole number from 1 to 50, got '0'/],
    [['demo', 'tasks', '--concurrency', '9'], /--concurrency must be a whole number from 1 to 8/],
    [['demo', 'tasks', '--effort', 'extreme'], /--effort must be one of low, medium, high/],
    [['demo', 'tasks', '--max-cost-usd', 'lots'], /--max-cost-usd must be a positive number/],
    [['demo', 'tasks', '--publish'], /unknown option '--publish'/],
    [['demo', 'tasks', '--model'], /--model needs a value/],
  ];
  for (const [args, message] of cases) {
    const result = invoke(PLAIN, args);
    assert.equal(result.code, 2, `${args.join(' ')}: ${result.output}`);
    assert.match(result.output, message);
    assert.match(result.output, /\nusage: just skills-eval \[skill\|all\] \[tasks\|triggers\] /);
  }
  noRunDir(PLAIN);
});
