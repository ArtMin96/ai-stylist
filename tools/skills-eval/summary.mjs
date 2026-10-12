// The printed summary of one `claude plugin eval` result for `just skills-eval`: per-case scores,
// then what planning/13 §10 "Measurement validity" asks of every eval number: its n, its 95%
// interval, and a plain statement when a difference lies inside that interval (a tie, not a
// result). The arithmetic is that of the 2026-10-12 pilot. Pure: the result document in, text out.
import { expectsNoTrigger } from './cases.mjs';

// Two-sided 95% Student t critical values, t(0.975, df), for df 1 to 30.
const T_975 = [
  [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228],
  [2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086],
  [2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042],
].flat();
// Above 30: the value at the nearest tabulated df below, which can only widen an interval.
const T_975_ABOVE_30 = [
  [120, 1.98],
  [60, 2.0],
  [40, 2.021],
  [31, 2.042],
];
const TITLES = {
  tasks: 'tasks, with and without the skill',
  triggers: 'triggers, routing among all skills',
};
const TASK_ARMS = [
  ['with', 'with skill:   '],
  ['without', 'without skill:'],
];
const TRIGGER_ARMS = [['with', 'each run:']];
const INSIDE = 'INSIDE its interval: noise, not a result (a tie, planning/13 §10)';
const OUTSIDE = 'outside its interval';
const STOPPED_EARLY = 'the runner stopped early, so the numbers cover only the runs it finished';
// How a run that max_turns ended is told apart: `claude -p` ends it with this error. The runner's
// `turns` cannot tell, because it also counts tool results: 20 at max_turns 15 in a run that was
// never cut off (the 2026-10-12 smoke).
const TURN_CAP_ERROR = /Reached maximum number of turns/;
const TURN_CAP_ERRORED = 'Errored runs that the turn cap (max_turns) ended';
const TURN_CAP_COUNTED = 'Runs that ended at the turn cap (max_turns), their verdict counted';
const JUDGES_SKIPPED = 'judges skipped at the cost ceiling';

