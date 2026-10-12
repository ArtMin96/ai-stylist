// Unit tests for the summary of `just skills-eval` (tools/skills-eval/summary.mjs) on the synthetic
// results of tests/results.mjs. Every expected number was worked out by hand from the scores listed
// there, with the t values of a printed table. Run by scripts/test/skills-eval.test.sh.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  differenceOfMeans,
  everyCaseScored,
  meanInterval,
  rateInterval,
  summarize,
  tCritical,
  unitScore,
} from '../summary.mjs';
import { run, taskResult, triggerResult, twoQueryResult } from './results.mjs';

const WITH = [1, 1, 1, 0.5];
const WITHOUT = [0.5, 0.5, 0.25, 0];

function assertNear(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 5e-4, `${actual} is not about ${expected}`);
}

test('t critical values: the table, and the nearest lower row above 30', () => {
  // 3.182 (df 3) and 2.201 (df 11) are the two constants the 2026-10-12 pilot used.
  assert.equal(tCritical(1), 12.706);
  assert.equal(tCritical(3), 3.182);
  assert.equal(tCritical(11), 2.201);
  assert.equal(tCritical(30), 2.042);
  assert.equal(tCritical(39), 2.042);
  assert.equal(tCritical(40), 2.021);
  assert.equal(tCritical(60), 2.0);
  assert.equal(tCritical(119), 2.0);
  assert.equal(tCritical(5000), 1.98);
});

test('a mean has a t interval from two values on, and none from one', () => {
  // mean 0.875, sd 0.25, t(3) = 3.182: 3.182 * 0.25 / sqrt(4) = 0.39775
  const four = meanInterval(WITH);
  assert.equal(four.center, 0.875);
  assertNear(four.halfWidth, 0.39775);
  assert.deepEqual(meanInterval([0.7]), { center: 0.7, halfWidth: null });
});

test('a difference of two arms uses the unpooled standard error and the smaller n - 1', () => {
  // variances 0.0625 and 0.171875 / 3; se = sqrt(0.0625 / 4 + 0.0572917 / 4) = 0.173055
  // t(3) = 3.182: half-width 0.55066
  const both = differenceOfMeans(WITH, WITHOUT);
  assert.equal(both.diff, 0.5625);
  assertNear(both.halfWidth, 0.55066);
  assert.deepEqual(differenceOfMeans([1], [0, 1]), { diff: 0.5, halfWidth: null });
});

test('a pass rate has the half-width of planning/13 §10, and the rule of three at 0 or 1', () => {
  // 7 of 8: 1.96 * sqrt(0.875 * 0.125 / 8) = 0.22918
  const some = rateInterval(7, 8);
  assert.equal(some.rate, 0.875);
  assertNear(some.halfWidth, 0.22918);
  assert.deepEqual(rateInterval(4, 4), { rate: 1, bound: 0.75 });
  assert.deepEqual(rateInterval(0, 2), { rate: 0, bound: 1 });
});

test('tasks: per-task scores, each arm and both differences with n and interval', () => {
  const inside = 'INSIDE its interval: noise, not a result (a tie, planning/13 §10)';
  const byRuns = '+0.563, n=4 and 4, 95% interval [+0.012, +1.113] (half-width 0.551)';
  const byCases = '+0.563, n=2, 95% interval [-0.232, +1.357] (half-width 0.794)';
  const expected = [
    'skills-eval: demo tasks, with and without the skill',
    'result: complete',
    'runner: Claude Code 2.1.296, 2 cases, 8 runs, 60 s, $1.5000 in total',
    '',
    'Per task: mean score of the scored runs. "fired" counts the with-skill runs that called the',
    'Skill tool for this skill: an indicator, never part of a score. "runs" is with+without.',
    '  task     with   without  delta   fired  runs',
    '  task-01  1.000  0.500    +0.500  2/2    2+2',
    '  task-02  0.750  0.125    +0.625  2/2    2+2',
    '',
    'Run score per arm (runs as the sample)',
    '  with skill:    0.875, n=4, 95% interval [0.477, 1.273] (half-width 0.398)',
    '  without skill: 0.313, n=4, 95% interval [-0.068, 0.693] (half-width 0.381)',
    '',
    'Difference, with minus without',
    `  runs as the sample:  ${byRuns}: outside its interval`,
    `  cases as the sample: ${byCases}: ${inside}`,
    '',
    'Cost',
    '  with skill:    $0.2000 per run, $0.0100 of it for the judges (n=4)',
    '  without skill: $0.1000 per run, $0.0100 of it for the judges (n=4)',
    '',
    'Runs left out of every number above (errored, or judges skipped): 0',
    'Errored runs that the turn cap (max_turns) ended: 0',
    '',
  ];
  assert.equal(summarize(taskResult(), { skill: 'demo', mode: 'tasks' }), expected.join('\n'));
});

