// Unit tests for the scoreboard of `just skills-eval` (tools/skills-eval/scoreboard.mjs): the two
// hash rules, what counts as up to date, the cost estimate, the ceiling the runner gets, which
// results may be stored, and the three verdicts. Synthetic skill trees in a temporary directory and the synthetic results of
// tests/results.mjs. Run by scripts/test/skills-eval.test.sh.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  entryFrom,
  estimateUsd,
  isUpToDate,
  readScoreboard,
  record,
  runnerBudget,
  unitHash,
  unstorable,
  verdict,
  writeScoreboard,
} from '../scoreboard.mjs';
import { run, taskResult, triggerResult, twoQueryResult } from './results.mjs';

const SCRATCH = mkdtempSync(path.join(tmpdir(), 'skills-eval-scoreboard-'));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

const DEMO = '.agents/skills/demo';
const OTHER = '.agents/skills/other';
const QUERIES = `${DEMO}/evals/trigger-evals.json`;
const SETUP = { model: 'model-x', effort: 'high' };

function skillMd(name, description, body = 'Body.', reviewed = '2026-10-01') {
  const metadata = `metadata:\n  last-reviewed: ${reviewed}`;
  return `---\nname: ${name}\ndescription: ${description}\n${metadata}\n---\n\n${body}\n`;
}

const FILES = {
  [`${DEMO}/SKILL.md`]: skillMd('demo', 'Tidy text files.'),
  [`${DEMO}/references/guide.md`]: '# Guide\n',
  [`${DEMO}/evals/evals.json`]: '{ "evals": [] }\n',
  [QUERIES]: '[]\n',
  [`${OTHER}/SKILL.md`]: skillMd('other', 'The other thing.'),
  [`${OTHER}/evals/trigger-evals.json`]: '[]\n',
};

let trees = 0;

/** Both hashes of the skill `demo` in a fresh copy of FILES with `change` laid over it. */
function hashes(change = {}, systemPrompt = 'the prompt') {
  trees += 1;
  const root = path.join(SCRATCH, `tree-${trees}`);
  for (const [file, text] of Object.entries({ ...FILES, ...change })) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  const unit = { root, skill: 'demo', skills: ['demo', 'other'], systemPrompt };
  return {
    tasks: unitHash({ ...unit, mode: 'tasks' }),
    triggers: unitHash({ ...unit, mode: 'triggers' }),
  };
}

function assertNear(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 5e-4, `${actual} is not about ${expected}`);
}

test('a tasks hash covers the skill directory and the prompt, and nothing of routing', () => {
  const base = hashes();
  assert.match(base.tasks, /^sha256:[0-9a-f]{64}$/);
  assert.equal(hashes().tasks, base.tasks);
  for (const file of ['SKILL.md', 'references/guide.md', 'evals/evals.json']) {
    assert.notEqual(hashes({ [`${DEMO}/${file}`]: 'changed\n' }).tasks, base.tasks, file);
  }
  assert.notEqual(hashes({ [`${DEMO}/references/more.md`]: 'added\n' }).tasks, base.tasks);
  assert.notEqual(hashes({}, 'another prompt').tasks, base.tasks);
  // Not its trigger queries, and not another skill.
  assert.equal(hashes({ [QUERIES]: '[1]\n' }).tasks, base.tasks);
  assert.equal(hashes({ [`${OTHER}/SKILL.md`]: skillMd('other', 'Changed.') }).tasks, base.tasks);
});

test('a triggers hash covers the queries and the name and description of every skill', () => {
  const base = hashes();
  const otherSkill = (...parts) => hashes({ [`${OTHER}/SKILL.md`]: skillMd(...parts) }).triggers;
  assert.notEqual(hashes({ [QUERIES]: '[1]\n' }).triggers, base.triggers);
  assert.notEqual(otherSkill('other', 'A changed description.'), base.triggers);
  assert.notEqual(otherSkill('renamed', 'The other thing.'), base.triggers);
  assert.notEqual(otherSkill('other', '>-\n  The other\n  thing.'), base.triggers);
  assert.notEqual(hashes({}, 'another prompt').triggers, base.triggers);
  // Not another skill's body or review date, and not this skill's tasks or references.
  assert.equal(otherSkill('other', 'The other thing.', 'A new body.'), base.triggers);
  assert.equal(otherSkill('other', 'The other thing.', 'Body.', '2026-10-12'), base.triggers);
  assert.equal(hashes({ [`${DEMO}/evals/evals.json`]: '{}\n' }).triggers, base.triggers);
  assert.equal(hashes({ [`${DEMO}/references/guide.md`]: 'changed\n' }).triggers, base.triggers);
});

test('a folded description is hashed with its continuation lines', () => {
  const folded = (last) => `>-\n  The other\n  ${last}`;
  const first = hashes({ [`${OTHER}/SKILL.md`]: skillMd('other', folded('thing.')) }).triggers;
  const second = hashes({ [`${OTHER}/SKILL.md`]: skillMd('other', folded('matter.')) }).triggers;
  assert.notEqual(first, second);
});

