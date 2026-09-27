// Local stand-ins for the Grafana and PostHog HTTP APIs that tools/observability/sync.mjs calls,
// with just enough state to prove call order, substitution and idempotence. They answer 401
// (echoing the Authorization header in the body, to prove the sync never prints a body) without the
// expected bearer token, and 404 for any route the sync has no reason to call. Like the real
// servers, they add fields of their own (`id`, `provenance`, Go zero values, query-model defaults)
// to what they return, and they reject what the real servers reject (a backwards weekday range, a
// second flag with the same key).
import http from 'node:http';

/** Serves `handle(method, url, body, origin)` → `[status, body?]` on 127.0.0.1. */
export async function serve(token, handle) {
  const calls = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const url = new URL(request.url, origin);
      const body = text === '' ? undefined : JSON.parse(text);
      const path = `${url.pathname}${url.search}`;
      calls.push({ method: request.method, path, body, headers: request.headers });
      const authorized = request.headers.authorization === `Bearer ${token}`;
      const denied = [401, { detail: `rejected ${request.headers.authorization}` }];
      const [status, payload] = authorized ? handle(request.method, url, body, origin) : denied;
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(payload === undefined ? '' : JSON.stringify(payload));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const close = () => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  };
  return { url: origin, calls, close };
}

const clone = (value) => structuredClone(value);

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Grafana's alertmanager fork: "start day cannot be before end day" (sunday is day 0). */
function hasBackwardsWeekdays(timing) {
  const ranges = (timing.time_intervals ?? []).flatMap((interval) => interval.weekdays ?? []);
  return ranges.some((range) => {
    const days = range.toLowerCase().split(':');
    return WEEKDAYS.indexOf(days[0]) > WEEKDAYS.indexOf(days.at(-1));
  });
}

/** Grafana's AlertQuery.GetModel(): a stored model has refId, intervalMs and maxDataPoints. */
function storedQuery(query) {
  const model = { ...clone(query.model), refId: query.refId };
  if (!model.intervalMs) model.intervalMs = 1000;
  if (!model.maxDataPoints) model.maxDataPoints = 43200;
  return { ...clone(query), model };
}

