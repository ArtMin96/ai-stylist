// Offline checks (`--check`: no network, no env, CI-safe). They implement the "Offline checks"
// list of docs/observability/grafana/README.md, the token rules of its "Tokens" table, and the
// registry fields the PostHog sync publishes. The sync runs them before any call, so a bad file
// never half-applies. The complete registry rules (JSON Schema, the 90-day rollout limit) stay in
// packages/contracts/tests and packages/shared-kernel/tests (`just test`).
import { existsSync } from 'node:fs';
import path from 'node:path';

import { findAtSigns, roleMembers, tokenProblems } from './tokens.mjs';

export const FOLDER_UID = 'ai-stylist';
const SEVERITIES = ['SEV1', 'SEV2', 'SEV3'];
const RUNBOOK_URL_PREFIX = 'https://github.com/ArtMin96/ai-stylist/blob/main/';
const RUNBOOK_PATH = /^docs\/runbooks\/[^/]+\.md$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Grafana's day numbering: sunday is 0. */
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_FORM = 'day name or a day:day range (sunday to saturday)';

/** Token names each kind of file may use (the "Allowed in" column of the Tokens table). */
const ALLOWED_TOKENS = {
  contactPoints: ['OWNERS', 'GRAFANA_ALERT_EMAILS'],
  muteTimings: ['OWNERS', 'ONCALL_TIMEZONE'],
  policy: ['OWNERS'],
  alert: ['OWNERS', 'PROM_DATASOURCE_UID'],
  dashboard: ['OWNERS', 'OWNER_TAGS'],
  posthogSettings: [],
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

/** Reports a missing or unparsable file; true when the file has data to check. */
function usable(ctx, file) {
  if (file.error) ctx.error(file, 'json', file.error);
  return file.error === undefined;
}

/** Tokens (known, allowed in this file, resolvable) and no `@` outside a token. */
function checkStrings(ctx, file, kind) {
  const owners = ctx.inputs.owners.data;
  for (const problem of tokenProblems(file.data, owners, ALLOWED_TOKENS[kind])) {
    ctx.error(file, problem.id, problem.message);
  }
  for (const at of findAtSigns(file.data)) {
    ctx.error(file, 'email', `'@' outside a token at ${at}: no address may be committed`);
  }
}

/**
 * An array of objects with a non-empty string for each `unique` and `required` field, unique per
 * field only for `unique` (two email contact points share a `type`); returns the `name` values.
 */
function checkNamedList(ctx, file, kind, { unique, required = [] }) {
  const names = new Set();
  if (!usable(ctx, file)) return names;
  checkStrings(ctx, file, kind);
  if (!Array.isArray(file.data)) {
    ctx.error(file, 'shape', 'must be a JSON array');
    return names;
  }
  for (const field of [...unique, ...required]) {
    const seen = new Set();
    file.data.forEach((item, i) => {
      const value = item?.[field];
      if (!isNonEmptyString(value)) {
        ctx.error(file, 'shape', `[${i}] needs a non-empty "${field}"`);
      } else if (unique.includes(field) && seen.has(value)) {
        ctx.error(file, 'shape', `[${i}] repeats ${field} '${value}'`);
      }
      seen.add(value);
    });
  }
  for (const item of file.data) {
    if (isNonEmptyString(item?.name)) names.add(item.name);
  }
  return names;
}

/**
 * Every `time_intervals[].weekdays[]` entry is a day or a forward `day:day` range. Grafana's
 * alertmanager fork counts sunday as day 0 and rejects a range whose start comes after its end
 * ("start day cannot be before end day"), so `monday:sunday` gets a 400; `sunday:saturday` is
 * every day. Day names are case-insensitive there too.
 */
function checkWeekdays(ctx, file) {
  if (!usable(ctx, file) || !Array.isArray(file.data)) return;
  file.data.forEach((timing, i) => {
    asArray(timing?.time_intervals).forEach((interval, j) => {
      asArray(interval?.weekdays).forEach((range, k) => {
        const at = `[${i}].time_intervals[${j}].weekdays[${k}]`;
        const days = typeof range === 'string' ? range.toLowerCase().split(':') : [];
        const [begin, end] = [days[0], days.at(-1)].map((day) => WEEKDAYS.indexOf(day));
        if (days.length === 0 || days.length > 2 || begin === -1 || end === -1) {
          const what = typeof range === 'string' ? `'${range}'` : 'a non-string';
          ctx.error(file, 'weekday', `${at}: ${what} is not a ${WEEKDAY_FORM}`);
        } else if (begin > end) {
          const why = 'runs backwards; Grafana rejects it (use sunday:saturday)';
          ctx.error(file, 'weekday', `${at}: weekday range '${range}' ${why}`);
        }
      });
    });
  });
}

/** Every receiver and mute timing a route names exists, recursively through `routes`. */
function checkRoute(ctx, file, route, at, known) {
  const where = at === '' ? 'root route' : at;
  if (!isObject(route)) {
    ctx.error(file, 'policy', `${where} must be an object`);
    return;
  }
  if (at === '' && !isNonEmptyString(route.receiver)) {
    ctx.error(file, 'policy', 'the root route needs a "receiver"');
  }
  const receiver = route.receiver;
  if (receiver !== undefined && !known.receivers.has(receiver)) {
    ctx.error(file, 'policy', `${where}: receiver '${receiver}' is not in contact-points.json`);
  }
  for (const key of ['mute_time_intervals', 'active_time_intervals']) {
    for (const name of route[key] ?? []) {
      if (!known.timings.has(name)) {
        ctx.error(file, 'policy', `${where}: ${key} '${name}' is not in mute-timings.json`);
      }
    }
  }
  const children = Array.isArray(route.routes) ? route.routes : [];
  children.forEach((child, i) => {
    checkRoute(ctx, file, child, `${at === '' ? '' : `${at}.`}routes[${i}]`, known);
  });
}

function checkRunbook(ctx, fail, url) {
  if (typeof url !== 'string' || !url.startsWith(RUNBOOK_URL_PREFIX)) {
    fail('runbook', `annotations.runbook_url must start with ${RUNBOOK_URL_PREFIX}docs/runbooks/`);
    return;
  }
  const rel = url.slice(RUNBOOK_URL_PREFIX.length);
  if (!RUNBOOK_PATH.test(rel)) {
    fail('runbook', `annotations.runbook_url must name docs/runbooks/<file>.md, not ${rel}`);
  } else if (!existsSync(path.join(ctx.inputs.root, rel))) {
    fail('runbook', `annotations.runbook_url points at ${rel}, which does not exist`);
  }
}

function checkRule(ctx, file, group, rule, at, uids) {
  const fail = (id, message) => ctx.error(file, id, `${at}: ${message}`);
  if (!isObject(rule)) {
    fail('rule', 'must be an object');
    return;
  }
  if (!isNonEmptyString(rule.uid)) {
    fail('rule', 'needs a stable, non-empty "uid"');
  } else if (uids.has(rule.uid)) {
    fail('rule', `uid '${rule.uid}' is used by another rule`);
  }
  uids.add(rule.uid);
  if (rule.ruleGroup !== group.title) {
    fail('rule', `"ruleGroup" must equal the group title '${group.title}'`);
  }
  if (rule.folderUID !== FOLDER_UID) fail('rule', `"folderUID" must be '${FOLDER_UID}'`);
  const labels = isObject(rule.labels) ? rule.labels : {};
  if (!SEVERITIES.includes(labels.severity)) {
    fail('rule', `labels.severity must be one of ${SEVERITIES.join(', ')}`);
  }
  if (!isNonEmptyString(labels.owner_role)) {
    fail('role', 'needs labels.owner_role, a role in owners.json');
  } else {
    const { error } = roleMembers(ctx.inputs.owners.data, labels.owner_role);
    if (error) fail('role', `labels.owner_role: ${error}`);
  }
  const annotations = isObject(rule.annotations) ? rule.annotations : {};
  if (!isNonEmptyString(annotations.summary)) fail('rule', 'needs annotations.summary');
  checkRunbook(ctx, fail, annotations.runbook_url);
}

function checkAlerts(ctx, files) {
  const titles = new Set();
  const uids = new Set();
  for (const file of files) {
    if (!usable(ctx, file)) continue;
    checkStrings(ctx, file, 'alert');
    const group = file.data;
    if (!isObject(group) || !isNonEmptyString(group.title)) {
      ctx.error(file, 'rule', 'must be one AlertRuleGroup object with a non-empty "title"');
      continue;
    }
    if (titles.has(group.title)) {
      ctx.error(file, 'rule', `group title '${group.title}' is used by another file`);
    }
    titles.add(group.title);
    if (group.folderUid !== FOLDER_UID) {
      ctx.error(file, 'rule', `"folderUid" must be '${FOLDER_UID}'`);
    }
    if (!Number.isInteger(group.interval) || group.interval <= 0) {
      ctx.error(file, 'rule', '"interval" must be a whole number of seconds above 0');
    }
    if (!Array.isArray(group.rules) || group.rules.length === 0) {
      ctx.error(file, 'rule', 'needs a non-empty "rules" array');
      continue;
    }
    group.rules.forEach((rule, i) => checkRule(ctx, file, group, rule, `rules[${i}]`, uids));
  }
}

function checkDashboards(ctx, files) {
  const uids = new Set();
  for (const file of files) {
    if (!usable(ctx, file)) continue;
    checkStrings(ctx, file, 'dashboard');
    const board = file.data;
    if (!isObject(board)) {
      ctx.error(file, 'dashboard', 'must be one dashboard object');
      continue;
    }
    if (!isNonEmptyString(board.uid)) {
      ctx.error(file, 'dashboard', 'needs a stable, non-empty "uid"');
    } else if (uids.has(board.uid)) {
      ctx.error(file, 'dashboard', `uid '${board.uid}' is used by another dashboard`);
    }
    uids.add(board.uid);
    if (board.id !== null) ctx.error(file, 'dashboard', '"id" must be null (Grafana assigns it)');
    if (!isNonEmptyString(board.title)) ctx.error(file, 'dashboard', 'needs a "title"');
  }
}

function checkGrafana(ctx) {
  const { contactPoints, muteTimings, policy, alerts, dashboards } = ctx.inputs.grafana;
  const known = {
    receivers: checkNamedList(ctx, contactPoints, 'contactPoints', {
      unique: ['uid', 'name'],
      required: ['type'],
    }),
    timings: checkNamedList(ctx, muteTimings, 'muteTimings', { unique: ['name'] }),
  };
  checkWeekdays(ctx, muteTimings);
  if (usable(ctx, policy)) {
    checkStrings(ctx, policy, 'policy');
    checkRoute(ctx, policy, policy.data, '', known);
  }
  checkAlerts(ctx, alerts);
  checkDashboards(ctx, dashboards);
}

/** The registry fields the sync writes into PostHog; rules come from the schema file itself. */
function checkFlags(ctx, today) {
  const { flags, flagSchema, owners } = ctx.inputs;
  if (!usable(ctx, flags) || !usable(ctx, flagSchema)) return;
  const definition = flagSchema.data?.$defs?.FeatureFlag;
  const keyPattern = flagSchema.data?.properties?.flags?.propertyNames?.pattern;
  const kinds = definition?.properties?.kind?.enum;
  const expiring = definition?.if?.properties?.kind?.enum;
  if (typeof keyPattern !== 'string' || !Array.isArray(kinds) || !Array.isArray(expiring)) {
    ctx.error(flagSchema, 'flag', 'cannot read the key pattern and the kinds from the schema');
    return;
  }
  const registry = flags.data?.flags;
  if (!isObject(registry)) {
    ctx.error(flags, 'flag', '"flags" must be an object');
    return;
  }
  const people = new Set((owners.data?.people ?? []).map((person) => person.id));
  const keyRule = new RegExp(keyPattern);
  for (const [key, flag] of Object.entries(registry)) {
    const fail = (message) => ctx.error(flags, 'flag', `${key}: ${message}`);
    if (!keyRule.test(key)) fail(`key must match ${keyPattern}`);
    if (!isObject(flag)) {
      fail('must be an object');
      continue;
    }
    if (!people.has(flag.owner)) fail(`owner '${flag.owner}' is not a person in owners.json`);
    if (!isNonEmptyString(flag.purpose)) fail('needs a "purpose"');
    if (!kinds.includes(flag.kind)) fail(`kind '${flag.kind}' is not one of ${kinds.join(', ')}`);
    if (!isIsoDate(flag.createdAt)) fail('"createdAt" must be a YYYY-MM-DD date');
    if (flag.expiresAt === undefined) {
      if (expiring.includes(flag.kind)) fail(`a ${flag.kind} flag needs "expiresAt"`);
    } else if (!isIsoDate(flag.expiresAt)) {
      fail('"expiresAt" must be a YYYY-MM-DD date');
    } else if (flag.expiresAt < today) {
      ctx.warn(flags, 'flag', `${key}: expired on ${flag.expiresAt}; its owner retires it`);
    }
  }
}

function checkPosthog(ctx, today) {
  const settings = ctx.inputs.posthogSettings;
  if (usable(ctx, settings)) {
    checkStrings(ctx, settings, 'posthogSettings');
    const project = settings.data?.project;
    const templates = settings.data?.disabledTransformationTemplates;
    if (!isObject(project) || Object.keys(project).length === 0) {
      ctx.error(settings, 'settings', '"project" must be a non-empty object (one PATCH body)');
    }
    if (!Array.isArray(templates) || !templates.every(isNonEmptyString)) {
      ctx.error(settings, 'settings', '"disabledTransformationTemplates" must list template ids');
    }
  }
  checkFlags(ctx, today);
}

/**
 * All offline checks for `targets` (`grafana`, `posthog`). Returns `{ errors, warnings }`, each
 * item `{ id, file, message }`. `today`: YYYY-MM-DD, for the expired-flag warning.
 */
export function checkInputs(inputs, targets, today) {
  const errors = [];
  const warnings = [];
  const ctx = {
    inputs,
    error: (file, id, message) => errors.push({ id, file: file.rel, message }),
    warn: (file, id, message) => warnings.push({ id, file: file.rel, message }),
  };
  usable(ctx, inputs.owners);
  if (targets.includes('grafana')) checkGrafana(ctx);
  if (targets.includes('posthog')) checkPosthog(ctx, today);
  return { errors, warnings };
}
