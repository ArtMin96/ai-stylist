#!/usr/bin/env node
// `just observability-sync [grafana|posthog|all] [--check|--dry-run|--prune]`: pushes the
// version-controlled Grafana and PostHog definitions over the vendors' HTTP APIs, so nobody clicks
// through their UIs. Contracts: docs/observability/grafana/README.md and
// docs/observability/posthog/README.md. Guide: tools/observability/README.md.
//
//   (default)  check, then apply: create or update what differs; a second run changes nothing
//   --check    offline checks only: no network, no env (CI-safe)
//   --dry-run  check, read the current state (GET only) and print every call a real run would send
//   --prune    also delete what has no file any more (Grafana: rule groups and dashboards in
//              the ai-stylist folder; PostHog: soft-delete registry-tagged flags that left the
//              registry)
//   --root <dir>  read the definitions below <dir> instead of the repository (tests, fixtures)
//
// Env comes from the process (the recipe loads the repo-root .env, which `just secrets-sync`
// writes). A missing key is named, never its value; HTTP errors print method, path and status
// only; every output line masks the secret values. Built-ins only (Node 24): runs without
// node_modules. Exit 0 ok, 1 findings or a failed call, 2 usage.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkInputs } from './check.mjs';
import { syncGrafana } from './grafana.mjs';
import { createClient, HttpError } from './http.mjs';
import { loadInputs } from './inputs.mjs';
import { createOutput, createReport } from './output.mjs';
import { syncPosthog } from './posthog.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE =
  'usage: just observability-sync [grafana|posthog|all] [--check|--dry-run|--prune] [--root <dir>]';
const ENV_KEYS = {
  grafana: [
    'GRAFANA_URL',
    'GRAFANA_SERVICE_ACCOUNT_TOKEN',
    'GRAFANA_ALERT_EMAILS',
    'GRAFANA_ONCALL_TIMEZONE',
  ],
  posthog: ['POSTHOG_CLI_HOST', 'POSTHOG_CLI_PROJECT_ID', 'POSTHOG_SYNC_API_KEY'],
};
/** Env keys whose values are masked in every output line. */
const SECRET_KEYS = [
  'GRAFANA_SERVICE_ACCOUNT_TOKEN',
  'GRAFANA_ALERT_EMAILS',
  'POSTHOG_SYNC_API_KEY',
  'POSTHOG_CLI_API_KEY',
];
const SYNCS = { grafana: syncGrafana, posthog: syncPosthog };

class UsageError extends Error {}

function parseArgs(argv) {
  const options = { target: 'all', mode: 'apply', prune: false, root: REPO_ROOT };
  const modes = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['grafana', 'posthog', 'all'].includes(arg)) options.target = arg;
    else if (arg === '--check' || arg === '--dry-run') modes.push(arg.slice(2));
    else if (arg === '--prune') options.prune = true;
    else if (arg === '--root' && argv[i + 1]) options.root = path.resolve(argv[(i += 1)]);
    else throw new UsageError(`unknown argument '${arg}'`);
  }
  if (modes.length > 1) throw new UsageError('use one of --check and --dry-run');
  if (modes.length === 1) options.mode = modes[0];
  if (options.mode === 'check' && options.prune) {
    throw new UsageError('--check is offline and cannot be combined with --prune');
  }
  return options;
}

function secretValues(env) {
  const values = [];
  for (const key of SECRET_KEYS) {
    const value = env[key]?.trim();
    if (value) values.push(value, ...value.split(/[,;\n]/).map((part) => part.trim()));
  }
  return values;
}

/** https, or http for a loopback host (the tests' stubs): never send a token in clear text. */
function isSafeBaseUrl(value) {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return url.protocol === 'https:' || (url.protocol === 'http:' && loopback);
  } catch {
    return false;
  }
}

/** An IANA zone name such as Europe/Berlin (not an offset such as +01:00). */
function isTimeZone(value) {
  if (!/^[A-Za-z]/.test(value)) return false;
  try {
    return Boolean(new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone);
  } catch {
    return false;
  }
}