/** Grafana: folders, provisioning API, dashboards, datasources and search. */
export function grafanaApi(options = {}) {
  const state = {
    datasources: options.datasources ?? [
      { uid: 'stub-prom-uid', name: 'grafanacloud-stub-prom', type: 'prometheus' },
      { uid: 'stub-logs-uid', name: 'grafanacloud-stub-logs', type: 'loki' },
    ],
    folders: new Map(),
    contactPoints: [
      { uid: 'stub-default', name: 'grafana-default-email', type: 'email', settings: {} },
    ],
    muteTimings: [],
    policy: { receiver: 'grafana-default-email', group_by: ['grafana_folder', 'alertname'] },
    groups: new Map(),
    dashboards: new Map(),
    nextId: 100,
    failOn: options.failOn ?? null,
  };
  const P = '/api/v1/provisioning';

  function contactPoints(method, rest, body) {
    if (rest === '' && method === 'GET') {
      return [200, state.contactPoints.map((cp) => ({ ...clone(cp), provenance: 'api' }))];
    }
    if (rest === '' && method === 'POST') {
      state.contactPoints.push(clone(body));
      return [202, body];
    }
    const i = state.contactPoints.findIndex((cp) => `/${cp.uid}` === rest);
    if (method !== 'PUT' || i === -1) return [404, { message: 'contact point not found' }];
    state.contactPoints[i] = clone(body);
    return [202, body];
  }

  function muteTimings(method, rest, body) {
    if (rest === '' && method === 'GET') {
      const list = state.muteTimings.map((mt) => ({ ...clone(mt), version: 'v1' }));
      return [200, list];
    }
    if (method !== 'GET' && hasBackwardsWeekdays(body)) {
      return [400, { message: 'start day cannot be before end day' }];
    }
    if (rest === '' && method === 'POST') {
      state.muteTimings.push(clone(body));
      return [201, body];
    }
    const i = state.muteTimings.findIndex((mt) => `/${encodeURIComponent(mt.name)}` === rest);
    if (method !== 'PUT' || i === -1) return [404, { message: 'mute timing not found' }];
    state.muteTimings[i] = clone(body);
    return [202, body];
  }

  function policies(method, body) {
    if (method === 'GET') return [200, { ...clone(state.policy), provenance: 'api' }];
    const receivers = new Set(state.contactPoints.map((cp) => cp.name));
    const timings = new Set(state.muteTimings.map((mt) => mt.name));
    const routes = [body, ...(body.routes ?? [])];
    for (const route of routes) {
      if (route.receiver !== undefined && !receivers.has(route.receiver)) {
        return [400, { message: 'unknown receiver' }];
      }
      for (const name of route.mute_time_intervals ?? []) {
        if (!timings.has(name)) return [400, { message: 'unknown mute timing' }];
      }
    }
    state.policy = clone(body);
    return [202, { message: 'policies updated' }];
  }

  function withServerFields(group) {
    const rules = group.rules.map((rule, i) => ({
      id: i + 1,
      orgID: 1,
      updated: '2026-09-27T00:00:00Z',
      provenance: 'api',
      ...clone(rule),
      data: rule.data.map((query) => ({ queryType: '', ...clone(query) })),
    }));
    return { ...clone(group), rules };
  }

  function ruleGroup(method, folder, title, body) {
    const key = `${folder}/${title}`;
    if (method === 'GET') {
      const group = state.groups.get(key);
      return group ? [200, withServerFields(group)] : [404, { message: 'rule group not found' }];
    }
    if (method === 'DELETE') {
      state.groups.delete(key);
      return [204];
    }
    if (!state.folders.has(folder)) return [404, { message: 'folder not found' }];
    const consistent = body.rules.every((r) => r.folderUID === folder && r.ruleGroup === title);
    if (body.title !== title || !consistent) return [400, { message: 'inconsistent group' }];
    const rules = body.rules.map((rule) => ({ ...clone(rule), data: rule.data.map(storedQuery) }));
    state.groups.set(key, { ...clone(body), rules });
    return [200, body];
  }

  function saveDashboard(body) {
    if (!state.folders.has(body.folderUid)) return [400, { message: 'folder not found' }];
    const uid = body.dashboard.uid;
    const existing = state.dashboards.get(uid);
    const id = existing?.dashboard.id ?? (state.nextId += 1);
    const version = (existing?.dashboard.version ?? 0) + 1;
    const dashboard = { ...clone(body.dashboard), id, version };
    state.dashboards.set(uid, { dashboard, folderUid: body.folderUid });
    return [200, { status: 'success', uid, version }];
  }

  function handle(method, url, body) {
    const p = decodeURIComponent(url.pathname);
    if (state.failOn === `${method} ${url.pathname}`) {
      return [500, { message: 'STUB-ERROR-BODY must never be printed' }];
    }
    if (method === 'GET' && p === '/api/datasources') return [200, state.datasources];
    let m = /^\/api\/folders\/([^/]+)$/.exec(p);
    if (m && method === 'GET') {
      const folder = state.folders.get(m[1]);
      return folder ? [200, folder] : [404, { message: 'folder not found' }];
    }
    if (method === 'POST' && p === '/api/folders') {
      state.folders.set(body.uid, { uid: body.uid, title: body.title, id: (state.nextId += 1) });
      return [200, state.folders.get(body.uid)];
    }
    if (url.pathname.startsWith(`${P}/contact-points`)) {
      return contactPoints(method, url.pathname.slice(`${P}/contact-points`.length), body);
    }
    if (url.pathname.startsWith(`${P}/mute-timings`)) {
      return muteTimings(method, url.pathname.slice(`${P}/mute-timings`.length), body);
    }
    if (p === `${P}/policies`) return policies(method, body);
    m = /^\/api\/v1\/provisioning\/folder\/([^/]+)\/rule-groups\/([^/]+)$/.exec(p);
    if (m) return ruleGroup(method, m[1], m[2], body);
    if (method === 'GET' && p === `${P}/alert-rules`) {
      const rules = [...state.groups.values()].flatMap((group) => withServerFields(group).rules);
      return [200, rules];
    }
    if (method === 'POST' && p === '/api/dashboards/db') return saveDashboard(body);
    m = /^\/api\/dashboards\/uid\/([^/]+)$/.exec(p);
    if (m) {
      const stored = state.dashboards.get(m[1]);
      if (!stored) return [404, { message: 'dashboard not found' }];
      if (method === 'DELETE') {
        state.dashboards.delete(m[1]);
        return [200, { title: stored.dashboard.title }];
      }
      return [200, { dashboard: clone(stored.dashboard), meta: { folderUid: stored.folderUid } }];
    }
    if (method === 'GET' && p === '/api/search') {
      const folder = url.searchParams.get('folderUIDs');
      const hits = [...state.dashboards.values()].filter((d) => d.folderUid === folder);
      return [200, hits.map((d) => ({ uid: d.dashboard.uid, type: 'dash-db' }))];
    }
    return [404, { message: `stub: no route for ${method} ${p}` }];
  }

  return { state, handle };
}

