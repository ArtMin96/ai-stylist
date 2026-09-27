// Black-box tests for tools/observability/sync.mjs (`just observability-sync`). The tool runs as a
// child process against local Grafana and PostHog stubs (tests/stubs.mjs) with synthetic
// credentials and an env built from scratch, so a developer's real keys (direnv exports .env) are
// never read and no real service is called. Every run asserts that no secret value reaches stdout
// or stderr. Run by scripts/test/observability-sync.test.sh (`just test tooling`).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createOutput } from '../output.mjs';
import { grafanaApi, posthogApi, serve } from './stubs.mjs';

const TOOL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(TOOL_DIR, '../..');
const SYNC = path.join(TOOL_DIR, 'sync.mjs');
const FIXTURES = path.join(TOOL_DIR, 'fixtures');
const GRAFANA_DIR = path.join(REPO, 'docs/observability/grafana');
const POSTHOG_SETTINGS = path.join(REPO, 'docs/observability/posthog/project-settings.json');
const RULE_GROUPS = '/api/v1/provisioning/folder/ai-stylist/rule-groups';

const GRAFANA_TOKEN = 'glsa_synthetic_DO_NOT_PRINT_grafana';
const POSTHOG_KEY = 'phx_synthetic_DO_NOT_PRINT_posthog';
const ALERT_EMAILS = 'oncall-one@example.invalid,oncall-two@example.invalid';
const SECRETS = [GRAFANA_TOKEN, POSTHOG_KEY, ALERT_EMAILS, ...ALERT_EMAILS.split(',')];
SECRETS.push('DO_NOT_PRINT');
const PROJECT_ID = '4242';
const PROM_UID = 'stub-prom-uid';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const owners = readJson(path.join(REPO, 'packages/shared-kernel/registry/owners.json'));
const registry = readJson(path.join(REPO, 'packages/shared-kernel/registry/feature-flags.json'));

function jsonFiles(dir) {
  const names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  return names.sort().map((name) => readJson(path.join(dir, name)));
}

/** Runs `command` with only `env` (plus PATH, HOME); asserts that no secret value is printed. */
function spawnChecked(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO,
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', NO_COLOR: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const output = `${stdout}${stderr}`;
      SECRETS.forEach((secret, i) => {
        assert.ok(!output.includes(secret), `secret #${i} was printed`);
      });
      resolve({ code, stdout, stderr, output });
    });
  });
}

const run = (args, env = {}) => spawnChecked(process.execPath, [SYNC, ...args], env);

const staged = [];
after(() => {
  for (const dir of staged) rmSync(dir, { recursive: true, force: true });
});

/** A copy of every input the tool reads, with a fixture case (if any) laid over it. */
function stage(fixture) {
  const root = mkdtempSync(path.join(tmpdir(), 'observability-sync-'));
  staged.push(root);
  for (const dir of ['docs/observability', 'docs/runbooks', 'packages/shared-kernel/registry']) {
    cpSync(path.join(REPO, dir), path.join(root, dir), { recursive: true });
  }
  if (fixture) {
    const filter = (source) => path.basename(source) !== '.expect';
    cpSync(path.join(FIXTURES, fixture), root, { recursive: true, filter });
  }
  return root;
}

function grafanaEnv(url, overrides = {}) {
  return {
    GRAFANA_URL: url,
    GRAFANA_SERVICE_ACCOUNT_TOKEN: GRAFANA_TOKEN,
    GRAFANA_ALERT_EMAILS: ALERT_EMAILS,
    GRAFANA_ONCALL_TIMEZONE: 'Europe/Berlin',
    ...overrides,
  };
}

function posthogEnv(url) {
  return {
    POSTHOG_CLI_HOST: url,
    POSTHOG_CLI_PROJECT_ID: PROJECT_ID,
    POSTHOG_SYNC_API_KEY: POSTHOG_KEY,
  };
}

/** Starts a stub; `use(stub)` runs with it and the stub always stops. */
async function withStub(token, api, use) {
  const server = await serve(token, api.handle);
  try {
    return await use({ ...server, state: api.state });
  } finally {
    await server.close();
  }
}