test('tasks: one run per arm gives a difference and says it has no interval', () => {
  const single = [{ name: 'task-01', maxTurns: 15, arms: { with: [run(1)], without: [run(0)] } }];
  const text = summarize(taskResult({ cases: single }), { skill: 'demo', mode: 'tasks' });
  const lines = text.split('\n');
  const none = 'no interval below two values';
  assert.ok(lines.includes('  with skill:    1.000, n=1: no interval from a single run'), text);
  assert.ok(lines.includes(`  runs as the sample:  +1.000, n=1 and 1: ${none}`), text);
  assert.ok(lines.includes(`  cases as the sample: +1.000, n=1: ${none}`), text);
});

test('tasks: an errored run and a run without its judges are listed, never averaged in', () => {
  const result = taskResult();
  const own = result.cases[0].arms.with;
  own.push(run(0, { error: 'scaffold failed (exit 1):\n  tar: no such file' }));
  own.push(run(0, { skippedPaidGraders: true }));
  own.push(run(0, { error: 'exit 1: Reached maximum number of turns (15)', turns: 15 }));
  // The runner's `turns` also counts tool results: 20 at max_turns 15 is a run that was not cut off.
  result.cases[0].arms.without[0].turns = 20;
  const text = summarize(result, { skill: 'demo', mode: 'tasks' });
  const listed = [
    'Runs left out of every number above (errored, or judges skipped): 3',
    '  task-01 with run 3: scaffold failed (exit 1): tar: no such file',
    '  task-01 with run 4: judges skipped at the cost ceiling',
    '  task-01 with run 5: exit 1: Reached maximum number of turns (15)',
    'Errored runs that the turn cap (max_turns) ended: 1',
    '  task-01 with run 5',
    '',
  ];
  assert.ok(text.includes('  task-01  1.000  0.500    +0.500  2/2    2+2\n'), text);
  assert.ok(text.includes('  with skill:    0.875, n=4,'), text);
  assert.ok(text.endsWith(listed.join('\n')), text);
});

test('the headline score of a tasks result is the mean run score with the skill', () => {
  // The same numbers as in the summary: 0.875 +- 0.39775 with, 0.3125 +- 0.38082 without.
  const { score, interval, n, withoutSkill } = unitScore(taskResult(), 'tasks');
  assert.deepEqual([score, n], [0.875, 4]);
  assertNear(interval.low, 0.47725);
  assertNear(interval.high, 1.27275);
  assert.deepEqual([withoutSkill.score, withoutSkill.n], [0.3125, 4]);
  assertNear(withoutSkill.interval.low, -0.06832);
  assertNear(withoutSkill.interval.high, 0.69332);
});

test('the headline score of a triggers result is the pass rate of the scored runs', () => {
  // 7 of 8 scored runs: 0.875 +- 0.22918.
  const some = unitScore(triggerResult(), 'triggers');
  assert.deepEqual([some.score, some.n, some.passed], [0.875, 8, 7]);
  assertNear(some.interval.low, 0.64582);
  assertNear(some.interval.high, 1.10418);
  // At 1 and at 0 the interval is one-sided, the rule of three: 3 / 6 = 0.5.
  const every = { score: 1, interval: { low: 0.5, high: 1 }, n: 6, passed: 6 };
  const none = { score: 0, interval: { low: 0, high: 0.5 }, n: 6, passed: 0 };
  assert.deepEqual(unitScore(twoQueryResult(6), 'triggers'), every);
  assert.deepEqual(unitScore(twoQueryResult(0), 'triggers'), none);
});