export const fixed = (value) => value.toFixed(3);
export const signed = (value) => `${value < 0 ? '-' : '+'}${fixed(Math.abs(value))}`;
export const usd = (value) => `$${value.toFixed(4)}`;
const rounded = (value) => Number(value.toFixed(4));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Sample standard deviation (n - 1 in the divisor) of two or more values. */
function deviation(values) {
  const center = mean(values);
  const squares = values.reduce((sum, value) => sum + (value - center) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

/** Two-sided 95% Student t critical value for `df` (1 or more) degrees of freedom. */
export function tCritical(df) {
  if (df <= 30) return T_975[df - 1];
  return T_975_ABOVE_30.find(([from]) => df >= from)[1];
}

/** Mean of one or more values with its 95% half-width; `halfWidth` is null for a single value. */
export function meanInterval(values) {
  const n = values.length;
  const center = mean(values);
  if (n < 2) return { center, halfWidth: null };
  return { center, halfWidth: (tCritical(n - 1) * deviation(values)) / Math.sqrt(n) };
}

/**
 * Difference of the means of two independent samples with its 95% half-width: unpooled standard
 * error, df = the smaller n - 1 (the cautious choice). `halfWidth` is null when a sample has one
 * value.
 */
export function differenceOfMeans(a, b) {
  const diff = mean(a) - mean(b);
  const df = Math.min(a.length, b.length) - 1;
  if (df < 1) return { diff, halfWidth: null };
  const standardError = Math.sqrt(deviation(a) ** 2 / a.length + deviation(b) ** 2 / b.length);
  return { diff, halfWidth: tCritical(df) * standardError };
}

/**
 * A pass rate over `runs` scored runs with its 95% half-width, 1.96 * sqrt(p(1 - p)/N). At 0 or 1
 * that formula gives zero, so `bound` carries the rule of three instead: nothing seen in N runs
 * only shows a rate below 3/N.
 */
export function rateInterval(passed, runs) {
  const rate = passed / runs;
  if (passed === 0 || passed === runs) return { rate, bound: Math.min(1, 3 / runs) };
  return { rate, halfWidth: 1.96 * Math.sqrt((rate * (1 - rate)) / runs) };
}

const endedAtTurnCap = (run) => TURN_CAP_ERROR.test(run.error ?? '');
/**
 * Whether a run's error makes it an infrastructure failure. Every error does, with one exception:
 * a trigger run is meant to end at its turn cap, after the one turn that holds the routing
 * answer, and the runner still grades what the run did before the cap.
 */
const failed = (run, mode) => Boolean(run.error) && !(mode === 'triggers' && endedAtTurnCap(run));
/**
 * A run the runner scored in full. A failed run, and one whose judges were skipped at the cost
 * ceiling, is listed apart and never averaged in (planning/13 §10).
 */
const isScored = (run, mode) => !failed(run, mode) && run.skippedPaidGraders !== true;
const everyRun = (entry, arm) => entry.arms[arm] ?? [];
const bothArms = (entry) => [...everyRun(entry, 'with'), ...everyRun(entry, 'without')];
const scoredRuns = (entry, arm, mode) => everyRun(entry, arm).filter((run) => isScored(run, mode));
const scoreOf = (run) => run.score;
const armScores = (cases, arm) =>
  cases.flatMap((entry) => scoredRuns(entry, arm, 'tasks').map(scoreOf));
/** A trigger case has one grader, so a run scores 1 (it routed as expected) or 0. */
const routedAsExpected = (run) => run.score === 1;
const calledSkill = (run) => run.graders.some((g) => g.name === 'skill-fired' && g.passed);
const oneLine = (text) => String(text).replace(/\s+/g, ' ').slice(0, 160);
const range = (center, reach) => ({ low: rounded(center - reach), high: rounded(center + reach) });

function meanScore(values) {
  if (values.length === 0) return { score: null, interval: null, n: 0 };
  const { center, halfWidth } = meanInterval(values);
  const interval = halfWidth === null ? null : range(center, halfWidth);
  return { score: rounded(center), interval, n: values.length };
}

function passRate(cases) {
  const runs = cases.flatMap((entry) => scoredRuns(entry, 'with', 'triggers'));
  if (runs.length === 0) return { score: null, interval: null, n: 0, passed: 0 };
  const passed = runs.filter(routedAsExpected).length;
  const { rate, halfWidth, bound } = rateInterval(passed, runs.length);
  let interval = range(rate, halfWidth ?? 0);
  // At 0 or 1 the interval is one-sided: the rule-of-three bound, towards the middle.
  if (passed === 0) interval = { low: 0, high: rounded(bound) };
  if (passed === runs.length) interval = { low: rounded(1 - bound), high: 1 };
  return { score: rounded(rate), interval, n: runs.length, passed };
}

/**
 * The headline score of a result, as the scoreboard stores it: for `tasks` the mean run score
 * with the skill (`withoutSkill` beside it), for `triggers` the pass rate. `interval` is the 95%
 * interval, null when there are too few runs for one; `n` counts the scored runs.
 */
export function unitScore(result, mode) {
  if (mode === 'triggers') return passRate(result.cases);
  const withoutSkill = meanScore(armScores(result.cases, 'without'));
  return { ...meanScore(armScores(result.cases, 'with')), withoutSkill };
}

/** Whether every case of a `mode` result has at least one scored run in each of its arms. */
export function everyCaseScored(result, mode) {
  return result.cases.every((entry) => {
    const arms = entry.arms.without ? ['with', 'without'] : ['with'];
    return arms.every((arm) => scoredRuns(entry, arm, mode).length > 0);
  });
}

/** Rows of cells as indented lines with left-aligned columns two spaces apart. */
export function table(rows) {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((cells) => cells[c].length)));
  return rows.map((cells) => {
    const padded = cells.map((cell, c) => cell.padEnd(widths[c]));
    return `  ${padded.join('  ').trimEnd()}`;
  });
}