const writes = (calls) => calls.filter((call) => call.method !== 'GET');
const described = (calls) => writes(calls).map((call) => `${call.method} ${call.path}`);

// --- offline checks ------------------------------------------------------------------------------

test('--check passes on the committed definitions, offline and with no env', async () => {
  const result = await run(['all', '--check']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.stdout, /grafana \+ posthog definitions OK \(offline\)/);
});

test('the just recipe runs the tool: `just observability-sync all --check`', async (t) => {
  const result = await spawnChecked('just', ['observability-sync', 'all', '--check'], {});
  t.diagnostic(result.output.trim());
  assert.equal(result.code, 0, result.output);
  assert.match(result.stdout, /grafana \+ posthog definitions OK \(offline\)/);
});

test('every fixture fails --check with exactly the findings in its .expect file', async (t) => {
  const entries = readdirSync(FIXTURES, { withFileTypes: true });
  const cases = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.ok(cases.length >= 10, `expected the fixture cases, found ${cases.join(', ')}`);
  for (const name of cases) {
    await t.test(name, async (sub) => {
      const expected = readFileSync(path.join(FIXTURES, name, '.expect'), 'utf8').trim();
      const result = await run(['all', '--check', '--root', stage(name)]);
      sub.diagnostic(result.stderr.trim());
      assert.equal(result.code, 1, result.output);
      const findings = result.stderr.split('\n').filter((line) => line.startsWith('ERROR'));
      assert.deepEqual(findings, expected.split('\n'));
    });
  }
});

test('--check: two contact points may share a type, not a uid; type is required', async () => {
  const root = stage();
  const file = path.join(root, 'docs/observability/grafana/contact-points.json');
  const [oncall] = readJson(file);
  const digest = { ...structuredClone(oncall), uid: 'fixture-digest', name: 'fixture-digest' };
  writeFileSync(file, JSON.stringify([oncall, digest]));
  const twoEmails = await run(['grafana', '--check', '--root', root]);
  assert.equal(twoEmails.code, 0, twoEmails.output);

  writeFileSync(file, JSON.stringify([oncall, { ...digest, uid: oncall.uid, type: '' }]));
  const broken = await run(['grafana', '--check', '--root', root]);
  assert.equal(broken.code, 1, broken.output);
  const findings = broken.stderr.split('\n').filter((line) => line.startsWith('ERROR'));
  const where = 'ERROR [shape] docs/observability/grafana/contact-points.json:';
  assert.deepEqual(findings, [
    `${where} [1] repeats uid '${oncall.uid}'`,
    `${where} [1] needs a non-empty "type"`,
  ]);
});

test('--check reports a file that is not JSON and sends nothing', async () => {
  const root = stage();
  writeFileSync(path.join(root, 'docs/observability/grafana/mute-timings.json'), '[{ "name": ');
  const result = await run(['grafana', '--check', '--root', root]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /ERROR \[json\] docs\/observability\/grafana\/mute-timings\.json/);
});

test('usage errors exit 2', async () => {
  assert.equal((await run(['--bogus'])).code, 2);
  assert.equal((await run(['--check', '--dry-run'])).code, 2);
  assert.equal((await run(['--check', '--prune'])).code, 2);
});

test('output masks the secret values on every line, whatever the code path', () => {
  const lines = [];
  const sink = { write: (text) => lines.push(text) };
  const secrets = [ALERT_EMAILS, ...ALERT_EMAILS.split(','), GRAFANA_TOKEN];
  const output = createOutput(secrets, sink, sink);
  output.info(`to ${ALERT_EMAILS} with ${GRAFANA_TOKEN}`);
  output.error('only oncall-two@example.invalid');
  assert.deepEqual(lines, ['to *** with ***\n', 'only ***\n']);
});

// --- env -----------------------------------------------------------------------------------------

