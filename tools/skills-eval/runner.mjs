// The `claude plugin eval` side of `just skills-eval`: the Claude Code version gate, the runner's
// argument list and the launch with the effort level pinned. Node built-ins only.
import { spawnSync } from 'node:child_process';

import { RefusalError, shellQuote } from './cases.mjs';

/** The first Claude Code release whose `claude plugin eval` this tool was built against. */
const MIN_CLI_VERSION = [2, 1, 269];
/** `tasks` scores each case with and without the plugin; `triggers` has no baseline to compare. */
const ABLATION = { tasks: 'with-without', triggers: 'none' };

function isOlder(version, minimum) {
  for (let i = 0; i < minimum.length; i += 1) {
    if (version[i] !== minimum[i]) return version[i] < minimum[i];
  }
  return false;
}

/** The installed Claude Code version; throws a RefusalError when `claude` is missing or too old. */
export function requireCli() {
  const needed = `Claude Code ${MIN_CLI_VERSION.join('.')} or newer`;
  const probe = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') {
    throw new RefusalError(`claude is not on PATH: \`claude plugin eval\` needs ${needed}`);
  }
  const version = /\d+\.\d+\.\d+/.exec(probe.stdout ?? '')?.[0];
  if (probe.status !== 0 || version === undefined) {
    throw new RefusalError(`\`claude --version\` did not print a version (need ${needed})`);
  }
  if (isOlder(version.split('.').map(Number), MIN_CLI_VERSION)) {
    throw new RefusalError(`claude is ${version}: \`claude plugin eval\` needs ${needed}`);
  }
  return version;
}

/**
 * The arguments of `claude` for one skill and mode: `options` from the command line, the unit's
 * `mode` and `runs` per case, `layout` its files, and `ceilingUsd` what the runner may spend
 * (runnerBudget() in scoreboard.mjs).
 */
export function runnerArgs(options, { mode, runs }, layout, ceilingUsd) {
  // Rounded down to 0.0001, so the ceiling never exceeds what the unit may spend. The 1e-6 keeps
  // a float such as 0.33999999999999997 (0.6 - 0.26) from losing a whole step.
  const ceiling = String(Math.max(0, Math.floor(ceilingUsd * 10000 + 1e-6) / 10000));
  const args = ['plugin', 'eval', layout.pluginDir];
  args.push('--runs', String(runs), '--ablation', ABLATION[mode]);
  args.push('--concurrency', String(options.concurrency), '--model', options.model);
  if (options.judgeModel !== undefined) args.push('--judge-model', options.judgeModel);
  if (options.caseGlob !== undefined) args.push('--case', options.caseGlob);
  if (mode === 'tasks') args.push('--scaffold');
  // --no-publish: the report quotes this private repository, so it stays on this machine.
  // --threshold 0: a low score is the measurement, not a failed command.
  // No --keep-temp: the runner removes each run's temporary directory itself.
  args.push('--trust-plugin', '--no-publish', '--threshold', '0');
  args.push('--max-cost-usd', ceiling, '--output-dir', layout.outputDir);
  args.push('--json', layout.resultFile, '--report', layout.reportFile);
  return args;
}

/** The launch as one shell line, for run-config.json: enough to repeat the run by hand. */
export function shellLine(args, effort) {
  const words = ['claude', ...args].map(shellQuote);
  return `env -u CLAUDE_EFFORT CLAUDE_CODE_EFFORT_LEVEL=${shellQuote(effort)} ${words.join(' ')}`;
}

/** Runs the suite with `effort` pinned for every child run; returns the runner's exit code. */
export function runEval(args, effort) {
  // The runner has no effort flag: its child runs take the level from CLAUDE_CODE_EFFORT_LEVEL.
  // CLAUDE_EFFORT is what a Claude Code session exports to the commands it runs, and is dropped so
  // that a run started from inside a session does not carry that session's level along.
  const env = { ...process.env, CLAUDE_CODE_EFFORT_LEVEL: effort };
  delete env.CLAUDE_EFFORT;
  const run = spawnSync('claude', args, { stdio: 'inherit', env });
  if (run.error) throw run.error;
  return run.status ?? 1;
}
