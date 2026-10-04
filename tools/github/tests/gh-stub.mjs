#!/usr/bin/env node
// A stand-in for the GitHub CLI, for scripts/test/repo-setup.test.sh: the suite puts a launcher
// named `gh` on PATH that runs this file, so `just repo-setup` talks to a JSON file instead of
// GitHub. It answers exactly the calls the scripts make (`gh auth token`, `gh secret|variable
// list|set`, `gh api` on the repository, Actions permissions, branch protection, labels and
// rulesets) and exits 64 on anything else, so a new call cannot go untested.
//
// State: the JSON file named by $GH_STUB_STATE (the suite writes it; this file updates it, the
// way GitHub keeps what it was sent). Every write is also one line in "$GH_STUB_STATE.log":
// `<method> <path> <body>` for `gh api`, `set <kind> <name>` for a secret or a variable. A value
// sent on standard input is stored in the state file only, never logged and never printed, and
// byte for byte (the real gh drops a trailing newline; keeping it here lets the suite prove that
// the scripts never send one).
// Errors look like gh's: GitHub's JSON body on stdout, `gh: <message> (HTTP <status>)` on
// stderr, exit 1. Node built-ins only.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const BLOCKED = 'Upgrade to GitHub Pro or make this repository public to enable this feature.';
const statePath = process.env.GH_STUB_STATE;
const args = process.argv.slice(2);

function unexpected() {
  process.stderr.write(`gh stub: unexpected call: ${args.join(' ')}\n`);
  process.exit(64);
}

if (!statePath) unexpected();
const state = JSON.parse(readFileSync(statePath, 'utf8'));

function save(logLine) {
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  if (logLine) appendFileSync(`${statePath}.log`, `${logLine}\n`);
}

function httpError(status, message) {
  process.stdout.write(`${JSON.stringify({ message, status: String(status) })}\n`);
  process.stderr.write(`gh: ${message} (HTTP ${status})\n`);
  process.exit(1);
}

function answer(body) {
  if (body !== undefined) process.stdout.write(`${JSON.stringify(body)}\n`);
  process.exit(0);
}

/** The value of `--flag value` in the argument list, or undefined. */
function flag(name) {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

function requireRepo() {
  if (flag('--repo') !== state.slug || !state.repo) httpError(404, 'Not Found');
}

function auth() {
  if (state.login === false) {
    process.stderr.write('no oauth token found for github.com\n');
    process.exit(1);
  }
  if (args[1] === 'token') process.stdout.write('stub-login\n');
  process.exit(0);
}

/** `gh secret list|set` and `gh variable list|set`. */
function names(kind) {
  const store = kind === 'secret' ? 'secrets' : 'variables';
  requireRepo();
  if (state.repo.permissions?.admin !== true) httpError(403, 'Resource not accessible');
  if (args[1] === 'list') {
    if (flag('--json') !== 'name' || flag('--jq') !== '.[].name') unexpected();
    const list = Object.keys(state[store]);
    if (list.length > 0) process.stdout.write(`${list.join('\n')}\n`);
    process.exit(0);
  }
  const name = args[2];
  if (args[1] !== 'set' || !name || args.length !== 5) unexpected();
  if (state.fail_set === name) {
    process.stderr.write('failed to set: synthetic-text-in-an-error\n');
    process.exit(1);
  }
  state[store][name] = readFileSync(0, 'utf8');
  save(`set ${kind} ${name}`);
  process.exit(0);
}

/** What GitHub returns for a protected branch, built from the body it was sent. */
function protectionDocument(body) {
  const enabled = (value) => ({ enabled: value === true });
  const checks = body.required_status_checks;
  const reviews = body.required_pull_request_reviews;
  const contexts = checks?.contexts ?? [];
  const url = 'https://api.github.com/stub';
  const document = {
    url,
    enforce_admins: { url, enabled: body.enforce_admins === true },
    required_signatures: { url, enabled: false },
    required_linear_history: enabled(body.required_linear_history),
    allow_force_pushes: enabled(body.allow_force_pushes),
    allow_deletions: enabled(body.allow_deletions),
    block_creations: enabled(false),
    required_conversation_resolution: enabled(body.required_conversation_resolution),
    lock_branch: enabled(false),
    allow_fork_syncing: enabled(false),
  };
  if (checks) {
    document.required_status_checks = {
      url,
      strict: checks.strict === true,
      contexts,
      checks: contexts.map((context) => ({ context, app_id: 15368 })),
    };
  }
  if (reviews) {
    document.required_pull_request_reviews = {
      url,
      dismiss_stale_reviews: false,
      require_code_owner_reviews: false,
      require_last_push_approval: false,
      required_approving_review_count: 0,
      ...reviews,
    };
  }
  return document;
}

function patchRepository(body) {
  const { security_and_analysis: security = {}, ...plain } = body;
  for (const [feature, value] of Object.entries(security)) {
    const live = state.repo.security_and_analysis?.[feature];
    if (!live) httpError(422, 'Secret scanning is not available for this repository.');
    if (!(state.sticky ?? []).includes(feature)) live.status = value.status;
  }
  Object.assign(state.repo, plain);
  return state.repo;
}

function protection(method, body) {
  if (state.protection_blocked) httpError(403, BLOCKED);
  if (method === 'PUT') {
    state.protection = body;
    return protectionDocument(body);
  }
  if (!state.protection) httpError(404, 'Branch not protected');
  return protectionDocument(state.protection);
}

function labels(method, body, query) {
  if (method === 'POST') {
    const wanted = body.name.toLowerCase();
    const taken = state.labels.some((label) => label.name.toLowerCase() === wanted);
    if (taken) httpError(422, 'Validation Failed');
    state.labels.push(body);
    return body;
  }
  const page = Number(new URLSearchParams(query).get('page') ?? 1);
  return state.labels.slice((page - 1) * 100, page * 100);
}

/** `gh api --method <M> <path> [-H ...] [--input -]`. */
function api() {
  const method = flag('--method');
  const [route, query = ''] = String(args[3] ?? '').split('?');
  if (!method || args[1] !== '--method' || !route) unexpected();
  const base = `repos/${state.slug}`;
  const inside = route === base || route.startsWith(`${base}/`);
  if (!state.repo || !inside) httpError(404, 'Not Found');
  const body = flag('--input') === '-' ? JSON.parse(readFileSync(0, 'utf8')) : undefined;
  const rest = route.slice(base.length);
  const key = `${method} ${rest}`;
  let result;
  if (key === 'GET ') result = state.repo;
  else if (key === 'PATCH ') result = patchRepository(body);
  else if (key === 'GET /actions/permissions') result = state.actions_permissions;
  else if (key === 'PUT /actions/permissions') state.actions_permissions = body;
  else if (key === 'GET /actions/permissions/workflow') result = state.actions_workflow;
  else if (key === 'PUT /actions/permissions/workflow') state.actions_workflow = body;
  else if (/^\/branches\/[^/]+\/protection$/.test(rest)) result = protection(method, body);
  else if (rest === '/labels') result = labels(method, body, query);
  else if (key === 'GET /rulesets') result = state.rulesets ?? [];
  else httpError(404, 'Not Found');
  save(method === 'GET' ? undefined : `${method} ${route} ${JSON.stringify(body)}`);
  answer(result);
}

if (args[0] === 'auth') auth();
else if (args[0] === 'secret' || args[0] === 'variable') names(args[0]);
else if (args[0] === 'api') api();
else unexpected();