test('a missing env key is named, never its value, and nothing is sent', async () => {
  const result = await run(['grafana'], { GRAFANA_SERVICE_ACCOUNT_TOKEN: GRAFANA_TOKEN });
  assert.equal(result.code, 1);
  const missing = 'GRAFANA_URL, GRAFANA_ALERT_EMAILS, GRAFANA_ONCALL_TIMEZONE';
  assert.ok(result.stderr.includes(`grafana needs env ${missing}`), result.stderr);
  const posthog = await run(['posthog', '--dry-run'], { POSTHOG_SYNC_API_KEY: POSTHOG_KEY });
  assert.match(posthog.stderr, /posthog needs env POSTHOG_CLI_HOST, POSTHOG_CLI_PROJECT_ID/);
});

test('a token is never sent over plain http to a remote host', async () => {
  const env = grafanaEnv('http://grafana.example.invalid');
  const result = await run(['grafana', '--dry-run'], env);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /GRAFANA_URL must be an https:\/\/ URL/);
});

// --- Grafana -------------------------------------------------------------------------------------

const OWNERS_TOKEN = /\$\{OWNERS:([^}]+)\}/g;
const OWNER_TAGS_TOKEN = /^\$\{OWNER_TAGS:([^}]+)\}$/;
function namesOf(role) {
  return owners.roles[role].map((id) => owners.people.find((p) => p.id === id).name);
}

/** The tags a dashboard file should end up with: each owner-tags token becomes owner:<id> tags. */
function expectedTags(tags) {
  return tags.flatMap((tag) => {
    const role = OWNER_TAGS_TOKEN.exec(tag)?.[1];
    return role ? owners.roles[role].map((id) => `owner:${id}`) : [tag];
  });
}

function expectedGrafanaWrites() {
  const contactPoints = readJson(path.join(GRAFANA_DIR, 'contact-points.json'));
  const muteTimings = readJson(path.join(GRAFANA_DIR, 'mute-timings.json'));
  const groups = jsonFiles(path.join(GRAFANA_DIR, 'alerts'));
  const dashboards = jsonFiles(path.join(GRAFANA_DIR, 'dashboards'));
  return [
    'POST /api/folders',
    ...contactPoints.map(() => 'POST /api/v1/provisioning/contact-points'),
    ...muteTimings.map(() => 'POST /api/v1/provisioning/mute-timings'),
    'PUT /api/v1/provisioning/policies',
    ...groups.map((group) => `PUT ${RULE_GROUPS}/${encodeURIComponent(group.title)}`),
    ...dashboards.map(() => 'POST /api/dashboards/db'),
  ];
}

