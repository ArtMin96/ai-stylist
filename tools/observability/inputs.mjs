// Reads every definition the sync pushes, relative to a root: the repository, or a staged copy in
// the tests. Each file is `{ rel, data }`, or `{ rel, error }` when it is missing or not JSON, so
// --check can report every problem in one run instead of stopping at the first.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const PATHS = {
  owners: 'packages/shared-kernel/registry/owners.json',
  flags: 'packages/shared-kernel/registry/feature-flags.json',
  flagSchema: 'packages/shared-kernel/registry/feature-flags.schema.json',
  grafana: 'docs/observability/grafana',
  posthogSettings: 'docs/observability/posthog/project-settings.json',
  runbooks: 'docs/runbooks',
};

function readJson(root, rel) {
  const file = path.join(root, rel);
  if (!existsSync(file)) return { rel, error: 'file is missing' };
  try {
    return { rel, data: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (error) {
    return { rel, error: `not valid JSON (${error.message})` };
  }
}

/** Every `*.json` file of a directory, sorted by name. */
function readJsonDir(root, rel) {
  const dir = path.join(root, rel);
  if (!existsSync(dir)) return [{ rel, error: 'directory is missing' }];
  const names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  return names.sort().map((name) => readJson(root, `${rel}/${name}`));
}

export function loadInputs(root) {
  const read = (rel) => readJson(root, rel);
  return {
    root,
    owners: read(PATHS.owners),
    flags: read(PATHS.flags),
    flagSchema: read(PATHS.flagSchema),
    grafana: {
      contactPoints: read(`${PATHS.grafana}/contact-points.json`),
      muteTimings: read(`${PATHS.grafana}/mute-timings.json`),
      policy: read(`${PATHS.grafana}/notification-policy.json`),
      alerts: readJsonDir(root, `${PATHS.grafana}/alerts`),
      dashboards: readJsonDir(root, `${PATHS.grafana}/dashboards`),
    },
    posthogSettings: read(PATHS.posthogSettings),
  };
}

/** Every Grafana file, in sync order. */
export function grafanaFiles(inputs) {
  const { contactPoints, muteTimings, policy, alerts, dashboards } = inputs.grafana;
  return [contactPoints, muteTimings, policy, ...alerts, ...dashboards];
}