test('a stored score is up to date for the same hash, model, judge and effort only', () => {
  const entry = { hash: 'sha256:a', model: 'model-x', judgeModel: null, effort: 'high' };
  assert.equal(isUpToDate(entry, 'sha256:a', SETUP), true);
  assert.equal(isUpToDate(undefined, 'sha256:a', SETUP), false);
  assert.equal(isUpToDate(entry, 'sha256:b', SETUP), false);
  assert.equal(isUpToDate(entry, 'sha256:a', { ...SETUP, model: 'model-y' }), false);
  assert.equal(isUpToDate(entry, 'sha256:a', { ...SETUP, effort: 'low' }), false);
  assert.equal(isUpToDate(entry, 'sha256:a', { ...SETUP, judgeModel: 'judge-x' }), false);
});

test('the estimate uses the own record, then the mode mean, then the constants', () => {
  const stored = (costPerCaseRunUsd) => ({ triggers: { current: { costPerCaseRunUsd } } });
  const demo = { skill: 'demo', mode: 'triggers' };
  // No record: 0.83 per task case run (both arms), 0.11 per trigger run.
  assertNear(estimateUsd({}, { skill: 'demo', mode: 'tasks' }, 4, 3), 9.96);
  assertNear(estimateUsd({}, demo, 20, 1), 2.2);
  // Records of other skills: their mean, (0.05 + 0.07) / 2 = 0.06 a run.
  assertNear(estimateUsd({ a: stored(0.05), b: stored(0.07) }, demo, 20, 1), 1.2);
  assertNear(estimateUsd({ a: stored(0.05) }, { skill: 'demo', mode: 'tasks' }, 4, 3), 9.96);
  // Its own record wins: 0.04 a run.
  assertNear(estimateUsd({ a: stored(0.05), demo: stored(0.04) }, demo, 20, 1), 0.8);
});

test('the runner gets what is left minus the runs that can be in flight', () => {
  const near = ({ reserveUsd, ceilingUsd, fits }, expected) => {
    assertNear(reserveUsd, expected.reserveUsd);
    assertNear(ceilingUsd, expected.ceilingUsd);
    assert.equal(fits, expected.fits);
  };
  // An example: 20 runs at 0.13 each, 3 at once. 3 x 0.13 is held back, 2.60 fits under 2.61.
  const unit = { estimateUsd: 2.6, caseRuns: 20, concurrency: 3 };
  const whole = runnerBudget({ ...unit, remainingUsd: 3 });
  near(whole, { reserveUsd: 0.39, ceilingUsd: 2.61, fits: true });
  assert.equal(whole.estimateUsd, 2.6);
  // The worst case stays inside what is left: the ceiling plus every run in flight.
  assertNear(whole.ceilingUsd + whole.reserveUsd, 3);
  // The estimate is below what is left but above the ceiling: the runner would stop early.
  near(runnerBudget({ ...unit, remainingUsd: 2.9 }), {
    reserveUsd: 0.39,
    ceilingUsd: 2.51,
    fits: false,
  });
  // Nothing is left for the runner once the runs in flight are held back.
  near(runnerBudget({ ...unit, remainingUsd: 0.3 }), {
    reserveUsd: 0.39,
    ceilingUsd: -0.09,
    fits: false,
  });
  // One run at a time holds back one run; more at once than the unit has holds back all of it.
  near(runnerBudget({ ...unit, concurrency: 1, remainingUsd: 3 }), {
    reserveUsd: 0.13,
    ceilingUsd: 2.87,
    fits: true,
  });
  near(runnerBudget({ estimateUsd: 0.26, caseRuns: 2, concurrency: 3, remainingUsd: 1 }), {
    reserveUsd: 0.26,
    ceilingUsd: 0.74,
    fits: true,
  });
  // A task case run is both arms: 3 tasks x 3 runs at 0.83 hold back 3 x 0.83.
  near(runnerBudget({ estimateUsd: 7.47, caseRuns: 9, concurrency: 3, remainingUsd: 10 }), {
    reserveUsd: 2.49,
    ceilingUsd: 7.51,
    fits: true,
  });
  // No case selected: nothing to hold back.
  near(runnerBudget({ estimateUsd: 0, caseRuns: 0, concurrency: 3, remainingUsd: 1 }), {
    reserveUsd: 0,
    ceilingUsd: 1,
    fits: true,
  });
});