test('grafana: the first run creates everything in contract order with tokens filled', async () => {
  await withStub(GRAFANA_TOKEN, grafanaApi(), async (stub) => {
    const result = await run(['grafana'], grafanaEnv(stub.url));
    assert.equal(result.code, 0, result.output);
    assert.deepEqual(described(stub.calls), expectedGrafanaWrites());

    const oncall = stub.state.contactPoints.find((cp) => cp.uid === 'ai-stylist-oncall');
    assert.equal(oncall.settings.addresses, ALERT_EMAILS);
    const quiet = stub.state.muteTimings.find((mt) => mt.name === 'quiet-hours');
    assert.equal(quiet.time_intervals[0].location, 'Europe/Berlin');
    for (const group of stub.state.groups.values()) {
      for (const query of group.rules.flatMap((rule) => rule.data)) {
        assert.ok([PROM_UID, '__expr__'].includes(query.datasourceUid), query.datasourceUid);
      }
    }
    for (const source of jsonFiles(path.join(GRAFANA_DIR, 'dashboards'))) {
      const { dashboard } = stub.state.dashboards.get(source.uid);
      assert.deepEqual(dashboard.tags, expectedTags(source.tags ?? []));
      const description = (source.description ?? '').replace(OWNERS_TOKEN, (_, role) => {
        return namesOf(role).join(', ');
      });
      assert.equal(dashboard.description ?? '', description);
      if (JSON.stringify(source).includes('${datasource}')) {
        assert.ok(JSON.stringify(dashboard).includes('${datasource}'), '${datasource} kept');
      }
    }
    const everything = JSON.stringify(writes(stub.calls).map((call) => call.body));
    assert.doesNotMatch(everything, /\$\{[A-Z]/, 'no upper-case token reaches Grafana');

    const board = stub.calls.find((call) => call.path === '/api/dashboards/db').body;
    assert.equal(board.folderUid, 'ai-stylist');
    assert.equal(board.overwrite, true);
    assert.match(board.message, /^observability-sync \S+$/);
    for (const call of stub.calls) {
      assert.equal(call.headers.authorization, `Bearer ${GRAFANA_TOKEN}`);
      assert.equal(call.headers['x-disable-provenance'], undefined);
    }
  });
});

test('grafana: a second run changes nothing', async () => {
  await withStub(GRAFANA_TOKEN, grafanaApi(), async (stub) => {
    assert.equal((await run(['grafana'], grafanaEnv(stub.url))).code, 0);
    const before = stub.calls.length;
    const second = await run(['grafana'], grafanaEnv(stub.url));
    assert.equal(second.code, 0, second.output);
    assert.deepEqual(described(stub.calls.slice(before)), []);
    assert.match(second.stdout, /grafana: done: 0 create, 0 update, 0 delete, \d+ unchanged/);
  });
});

test('grafana: query models get the defaults Grafana stores; the next run is a no-op', async () => {
  const root = stage();
  const dir = path.join(root, 'docs/observability/grafana/alerts');
  for (const name of readdirSync(dir)) {
    const group = readJson(path.join(dir, name));
    for (const query of group.rules.flatMap((rule) => rule.data)) {
      if (query.refId === 'B') {
        delete query.model.refId;
        delete query.model.intervalMs;
        delete query.model.maxDataPoints;
      } else {
        query.model.maxDataPoints = 0;
      }
    }
    writeFileSync(path.join(dir, name), JSON.stringify(group));
  }
  await withStub(GRAFANA_TOKEN, grafanaApi(), async (stub) => {
    const first = await run(['grafana', '--root', root], grafanaEnv(stub.url));
    assert.equal(first.code, 0, first.output);
    const puts = writes(stub.calls).filter((call) => call.path.startsWith(RULE_GROUPS));
    for (const query of puts.flatMap((call) => call.body.rules.flatMap((rule) => rule.data))) {
      assert.equal(query.model.refId, query.refId);
      assert.equal(query.model.maxDataPoints, 43200);
      assert.ok(query.model.intervalMs > 0, `${query.refId} intervalMs`);
      if (query.refId === 'B') assert.equal(query.model.intervalMs, 1000);
    }
    const before = stub.calls.length;
    const second = await run(['grafana', '--root', root], grafanaEnv(stub.url));
    assert.equal(second.code, 0, second.output);
    assert.deepEqual(described(stub.calls.slice(before)), []);
  });
});

test('the Grafana stub rejects a backwards weekday range, as Grafana does', () => {
  const api = grafanaApi();
  const url = new URL('http://127.0.0.1/api/v1/provisioning/mute-timings');
  const timing = (weekdays) => ({ name: weekdays, time_intervals: [{ weekdays: [weekdays] }] });
  assert.equal(api.handle('POST', url, timing('monday:sunday'))[0], 400);
  assert.equal(api.handle('POST', url, timing('sunday:saturday'))[0], 201);
});

test('grafana: --dry-run sends only GETs and prints every planned call', async (t) => {
  await withStub(GRAFANA_TOKEN, grafanaApi(), async (stub) => {
    const result = await run(['grafana', '--dry-run'], grafanaEnv(stub.url));
    t.diagnostic(result.stdout.trim());
    assert.equal(result.code, 0, result.output);
    assert.deepEqual(described(stub.calls), []);
    const planned = result.stdout.split('\n').filter((line) => line.includes('[dry-run]'));
    const plannedCalls = planned.map((line) => line.replace(/^.*: (\S+ \S+)$/, '$1'));
    assert.deepEqual(plannedCalls, expectedGrafanaWrites());
    assert.match(result.stdout, /grafana: dry run, nothing sent: /);
  });
});

test('grafana: an edited value is pushed as one update, the rest stays unchanged', async () => {
  await withStub(GRAFANA_TOKEN, grafanaApi(), async (stub) => {
    assert.equal((await run(['grafana'], grafanaEnv(stub.url))).code, 0);
    const before = stub.calls.length;
    const env = grafanaEnv(stub.url, { GRAFANA_ONCALL_TIMEZONE: 'UTC' });
    const result = await run(['grafana'], env);
    assert.equal(result.code, 0, result.output);
    const changed = described(stub.calls.slice(before));
    assert.deepEqual(changed, ['PUT /api/v1/provisioning/mute-timings/quiet-hours']);
  });
});

test('grafana: orphans are reported, and deleted only with --prune', async () => {
  await withStub(GRAFANA_TOKEN, grafanaApi(), async (stub) => {
    assert.equal((await run(['grafana'], grafanaEnv(stub.url))).code, 0);
    const retired = { uid: 'retired-dashboard', title: 'Retired', id: 7, version: 3 };
    stub.state.dashboards.set(retired.uid, { dashboard: retired, folderUid: 'ai-stylist' });
    const [first] = stub.state.groups.values();
    const orphan = structuredClone(first);
    orphan.title = 'retired-group';
    const moved = (rule) => ({ ...rule, uid: 'retired-rule', ruleGroup: 'retired-group' });
    orphan.rules = orphan.rules.map(moved);
    stub.state.groups.set('ai-stylist/retired-group', orphan);

    const before = stub.calls.length;
    const report = await run(['grafana'], grafanaEnv(stub.url));
    assert.equal(report.code, 0, report.output);
    assert.deepEqual(described(stub.calls.slice(before)), []);
    assert.match(report.stderr, /alert rule group retired-group has no file; --prune deletes it/);
    assert.match(report.stderr, /dashboard retired-dashboard has no file; --prune deletes it/);

    const pruneStart = stub.calls.length;
    const prune = await run(['grafana', '--prune'], grafanaEnv(stub.url));
    assert.equal(prune.code, 0, prune.output);
    const expected = [
      `DELETE ${RULE_GROUPS}/retired-group`,
      'DELETE /api/dashboards/uid/retired-dashboard',
    ];
    assert.deepEqual(described(stub.calls.slice(pruneStart)), expected);
  });
});

test('grafana: an ambiguous Prometheus datasource fails before any write', async () => {
  const datasources = [
    { uid: 'a', name: 'grafanacloud-one-prom', type: 'prometheus' },
    { uid: 'b', name: 'grafanacloud-two-prom', type: 'prometheus' },
    { uid: 'c', name: 'team-prom', type: 'prometheus' },
  ];
  await withStub(GRAFANA_TOKEN, grafanaApi({ datasources }), async (stub) => {
    const result = await run(['grafana'], grafanaEnv(stub.url));
    assert.equal(result.code, 1);
    const message = 'need the prometheus datasource with uid grafanacloud-prom, or exactly one';
    assert.ok(result.stderr.includes(`${message} named grafanacloud-<stack>-prom; found 2`));
    assert.deepEqual(described(stub.calls), []);
  });
});

test('grafana: uid grafanacloud-prom wins; other Prometheus datasources are ignored', async () => {
  const datasources = [
    { uid: 'team', name: 'team-prom', type: 'prometheus' },
    { uid: 'grafanacloud-usage', name: 'grafanacloud-usage', type: 'prometheus' },
    { uid: 'other', name: 'grafanacloud-other-prom', type: 'prometheus' },
    { uid: 'grafanacloud-prom', name: 'grafanacloud-mystack-prom', type: 'prometheus' },
  ];
  await withStub(GRAFANA_TOKEN, grafanaApi({ datasources }), async (stub) => {
    const result = await run(['grafana'], grafanaEnv(stub.url));
    assert.equal(result.code, 0, result.output);
    for (const group of stub.state.groups.values()) {
      for (const query of group.rules.flatMap((rule) => rule.data)) {
        assert.ok(['grafanacloud-prom', '__expr__'].includes(query.datasourceUid));
      }
    }
  });
});

test('grafana: an HTTP error prints method, path and status, never the body', async () => {
  const api = grafanaApi({ failOn: 'PUT /api/v1/provisioning/policies' });
  await withStub(GRAFANA_TOKEN, api, async (stub) => {
    const result = await run(['grafana'], grafanaEnv(stub.url));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /grafana: ERROR PUT \/api\/v1\/provisioning\/policies → 500/);
    assert.doesNotMatch(result.output, /STUB-ERROR-BODY/);
  });
});