/** Problems with the env a target needs; each names a KEY, never a value. */
function envProblems(targets, env) {
  const problems = [];
  for (const target of targets) {
    const missing = ENV_KEYS[target].filter((key) => !env[key]?.trim());
    if (missing.length > 0) problems.push(`${target} needs env ${missing.join(', ')}`);
  }
  const has = (key) => Boolean(env[key]?.trim());
  if (targets.includes('grafana') && has('GRAFANA_URL') && !isSafeBaseUrl(env.GRAFANA_URL)) {
    problems.push('GRAFANA_URL must be an https:// URL');
  }
  const zone = env.GRAFANA_ONCALL_TIMEZONE;
  if (targets.includes('grafana') && has('GRAFANA_ONCALL_TIMEZONE') && !isTimeZone(zone)) {
    problems.push('GRAFANA_ONCALL_TIMEZONE must be an IANA time zone, e.g. Europe/Berlin');
  }
  if (targets.includes('posthog')) {
    if (has('POSTHOG_CLI_HOST') && !isSafeBaseUrl(env.POSTHOG_CLI_HOST)) {
      problems.push('POSTHOG_CLI_HOST must be an https:// URL, e.g. https://us.posthog.com');
    }
    if (has('POSTHOG_CLI_PROJECT_ID') && !/^\d+$/.test(env.POSTHOG_CLI_PROJECT_ID.trim())) {
      problems.push('POSTHOG_CLI_PROJECT_ID must be the numeric project id');
    }
  }
  return problems;
}

function gitSha(root) {
  try {
    const args = ['-C', root, 'rev-parse', '--short=12', 'HEAD'];
    const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    return execFileSync('git', args, options).trim();
  } catch {
    return 'unknown';
  }
}

const HINTS = {
  401: ' (the key was rejected; see tools/observability/README.md)',
  403: ' (the key lacks a role or scope; see tools/observability/README.md)',
};

function hintFor(error) {
  if (!(error instanceof HttpError)) return '';
  return HINTS[error.status] ?? '';
}

async function applyTarget(target, { options, inputs, env, output }) {
  const dryRun = options.mode === 'dry-run';
  const report = createReport(target, dryRun, output);
  const grafana = target === 'grafana';
  const client = createClient({
    baseUrl: grafana ? env.GRAFANA_URL.trim() : env.POSTHOG_CLI_HOST.trim(),
    token: grafana ? env.GRAFANA_SERVICE_ACCOUNT_TOKEN.trim() : env.POSTHOG_SYNC_API_KEY.trim(),
    dryRun,
    report,
  });
  const values = Object.fromEntries(ENV_KEYS[target].map((key) => [key, env[key].trim()]));
  const sha = grafana ? gitSha(options.root) : undefined;
  await SYNCS[target]({ inputs, env: values, client, report, prune: options.prune, sha });
  report.summary();
}

async function main(argv, env) {
  const output = createOutput(secretValues(env));
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    output.error(`observability-sync: ${error.message}\n${USAGE}`);
    return 2;
  }
  const targets = options.target === 'all' ? ['grafana', 'posthog'] : [options.target];
  const inputs = loadInputs(options.root);
  const today = new Date().toISOString().slice(0, 10);
  const { errors, warnings } = checkInputs(inputs, targets, today);
  for (const w of warnings) output.error(`WARN  [${w.id}] ${w.file}: ${w.message}`);
  for (const e of errors) output.error(`ERROR [${e.id}] ${e.file}: ${e.message}`);
  if (errors.length > 0) {
    output.error(`observability-sync: ${errors.length} problem(s) found, nothing sent`);
    return 1;
  }
  if (options.mode === 'check') {
    output.info(`observability-sync --check: ${targets.join(' + ')} definitions OK (offline)`);
    return 0;
  }
  const problems = envProblems(targets, env);
  if (problems.length > 0) {
    for (const problem of problems) output.error(`observability-sync: ${problem}`);
    output.error('Set them with `just secrets-edit dev`, then `just secrets-sync`.');
    return 1;
  }
  for (const target of targets) {
    try {
      await applyTarget(target, { options, inputs, env, output });
    } catch (error) {
      output.error(`${target}: ERROR ${error.message}${hintFor(error)}`);
      return 1;
    }
  }
  return 0;
}

main(process.argv.slice(2), process.env).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    const output = createOutput(secretValues(process.env));
    output.error(`observability-sync: unexpected ${error?.name ?? 'error'}: ${error?.message}`);
    process.exitCode = 1;
  },
);
