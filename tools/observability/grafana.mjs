// Pushes docs/observability/grafana/** to a Grafana Cloud stack in the order its README fixes:
// folder, contact points, mute timings, notification policy, alert rule groups, dashboards; then
// reports (or with --prune deletes) rule groups and dashboards in the folder that have no file.
// Everything that can fail before a write (datasource lookup, token values) is resolved first. No
// `X-Disable-Provenance` header: provisioned alerting objects stay locked in the Grafana UI.
import { FOLDER_UID } from './check.mjs';
import { matchesTopLevel, omitKeys, sameJson } from './compare.mjs';
import { grafanaFiles } from './inputs.mjs';
import { substitute, usesToken } from './tokens.mjs';

const FOLDER_TITLE = 'AI Stylist';
const PROVISIONING = '/api/v1/provisioning';
const POLICIES = `${PROVISIONING}/policies`;
const RULE_GROUPS = `${PROVISIONING}/folder/${FOLDER_UID}/rule-groups`;
/** Dashboard keys Grafana sets on save. */
const DASHBOARD_SERVER_KEYS = ['id', 'version'];
/** Grafana Cloud's own Prometheus (Mimir) datasource: this uid, or a name of this form. */
const CLOUD_PROM_UID = 'grafanacloud-prom';
const CLOUD_PROM_NAME = /^grafanacloud-.+-prom$/;
/** What AlertQuery.GetModel() stores for a query model field that is missing or 0. */
const MODEL_DEFAULTS = { intervalMs: 1000, maxDataPoints: 43200 };

export class SyncError extends Error {}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * The uid of Grafana Cloud's Prometheus datasource: uid `grafanacloud-prom` when it exists, else
 * the one named `grafanacloud-<stack>-prom`. Other Prometheus sources (`grafanacloud-usage`, a
 * user-added `team-prom`) never count.
 */
async function promDatasourceUid(client) {
  const prometheus = asList(await client.get('/api/datasources')).filter((datasource) => {
    return datasource?.type === 'prometheus';
  });
  if (prometheus.some((datasource) => datasource.uid === CLOUD_PROM_UID)) return CLOUD_PROM_UID;
  const matches = prometheus.filter((datasource) => CLOUD_PROM_NAME.test(datasource.name ?? ''));
  if (matches.length !== 1 || !matches[0].uid) {
    const wanted = `uid ${CLOUD_PROM_UID}, or exactly one named grafanacloud-<stack>-prom`;
    throw new SyncError(`need the prometheus datasource with ${wanted}; found ${matches.length}`);
  }
  return matches[0].uid;
}

/**
 * A rule group as Grafana stores it: each `data[].model` carries its query's `refId`, and
 * `intervalMs` and `maxDataPoints` when missing or 0 get Grafana's defaults. Compared and sent in
 * this form, a file may leave them out and a second run still finds the group unchanged.
 */
function withStoredModels(group) {
  const rules = asList(group.rules).map((rule) => {
    if (!Array.isArray(rule?.data)) return rule;
    const data = rule.data.map((query) => {
      const model = { ...query?.model, refId: query?.refId };
      for (const [key, value] of Object.entries(MODEL_DEFAULTS)) {
        if (typeof model[key] !== 'number' || model[key] === 0) model[key] = value;
      }
      return { ...query, model };
    });
    return { ...rule, data };
  });
  return { ...group, rules };
}

async function ensureFolder(client, report) {
  const folder = await client.find(`/api/folders/${FOLDER_UID}`);
  if (folder) {
    report.unchanged(`folder ${FOLDER_UID}`);
    return;
  }
  const body = { uid: FOLDER_UID, title: FOLDER_TITLE };
  await client.mutate('create', 'POST', '/api/folders', body, `folder ${FOLDER_UID}`);
}

/** Upserts a list of objects identified by `key` (contact points by uid, mute timings by name). */
async function syncList(client, report, { label, key, path, items }) {
  const current = asList(await client.get(path));
  const byKey = new Map(current.map((item) => [item?.[key], item]));
  for (const item of items) {
    const what = `${label} ${item[key]}`;
    const existing = byKey.get(item[key]);
    const itemPath = `${path}/${encodeURIComponent(item[key])}`;
    if (existing === undefined) {
      await client.mutate('create', 'POST', path, item, what);
    } else if (matchesTopLevel(item, existing)) {
      report.unchanged(what);
    } else {
      await client.mutate('update', 'PUT', itemPath, item, what);
    }
  }
}

async function syncPolicy(client, report, tree) {
  if (matchesTopLevel(tree, await client.get(POLICIES))) {
    report.unchanged('notification policy');
  } else {
    await client.mutate('update', 'PUT', POLICIES, tree, 'notification policy');
  }
}