test('grafana: a rejected token says so without echoing the token or the body', async () => {
  await withStub(GRAFANA_TOKEN, grafanaApi(), async (stub) => {
    const wrong = { GRAFANA_SERVICE_ACCOUNT_TOKEN: 'glsa_wrong_DO_NOT_PRINT' };
    const result = await run(['grafana'], grafanaEnv(stub.url, wrong));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /GET \/api\/datasources → 401 \(the key was rejected/);
    assert.doesNotMatch(result.output, /rejected Bearer/);
  });
});

// --- PostHog -------------------------------------------------------------------------------------

const retiredFlag = () => ({
  id: 11,
  key: 'retired-flag',
  name: 'Gone [registry: owner arthur-minasyan, rollout, expires 2026-01-01]',
  active: true,
  filters: { groups: [{ properties: [], rollout_percentage: 100 }] },
  deleted: false,
});
const manualFlag = () => ({
  id: 12,
  key: 'manual-experiment',
  name: 'Created in the PostHog UI',
  active: true,
  filters: { groups: [{ properties: [], rollout_percentage: 20 }] },
  deleted: false,
});

function registryName(key) {
  const flag = registry.flags[key];
  const expires = flag.expiresAt ?? 'never';
  return `${flag.purpose} [registry: owner ${flag.owner}, ${flag.kind}, expires ${expires}]`;
}

