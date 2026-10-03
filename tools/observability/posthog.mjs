// Applies docs/observability/posthog/project-settings.json and the flag registry
// (packages/shared-kernel/registry/feature-flags.json) to one PostHog project, as
// docs/observability/posthog/README.md describes: project settings, disabled transformations,
// then flags. A new flag is created OFF at 0 %; on an existing flag only its name (PostHog's
// description) is updated, never `active` or `filters`: turning a flag on is a human decision.
import { sameJson } from './compare.mjs';
import { HttpError } from './http.mjs';

const REGISTRY_TAG = '[registry:';
const GEOIP_HUMAN_STEP =
  'disable it by hand: PostHog → Data pipelines → Transformations → GeoIP → disable';

/** The PostHog flag name for a registry entry; the `[registry: …]` suffix marks it as synced. */
export function registryFlagName(key, flag) {
  const expires = flag.expiresAt ?? 'never';
  return `${flag.purpose} [registry: owner ${flag.owner}, ${flag.kind}, expires ${expires}]`;
}

async function syncSettings(client, report, base, project) {
  const current = await client.get(`${base}/`);
  const differs = Object.keys(project).filter((key) => !sameJson(project[key], current?.[key]));
  if (differs.length === 0) {
    report.unchanged('project settings');
    return;
  }
  const what = `project settings (${differs.join(', ')})`;
  await client.mutate('update', 'PATCH', `${base}/`, project, what);
}

/**
 * A 403 on the transformation calls prints the human step instead of failing the run. The list
 * response names the template only as `template.id` (`template_id` needs `?full=true`); a listed
 * template that matches no function is reported, so a renamed template never passes silently.
 */
async function disableTransformations(client, report, base, templates) {
  try {
    const functions = await client.getAll(`${base}/hog_functions/?type=transformation`);
    const found = new Set();
    for (const fn of functions) {
      const template = fn?.template?.id;
      if (!templates.includes(template)) continue;
      found.add(template);
      const what = `transformation ${fn.id} (${template})`;
      if (fn.enabled !== true) {
        report.unchanged(`${what}, disabled`);
        continue;
      }
      const path = `${base}/hog_functions/${encodeURIComponent(fn.id)}/`;
      await client.mutate('update', 'PATCH', path, { enabled: false }, `${what}: disable`);
    }
    for (const template of templates.filter((id) => !found.has(id))) {
      report.warn(`no transformation from ${template} found; nothing to disable`);
    }
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    report.warn(`${error.message}: the key cannot manage transformations; ${GEOIP_HUMAN_STEP}`);
  }
}

/** Keys of the flags `path` lists, soft-deleted flags left out. */
async function flagsByKey(client, path) {
  const byKey = new Map();
  for (const flag of await client.getAll(path)) {
    if (flag?.deleted !== true) byKey.set(flag?.key, flag);
  }
  return byKey;
}

/**
 * The plain list leaves archived flags out; they come only with `?archived=true`. A key that is
 * listed only there is archived: creating it again would get a 400, so it is reported instead.
 */
async function syncFlags(client, report, { base, registry, prune }) {
  const byKey = await flagsByKey(client, `${base}/feature_flags/?limit=100`);
  const archived = await flagsByKey(client, `${base}/feature_flags/?archived=true&limit=100`);
  for (const [key, entry] of Object.entries(registry)) {
    const name = registryFlagName(key, entry);
    const existing = byKey.get(key);
    if (existing === undefined && archived.has(key)) {
      report.warn(`flag ${key} is archived in PostHog: unarchive it there or retire the key`);
    } else if (existing === undefined) {
      const body = {
        key,
        name,
        active: false,
        filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
      };
      await client.mutate('create', 'POST', `${base}/feature_flags/`, body, `flag ${key} (off)`);
    } else if (existing.name === name) {
      report.unchanged(`flag ${key}`);
    } else {
      const path = `${base}/feature_flags/${encodeURIComponent(existing.id)}/`;
      await client.mutate('update', 'PATCH', path, { name }, `flag ${key} name`);
    }
  }
  for (const [key, flag] of byKey) {
    const tagged = typeof flag.name === 'string' && flag.name.includes(REGISTRY_TAG);
    if (!tagged || Object.hasOwn(registry, key)) continue;
    if (prune) {
      const path = `${base}/feature_flags/${encodeURIComponent(flag.id)}/`;
      const what = `flag ${key} (soft delete)`;
      await client.mutate('delete', 'PATCH', path, { deleted: true }, what);
    } else {
      report.warn(`flag ${key} left the registry; --prune soft-deletes it`);
    }
  }
}

/** `env`: the POSTHOG_CLI_* / POSTHOG_SYNC_* values; `client`: createClient() for the API host. */
export async function syncPosthog({ inputs, env, client, report, prune }) {
  const base = `/api/projects/${encodeURIComponent(env.POSTHOG_CLI_PROJECT_ID)}`;
  const settings = inputs.posthogSettings.data;
  await syncSettings(client, report, base, settings.project);
  await disableTransformations(client, report, base, settings.disabledTransformationTemplates);
  await syncFlags(client, report, { base, registry: inputs.flags.data.flags, prune });
}