/** One page of `items` per request, with an absolute `next` link like PostHog's. */
function page(items, url, origin) {
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const next = new URL(url.pathname, origin);
  for (const [key, value] of url.searchParams) next.searchParams.set(key, value);
  next.searchParams.set('offset', String(offset + 1));
  const results = items.slice(offset, offset + 1);
  return { count: items.length, next: offset + 1 < items.length ? next.href : null, results };
}

const GEOIP = 'template-geoip';

/** PostHog: one project's settings, transformations and feature flags. */
export function posthogApi(projectId, options = {}) {
  const state = {
    project: {
      id: Number(projectId),
      name: 'Stub project',
      anonymize_ips: false,
      autocapture_exceptions_opt_in: false,
      session_recording_opt_in: true,
      surveys_opt_in: true,
      autocapture_opt_out: false,
      heatmaps_opt_in: true,
      capture_console_log_opt_in: true,
      capture_performance_opt_in: true,
    },
    // Like PostHog's list serializer: the template is `template.id`, there is no `template_id`.
    functions: options.functions ?? [
      { id: 'fn-geoip', type: 'transformation', enabled: true, template: { id: GEOIP } },
      { id: 'fn-other', type: 'transformation', enabled: true, template: { id: 'template-x' } },
    ],
    flags: options.flags ?? [],
    nextId: 500,
    denyTransformations: options.denyTransformations ?? false,
  };
  const base = `/api/projects/${projectId}`;

  function handle(method, url, body, origin) {
    const p = url.pathname;
    if (p === `${base}/`) {
      if (method === 'GET') return [200, clone(state.project)];
      if (method === 'PATCH') {
        Object.assign(state.project, body);
        return [200, clone(state.project)];
      }
    }
    if (p.startsWith(`${base}/hog_functions/`) && state.denyTransformations) {
      return [403, { detail: 'You do not have permission to perform this action.' }];
    }
    if (method === 'GET' && p === `${base}/hog_functions/`) {
      const type = url.searchParams.get('type');
      const list = state.functions.filter((fn) => fn.type === type);
      return [200, page(list, url, origin)];
    }
    let m = new RegExp(`^${base}/hog_functions/([^/]+)/$`).exec(p);
    if (m && method === 'PATCH') {
      const fn = state.functions.find((item) => item.id === m[1]);
      if (!fn) return [404, { detail: 'Not found.' }];
      Object.assign(fn, body);
      return [200, clone(fn)];
    }
    if (method === 'GET' && p === `${base}/feature_flags/`) {
      // Archived flags are listed only with ?archived=true (`archived` is stub-only state).
      const archived = url.searchParams.get('archived') === 'true';
      const listed = (flag) => !flag.deleted && Boolean(flag.archived) === archived;
      return [200, page(state.flags.filter(listed), url, origin)];
    }
    if (method === 'POST' && p === `${base}/feature_flags/`) {
      if (state.flags.some((flag) => !flag.deleted && flag.key === body.key)) {
        return [400, { detail: 'There is already a feature flag with this key.' }];
      }
      const flag = { id: (state.nextId += 1), deleted: false, ...clone(body) };
      state.flags.push(flag);
      return [201, clone(flag)];
    }
    m = new RegExp(`^${base}/feature_flags/(\\d+)/$`).exec(p);
    if (m && method === 'PATCH') {
      const flag = state.flags.find((item) => String(item.id) === m[1]);
      if (!flag) return [404, { detail: 'Not found.' }];
      Object.assign(flag, body);
      return [200, clone(flag)];
    }
    return [404, { detail: `stub: no route for ${method} ${p}` }];
  }

  return { state, handle };
}
