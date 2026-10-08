#!/usr/bin/env node
// Breaking-change check for the versioned JSON Schemas of this package, base vs head
// (planning/06 §4 "Versioning rules": additive-only within vN; renaming, removing or retyping
// needs vN+1): the event schemas in events/*.json and the internal worker HTTP contracts in
// workers/<service>/*.json (e.g. workers/segmentation/segmentation.v1.json). Node built-ins only,
// so it runs before and without `pnpm install`.
//
//   node packages/contracts/scripts/events-breaking.mjs --base-ref <git-ref> [--repo <dir>]
//   node packages/contracts/scripts/events-breaking.mjs --base-dir <dir> --head-dir <dir>
//   pnpm --filter @ai-stylist/contracts run breaking:events --base-ref <git-ref>
//
// The schema dirs are this package's events/ and every workers/<service>/ on the base or head,
// resolved from this file (package-relative). --base-ref reads the base schemas from git
// (`git show <ref>:<dir>/<f>`, where <dir> is that directory relative to
// `git rev-parse --show-toplevel`, e.g. `packages/contracts/events`) and compares each dir with the
// working tree of the repository: the package's own, or --repo <dir> with the same layout (the
// tests' throwaway repos). --base-dir/--head-dir compare two directories (the tests' fixtures).
// Only top-level *.json files of a schema dir are schemas; events/analytics/ is a separate taxonomy.
//
// A schema version is keyed by its `properties.type.const` (the `<module>.<entity>.<action>.vN`
// event type), else its `$id`, else its file name, so moving a schema to another file is not a
// change and a v2 next to v1 is a new schema. For every version present on the base, head must
// still have it and must not, at any depth reached through properties, items and local $refs:
//   remove a property · newly require a property · change or narrow a type (integer → number is
//   a widening and allowed) · remove an enum value, add an enum/const or change a const ·
//   tighten additionalProperties/unevaluatedProperties (open → schema → false).
// A root `anyOf`/`oneOf` of local $refs lists the messages of a contract (the worker contracts):
// each base message must still be listed, under the same $ref, and is compared like a root.
// Additive changes (a new optional property, a new enum value, a new message, a new version) pass.
// Not compared: other allOf/anyOf/oneOf, prefixItems and value constraints (pattern, length, range).
//
// Exit codes: 0 no breaking change (or nothing on the base to compare), 1 breaking change,
// 2 usage, git or JSON error.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** This package's events/ directory, resolved from this file, wherever the package sits. */
const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_EVENTS_DIR = path.join(PACKAGE_DIR, 'events');

class UsageError extends Error {}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new UsageError(`${label}: invalid JSON (${err.message})`);
  }
}

/** Map<file name, schema> of the top-level *.json files in `dir`. */
export function loadDir(dir) {
  if (!existsSync(dir)) throw new UsageError(`${dir}: no such directory`);
  const out = new Map();
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    out.set(name, parseJson(readFileSync(path.join(dir, name), 'utf8'), path.join(dir, name)));
  }
  return out;
}

function git(repo, args) {
  try {
    return execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const detail = String(err.stderr || err.message).trim();
    throw new UsageError(`git ${args.join(' ')} failed: ${detail}`);
  }
}

/**
 * The events dir as a repo-relative posix path (`packages/contracts/events` in this monorepo): this
 * package's events/ relative to the top level of the git repository that holds the package.
 */
export function eventsRepoPath() {
  const top = git(PACKAGE_DIR, ['rev-parse', '--show-toplevel']).trim();
  const rel = path.relative(realpathSync(top), realpathSync(PACKAGE_EVENTS_DIR));
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new UsageError(`${PACKAGE_EVENTS_DIR} is not inside the git repository ${top}`);
  }
  return rel.split(path.sep).join(path.posix.sep);
}

/** Map<file name, schema> of the top-level event schemas at `ref`; empty when the dir is absent. */
export function loadRef(repo, ref, eventsDir = eventsRepoPath()) {
  git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  const listing = git(repo, ['ls-tree', '--name-only', ref, '--', `${eventsDir}/`]);
  const out = new Map();
  for (const file of listing.split('\n').filter((f) => f.endsWith('.json'))) {
    out.set(
      path.posix.basename(file),
      parseJson(git(repo, ['show', `${ref}:${file}`]), `${ref}:${file}`),
    );
  }
  return out;
}

/**
 * The repo-relative posix paths of this package's workers/<service> schema dirs present at `ref`
 * or in the working tree of `repo` (`packages/contracts/workers/segmentation`, …), sorted.
 */
