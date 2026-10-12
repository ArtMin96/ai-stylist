// Unit tests for the case text `just skills-eval` generates (tools/skills-eval/cases.mjs), on
// synthetic eval entries. Run by scripts/test/skills-eval.test.sh.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  expectsNoTrigger,
  READ_ONLY_NOTE,
  RefusalError,
  scaffoldScript,
  shellQuote,
  skillStepText,
  systemPromptFor,
  taskCase,
  triggerCase,
} from '../cases.mjs';
import { assertLoadableCase, parseFrontmatter } from './case-format.mjs';

const SKILL_DIR = '/runs/r1/plugin/skills/demo';
const OWN_FILE = '.agents/skills/demo/references/guide.md';
const STEP = '**Match a skill:** follow the skill that covers the task.';
const SYSTEM_PROMPT = systemPromptFor('tasks', STEP);
const SCAFFOLD = scaffoldScript('/runs/r1/snapshot.tar');
const VERDICT =
  'PASS if the statement is true of the response. FAIL if it is false or the response is empty.';
const TASK_INPUTS = {
  skill: 'demo',
  skillDir: SKILL_DIR,
  systemPrompt: SYSTEM_PROMPT,
  scaffold: SCAFFOLD,
};

function demoTask(change = {}) {
  return {
    id: 2,
    prompt: 'Tidy `src/app.txt`.\n\nKeep the "quoted" word: it\'s needed.',
    expected_output: 'A tidy file.',
    files: [],
    assertions: [`The reply cites ${OWN_FILE} only`, 'The reply shows the whole file'],
    ...change,
  };
}

const buildTask = (change) => taskCase({ ...TASK_INPUTS, task: demoTask(change) });

test('step 3 of the session workflow is quoted as one line, without its number', () => {
  const claudeMd = [
    '# Contract',
    '',
    '## Session workflow',
    '',
    '2. **Restate** the task.',
    '3. **Match a skill:** if a skill covers the task type,',
    '   follow its workflow.',
    '4. **Verify** the result.',
    '',
    '## Later',
    '',
    '3. **Match a skill:** a decoy outside the section.',
  ].join('\n');
  const expected = '**Match a skill:** if a skill covers the task type, follow its workflow.';
  assert.equal(skillStepText(claudeMd), expected);
});

test('a CLAUDE.md without that step under "Session workflow" is refused', () => {
  const missing = '## Session workflow\n\n1. **Orient:** read.\n';
  const elsewhere = `${missing}\n## Other\n\n3. **Match a skill:** in the wrong section.\n`;
  assert.throws(() => skillStepText(missing), RefusalError);
  assert.throws(() => skillStepText(elsewhere), /no list item "3\. \*\*Match a skill:\*\*"/);
});

test('tasks are told the skill step and that they cannot edit; triggers the step only', () => {
  assert.equal(systemPromptFor('tasks', STEP), `${STEP}\n\n${READ_ONLY_NOTE}`);
  assert.equal(systemPromptFor('triggers', STEP), STEP);
  assert.match(READ_ONLY_NOTE, /^You cannot edit files or run commands in this environment\. /);
});

test('a task becomes a loadable case: prompt verbatim, read-only tools, both prompt parts', () => {
  const { name, files } = buildTask();
  assertLoadableCase(files);
  const { fields, body } = parseFrontmatter(files['prompt.md']);
  assert.equal(name, 'task-02');
  assert.equal(body, `${demoTask().prompt}\n`);
  assert.deepEqual(fields, {
    name: 'task-02',
    description: 'demo evals.json task 2',
    expected_outcome: 'A tidy file.',
    max_turns: 15,
    timeout_seconds: 600,
    allowed_tools: ['Read', 'Glob', 'Grep', 'Skill'],
    append_system_prompt: SYSTEM_PROMPT,
  });
  assert.equal(files['scaffold.sh'], SCAFFOLD);
  const caseYaml =
    'schema_version: "1.1"\nname: "task-02"\ncontext:\n  scaffold_script: scaffold.sh\n';
  assert.equal(files['case.yaml'], caseYaml);
  assert.deepEqual(Object.keys(files).sort(), [
    'case.yaml',
    'graders/check-01.md',
    'graders/check-02.md',
    'graders/skill-fired.md',
    'prompt.md',
    'scaffold.sh',
  ]);
});

test("an assertion that names the skill's own files is with-only, with the path note", () => {
  const { fields, body } = parseFrontmatter(buildTask().files['graders/check-01.md']);
  assert.deepEqual(fields, { type: 'llm', arm: 'with-only' });
  const note =
    `In this run \`.agents/skills/demo/\` is \`${SKILL_DIR}/\`. A reference to a file under ` +
    'either path, or to that file by its name, is the same file.';
  const rubric = ['', `Statement: The reply cites ${OWN_FILE} only`, '', VERDICT, '', note, ''];
  assert.equal(body, rubric.join('\n'));
});