test('posthog: settings, GeoIP and flags are applied; a second run changes nothing', async () => {
  const api = posthogApi(PROJECT_ID, { flags: [retiredFlag(), manualFlag()] });
  await withStub(POSTHOG_KEY, api, async (stub) => {
    const result = await run(['posthog'], posthogEnv(stub.url));
    assert.equal(result.code, 0, result.output);
    const base = `/api/projects/${PROJECT_ID}`;
    const keys = Object.keys(registry.flags);
    const expected = [
      `PATCH ${base}/`,
      `PATCH ${base}/hog_functions/fn-geoip/`,
      ...keys.map(() => `POST ${base}/feature_flags/`),
    ];
    assert.deepEqual(described(stub.calls), expected);
    assert.deepEqual(writes(stub.calls)[0].body, readJson(POSTHOG_SETTINGS).project);
    assert.equal(stub.state.functions.find((fn) => fn.id === 'fn-other').enabled, true);
    for (const key of keys) {
      const created = stub.state.flags.find((flag) => flag.key === key);
      assert.equal(created.name, registryName(key));
      assert.equal(created.active, false);
      assert.deepEqual(created.filters, { groups: [{ properties: [], rollout_percentage: 0 }] });
    }
    assert.match(result.stderr, /flag retired-flag left the registry; --prune soft-deletes it/);
    assert.equal(stub.state.flags.find((flag) => flag.key === 'retired-flag').deleted, false);

    const before = stub.calls.length;
    const second = await run(['posthog'], posthogEnv(stub.url));
    assert.equal(second.code, 0, second.output);
    assert.deepEqual(described(stub.calls.slice(before)), []);
  });
});