export function workerDirs(repo, ref, packageDir = path.posix.dirname(eventsRepoPath())) {
  const dirs = new Set();
  const listing = git(repo, ['ls-tree', '-d', '--name-only', ref, '--', `${packageDir}/workers/`]);
  for (const dir of listing.split('\n').filter(Boolean)) dirs.add(dir);
  const local = path.join(repo, ...packageDir.split(path.posix.sep), 'workers');
  if (existsSync(local)) {
    for (const entry of readdirSync(local, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.add(`${packageDir}/workers/${entry.name}`);
    }
  }
  return [...dirs].sort();
}

/** The schema-version key: the event `type` const, else `$id`, else the file name. */
export function versionKey(schema, file) {
  const typeConst = schema?.properties?.type?.const;
  if (typeof typeConst === 'string') return typeConst;
  if (typeof schema?.$id === 'string') return schema.$id;
  return file;
}

function byVersion(files) {
  const out = new Map();
  for (const [file, schema] of files) {
    const key = versionKey(schema, file);
    if (out.has(key)) {
      throw new UsageError(`${file} and ${out.get(key).file} declare the same version ${key}`);
    }
    out.set(key, { file, schema });
  }
  return out;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const show = (v) => JSON.stringify(v);

function resolvePointer(root, ref) {
  let node = root;
  for (const raw of ref.slice(2).split('/')) {
    const part = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObject(node) || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

/** Follows local `#/...` $refs; returns [schema, ref chain] (non-local refs are left as they are). */
function deref(node, root) {
  const chain = [];
  while (isObject(node) && typeof node.$ref === 'string' && node.$ref.startsWith('#/')) {
    if (chain.includes(node.$ref) || chain.length > 32) break;
    chain.push(node.$ref);
    const target = resolvePointer(root, node.$ref);
    if (target === undefined) break;
    node = target;
  }
  return [node, chain];
}

function typesOf(schema) {
  if (typeof schema.type === 'string') return [schema.type];
  if (Array.isArray(schema.type)) return schema.type;
  return null;
}

function compareTypes(b, h, report) {
  const bt = typesOf(b);
  const ht = typesOf(h);
  if (!ht) return;
  if (!bt) {
    report(`type constrained to ${show(h.type)}`);
    return;
  }
  const lost = bt.filter((t) => !ht.includes(t) && !(t === 'integer' && ht.includes('number')));
  if (lost.length) report(`type changed from ${show(b.type)} to ${show(h.type)}`);
}

function compareValues(b, h, report) {
  if ('const' in h) {
    if (!('const' in b)) report(`const ${show(h.const)} added`);
    else if (show(b.const) !== show(h.const))
      report(`const changed from ${show(b.const)} to ${show(h.const)}`);
  }
  if (Array.isArray(h.enum)) {
    if (!Array.isArray(b.enum)) {
      if (!('const' in b)) report(`enum ${show(h.enum)} added`);
      return;
    }
    const kept = new Set(h.enum.map(show));
    const removed = b.enum.filter((v) => !kept.has(show(v)));
    if (removed.length) report(`enum value(s) removed: ${removed.map(show).join(', ')}`);
  }
}

const openness = (v) => (v === undefined || v === true ? 2 : v === false ? 0 : 1);
const OPENNESS = ['false', 'a schema', 'open'];

function compareObject(b, h, at, report, walk) {
  const bReq = new Set(Array.isArray(b.required) ? b.required : []);
  for (const name of Array.isArray(h.required) ? h.required : []) {
    if (!bReq.has(name)) report(`property "${name}" newly required`);
  }
  const bProps = isObject(b.properties) ? b.properties : {};
  const hProps = isObject(h.properties) ? h.properties : {};
  for (const name of Object.keys(bProps)) {
    if (!(name in hProps)) report(`property "${name}" removed`);
    else walk(bProps[name], hProps[name], `${at}/properties/${name}`);
  }
  for (const key of ['additionalProperties', 'unevaluatedProperties']) {
    const bo = openness(b[key]);
    const ho = openness(h[key]);
    if (ho < bo) report(`${key} tightened from ${OPENNESS[bo]} to ${OPENNESS[ho]}`);
    else if (bo === 1 && ho === 1) walk(b[key], h[key], `${at}/${key}`);
  }
}

/** Breaking findings between two versions of one schema: [{ path, message }]. */
export function diffSchema(baseRoot, headRoot) {
  const findings = [];
  const seen = new Set();
  const walk = (bNode, hNode, at) => {
    const [b, bChain] = deref(bNode, baseRoot);
    const [h, hChain] = deref(hNode, headRoot);
    const report = (message) => findings.push({ path: at || '/', message });
    if (bChain.length || hChain.length) {
      const pair = `${bChain.join('>')}|${hChain.join('>')}`;
      if (seen.has(pair)) return;
      seen.add(pair);
    }
    if (typeof b === 'boolean' || typeof h === 'boolean') {
      if (b !== false && h === false) report('schema tightened to false');
      return;
    }
    if (!isObject(b) || !isObject(h)) return;
    compareTypes(b, h, report);
    compareValues(b, h, report);
    compareObject(b, h, at, report, walk);
    if (isObject(b.items) && isObject(h.items)) walk(b.items, h.items, `${at}/items`);
  };
  walk(baseRoot, headRoot, '');
  // A root anyOf/oneOf of local $refs lists a contract's messages: each must stay, and is compared.
  const messages = (root) => {
    const list = isObject(root) ? (root.anyOf ?? root.oneOf) : undefined;
    if (!Array.isArray(list)) return [];
    return list
      .filter((b) => isObject(b) && typeof b.$ref === 'string' && b.$ref.startsWith('#/'))
      .map((b) => b.$ref);
  };
  const headMessages = new Set(messages(headRoot));
  for (const ref of messages(baseRoot)) {
    if (!headMessages.has(ref)) findings.push({ path: '/', message: `message ${ref} removed` });
    else walk({ $ref: ref }, { $ref: ref }, ref.slice(1));
  }
  return findings;
}

/** Compares every base schema version with head. */
export function diffEventSchemas(baseFiles, headFiles) {
  const base = byVersion(baseFiles);
  const head = byVersion(headFiles);
  const breaking = [];
  for (const [key, { file, schema }] of base) {
    const match = head.get(key);
    if (!match) {
      breaking.push({
        version: key,
        file,
        path: '/',
        message: 'schema version removed (retire it through the doc 06 deprecation path)',
      });
      continue;
    }
    for (const f of diffSchema(schema, match.schema))
      breaking.push({ version: key, file: match.file, ...f });
  }
  const added = [...head.keys()].filter((k) => !base.has(k));
  return { compared: base.size, added, breaking };
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (
      !['--base-ref', '--repo', '--base-dir', '--head-dir'].includes(flag) ||
      value === undefined
    ) {
      throw new UsageError(
        'usage: events-breaking.mjs --base-ref <git-ref> [--repo <dir>] | --base-dir <dir> --head-dir <dir>',
      );
    }
    opts[flag.slice(2)] = value;
  }
  const byRef = 'base-ref' in opts;
  const byDir = 'base-dir' in opts || 'head-dir' in opts;
  if (
    byRef === byDir ||
    (byDir && !('base-dir' in opts && 'head-dir' in opts)) ||
    (byDir && 'repo' in opts)
  ) {
    return parseArgs(['--help']);
  }
  return opts;
}

/** Compares every schema dir at `ref` with the working tree of `repo`; null when the base has none. */
function compareRef(repo, ref) {
  const eventsDir = eventsRepoPath();
  const dirs = [eventsDir, ...workerDirs(repo, ref, path.posix.dirname(eventsDir))];
  const total = { compared: 0, added: [], breaking: [] };
  let baseSchemas = 0;
  for (const dir of dirs) {
    const baseFiles = loadRef(repo, ref, dir);
    baseSchemas += baseFiles.size;
    const headDir = path.join(repo, ...dir.split(path.posix.sep));
    // A missing events/ is a usage error, as before; a removed worker dir removes its versions.
    const headFiles = dir === eventsDir || existsSync(headDir) ? loadDir(headDir) : new Map();
    const { compared, added, breaking } = diffEventSchemas(baseFiles, headFiles);
    total.compared += compared;
    total.added.push(...added);
    total.breaking.push(...breaking);
  }
  return baseSchemas === 0 ? null : total;
}

function main(argv) {
  const opts = parseArgs(argv);
  let result;
  if (opts['base-ref']) {
    const repo =
      opts.repo !== undefined
        ? path.resolve(opts.repo)
        : git(PACKAGE_DIR, ['rev-parse', '--show-toplevel']).trim();
    git(repo, ['rev-parse', '--verify', '--quiet', `${opts['base-ref']}^{commit}`]);
    result = compareRef(repo, opts['base-ref']);
    if (result === null) {
      process.stdout.write(
        `events-breaking: no event schemas or worker schemas at ${opts['base-ref']} - nothing to compare\n`,
      );
      return 0;
    }
  } else {
    result = diffEventSchemas(loadDir(opts['base-dir']), loadDir(opts['head-dir']));
  }
  const { compared, added, breaking } = result;
  if (breaking.length) {
    for (const b of breaking) {
      process.stderr.write(`BREAKING ${b.version} (${b.file}) ${b.path}: ${b.message}\n`);
    }
    process.stderr.write(
      `events-breaking: ${breaking.length} breaking change(s); ship a new schema version (.vN+1) instead (planning/06 §4)\n`,
    );
    return 1;
  }
  const extra = added.length ? `; new: ${added.join(', ')}` : '';
  process.stdout.write(
    `events-breaking: OK - ${compared} base schema version(s) compatible${extra}\n`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    process.stderr.write(`events-breaking: ${err.message}\n`);
    process.exitCode = 2;
  }
}
