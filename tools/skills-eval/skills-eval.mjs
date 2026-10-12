#!/usr/bin/env node
// `just skills-eval [skill] [tasks|triggers] [options]`: scores the skill eval files with Claude
// Code's eval runner, `claude plugin eval` (Claude Code 2.1.269 or newer), in one run:
//
//   just skills-eval                  every skill, both modes
//   just skills-eval <skill>          that skill, both modes (`all` = every skill)
//   just skills-eval <skill> <mode>   one skill and mode
//
//   triggers  evals/trigger-evals.json against a plugin that holds every skill
//   tasks     evals/evals.json: one case per task, every run with and without the skill
//
// All triggers run before all tasks, skills in name order. A skill and mode whose inputs are
// unchanged since its last stored score (tools/skills-eval/scoreboard.json) is up to date and is
// skipped. --max-cost-usd is one budget for the whole invocation: what does not fit is left for
// the next one, so running the command again continues. The cases are generated from
// .agents/skills/<skill>/evals/ into a new run directory below artifacts/skills-eval/
// (gitignored); the eval files stay the source of truth and nothing is published.
// Guide: tools/skills-eval/README.md.
//
//   --force             score what is selected even when it is up to date
//   --max-cost-usd <n>  the budget of the invocation in USD (default: DEFAULTS.maxCostUsd)
//   --runs <n>          runs per case and arm (default: 3 for tasks, 1 for triggers; a result
//                       with fewer than the default is printed, never stored)
//   --effort <level>    low | medium | high | xhigh | max (default high), pinned for every run
//   --model <id>        the model under test (default claude-opus-5-5)
//   --judge-model <id>  the model of the llm graders (default: the runner's own)
//   --concurrency <n>   runs at once, 1 to 8 (default 3)
//   --case <glob>       only the cases whose name matches (one skill and mode; never stored)
//   --generate-only     write the run directory and stop: nothing runs, `claude` is not needed
//   --root <dir>        take the skills, CLAUDE.md, HEAD and scoreboard from <dir> (tests)
//
// A run spends model usage on your own credential: a developer command, never part of CI.
// Exit 0 when nothing failed (units left by the budget are not a failure), 1 when the invocation
// is refused or a unit failed, 2 usage. Node built-ins only.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { RefusalError } from './cases.mjs';
import { anyFailed, closingText, planInvocation, runInvocation } from './invocation.mjs';
import { headSha, listSkills, readSkillStep, uncommittedSources } from './plugin.mjs';
import { requireCli } from './runner.mjs';
import { readScoreboard } from './scoreboard.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const USAGE =
  'usage: just skills-eval [skill|all] [tasks|triggers] [--force] [--max-cost-usd <n>] ' +
  '[--runs <n>] [--effort <level>] [--model <id>] [--judge-model <id>] [--concurrency <n>] ' +
  '[--case <glob>] [--generate-only]';
const MODES = ['tasks', 'triggers'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
/** The model under test unless --model names another: the one the 2026-10-12 pilot measured. */
const DEFAULT_MODEL = 'claude-opus-5-5';
// No `runs` here: the default depends on the mode (DEFAULT_RUNS in scoreboard.mjs).
const DEFAULTS = { effort: 'high', model: DEFAULT_MODEL, maxCostUsd: 10, concurrency: 3 };
// The runner's own upper bounds for --runs and --concurrency.
const MAX_RUNS = 50;
const MAX_CONCURRENCY = 8;
const FLAGS = new Map([
  ['--force', 'force'],
  ['--generate-only', 'generateOnly'],
]);
const VALUE_OPTIONS = new Map([
  ['--runs', 'runs'],
  ['--effort', 'effort'],
  ['--model', 'model'],
  ['--judge-model', 'judgeModel'],
  ['--max-cost-usd', 'maxCostUsd'],
  ['--concurrency', 'concurrency'],
  ['--case', 'caseGlob'],
  ['--root', 'root'],
]);

class UsageError extends Error {}

const say = (line) => process.stdout.write(`skills-eval: ${line}\n`);
const complain = (line) => process.stderr.write(`skills-eval: ${line}\n`);

function wholeNumber(value, option, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new UsageError(`${option} must be a whole number from 1 to ${max}, got '${value}'`);
  }
  return number;
}