test('only a complete measurement with the runs of its mode may be stored', () => {
  const complete = {
    result: twoQueryResult(5),
    exitCode: 0,
    expectedCases: 2,
    caseGlob: undefined,
    mode: 'triggers',
    runs: 1,
  };
  const refused = (change) => unstorable({ ...complete, ...change });
  assert.equal(unstorable(complete), null);
  assert.equal(refused({ result: twoQueryResult(5, { partial: true }) }), 'the result is partial');
  assert.equal(refused({ exitCode: 1 }), 'the runner exited 1');
  assert.equal(refused({ expectedCases: 3 }), '1 of 3 cases did not load');
  assert.equal(refused({ caseGlob: 'trigger-01*' }), 'only the cases of --case ran');
  // One run per case is what a trigger score has; a task score has three.
  const tasks = { result: taskResult(), mode: 'tasks' };
  assert.equal(refused({ ...tasks, runs: 3 }), null);
  assert.equal(refused({ ...tasks, runs: 5 }), null);
  const tooFew = '--runs 2 is fewer than the 3 a stored tasks score has';
  assert.equal(refused({ ...tasks, runs: 2 }), tooFew);
  const errored = [run(0, { error: 'timed out after 180s' })];
  const cases = [{ name: 'trigger-01-yes', maxTurns: 1, arms: { with: errored } }];
  const unscored = triggerResult({ cases });
  assert.equal(refused({ result: unscored, expectedCases: 1 }), 'a case has no scored run');
  // The turn cap is how a trigger run ends: such a run is scored. In a task run it is an error.
  const capped = [run(1, { error: 'exit 1: Reached maximum number of turns (1)' })];
  const routed = [{ name: 'trigger-01-yes', maxTurns: 1, arms: { with: capped } }];
  assert.equal(refused({ result: triggerResult({ cases: routed }), expectedCases: 1 }), null);
  const cut = [{ name: 'task-01', maxTurns: 15, arms: { with: capped, without: [run(0)] } }];
  const cutTask = { result: taskResult({ cases: cut }), mode: 'tasks', runs: 3, expectedCases: 1 };
  assert.equal(refused(cutTask), 'a case has no scored run');
});

test('an entry records the score, its interval and what it was measured with', () => {
  const entry = entryFrom({
    result: taskResult(),
    mode: 'tasks',
    hash: 'sha256:a',
    setup: SETUP,
    cliVersion: '2.1.296',
    gitSha: 'abc123',
    date: '2026-10-12',
    runs: 2,
  });
  const { interval, withoutSkill, ...plain } = entry;
  assert.deepEqual(plain, {
    hash: 'sha256:a',
    date: '2026-10-12',
    model: 'model-x',
    judgeModel: null,
    effort: 'high',
    cliVersion: '2.1.296',
    gitSha: 'abc123',
    cases: 2,
    runs: 2,
    score: 0.875,
    n: 4,
    costUsd: 1.5,
    costPerCaseRunUsd: 0.375,
  });
  assertNear(interval.low, 0.47725);
  assertNear(interval.high, 1.27275);
  assert.equal(withoutSkill.score, 0.3125);
});

test('the scoreboard keeps the previous entry beside the current one, in a stable file', () => {
  const unit = { skill: 'demo', mode: 'triggers' };
  const entry = (hash) => ({ hash, score: 0.9, interval: { low: 0.8, high: 1 } });
  const once = record({}, unit, entry('sha256:a'));
  assert.deepEqual(once, { demo: { triggers: { current: entry('sha256:a') } } });
  const twice = record(once, unit, entry('sha256:b'));
  const thrice = record(twice, unit, entry('sha256:c'));
  const slot = { current: entry('sha256:c'), previous: entry('sha256:b') };
  assert.deepEqual(thrice, { demo: { triggers: slot } });

  const withTasks = record(thrice, { skill: 'demo', mode: 'tasks' }, entry('sha256:t'));
  const board = record(withTasks, { skill: 'alpha', mode: 'tasks' }, entry('sha256:u'));
  const file = path.join(SCRATCH, 'board', 'scoreboard.json');
  writeScoreboard(file, board);
  const text = readFileSync(file, 'utf8');
  assert.deepEqual(readScoreboard(file), board);
  // Prettier keeps objects as written but would refold an array: none may appear.
  assert.ok(!text.includes('['), text);
  assert.equal(text, `${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  assert.deepEqual(Object.keys(JSON.parse(text)), ['alpha', 'demo']);
  assert.deepEqual(Object.keys(JSON.parse(text).demo), ['tasks', 'triggers']);
  assert.deepEqual(readScoreboard(path.join(SCRATCH, 'none.json')), {});
});

test('the verdict is better, worse, or no measurable change inside the combined interval', () => {
  const score = (value, reach) => {
    return { score: value, interval: { low: value - reach, high: value + reach } };
  };
  // Each interval reaches 0.1, so the two combined reach sqrt(0.1^2 + 0.1^2) = 0.1414.
  const better = verdict(score(0.5, 0.1), score(0.8, 0.1));
  assert.equal(better.word, 'better');
  assertNear(better.difference, 0.3);
  assertNear(better.interval, 0.1414);
  assert.equal(verdict(score(0.8, 0.1), score(0.5, 0.1)).word, 'worse');
  assert.equal(verdict(score(0.5, 0.1), score(0.6, 0.1)).word, 'no measurable change');
  assert.equal(verdict(score(0.6, 0.1), score(0.5, 0.1)).word, 'no measurable change');
  // A rate of 1 has a one-sided interval: its reach is the rule-of-three bound, here 0.05.
  const perfect = { score: 1, interval: { low: 0.95, high: 1 } };
  assertNear(verdict(perfect, score(0.9, 0.03)).interval, Math.hypot(0.05, 0.03));
  assert.equal(verdict(perfect, score(0.9, 0.03)).word, 'worse');
});
