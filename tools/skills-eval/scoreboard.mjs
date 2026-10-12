// The scoreboard of `just skills-eval`: tools/skills-eval/scoreboard.json holds the last complete
// score of every skill and mode with a hash of what was scored. From it a later run knows what
// is up to date, what the rest will cost, and whether a new score is better than the last one.
// Node built-ins only.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GENERATOR_VERSION } from './cases.mjs';
import { everyCaseScored, unitScore } from './summary.mjs';

const TRIGGER_FILE = path.join('evals', 'trigger-evals.json');
/**
 * List price in USD of one run of one case, used while the scoreboard has no record of a mode.
 * Both are from the 2026-10-12 smokes (code-quality, effort high, one run per case), rounded up
 * to the next cent.
 */
const UNRECORDED_CASE_RUN_USD = {
  // One task, both arms: 0.405 with the skill plus 0.422 without. The earlier pilot's 0.341 was
  // measured without the repository snapshot that a run now reads.
  tasks: 0.83,
  // The mean of 20 runs of one turn each: 0.1068, from 0.1041 to 0.1120.
  triggers: 0.11,
};
/**
 * Runs per case and arm unless --runs names another number. A task score needs repeats of each
 * case. A trigger pass rate gets its resolution from the number of queries, pooled over the
 * skills, so one run each is enough. A result with fewer runs than this is printed, never stored.
 */
export const DEFAULT_RUNS = { tasks: 3, triggers: 1 };
const ROUTING_KEYS = /^(?:name|description):.*(?:\n[ \t]+.*)*/gm;

const rounded = (value) => Number(value.toFixed(4));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

function sortedKeys(object) {
  const pairs = Object.entries(object).sort(([a], [b]) => (a < b ? -1 : 1));
  return Object.fromEntries(pairs);
}

