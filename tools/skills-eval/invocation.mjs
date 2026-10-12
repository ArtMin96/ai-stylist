// One invocation of `just skills-eval`: every selected skill and mode (a "unit") in order. A unit
// is up to date, scored now, left for the next invocation by the budget, or failed, and the
// closing table says which. The scoreboard is written after every stored score, so an invocation
// that stops early loses nothing and the next one continues. Node built-ins only.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { caseName, RefusalError, systemPromptFor } from './cases.mjs';
import { evalEntries, generatePlugin, tryScaffold, writeSnapshot } from './plugin.mjs';
import { runEval, runnerArgs, shellLine } from './runner.mjs';
import {
  DEFAULT_RUNS,
  entryFrom,
  estimateUsd,
  isUpToDate,
  record,
  runnerBudget,
  unitHash,
  unstorable,
  verdict,
  writeScoreboard,
} from './scoreboard.mjs';
import { describeRate, fixed, signed, summarize, table, unitScore, usd } from './summary.mjs';

/** The order of one invocation: routing first, then the costlier two-arm task runs. */
const MODE_ORDER = ['triggers', 'tasks'];
const STATUS = {
  upToDate: 'up to date',
  scored: 'scored now',
  unstored: 'scored now, not stored',
  generated: 'generated',
  budget: 'not run: budget',
  stopped: 'not run: after the failure',
  failed: 'failed',
};
const STALE_NOTE =
  'A score beside "not run" or "failed" is the last stored one, from before the change.';
const AGAIN = 'Run `just skills-eval` again to continue.';

const say = (line) => process.stdout.write(`skills-eval: ${line}\n`);
const rounded = (value) => Number(value.toFixed(4));

/** Every selected skill and mode in running order: all triggers by skill name, then all tasks. */
export function selectUnits(skills, skill, mode) {
  const names = skill === 'all' ? skills : [skill];
  const modes = mode === 'all' ? MODE_ORDER : [mode];
  return modes.flatMap((each) => names.map((name) => ({ skill: name, mode: each })));
}

/** How many of a unit's cases a run takes: all of them, or those that `--case` selects by name. */
function selectedCount(entries, mode, caseGlob) {
  if (caseGlob === undefined) return entries.length;
  const names = entries.map((entry, i) => caseName(mode, entry, i + 1));
  return names.filter((name) => path.matchesGlob(name, caseGlob)).length;
}

/**
 * What each selected unit would be scored on: the number of cases a run takes, the runs per case
 * (--runs, else the default of its mode), its hash, its last stored score and whether that score
 * is up to date. A unit whose eval file cannot be used carries a `refusal`.
 */
export function planInvocation({ options, skills, skillStep, board }) {
  return selectUnits(skills, options.skill, options.mode).map((unit) => {
    const last = board[unit.skill]?.[unit.mode]?.current;
    const runs = options.runs ?? DEFAULT_RUNS[unit.mode];
    try {
      const entries = evalEntries(options.root, unit.skill, unit.mode);
      const caseCount = selectedCount(entries, unit.mode, options.caseGlob);
      const systemPrompt = systemPromptFor(unit.mode, skillStep);
      const hash = unitHash({ root: options.root, ...unit, skills, systemPrompt });
      const upToDate = isUpToDate(last, hash, options);
      return { ...unit, last, runs, caseCount, hash, upToDate };
    } catch (error) {
      if (!(error instanceof RefusalError)) throw error;
      return { ...unit, last, runs, refusal: error.message };
    }
  });
}

function unitLayout(layout, { skill, mode }) {
  const dir = path.join(layout.runDir, `${skill}-${mode}`);
  return {
    pluginDir: path.join(dir, 'plugin'),
    outputDir: path.join(dir, 'results'),
    resultFile: path.join(dir, 'result.json'),
    reportFile: path.join(dir, 'report.html'),
    configFile: path.join(dir, 'run-config.json'),
    summaryFile: path.join(dir, 'summary.txt'),
  };
}

/** What planning/13 §10 asks every eval run to record, plus the launch that repeats it. */
function runConfig({ plan, budget, context, state, cases, args }) {
  const { options } = context;
  return {
    skill: plan.skill,
    mode: plan.mode,
    hash: plan.hash,
    model: options.model,
    judgeModel: options.judgeModel ?? null,
    effort: options.effort,
    runs: plan.runs,
    concurrency: options.concurrency,
    maxCostUsd: options.maxCostUsd,
    ceilingUsd: rounded(budget.ceilingUsd),
    estimateUsd: rounded(budget.estimateUsd),
    caseGlob: options.caseGlob ?? null,
    cliVersion: context.cliVersion,
    gitSha: context.gitSha,
    uncommittedSources: context.uncommitted,
    timestamp: context.startedAt.toISOString(),
    generateOnly: options.generateOnly,
    cases,
    scaffold: plan.mode === 'tasks' ? state.scaffold : null,
    runnerCommand: shellLine(args, options.effort),
  };
}

