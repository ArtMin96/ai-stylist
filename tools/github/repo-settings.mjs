#!/usr/bin/env node
// `just repo-setup settings [--apply]`: the GitHub repository settings as code. The declared state
// is tools/github/repo-settings.json; this tool reads the live repository through `gh api` and
// reports the difference, and with --apply sets what differs. Guide: tools/github/README.md.
//
//   (default)  report only: GET calls, one line per setting, exit 1 when something differs
//   --apply    also send the calls that close the difference; a second run sends nothing
//   --offline  only check the file against the workflows and renovate.json: no gh, no network
//   --repo OWNER/REPO  the repository (scripts/repo-setup.sh passes the one `origin` points at)
//
// What it manages: Actions permissions and the workflow token's default permission, classic branch
// protection of the default branch (required checks = the job names of pr-gate.yml), secret
// scanning and push protection, and the labels renovate.json uses. Nothing is ever deleted: a
// label, a rule or a setting the file does not mention is left alone.
//
// A setting GitHub does not offer for this repository (a private repository under a personal
// account has neither protected branches nor secret scanning on the free plan) is reported as
// `unavailable`, with GitHub's own message, and is not counted as a difference.
// --apply is owner-run: it refuses inside an AI agent session. Node built-ins only.
// Exit 0 nothing differs · 1 a difference, a failed call or a step only you can do · 2 usage.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sameJson } from '../observability/compare.mjs';
import { GhError, ghApi } from './gh.mjs';
import { SETTINGS_FILE, loadSettings } from './settings-file.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = `usage: just repo-setup settings [--apply]   (no --apply = report only)
       just repo-setup settings --offline   (the file against the workflows; no network)`;
/** Parts of GitHub's answers when a plan or the repository's visibility lacks a feature. */
const PLAN_MESSAGES = [
  'upgrade to github',
  'make this repository public',
  'not available for this repository',
  'advanced security',
];
/** Statuses that still need something after a run. */
const PENDING = ['change', 'create', 'manual', 'failed'];

class UsageError extends Error {}
/** A problem that stops the run with one plain line. */
class Fatal extends Error {}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** `have` reduced to the keys `want` declares, at every depth: GitHub adds keys of its own. */
function pick(have, want) {
  if (!isPlainObject(want) || !isPlainObject(have)) return have;
  const entries = Object.keys(want).map((key) => [key, pick(have[key], want[key])]);
  return Object.fromEntries(entries);
}

/** Does the live object hold everything the file declares? (compare.mjs: missing = zero) */
function matches(want, have) {
  return sameJson(want, pick(have, want));
}

function describe(error) {
  const status = error.status ? ` (HTTP ${error.status})` : '';
  return `${error.method} ${error.apiPath}: GitHub answered "${error.message}"${status}`;
}

function planBlocked(error) {
  const text = error.message.toLowerCase();
  const known = PLAN_MESSAGES.some((part) => text.includes(part));
  return known && [403, 422].includes(error.status);
}

function item(status, what, detail = '', write) {
  return { status, what, detail, write };
}

function countOf(done, ...statuses) {
  return done.filter((entry) => statuses.includes(entry.status)).length;
}

/** `key: live -> declared` for every top-level key of `want` that differs. */
function differences(want, have) {
  const changed = Object.keys(want).filter((key) => !matches(want[key], have?.[key]));
  const show = (key) => {
    const live = JSON.stringify(have?.[key] ?? null);
    return `${key}: ${live} -> ${JSON.stringify(want[key])}`;
  };
  return changed.map(show).join(', ');
}

function parseArgs(argv) {
  const options = { apply: false, check: false, offline: false, repo: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--offline') options.offline = true;
    else if (arg === '--repo' && argv[i + 1]) options.repo = argv[(i += 1)];
    else throw new UsageError(`unknown argument '${arg}'`);
  }
  if (options.apply && (options.check || options.offline)) {
    throw new UsageError('--apply cannot be combined with --check or --offline');
  }
  if (!options.offline && !/^[\w.-]+\/[\w.-]+$/.test(options.repo ?? '')) {
    throw new UsageError('--repo OWNER/REPO is required');
  }
  return options;
}

function readRepository(slug) {
  const hint = `check: gh auth status ; gh repo view ${slug}`;
  let repo;
  try {
    repo = ghApi('GET', `repos/${slug}`);
  } catch (error) {
    if (!(error instanceof GhError)) throw error;
    if (error.status === 404) {
      const reason = 'the repository does not exist, or the logged-in account cannot see it';
      throw new Fatal(`GitHub answered 404 for ${slug}: ${reason} (${hint})`);
    }
    throw new Fatal(`could not read ${slug}: ${describe(error)} (${hint})`);
  }
  if (repo?.permissions?.admin !== true) {
    const needs = 'its settings, branch protection and labels need them';
    throw new Fatal(`the gh account has no admin rights on ${slug}: ${needs} (${hint})`);
  }
  return repo;
}

/** Repository-level settings other than security: one PATCH per setting. */
function plainItems(slug, plain, repo, where) {
  const absent = `GitHub does not report it for ${where}`;
  return Object.entries(plain).map(([key, want]) => {
    const what = `repository setting ${key}`;
    if (!(key in repo)) return item('unavailable', what, absent);
    if (matches(want, repo[key])) return item('ok', what, JSON.stringify(want));
    const detail = `${JSON.stringify(repo[key])} -> ${JSON.stringify(want)}`;
    const write = { method: 'PATCH', apiPath: `repos/${slug}`, body: { [key]: want } };
    return item('change', what, detail, write);
  });
}

/** Secret scanning and push protection: GitHub lists a feature only where it offers it. */
function securityItems(slug, security, repo, where) {
  const free = 'free on a public repository; a private one needs GitHub Secret Protection';
  const absent = `GitHub does not offer it for ${where} (${free}, sold to organizations)`;
  return Object.entries(security).map(([feature, want]) => {
    const what = feature.replaceAll('_', ' ');
    const live = repo.security_and_analysis?.[feature];
    if (!live) return item('unavailable', what, absent);
    if (live.status === want.status) return item('ok', what, live.status);
    const body = { security_and_analysis: { [feature]: want } };
    const verify = (answer) => answer?.security_and_analysis?.[feature]?.status === want.status;
    const write = { method: 'PATCH', apiPath: `repos/${slug}`, body, verify };
    return item('change', what, `${live.status} -> ${want.status}`, write);
  });
}

/** A settings object GitHub returns and takes in one shape: GET, then PUT the whole object. */
function objectItem(what, apiPath, want) {
  const live = ghApi('GET', apiPath);
  if (!matches(want, live)) {
    const write = { method: 'PUT', apiPath, body: want };
    return item('change', what, differences(want, live), write);
  }
  const shown = Object.entries(want).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  return item('ok', what, shown.join(', '));
}

/** GitHub's protection document in the shape of the file: `{ enabled }` becomes a boolean. */
function liveProtection(doc) {
  const flat = {};
  for (const [key, value] of Object.entries(doc)) {
    const flag = isPlainObject(value) && typeof value.enabled === 'boolean';
    flat[key] = flag ? value.enabled : value;
  }
  const checks = doc.required_status_checks;
  if (isPlainObject(checks)) {
    const contexts = checks.contexts ?? (checks.checks ?? []).map((check) => check.context);
    flat.required_status_checks = { ...checks, contexts: [...contexts].sort() };
  }
  return flat;
}

function protectionItem(slug, settings, where) {
  const want = settings.branch_protection;
  const what = `branch protection for ${settings.branch}`;
  const apiPath = `repos/${slug}/branches/${settings.branch}/protection`;
  const write = { method: 'PUT', apiPath, body: want };
  const contexts = want.required_status_checks.contexts;
  const n = contexts.length;
  let live;
  try {
    live = ghApi('GET', apiPath);
  } catch (error) {
    if (!(error instanceof GhError)) throw error;
    const answer = `GitHub answered "${error.message}" (HTTP ${error.status})`;
    if (planBlocked(error)) {
      const detail = `${answer}: protected branches are not offered for ${where}`;
      return item('unavailable', what, detail);
    }
    if (error.status !== 404) throw error;
    if (/not protected/i.test(error.message)) {
      const detail = `not protected -> ${n} required check(s) and the declared rules`;
      return item('change', what, detail, write);
    }
    const detail = `${answer}: push the branch ${settings.branch} first, then run this again`;
    return item('manual', what, detail);
  }
  const sorted = { ...want.required_status_checks, contexts: [...contexts].sort() };
  const comparable = { ...want, required_status_checks: sorted };
  const flat = liveProtection(live);
  if (matches(comparable, flat)) return item('ok', what, `${n} required check(s)`);
  return item('change', what, differences(comparable, flat), write);
}

function labelItems(slug, settings) {
  const have = new Set();
  for (let page = 1; page <= 50; page += 1) {
    const batch = ghApi('GET', `repos/${slug}/labels?per_page=100&page=${page}`) ?? [];
    for (const label of batch) have.add(String(label.name).toLowerCase());
    if (batch.length < 100) break;
  }
  return settings.labels.map((label) => {
    const what = `label ${label.name}`;
    if (have.has(label.name.toLowerCase())) return item('ok', what);
    const write = { method: 'POST', apiPath: `repos/${slug}/labels`, body: label };
    return item('create', what, '', write);
  });
}

/** Rulesets can require checks too; this tool does not manage them, it only says they exist. */
function rulesetNote(slug) {
  let count;
  try {
    count = (ghApi('GET', `repos/${slug}/rulesets`) ?? []).length;
  } catch {
    return []; // best effort: rulesets are not offered on every plan
  }
  if (count === 0) return [];
  const scope = 'this command manages classic branch protection only (use one of the two)';
  return [item('note', 'rulesets', `${count} ruleset(s) exist; ${scope}`)];
}

/** One part of the plan; a failed read becomes a `failed` line and the other parts go on. */
function section(what, build) {
  try {
    return [build()].flat();
  } catch (error) {
    if (!(error instanceof GhError)) throw error;
    return [item('failed', what, describe(error))];
  }
}

function buildPlan(slug, settings, repo, where) {
  const { security_and_analysis: security = {}, ...plain } = settings.repository ?? {};
  const branch = settings.branch;
  const base = `repos/${slug}/actions/permissions`;
  const workflowPath = `${base}/workflow`;
  const permissions = settings.actions_permissions;
  const tokenSettings = settings.actions_workflow_permissions;
  const items = [];
  if (repo.default_branch !== branch) {
    const fix = `change it under Settings (every runbook link assumes ${branch})`;
    const detail = `is ${repo.default_branch}, not ${branch}; ${fix}`;
    items.push(item('manual', 'default branch', detail));
  }
  const actions = () => objectItem('Actions permissions', base, permissions);
  const token = () => objectItem('Actions workflow token', workflowPath, tokenSettings);
  const protection = () => protectionItem(slug, settings, where);
  const labels = () => labelItems(slug, settings);
  return [
    ...items,
    ...section('Actions permissions', actions),
    ...section('Actions workflow token', token),
    ...section(`branch protection for ${branch}`, protection),
    ...plainItems(slug, plain, repo, where),
    ...securityItems(slug, security, repo, where),
    ...section('labels', labels),
    ...rulesetNote(slug),
  ];
}

/** Sends one planned call; the entry it returns says what happened. */
function applyItem(entry, where) {
  const { method, apiPath, body, verify } = entry.write;
  try {
    const answer = ghApi(method, apiPath, body);
    if (verify && !verify(answer)) {
      const detail = `GitHub took the call and changed nothing: not offered for ${where}`;
      return { ...entry, status: 'unavailable', detail };
    }
    return { ...entry, status: entry.status === 'create' ? 'created' : 'changed' };
  } catch (error) {
    if (!(error instanceof GhError)) throw error;
    if (planBlocked(error)) {
      const answer = `GitHub answered "${error.message}" (HTTP ${error.status})`;
      const detail = `${answer}: not offered for ${where}`;
      return { ...entry, status: 'unavailable', detail };
    }
    const exists = entry.status === 'create' && error.status === 422;
    if (exists) return { ...entry, status: 'ok', detail: 'already exists' };
    return { ...entry, status: 'failed', detail: describe(error) };
  }
}

function ownerOnly(env, err) {
  if (!env.CLAUDECODE) return false;
  const why = 'this shell belongs to an AI agent session (CLAUDECODE is set)';
  err(`error: 'just repo-setup settings --apply' is owner-run: ${why}; nothing was changed`);
  err('  run it yourself, in a terminal no agent is attached to');
  return true;
}

function summarize(done, apply, where, out) {
  const unavailable = countOf(done, 'unavailable');
  const byHand = countOf(done, 'manual');
  const failed = countOf(done, 'failed');
  const ok = countOf(done, 'ok');
  const rest = `${unavailable} unavailable, ${byHand} only you can do, ${ok} already as declared`;
  if (apply) {
    const changed = countOf(done, 'changed', 'created');
    out(`repo-setup settings: ${changed} changed, ${failed} failed, ${rest}`);
  } else {
    const pending = countOf(done, 'change', 'create');
    out(`repo-setup settings: ${pending} to change, ${failed} not readable, ${rest}`);
    if (pending > 0) out('  to apply: just repo-setup settings --apply');
  }
  if (unavailable > 0) {
    const meaning = `GitHub does not offer the setting for ${where}`;
    out(`  unavailable = ${meaning}: left alone, not a difference`);
  }
}

function main(argv, env, out, err) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    err(`repo-setup settings: ${error.message}\n${USAGE}`);
    return 2;
  }
  if (options.apply && ownerOnly(env, err)) return 1;
  const { settings, problems } = loadSettings(REPO_ROOT);
  if (problems.length > 0) {
    for (const problem of problems) err(`ERROR ${SETTINGS_FILE}: ${problem}`);
    err(`repo-setup settings: ${problems.length} problem(s) in the file, nothing sent`);
    return 1;
  }
  if (options.offline) {
    const checks = settings.branch_protection.required_status_checks.contexts.length;
    const against = `${settings.required_checks_workflow} (${checks} required checks)`;
    const labels = `renovate.json (${settings.labels.length} labels)`;
    out(`repo-setup settings --offline: ${SETTINGS_FILE} matches ${against} and ${labels}`);
    return 0;
  }
  const slug = options.repo;
  const repo = readRepository(slug);
  const organization = repo.owner?.type === 'Organization';
  const owner = organization ? 'an organization' : 'a personal account';
  const where = `a ${repo.private ? 'private' : 'public'} repository under ${owner}`;
  const mode = options.apply ? 'applying' : 'report only: nothing changes without --apply';
  out(`repo-setup settings: ${slug} (${where}) against ${SETTINGS_FILE} — ${mode}`);
  const plan = buildPlan(slug, settings, repo, where);
  const send = (entry) => (entry.write ? applyItem(entry, where) : entry);
  const done = options.apply ? plan.map(send) : plan;
  for (const entry of done) {
    const detail = entry.detail ? `: ${entry.detail}` : '';
    out(`  ${entry.status.padEnd(11)} ${entry.what}${detail}`);
  }
  summarize(done, options.apply, where, out);
  return countOf(done, ...PENDING) > 0 ? 1 : 0;
}

const out = (line) => process.stdout.write(`${line}\n`);
const err = (line) => process.stderr.write(`${line}\n`);
try {
  process.exitCode = main(process.argv.slice(2), process.env, out, err);
} catch (error) {
  const known = error instanceof Fatal;
  err(`repo-setup settings: ${known ? '' : 'unexpected error: '}${error?.message}`);
  process.exitCode = 1;
}