test('a score has no interval from one run, and a case can be left without a scored run', () => {
  const single = [{ name: 'task-01', maxTurns: 15, arms: { with: [run(1)], without: [run(0)] } }];
  const score = unitScore(taskResult({ cases: single }), 'tasks');
  assert.deepEqual([score.score, score.interval, score.n], [1, null, 1]);
  assert.equal(everyCaseScored(taskResult(), 'tasks'), true);
  const failed = [run(0, { error: 'timed out after 180s' })];
  const unscored = [{ name: 'trigger-01-yes', maxTurns: 4, arms: { with: failed } }];
  assert.equal(everyCaseScored(triggerResult({ cases: unscored }), 'triggers'), false);
  assert.equal(unitScore(triggerResult({ cases: unscored }), 'triggers').score, null);
});

test('a partial result says so before any number', () => {
  const result = taskResult({ partial: true, partialReason: 'cost_ceiling' });
  const lines = summarize(result, { skill: 'demo', mode: 'tasks' }).split('\n');
  const stopped = 'the runner stopped early, so the numbers cover only the runs it finished';
  assert.equal(lines[1], `result: PARTIAL (cost_ceiling): ${stopped}`);
});

test('triggers: per-query passes and the three pass rates with N, n and half-width', () => {
  const ruleOfThree = 'the failure rate is below 3/N = 0.750 (rule of three, 95%)';
  const expected = [
    'skills-eval: demo triggers, routing among all skills',
    'result: complete',
    'runner: Claude Code 2.1.296, 3 cases, 9 runs, 60 s, $1.5000 in total',
    '',
    'Per query: scored runs that passed. A run passes when it calls the Skill tool for the skill',
    '(expected "trigger") or never calls it for the skill (expected "no trigger").',
    '  query           expected    passed',
    '  trigger-01-yes  trigger     2/2',
    '  trigger-02-yes  trigger     1/2',
    '  trigger-03-no   no trigger  4/4',
    '',
    'Pass rate (N = scored runs, n = cases)',
    '  overall:            0.875, N=8, n=3, 95% half-width 0.229',
    '  should trigger:     0.750, N=4, n=2, 95% half-width 0.424',
    `  should not trigger: 1.000, N=4, n=1: no failure seen, so ${ruleOfThree}`,
    '',
    'Cost',
    '  each run: $0.2000 per run, $0.0100 of it for the judges (n=9)',
    '',
    'Runs left out of every number above (errored, or judges skipped): 1',
    '  trigger-02-yes run 3: timed out after 180s',
    'Runs that ended at the turn cap (max_turns), their verdict counted: 0',
    '',
  ];
  const text = summarize(triggerResult(), { skill: 'demo', mode: 'triggers' });
  assert.equal(text, expected.join('\n'));
});

test('triggers: a run that the turn cap ended is counted, any other error is left out', () => {
  // A trigger run has one turn: the cap ends every run that called a tool in it.
  const capped = (score) => run(score, { error: 'exit 1: Reached maximum number of turns (1)' });
  const cases = [
    { name: 'trigger-01-yes', maxTurns: 1, arms: { with: [capped(1)] } },
    { name: 'trigger-02-yes', maxTurns: 1, arms: { with: [capped(0)] } },
    { name: 'trigger-03-no', maxTurns: 1, arms: { with: [run(1)] } },
    { name: 'trigger-04-no', maxTurns: 1, arms: { with: [run(0, { error: 'timed out' })] } },
  ];
  const result = triggerResult({ cases });
  const score = unitScore(result, 'triggers');
  assert.deepEqual([score.score, score.n, score.passed], [0.6667, 3, 2]);
  assert.equal(everyCaseScored(result, 'triggers'), false);
  assert.equal(everyCaseScored(triggerResult({ cases: cases.slice(0, 3) }), 'triggers'), true);
  const text = summarize(result, { skill: 'demo', mode: 'triggers' });
  const listed = [
    '  trigger-01-yes  trigger     1/1',
    '  trigger-02-yes  trigger     0/1',
    '  trigger-03-no   no trigger  1/1',
    '  trigger-04-no   no trigger  0/0',
    '',
    'Pass rate (N = scored runs, n = cases)',
    '  overall:            0.667, N=3, n=3, 95% half-width 0.533',
    '  should trigger:     0.500, N=2, n=2, 95% half-width 0.693',
  ];
  assert.ok(text.includes(listed.join('\n')), text);
  const closing = [
    'Runs left out of every number above (errored, or judges skipped): 1',
    '  trigger-04-no run 1: timed out',
    'Runs that ended at the turn cap (max_turns), their verdict counted: 2',
    '',
  ];
  assert.ok(text.endsWith(closing.join('\n')), text);
});