function describeMean(values) {
  if (values.length === 0) return 'no scored run';
  const { center, halfWidth } = meanInterval(values);
  if (halfWidth === null) return `${fixed(center)}, n=1: no interval from a single run`;
  const range = `[${fixed(center - halfWidth)}, ${fixed(center + halfWidth)}]`;
  const sample = `n=${values.length}, 95% interval ${range}`;
  return `${fixed(center)}, ${sample} (half-width ${fixed(halfWidth)})`;
}

function describeDifference(diff, sample, halfWidth) {
  if (halfWidth === null) return `${signed(diff)}, ${sample}: no interval below two values`;
  const range = `[${signed(diff - halfWidth)}, ${signed(diff + halfWidth)}]`;
  const interval = `95% interval ${range} (half-width ${fixed(halfWidth)})`;
  const verdict = Math.abs(diff) <= halfWidth ? INSIDE : OUTSIDE;
  return `${signed(diff)}, ${sample}, ${interval}: ${verdict}`;
}

/** A pass rate as text: `0.875, N=8, n=3, 95% half-width 0.229` (N scored runs of n cases). */
export function describeRate({ passed, runs, cases }) {
  if (runs === 0) return 'no scored run';
  const sample = `N=${runs}, n=${cases}`;
  const { rate, halfWidth, bound } = rateInterval(passed, runs);
  if (halfWidth !== undefined) {
    return `${fixed(rate)}, ${sample}, 95% half-width ${fixed(halfWidth)}`;
  }
  const unseen = passed === 0 ? 'pass' : 'failure';
  const limit = `the ${unseen} rate is below 3/N = ${fixed(bound)} (rule of three, 95%)`;
  return `${fixed(rate)}, ${sample}: no ${unseen} seen, so ${limit}`;
}

function taskSection(cases) {
  const rows = [['task', 'with', 'without', 'delta', 'fired', 'runs']];
  const deltas = [];
  for (const entry of cases) {
    const own = scoredRuns(entry, 'with', 'tasks');
    const base = scoredRuns(entry, 'without', 'tasks');
    const ownMean = own.length > 0 ? mean(own.map(scoreOf)) : null;
    const baseMean = base.length > 0 ? mean(base.map(scoreOf)) : null;
    const delta = ownMean === null || baseMean === null ? null : ownMean - baseMean;
    if (delta !== null) deltas.push(delta);
    rows.push([
      entry.name,
      ownMean === null ? '-' : fixed(ownMean),
      baseMean === null ? '-' : fixed(baseMean),
      delta === null ? '-' : signed(delta),
      `${own.filter(calledSkill).length}/${own.length}`,
      `${own.length}+${base.length}`,
    ]);
  }
  const withScores = armScores(cases, 'with');
  const withoutScores = armScores(cases, 'without');
  let byRuns = 'an arm has no scored run';
  if (withScores.length > 0 && withoutScores.length > 0) {
    const { diff, halfWidth } = differenceOfMeans(withScores, withoutScores);
    const sample = `n=${withScores.length} and ${withoutScores.length}`;
    byRuns = describeDifference(diff, sample, halfWidth);
  }
  let byCases = 'no case has scored runs in both arms';
  if (deltas.length > 0) {
    const { center, halfWidth } = meanInterval(deltas);
    byCases = describeDifference(center, `n=${deltas.length}`, halfWidth);
  }
  return [
    'Per task: mean score of the scored runs. "fired" counts the with-skill runs that called the',
    'Skill tool for this skill: an indicator, never part of a score. "runs" is with+without.',
    ...table(rows),
    '',
    'Run score per arm (runs as the sample)',
    `  with skill:    ${describeMean(withScores)}`,
    `  without skill: ${describeMean(withoutScores)}`,
    '',
    'Difference, with minus without',
    `  runs as the sample:  ${byRuns}`,
    `  cases as the sample: ${byCases}`,
  ];
}