test('posthog: an existing flag gets only its name; active and filters stay human', async () => {
  const [key] = Object.keys(registry.flags);
  const rolledOut = {
    id: 21,
    key,
    name: 'stale description',
    active: true,
    filters: { groups: [{ properties: [], rollout_percentage: 50 }] },
    deleted: false,
  };
  const api = posthogApi(PROJECT_ID, { flags: [rolledOut, retiredFlag(), manualFlag()] });
  await withStub(POSTHOG_KEY, api, async (stub) => {
    assert.equal((await run(['posthog'], posthogEnv(stub.url))).code, 0);
    const patch = stub.calls.find((call) => call.path.endsWith('/feature_flags/21/'));
    assert.deepEqual(patch.body, { name: registryName(key) });
    const flag = stub.state.flags.find((item) => item.id === 21);
    assert.equal(flag.active, true);
    assert.equal(flag.filters.groups[0].rollout_percentage, 50);

    const before = stub.calls.length;
    const prune = await run(['posthog', '--prune'], posthogEnv(stub.url));
    assert.equal(prune.code, 0, prune.output);
    const pruned = writes(stub.calls.slice(before)).map((call) => [call.path, call.body]);
    const expected = [[`/api/projects/${PROJECT_ID}/feature_flags/11/`, { deleted: true }]];
    assert.deepEqual(pruned, expected);
    assert.equal(stub.state.flags.find((item) => item.id === 12).deleted, false);
  });
});

test('posthog: an archived registry flag is reported, never created a second time', async () => {
  const [key] = Object.keys(registry.flags);
  const archived = {
    id: 31,
    key,
    name: registryName(key),
    active: false,
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
    deleted: false,
    archived: true,
  };
  const api = posthogApi(PROJECT_ID, { flags: [archived] });
  await withStub(POSTHOG_KEY, api, async (stub) => {
    const result = await run(['posthog'], posthogEnv(stub.url));
    assert.equal(result.code, 0, result.output);
    const flagsPath = `/api/projects/${PROJECT_ID}/feature_flags/`;
    assert.ok(stub.calls.some((call) => call.path.startsWith(`${flagsPath}?archived=true`)));
    const created = writes(stub.calls).filter((call) => call.path === flagsPath);
    assert.deepEqual(created, []);
    assert.ok(result.stderr.includes(`WARN  posthog: flag ${key} is archived in PostHog`));
  });
});

test('posthog: a listed template with no transformation is reported', async () => {
  const other = { id: 'fn-other', type: 'transformation', enabled: true, template: { id: 'x' } };
  const api = posthogApi(PROJECT_ID, { functions: [other] });
  await withStub(POSTHOG_KEY, api, async (stub) => {
    const result = await run(['posthog'], posthogEnv(stub.url));
    assert.equal(result.code, 0, result.output);
    assert.match(result.stderr, /WARN {2}posthog: no transformation from template-geoip found/);
    assert.equal(stub.state.functions[0].enabled, true);
  });
});

test('posthog: a 403 on transformations prints the human step; the run goes on', async () => {
  const api = posthogApi(PROJECT_ID, { denyTransformations: true });
  await withStub(POSTHOG_KEY, api, async (stub) => {
    const result = await run(['posthog'], posthogEnv(stub.url));
    assert.equal(result.code, 0, result.output);
    assert.match(result.stderr, /→ 403: .*Data pipelines → Transformations → GeoIP → disable/);
    assert.ok(stub.calls.some((call) => call.method === 'POST'), 'flags are still created');
  });
});

// --- both ----------------------------------------------------------------------------------------

test('all --dry-run plans both vendors and sends nothing', async (t) => {
  await withStub(GRAFANA_TOKEN, grafanaApi(), async (grafana) => {
    await withStub(POSTHOG_KEY, posthogApi(PROJECT_ID), async (posthog) => {
      const env = { ...grafanaEnv(grafana.url), ...posthogEnv(posthog.url) };
      const result = await run(['all', '--dry-run'], env);
      t.diagnostic(result.stdout.trim());
      assert.equal(result.code, 0, result.output);
      assert.deepEqual(described([...grafana.calls, ...posthog.calls]), []);
      assert.match(result.stdout, /grafana: dry run, nothing sent/);
      assert.match(result.stdout, /posthog: dry run, nothing sent/);
    });
  });
});