/**
 * Writes one unit's plugin and run-config.json, and before the first `tasks` unit the snapshot
 * that every tasks unit of the invocation shares, checked once with the scaffold script.
 */
function prepareUnit(plan, budget, context, state) {
  const { options, layout, skills, skillStep } = context;
  const paths = unitLayout(layout, plan);
  const cases = generatePlugin({
    root: options.root,
    skill: plan.skill,
    mode: plan.mode,
    skills,
    skillStep,
    pluginDir: paths.pluginDir,
    snapshotFile: layout.snapshotFile,
  });
  if (plan.mode === 'tasks' && state.scaffold === null) {
    const snapshotBytes = writeSnapshot(options.root, layout.snapshotFile);
    const script = path.join(paths.pluginDir, 'evals', cases[0], 'scaffold.sh');
    state.scaffold = { ...tryScaffold(script), snapshotBytes };
    const megabytes = (snapshotBytes / 1e6).toFixed(1);
    const { entries, seconds } = state.scaffold;
    say(`scaffold check: ${entries} entries from a ${megabytes} MB snapshot in ${seconds} s`);
  }
  const args = runnerArgs(options, plan, paths, budget.ceilingUsd);
  const config = runConfig({ plan, budget, context, state, cases, args });
  writeFileSync(paths.configFile, `${JSON.stringify(config, null, 2)}\n`);
  return { paths, cases, args };
}

function scoreCell(score) {
  if (score === null || score.score === null) return '-';
  if (score.interval === null) return `${fixed(score.score)} (no interval)`;
  return `${fixed(score.score)} [${fixed(score.interval.low)}, ${fixed(score.interval.high)}]`;
}

/** The new score against the last stored one, with the verdict when the inputs changed. */
function comparison(last, entry) {
  if (last === undefined) return 'the first stored score';
  const was = `was ${scoreCell(last)} on ${last.date}`;
  if (last.hash === entry.hash) return `${was}: the same inputs, scored again`;
  const { word, difference, interval } = verdict(last, entry);
  const detail = `difference ${signed(difference)}, interval ${fixed(interval)}`;
  return `${was}, now ${scoreCell(entry)}: ${word} (${detail})`;
}

/** Runs one unit and stores its score when the result is complete; returns its row fields. */
function scoreUnit(plan, budget, context, state) {
  const { options } = context;
  const about = `about ${usd(budget.estimateUsd)} of ${usd(state.remainingUsd)} left`;
  const ceiling = `the runner may spend ${usd(budget.ceilingUsd)}`;
  const { paths, cases, args } = prepareUnit(plan, budget, context, state);
  say(`${plan.skill} ${plan.mode}: ${plan.caseCount} cases, ${about}; ${ceiling}`);
  const exitCode = runEval(args, options.effort);
  if (!existsSync(paths.resultFile)) {
    state.stopped = true;
    return { status: STATUS.failed, note: `the runner exited ${exitCode} and wrote no result` };
  }
  const result = JSON.parse(readFileSync(paths.resultFile, 'utf8'));
  const costUsd = result.costUsd;
  state.remainingUsd -= costUsd;
  const summary = summarize(result, plan);
  writeFileSync(paths.summaryFile, summary);
  process.stdout.write(`\n${summary}\n`);

  const reason = unstorable({
    result,
    exitCode,
    expectedCases: cases.length,
    caseGlob: options.caseGlob,
    mode: plan.mode,
    runs: plan.runs,
  });
  if (result.partial || exitCode !== 0) {
    // A cost ceiling, a sign-in or a rate limit: the next unit would meet it too.
    state.stopped = true;
    return { status: STATUS.failed, costUsd, note: reason };
  }
  if (reason !== null) {
    const score = unitScore(result, plan.mode);
    return { status: STATUS.unstored, score, costUsd, note: reason };
  }
  const entry = entryFrom({
    result,
    mode: plan.mode,
    hash: plan.hash,
    setup: options,
    cliVersion: context.cliVersion,
    gitSha: context.gitSha,
    date: context.startedAt.toISOString().slice(0, 10),
    runs: plan.runs,
  });
  state.board = record(state.board, plan, entry);
  writeScoreboard(context.boardFile, state.board);
  return { status: STATUS.scored, score: entry, costUsd, note: comparison(plan.last, entry) };
}

/** What becomes of one planned unit in this invocation; returns its row fields. */
function handleUnit(plan, context, state) {
  const { options } = context;
  if (plan.refusal !== undefined) return { status: STATUS.failed, note: plan.refusal };
  const estimate = estimateUsd(state.board, plan, plan.caseCount, plan.runs);
  const budget = runnerBudget({
    estimateUsd: estimate,
    caseRuns: plan.caseCount * plan.runs,
    concurrency: options.concurrency,
    remainingUsd: state.remainingUsd,
  });
  if (options.generateOnly) {
    prepareUnit(plan, budget, context, state);
    return { status: STATUS.generated, note: `${plan.caseCount} cases, about ${usd(estimate)}` };
  }
  if (plan.upToDate && !options.force) return { status: STATUS.upToDate };
  if (state.stopped) return { status: STATUS.stopped };
  if (!budget.fits) {
    const held = `${usd(budget.reserveUsd)} held back for the runs in flight`;
    const left = usd(Math.max(0, state.remainingUsd));
    const note = `needs about ${usd(estimate)} and ${held}, ${left} is left`;
    return { status: STATUS.budget, note, neededUsd: estimate + budget.reserveUsd };
  }
  return scoreUnit(plan, budget, context, state);
}