/** The words and options of the command line, unchecked. */
function readArgs(argv) {
  const options = { ...DEFAULTS, root: REPO_ROOT, force: false, generateOnly: false };
  const words = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const key = VALUE_OPTIONS.get(arg);
    if (FLAGS.has(arg)) {
      options[FLAGS.get(arg)] = true;
    } else if (key !== undefined) {
      if (argv[i + 1] === undefined) throw new UsageError(`${arg} needs a value`);
      options[key] = argv[(i += 1)];
    } else if (arg.startsWith('-')) {
      throw new UsageError(`unknown option '${arg}'`);
    } else {
      words.push(arg);
    }
  }
  return { options, words };
}

function parseArgs(argv) {
  const { options, words } = readArgs(argv);
  if (words.length > 2) throw new UsageError('give at most one skill name and one mode');
  // No word selects everything: every skill, and both modes.
  const [skill = 'all', mode = 'all'] = words;
  if (words.length === 2 && !MODES.includes(mode)) {
    throw new UsageError(`the mode must be tasks or triggers, got '${mode}'`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(skill)) throw new UsageError(`'${skill}' is not a skill name`);
  if (options.caseGlob !== undefined && (skill === 'all' || mode === 'all')) {
    throw new UsageError('--case selects the cases of one skill and mode: name both');
  }
  if (!EFFORTS.includes(options.effort)) {
    throw new UsageError(`--effort must be one of ${EFFORTS.join(', ')}, got '${options.effort}'`);
  }
  const maxCostUsd = Number(options.maxCostUsd);
  if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0) {
    throw new UsageError(`--max-cost-usd must be a positive number, got '${options.maxCostUsd}'`);
  }
  const { runs: given } = options;
  const runs = given === undefined ? undefined : wholeNumber(given, '--runs', MAX_RUNS);
  const concurrency = wholeNumber(options.concurrency, '--concurrency', MAX_CONCURRENCY);
  const root = path.resolve(options.root);
  return { ...options, skill, mode, runs, concurrency, maxCostUsd, root };
}

/** `2026-10-12T09:30:05.123Z` as `20261012T093005.123Z`: sorts by time, safe in a path. */
const stamp = (date) => date.toISOString().replace(/[-:]/g, '');

/** The one new directory of an invocation; each skill and mode gets a directory inside it. */
function runLayout(root, name) {
  const runDir = path.join(root, 'artifacts', 'skills-eval', name);
  return {
    runDir,
    snapshotFile: path.join(runDir, 'snapshot.tar'),
    summaryFile: path.join(runDir, 'summary.txt'),
  };
}

function main(argv) {
  const options = parseArgs(argv);
  const { root, skill, mode } = options;
  const skills = listSkills(root);
  if (skill !== 'all' && !skills.includes(skill)) {
    throw new RefusalError(`no skill '${skill}' under .agents/skills`);
  }
  const boardFile = path.join(root, 'tools', 'skills-eval', 'scoreboard.json');
  const startedAt = new Date();
  const context = {
    options,
    skills,
    boardFile,
    startedAt,
    skillStep: readSkillStep(root),
    board: readScoreboard(boardFile),
    layout: runLayout(root, `${stamp(startedAt)}-${skill}-${mode}`),
    gitSha: headSha(root),
    uncommitted: uncommittedSources(root),
    cliVersion: null,
  };
  const { runDir, summaryFile } = context.layout;
  if (existsSync(runDir)) throw new RefusalError(`${runDir} exists: run again`);
  const plans = planInvocation(context);
  const isDue = (plan) => plan.refusal === undefined && (options.force || !plan.upToDate);
  // `claude` is needed only when something will run: an all up-to-date invocation is free.
  if (!options.generateOnly && plans.some(isDue)) context.cliVersion = requireCli();
  if (context.uncommitted.length > 0) {
    const count = context.uncommitted.length;
    say(`note: ${count} skill source path(s) differ from HEAD; each run-config.json lists them`);
  }

  const rows = runInvocation(context, plans);
  const closing = closingText(rows, context);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(summaryFile, closing);
  process.stdout.write(`\n${closing}`);
  say(`run directory: ${runDir}`);
  return anyFailed(rows) ? 1 : 0;
}

// exitCode, never process.exit(): stdout to a pipe is asynchronous on macOS and would be cut off.
try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    complain(`${error.message}\n${USAGE}`);
    process.exitCode = 2;
  } else if (error instanceof RefusalError) {
    complain(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