function sameRuleGroup(desired, current) {
  if (!matchesTopLevel(omitKeys(desired, ['rules']), current)) return false;
  const rules = asList(current?.rules);
  if (rules.length !== desired.rules.length) return false;
  return desired.rules.every((rule, i) => matchesTopLevel(rule, rules[i]));
}

async function syncRuleGroup(client, report, group) {
  const path = `${RULE_GROUPS}/${encodeURIComponent(group.title)}`;
  const what = `alert rule group ${group.title}`;
  const current = await client.find(path);
  if (current !== null && sameRuleGroup(group, current)) {
    report.unchanged(what);
    return;
  }
  await client.mutate(current === null ? 'create' : 'update', 'PUT', path, group, what);
}

async function syncDashboard(client, report, dashboard, sha) {
  const what = `dashboard ${dashboard.uid}`;
  const current = await client.find(`/api/dashboards/uid/${encodeURIComponent(dashboard.uid)}`);
  const desired = omitKeys(dashboard, DASHBOARD_SERVER_KEYS);
  const stored = current?.dashboard ? omitKeys(current.dashboard, DASHBOARD_SERVER_KEYS) : null;
  if (stored && current.meta?.folderUid === FOLDER_UID && sameJson(desired, stored)) {
    report.unchanged(what);
    return;
  }
  const body = {
    dashboard,
    folderUid: FOLDER_UID,
    overwrite: true,
    message: `observability-sync ${sha}`,
  };
  const kind = current === null ? 'create' : 'update';
  await client.mutate(kind, 'POST', '/api/dashboards/db', body, what);
}

/** Rule groups and dashboards in the folder without a file: reported, deleted with --prune. */
async function pruneOrphans(client, report, { titles, uids, prune }) {
  const orphans = [];
  const groups = new Set();
  for (const rule of asList(await client.get(`${PROVISIONING}/alert-rules`))) {
    if (rule?.folderUID === FOLDER_UID && !titles.has(rule.ruleGroup)) {
      groups.add(rule.ruleGroup);
    }
  }
  for (const title of groups) {
    orphans.push({
      what: `alert rule group ${title}`,
      path: `${RULE_GROUPS}/${encodeURIComponent(title)}`,
    });
  }
  const search = `/api/search?type=dash-db&folderUIDs=${FOLDER_UID}`;
  for (const item of asList(await client.get(search))) {
    if (typeof item?.uid !== 'string' || uids.has(item.uid)) continue;
    orphans.push({
      what: `dashboard ${item.uid}`,
      path: `/api/dashboards/uid/${encodeURIComponent(item.uid)}`,
    });
  }
  for (const orphan of orphans) {
    if (prune) {
      await client.mutate('delete', 'DELETE', orphan.path, undefined, `${orphan.what} (no file)`);
    } else {
      report.warn(`${orphan.what} has no file; --prune deletes it`);
    }
  }
}

/**
 * `inputs`: loadInputs(); `env`: the GRAFANA_* values; `client`: createClient() for GRAFANA_URL;
 * `sha`: the commit named in each dashboard version message.
 */
export async function syncGrafana({ inputs, env, client, report, prune, sha }) {
  const values = {
    GRAFANA_ALERT_EMAILS: env.GRAFANA_ALERT_EMAILS,
    ONCALL_TIMEZONE: env.GRAFANA_ONCALL_TIMEZONE,
  };
  const files = grafanaFiles(inputs).map((file) => file.data);
  if (usesToken(files, 'PROM_DATASOURCE_UID')) {
    values.PROM_DATASOURCE_UID = await promDatasourceUid(client);
  }
  const context = { owners: inputs.owners.data, values };
  const grafana = inputs.grafana;
  const contactPoints = substitute(grafana.contactPoints.data, context);
  const muteTimings = substitute(grafana.muteTimings.data, context);
  const tree = substitute(grafana.policy.data, context);
  const groups = grafana.alerts.map((file) => withStoredModels(substitute(file.data, context)));
  const boards = grafana.dashboards.map((file) => substitute(file.data, context));

  await ensureFolder(client, report);
  await syncList(client, report, {
    label: 'contact point',
    key: 'uid',
    path: `${PROVISIONING}/contact-points`,
    items: contactPoints,
  });
  await syncList(client, report, {
    label: 'mute timing',
    key: 'name',
    path: `${PROVISIONING}/mute-timings`,
    items: muteTimings,
  });
  await syncPolicy(client, report, tree);
  for (const group of groups) await syncRuleGroup(client, report, group);
  for (const board of boards) await syncDashboard(client, report, board, sha);

  const titles = new Set(groups.map((group) => group.title));
  const uids = new Set(boards.map((board) => board.uid));
  await pruneOrphans(client, report, { titles, uids, prune });
}
