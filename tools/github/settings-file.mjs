// Loads tools/github/repo-settings.json and checks it offline: its own shape, the required check
// names against the job names of the workflow it names, and its labels against the labels
// renovate.json uses. A renamed job or a new Renovate label therefore fails here (and in
// `just test tooling`) instead of leaving a required check that never reports.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const SETTINGS_FILE = 'tools/github/repo-settings.json';
const RENOVATE_FILE = 'renovate.json';
const CONTEXTS = 'branch_protection.required_status_checks.contexts';
/** The four keys GitHub's "update branch protection" call requires in every body. */
const PROTECTION_KEYS = [
  'required_status_checks',
  'enforce_admins',
  'required_pull_request_reviews',
  'restrictions',
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * The `name:` of every job of a workflow file: the names GitHub reports as status checks. The
 * workflows are prettier-formatted, so a job's keys sit four spaces deep below `jobs:`.
 */
export function workflowJobNames(text) {
  const names = [];
  let inJobs = false;
  for (const line of text.split('\n')) {
    if (/^jobs:\s*$/.test(line)) inJobs = true;
    else if (/^\S/.test(line)) inJobs = false;
    const match = inJobs ? /^ {4}name:\s*(.+?)\s*$/.exec(line) : null;
    if (match) names.push(match[1].replace(/^(['"])(.*)\1$/, '$2'));
  }
  return names;
}

/** Every label a Renovate config can put on a pull request (`labels`, `addLabels`, any depth). */
function renovateLabels(value, found = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) renovateLabels(entry, found);
    return found;
  }
  if (!isPlainObject(value)) return found;
  for (const [key, entry] of Object.entries(value)) {
    const labels = key === 'labels' || key === 'addLabels';
    if (labels && Array.isArray(entry)) {
      for (const label of entry) found.add(String(label));
    } else {
      renovateLabels(entry, found);
    }
  }
  return found;
}

function checkProtection(root, settings, problems) {
  const protection = settings.branch_protection;
  if (!isPlainObject(protection)) {
    problems.push('branch_protection must be an object');
    return;
  }
  for (const key of PROTECTION_KEYS) {
    if (!(key in protection)) problems.push(`branch_protection.${key} is required`);
  }
  const contexts = protection.required_status_checks?.contexts;
  if (!Array.isArray(contexts) || !contexts.every(isNonEmptyString)) {
    problems.push(`${CONTEXTS} must list the check names`);
    return;
  }
  if (new Set(contexts).size !== contexts.length) {
    problems.push(`${CONTEXTS} lists a name twice`);
  }
  const workflow = settings.required_checks_workflow;
  if (!isNonEmptyString(workflow) || !existsSync(path.join(root, workflow))) {
    problems.push('required_checks_workflow must name an existing workflow file');
    return;
  }
  const jobs = workflowJobNames(readFileSync(path.join(root, workflow), 'utf8'));
  for (const name of contexts) {
    if (jobs.includes(name)) continue;
    problems.push(`required check '${name}' is not the name of a job in ${workflow}`);
  }
  for (const name of jobs) {
    if (contexts.includes(name)) continue;
    problems.push(`job '${name}' of ${workflow} is not a required check`);
  }
}

function checkLabels(root, settings, problems) {
  const labels = settings.labels;
  if (!Array.isArray(labels)) {
    problems.push('labels must be an array');
    return;
  }
  const names = new Set();
  for (const label of labels) {
    if (!isPlainObject(label) || !isNonEmptyString(label.name)) {
      problems.push('every label needs a name');
      continue;
    }
    const name = label.name.toLowerCase();
    if (names.has(name)) problems.push(`label '${label.name}' is listed twice`);
    names.add(name);
    if (!/^[0-9a-f]{6}$/i.test(label.color ?? '')) {
      problems.push(`label '${label.name}' needs a color of six hex digits`);
    }
    if (typeof label.description !== 'string' || label.description.length > 100) {
      problems.push(`label '${label.name}' needs a description (100 characters)`);
    }
  }
  const renovate = path.join(root, RENOVATE_FILE);
  if (!existsSync(renovate)) return;
  for (const label of renovateLabels(JSON.parse(readFileSync(renovate, 'utf8')))) {
    if (names.has(label.toLowerCase())) continue;
    problems.push(`${RENOVATE_FILE} uses the label '${label}', which is not declared`);
  }
}

function checkShape(settings, problems) {
  if (!isNonEmptyString(settings.branch)) problems.push('branch must name a branch');
  for (const key of ['actions_permissions', 'actions_workflow_permissions']) {
    if (!isPlainObject(settings[key])) problems.push(`${key} must be an object`);
  }
  const repository = settings.repository ?? {};
  if (!isPlainObject(repository)) {
    problems.push('repository must be an object');
    return;
  }
  const security = repository.security_and_analysis ?? {};
  if (!isPlainObject(security)) {
    problems.push('repository.security_and_analysis must be an object');
    return;
  }
  for (const [feature, value] of Object.entries(security)) {
    if (['enabled', 'disabled'].includes(value?.status)) continue;
    problems.push(`${feature}.status must be enabled or disabled`);
  }
}

/** `{ settings, problems }`: the parsed file and every offline finding (none when it is sound). */
export function loadSettings(root) {
  const file = path.join(root, SETTINGS_FILE);
  const failed = (problem) => ({ settings: undefined, problems: [problem] });
  if (!existsSync(file)) return failed('file not found');
  let settings;
  try {
    settings = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return failed(`not valid JSON: ${error.message}`);
  }
  if (!isPlainObject(settings)) return failed('must be a JSON object');
  const problems = [];
  checkShape(settings, problems);
  checkProtection(root, settings, problems);
  checkLabels(root, settings, problems);
  return { settings, problems };
}