/** The scoreboard as `{ [skill]: { [mode]: { current, previous } } }`; empty when there is none. */
export function readScoreboard(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

/** Writes the scoreboard as Prettier keeps it: two-space JSON, objects only, keys in order. */
export function writeScoreboard(file, board) {
  const skills = Object.entries(board).map(([skill, modes]) => [skill, sortedKeys(modes)]);
  const ordered = sortedKeys(Object.fromEntries(skills));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(ordered, null, 2)}\n`);
}

function digest(parts) {
  const hash = createHash('sha256');
  for (const [label, content] of parts) {
    const bytes = Buffer.from(content);
    hash.update(`${label}\n${bytes.length}\n`).update(bytes);
  }
  return `sha256:${hash.digest('hex')}`;
}

/** The files of a skill that a tasks score depends on: all of them but its trigger queries. */
function taskFiles(skillDir) {
  const entries = readdirSync(skillDir, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  const inSkill = (entry) => path.relative(skillDir, path.join(entry.parentPath, entry.name));
  const names = files.map(inSkill);
  return names.filter((name) => name !== TRIGGER_FILE).sort();
}

/** The raw `name` and `description` of a SKILL.md: all that routing sees of a skill. */
function routingText(skillMd) {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skillMd)?.[1] ?? '';
  return (frontmatter.match(ROUTING_KEYS) ?? []).join('\n');
}

/**
 * The hash of what one skill and mode would be scored on, read from the working tree. `tasks`:
 * the skill's directory without its trigger queries. `triggers`: the skill's trigger queries and
 * the `name` and `description` of every skill in `skills`, because routing weighs them all. Both:
 * the system prompt the runs get and the generator version.
 */
export function unitHash({ root, skill, mode, skills, systemPrompt }) {
  const base = path.join(root, '.agents', 'skills');
  const parts = [
    ['generator', String(GENERATOR_VERSION)],
    ['system prompt', systemPrompt],
  ];
  if (mode === 'tasks') {
    for (const name of taskFiles(path.join(base, skill))) {
      parts.push([`file ${name}`, readFileSync(path.join(base, skill, name))]);
    }
    return digest(parts);
  }
  parts.push(['queries', readFileSync(path.join(base, skill, TRIGGER_FILE))]);
  for (const other of skills) {
    const skillMd = readFileSync(path.join(base, other, 'SKILL.md'), 'utf8');
    parts.push([`skill ${other}`, routingText(skillMd)]);
  }
  return digest(parts);
}

/**
 * Whether `entry` is a score of exactly this: the same hash, and the same model, judge and effort
 * (`setup`), since a score measured with another setup is another score.
 */
export function isUpToDate(entry, hash, setup) {
  if (entry === undefined || entry.hash !== hash) return false;
  const sameJudge = entry.judgeModel === (setup.judgeModel ?? null);
  return entry.model === setup.model && entry.effort === setup.effort && sameJudge;
}

/**
 * The expected list price of scoring one skill and mode: `caseCount` cases at `runs` runs, at the
 * cost per case run of its own last score, else the mean of that mode's stored scores, else the
 * constant.
 */
export function estimateUsd(board, { skill, mode }, caseCount, runs) {
  const own = board[skill]?.[mode]?.current?.costPerCaseRunUsd;
  const costs = Object.values(board).map((modes) => modes[mode]?.current?.costPerCaseRunUsd);
  const stored = costs.filter((cost) => cost !== undefined);
  const fallback = stored.length > 0 ? mean(stored) : UNRECORDED_CASE_RUN_USD[mode];
  return caseCount * runs * (own ?? fallback);
}

/**
 * What the runner may spend on a unit so that the invocation stays inside its budget. The runner
 * checks its ceiling only before it starts a run, so the runs in flight when the ceiling is
 * crossed come on top of it: at most `concurrency` of them, and never more than the unit has.
 * Their estimated cost, `reserveUsd`, is held back from `remainingUsd`, and `ceilingUsd` is what
 * the runner gets. `caseRuns` is cases x runs: for a task one of them is both arms, which is the
 * most a single run of it can cost. A unit `fits` when its estimate is not above the ceiling:
 * above it the runner would stop before the last runs and the result would be partial.
 */
export function runnerBudget({ estimateUsd, caseRuns, concurrency, remainingUsd }) {
  const inFlight = Math.min(concurrency, caseRuns);
  const reserveUsd = caseRuns === 0 ? 0 : (estimateUsd / caseRuns) * inFlight;
  const ceilingUsd = remainingUsd - reserveUsd;
  return { estimateUsd, reserveUsd, ceilingUsd, fits: estimateUsd - ceilingUsd <= 1e-6 };
}

/**
 * Why a result must not be stored, or null when it is a complete measurement. `expectedCases` is
 * the number of generated cases, `caseGlob` the invocation's --case, `runs` the runs per case.
 */
export function unstorable({ result, exitCode, expectedCases, caseGlob, mode, runs }) {
  if (result.partial) return 'the result is partial';
  if (exitCode !== 0) return `the runner exited ${exitCode}`;
  if (caseGlob !== undefined) return 'only the cases of --case ran';
  const missing = expectedCases - result.cases.length;
  if (missing !== 0) return `${missing} of ${expectedCases} cases did not load`;
  const needed = DEFAULT_RUNS[mode];
  if (runs < needed) return `--runs ${runs} is fewer than the ${needed} a stored ${mode} score has`;
  if (!everyCaseScored(result, mode)) return 'a case has no scored run';
  return null;
}

/** The scoreboard entry of a complete result. */
export function entryFrom({ result, mode, hash, setup, cliVersion, gitSha, date, runs }) {
  return {
    hash,
    date,
    model: setup.model,
    judgeModel: setup.judgeModel ?? null,
    effort: setup.effort,
    cliVersion,
    gitSha,
    cases: result.cases.length,
    runs,
    ...unitScore(result, mode),
    costUsd: rounded(result.costUsd),
    costPerCaseRunUsd: rounded(result.costUsd / (result.cases.length * runs)),
  };
}

/** The scoreboard with `entry` as the current score of a skill and mode, the last one beside it. */
export function record(board, { skill, mode }, entry) {
  const previous = board[skill]?.[mode]?.current;
  const slot = previous === undefined ? { current: entry } : { current: entry, previous };
  return { ...board, [skill]: { ...board[skill], [mode]: slot } };
}

/** How far a score's 95% interval reaches from the score, on its wider side. */
const reach = ({ score, interval }) => Math.max(score - interval.low, interval.high - score);

/**
 * Whether `current` is better or worse than `previous`, or neither: a difference that is not
 * larger than the two 95% intervals combined (root of the summed squares) is noise, not a result
 * (planning/13 §10).
 */
export function verdict(previous, current) {
  const difference = current.score - previous.score;
  const interval = Math.hypot(reach(previous), reach(current));
  let word = difference > 0 ? 'better' : 'worse';
  if (Math.abs(difference) <= interval) word = 'no measurable change';
  return { word, difference, interval };
}
