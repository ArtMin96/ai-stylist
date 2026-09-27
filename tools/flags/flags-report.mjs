#!/usr/bin/env node
// Expired-flag report (planning/14 §11, NFR-OBS-080; P02-T09 AC-10). One row per flag in the
// registry: key, kind, owner (display name resolved from owners.json), expiry, days left or
// overdue, status. A rollout or experiment flag past its expiresAt (a UTC date) fails the report;
// more than 30 days overdue is a DEFECT that its owner fixes. Kill-switch flags are exempt.
// Run by `just flags-report` (nightly CI); `just flags-report --fixtures` runs check-fixtures.sh.
// Details: tools/flags/README.md.
//
// Usage: node tools/flags/flags-report.mjs [--today YYYY-MM-DD] [--registry <file>]
//                                          [--owners <file>]
//   --today    the UTC date to judge expiry by (default: today in UTC); fixtures pin it
//   --registry  flag registry (default: packages/shared-kernel/registry/feature-flags.json)
//   --owners    owner registry (default: packages/shared-kernel/registry/owners.json)
// Exit: 0 no flag past expiry, 1 at least one flag past expiry, 2 usage error or malformed registry.
// Node built-ins only: it runs before `pnpm install`, on Linux and macOS alike.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const REGISTRY_DIR = path.join(REPO_ROOT, 'packages/shared-kernel/registry');
const DEFECT_DAYS = 30; // planning/14 §11: "> 30 d overdue = defect with owner"
const DAY_MS = 86_400_000;
const OPTIONS = new Map([
  ['--today', 'today'],
  ['--registry', 'registry'],
  ['--owners', 'owners'],
]);
const ADVICE =
  'retire each expired flag with its last check, or record a reviewed new expiresAt (doc 14 §11)';

class UsageError extends Error {}
function fatal(message) {
  throw new UsageError(message);
}

function parseArgs(argv) {
  const opts = {
    today: new Date().toISOString().slice(0, 10),
    registry: path.join(REGISTRY_DIR, 'feature-flags.json'),
    owners: path.join(REGISTRY_DIR, 'owners.json'),
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = OPTIONS.get(argv[i]);
    if (!key) fatal(`unknown argument '${argv[i]}' (use --today, --registry, --owners)`);
    if (argv[i + 1] === undefined) fatal(`${argv[i]} needs a value`);
    opts[key] = key === 'today' ? argv[i + 1] : path.resolve(argv[i + 1]);
  }
  return opts;
}

// Whole days since 1970-01-01 (UTC) of a YYYY-MM-DD date; NaN unless it is a real calendar date.
function dayNumber(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return NaN;
  return ms / DAY_MS;
}

const shown = (file) => path.relative(REPO_ROOT, file) || file;
const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return fatal(`cannot read ${shown(file)}: ${err.message}`);
  }
}

// One table row for a flag, and how many days it is overdue (0 or less when it is not).
function judge(key, flag, today, names) {
  if (typeof flag !== 'object' || flag === null) fatal(`flag '${key}' is not an object`);
  const owner = names.get(flag.owner);
  if (owner === undefined) fatal(`flag '${key}': owner '${flag.owner}' is not a person id`);
  if (flag.kind === 'kill-switch') {
    return { cells: [key, flag.kind, owner, flag.expiresAt ?? '-', '-', 'exempt'], overdue: 0 };
  }
  if (flag.kind !== 'rollout' && flag.kind !== 'experiment') {
    fatal(`flag '${key}': unknown kind '${flag.kind}'`);
  }
  const expires = dayNumber(flag.expiresAt);
  if (Number.isNaN(expires)) {
    fatal(`flag '${key}' (${flag.kind}): expiresAt must be a YYYY-MM-DD date`);
  }
  const left = expires - today;
  let status = 'ok';
  if (left === 0) status = 'expires today';
  if (left < 0) status = 'EXPIRED';
  if (-left > DEFECT_DAYS) status = 'DEFECT';
  const when = left < 0 ? `${days(-left)} overdue` : `${days(left)} left`;
  return { cells: [key, flag.kind, owner, flag.expiresAt, when, status], overdue: -left };
}

// Left-aligned columns two spaces apart, a dashed rule under the header, no trailing blanks.
function formatTable(header, rows) {
  const all = [header, ...rows];
  const widths = header.map((_, c) => Math.max(...all.map((cells) => cells[c].length)));
  const rule = widths.map((width) => '-'.repeat(width));
  return [header, rule, ...rows].map((cells) => {
    const padded = cells.map((cell, c) => cell.padEnd(widths[c]));
    return padded.join('  ').trimEnd();
  });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const today = dayNumber(opts.today);
  if (Number.isNaN(today)) {
    fatal(`--today must be a real YYYY-MM-DD date, got '${opts.today}'`);
  }
  const registry = readJson(opts.registry);
  const owners = readJson(opts.owners);
  if (typeof registry?.flags !== 'object' || registry.flags === null) {
    fatal(`${shown(opts.registry)}: "flags" must be an object`);
  }
  if (!Array.isArray(owners?.people)) {
    fatal(`${shown(opts.owners)}: "people" must be an array`);
  }
  const names = new Map(owners.people.map((person) => [person?.id, person?.name]));

  const keys = Object.keys(registry.flags).sort();
  const judged = keys.map((key) => judge(key, registry.flags[key], today, names));
  const header = ['flag', 'kind', 'owner', 'expiresAt', 'days', 'status'];
  const lines = formatTable(header, judged.map((j) => j.cells));
  process.stdout.write(`Feature flags on ${opts.today} (UTC) in ${shown(opts.registry)}\n\n`);
  process.stdout.write(`${lines.join('\n')}\n\n`);

  const expired = judged.filter((j) => j.overdue > 0);
  const defects = expired.filter((j) => j.overdue > DEFECT_DAYS);
  if (expired.length === 0) {
    process.stdout.write(`flags-report: ${judged.length} flag(s), none past expiry\n`);
    return 0;
  }
  const verdict = `${expired.length} flag(s) past expiry, ${defects.length} of them DEFECT`;
  process.stderr.write(`flags-report: ${verdict} (> ${DEFECT_DAYS} days overdue)\n`);
  process.stderr.write(`flags-report: ${ADVICE}\n`);
  return 1;
}

// exitCode, never process.exit(): stdout to a pipe is asynchronous on macOS and would be cut off.
try {
  process.exitCode = main();
} catch (err) {
  const detail = err instanceof UsageError ? err.message : `internal error: ${err?.stack}`;
  process.stderr.write(`flags-report: ${detail}\n`);
  process.exitCode = 2;
}