function triggerSection(cases) {
  const rows = [['query', 'expected', 'passed']];
  const fire = { passed: 0, runs: 0, cases: 0 };
  const quiet = { passed: 0, runs: 0, cases: 0 };
  for (const entry of cases) {
    const expectsQuiet = expectsNoTrigger(entry.name);
    const runs = scoredRuns(entry, 'with', 'triggers');
    const passed = runs.filter(routedAsExpected).length;
    const tally = expectsQuiet ? quiet : fire;
    tally.passed += passed;
    tally.runs += runs.length;
    tally.cases += runs.length > 0 ? 1 : 0;
    rows.push([entry.name, expectsQuiet ? 'no trigger' : 'trigger', `${passed}/${runs.length}`]);
  }
  const overall = {
    passed: fire.passed + quiet.passed,
    runs: fire.runs + quiet.runs,
    cases: fire.cases + quiet.cases,
  };
  return [
    'Per query: scored runs that passed. A run passes when it calls the Skill tool for the skill',
    '(expected "trigger") or never calls it for the skill (expected "no trigger").',
    ...table(rows),
    '',
    'Pass rate (N = scored runs, n = cases)',
    `  overall:            ${describeRate(overall)}`,
    `  should trigger:     ${describeRate(fire)}`,
    `  should not trigger: ${describeRate(quiet)}`,
  ];
}

function costLines(cases, arms) {
  return arms.map(([arm, label]) => {
    const runs = cases.flatMap((entry) => everyRun(entry, arm));
    if (runs.length === 0) return `  ${label} no run`;
    const perRun = usd(mean(runs.map((run) => run.costUsd)));
    const judges = usd(mean(runs.map((run) => run.judgeCostUsd)));
    return `  ${label} ${perRun} per run, ${judges} of it for the judges (n=${runs.length})`;
  });
}

/**
 * The runs left out of the numbers, and the runs that the turn cap ended: for `tasks` those are
 * among the errored ones and are named, for `triggers` they are counted in and only their number
 * is given.
 */
function problemLines(cases, mode) {
  const unscored = [];
  const atTurnCap = [];
  for (const entry of cases) {
    for (const arm of ['with', 'without']) {
      everyRun(entry, arm).forEach((run, i) => {
        const where = `  ${entry.name}${entry.arms.without ? ` ${arm}` : ''} run ${i + 1}`;
        if (failed(run, mode)) unscored.push(`${where}: ${oneLine(run.error)}`);
        else if (!isScored(run, mode)) unscored.push(`${where}: ${JUDGES_SKIPPED}`);
        if (endedAtTurnCap(run)) atTurnCap.push(where);
      });
    }
  }
  const left = `Runs left out of every number above (errored, or judges skipped): ${unscored.length}`;
  if (mode === 'triggers') {
    return [left, ...unscored, `${TURN_CAP_COUNTED}: ${atTurnCap.length}`];
  }
  return [left, ...unscored, `${TURN_CAP_ERRORED}: ${atTurnCap.length}`, ...atTurnCap];
}

/**
 * The summary of a result document (the runner's `--json` file) as text ending in a newline.
 * `mode` is `tasks` (two arms per case) or `triggers` (one arm, one Skill grader per case).
 */
export function summarize(result, { skill, mode }) {
  const tasks = mode === 'tasks';
  const { cases } = result;
  const reason = result.partialReason ?? 'no reason given';
  const state = result.partial ? `PARTIAL (${reason}): ${STOPPED_EARLY}` : 'complete';
  const runCount = cases.flatMap(bothArms).length;
  const size = `${cases.length} cases, ${runCount} runs, ${result.durationSeconds} s`;
  const lines = [
    `skills-eval: ${skill} ${TITLES[mode]}`,
    `result: ${state}`,
    `runner: Claude Code ${result.claudeVersion}, ${size}, ${usd(result.costUsd)} in total`,
    '',
    ...(tasks ? taskSection(cases) : triggerSection(cases)),
    '',
    'Cost',
    ...costLines(cases, tasks ? TASK_ARMS : TRIGGER_ARMS),
    '',
    ...problemLines(cases, mode),
  ];
  return `${lines.join('\n')}\n`;
}