test('any other assertion is scored in both arms, its text verbatim in the rubric', () => {
  const assertions = ['The reply shows the whole file', 'It cites .agents/skills/other/x.md'];
  const { files } = buildTask({ assertions });
  assertions.forEach((assertion, i) => {
    const { fields, body } = parseFrontmatter(files[`graders/check-0${i + 1}.md`]);
    assert.deepEqual(fields, { type: 'llm' });
    assert.equal(body, `\nStatement: ${assertion}\n\n${VERDICT}\n`);
  });
});

test('every task case has the skill-fired indicator: a Skill call for this skill', () => {
  const { fields } = parseFrontmatter(buildTask().files['graders/skill-fired.md']);
  assert.deepEqual(Object.keys(fields), ['type', 'tool', 'input_match']);
  assert.equal(fields.tool, 'Skill');
  const pattern = new RegExp(fields.input_match);
  assert.ok(pattern.test('{"skill": "skills-eval:demo"}'));
  assert.ok(pattern.test('{"skill":"demo","args":""}'));
  assert.ok(!pattern.test('{"skill": "skills-eval:demo-extra"}'));
  assert.ok(!pattern.test('{"skill": "other"}'));
});

test('a task with a non-empty "files" list is refused', () => {
  const refusal = /evals\.json task 2: a non-empty "files" list is not supported/;
  assert.throws(() => buildTask({ files: ['fixtures/a.txt'] }), RefusalError);
  assert.throws(() => buildTask({ files: ['fixtures/a.txt'] }), refusal);
});

test('a task without a prompt or without an assertion is refused', () => {
  assert.throws(() => buildTask({ prompt: ' ' }), RefusalError);
  assert.throws(() => buildTask({ assertions: [] }), /at least one assertion/);
});

test('a should-trigger query passes on a Skill call for the skill; only Skill is allowed', () => {
  const entry = { query: 'tidy this file for me', should_trigger: true, _teaches: 'a synonym' };
  const inputs = { skill: 'demo', index: 3, entry, systemPrompt: STEP };
  const { name, files } = triggerCase(inputs);
  assertLoadableCase(files);
  assert.equal(name, 'trigger-03-yes');
  assert.equal(expectsNoTrigger(name), false);
  assert.deepEqual(Object.keys(files), ['prompt.md', 'graders/skill-fired.md']);
  const prompt = parseFrontmatter(files['prompt.md']);
  assert.equal(prompt.body, 'tidy this file for me\n');
  assert.deepEqual(prompt.fields, {
    name: 'trigger-03-yes',
    description: 'demo trigger query 3: should trigger',
    max_turns: 1,
    timeout_seconds: 180,
    allowed_tools: ['Skill'],
    append_system_prompt: STEP,
  });
  const grader = parseFrontmatter(files['graders/skill-fired.md']).fields;
  assert.deepEqual(Object.keys(grader), ['type', 'tool', 'input_match']);
});

test('a should-not-trigger query passes only when Skill is never called for the skill', () => {
  const entry = { query: 'what is the weather', should_trigger: false, _near_miss_reason: 'x' };
  const inputs = { skill: 'demo', index: 12, entry, systemPrompt: STEP };
  const { name, files } = triggerCase(inputs);
  assertLoadableCase(files);
  assert.equal(name, 'trigger-12-no');
  assert.equal(expectsNoTrigger(name), true);
  assert.deepEqual(Object.keys(files), ['prompt.md', 'graders/skill-not-fired.md']);
  const grader = parseFrontmatter(files['graders/skill-not-fired.md']).fields;
  assert.equal(grader.tool, 'Skill');
  assert.ok(new RegExp(grader.input_match).test('{"skill": "skills-eval:demo"}'));
  assert.equal(grader.min, 0);
  assert.equal(grader.max, 0);
});

test('a trigger entry without a query or without a true or false is refused', () => {
  const inputs = { skill: 'demo', index: 1, systemPrompt: STEP };
  const noQuery = { query: '', should_trigger: true };
  const noVerdict = { query: 'tidy this file', should_trigger: 'yes' };
  assert.throws(() => triggerCase({ ...inputs, entry: noQuery }), /"query" must be/);
  assert.throws(() => triggerCase({ ...inputs, entry: noVerdict }), /"should_trigger" must be/);
});

test('the scaffold script unpacks the snapshot by its quoted absolute path', () => {
  assert.equal(shellQuote('/runs/r1/snapshot.tar'), '/runs/r1/snapshot.tar');
  const quoted = `'/runs/it'\\''s here/s.tar'`;
  assert.equal(shellQuote("/runs/it's here/s.tar"), quoted);
  const lines = scaffoldScript("/runs/it's here/s.tar").split('\n');
  assert.deepEqual(lines.slice(-3), ['set -euo pipefail', `tar -xf ${quoted}`, '']);
});