/**
 * Works through the planned units within the invocation's one budget and returns a row per unit:
 * `{ skill, mode, caseCount, status, score, costUsd, note }`. `score` is the stored or the fresh
 * score (null when there is none), `costUsd` null when nothing was spent on the unit.
 */
export function runInvocation(context, plans) {
  const { options, board } = context;
  const state = { board, remainingUsd: options.maxCostUsd, stopped: false, scaffold: null };
  return plans.map((plan) => {
    const { skill, mode, caseCount } = plan;
    const row = { skill, mode, caseCount, score: plan.last ?? null, costUsd: null, note: '' };
    try {
      return { ...row, ...handleUnit(plan, context, state) };
    } catch (error) {
      if (!(error instanceof RefusalError)) throw error;
      return { ...row, status: STATUS.failed, note: error.message };
    }
  });
}

/** Whether any unit failed: the invocation then exits 1. */
export const anyFailed = (rows) => rows.some((row) => row.status === STATUS.failed);

function statusCell(row) {
  if (row.status !== STATUS.upToDate) return row.status;
  return `${STATUS.upToDate} (${row.score.date})`;
}

function leftLine(rows, options) {
  if (options.generateOnly) return '--generate-only: nothing was run.';
  const done = [STATUS.scored, STATUS.upToDate];
  const left = rows.filter((row) => !done.includes(row.status));
  if (left.length === 0) return 'Nothing is left: every selected skill and mode is up to date.';
  const largest = Math.max(0, ...left.map((row) => row.neededUsd ?? 0));
  const text = `Left: ${left.length} of ${rows.length}. ${AGAIN}`;
  if (largest <= options.maxCostUsd) return text;
  const hint = `needs --max-cost-usd ${Math.ceil(largest * 100) / 100} or more`;
  return `${text} The largest one ${hint}: it does not fit in ${usd(options.maxCostUsd)}.`;
}

/**
 * The closing table of an invocation as text ending in a newline: one row per unit, the notes,
 * the totals, the pooled trigger pass rate when several skills' triggers ran, and what is left.
 */
export function closingText(rows, { options, startedAt }) {
  const header = ['skill', 'mode', 'score [95% interval]', 'status', 'cost'];
  const body = rows.map((row) => {
    const cost = row.costUsd === null ? '-' : usd(row.costUsd);
    return [row.skill, row.mode, scoreCell(row.score), statusCell(row), cost];
  });
  const count = (...statuses) => rows.filter((row) => statuses.includes(row.status)).length;
  const spent = rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  const budget = usd(options.maxCostUsd);
  const notes = rows.filter((row) => row.note !== '');
  const stale = rows.some((row) => row.score !== null && /^not run|^failed/.test(row.status));
  const fresh = rows.filter((row) => [STATUS.scored, STATUS.unstored].includes(row.status));
  const ran = fresh.filter((row) => row.mode === 'triggers' && row.score.n > 0);
  const totals = [
    `${count(STATUS.scored, STATUS.unstored)} scored now`,
    `${count(STATUS.upToDate)} up to date`,
    `${count(STATUS.budget, STATUS.stopped)} not run`,
    `${count(STATUS.failed)} failed`,
  ];
  const { triggers, tasks } = DEFAULT_RUNS;
  const perMode = `runs per case: ${triggers} for triggers, ${tasks} for tasks`;
  const runs = options.runs === undefined ? perMode : `${options.runs} runs per case`;
  const setup = `model ${options.model}, effort ${options.effort}, ${runs}`;
  const lines = [
    `Skill eval scores, ${startedAt.toISOString().slice(0, 10)} (${setup})`,
    ...table([header, ...body]),
  ];
  if (notes.length > 0) lines.push('', 'Notes');
  for (const row of notes) lines.push(`  ${row.skill} ${row.mode}: ${row.note}`);
  if (stale) lines.push('', STALE_NOTE);
  lines.push('', `Totals: ${totals.join(', ')}; ${usd(spent)} of ${budget} spent`);
  if (ran.length > 1) {
    const rate = describeRate({
      passed: ran.reduce((sum, row) => sum + row.score.passed, 0),
      runs: ran.reduce((sum, row) => sum + row.score.n, 0),
      cases: ran.reduce((sum, row) => sum + row.caseCount, 0),
    });
    lines.push(`Trigger pass rate over the ${ran.length} skills scored now: ${rate}`);
  }
  lines.push(leftLine(rows, options));
  return `${lines.join('\n')}\n`;
}
