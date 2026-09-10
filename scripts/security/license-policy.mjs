#!/usr/bin/env node
// License gate evaluator (planning/15 §9, docs/security/licenses.md).
// Called by scripts/security/license-check.sh; not a public API.
//
// Inputs (all optional, any combination):
//   --policy <file>            tools/security/license-policy.json (required)
//   --pnpm-all <file>          `pnpm licenses list --json` (every dependency)
//   --pnpm-prod <file>         `pnpm licenses list --json --prod` (production only)
//   --pip-all <file>           `pip-licenses --format=json`
//   --pip-locked <file>        `uv export --all-groups` requirement lines (locked set, all groups)
//   --pip-prod <file>          `uv export --no-dev` requirement lines (production set)
//   --node-modules-dir <dir>   flat node_modules tree with a sibling package.json (fixtures)
//   --today YYYY-MM-DD         exception expiry reference date (default: today)
//
// Output: one line per WARN/FAIL, then a summary. Exit 1 on any FAIL, 0 otherwise.
// Never prints anything but package names, versions and license strings.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const policyPath = args.policy;
if (!policyPath) die('--policy <tools/security/license-policy.json> is required');
const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
const today = args.today ?? new Date().toISOString().slice(0, 10);

// --- policy validation -------------------------------------------------------------

const LEVEL = { allow: 0, warn: 1, unclassified: 2, deny: 3 };
const LEVEL_NAME = Object.fromEntries(Object.entries(LEVEL).map(([k, v]) => [v, k]));
const MAX_EXCEPTION_DAYS = 62; // "at most two months", same as docs/security/dependency-ignores.md

for (const list of ['allow', 'warn', 'deny']) {
  if (!Array.isArray(policy[list])) die(`policy: "${list}" must be an array`);
}
const exceptions = Array.isArray(policy.exceptions) ? policy.exceptions : [];
for (const ex of exceptions) {
  for (const field of ['package', 'license', 'reason', 'added', 'expiry']) {
    if (typeof ex[field] !== 'string' || ex[field] === '')
      die(`policy: exception for ${ex.package ?? '?'} lacks "${field}"`);
  }
  const span = (Date.parse(ex.expiry) - Date.parse(ex.added)) / 86_400_000;
  if (!(span >= 0 && span <= MAX_EXCEPTION_DAYS))
    die(
      `policy: exception for ${ex.package} expires ${ex.expiry}, more than ${MAX_EXCEPTION_DAYS} days after added ${ex.added}`,
    );
}

// --- license id classification -------------------------------------------------------

const globToRegExp = (glob) =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');
const matchers = {
  deny: policy.deny.map(globToRegExp),
  warn: policy.warn.map(globToRegExp),
  allow: policy.allow.map(globToRegExp),
};

function classifyId(id) {
  const norm = id.trim().replace(/\+$/, '-or-later');
  for (const level of ['deny', 'warn', 'allow']) {
    if (matchers[level].some((re) => re.test(norm))) return LEVEL[level];
  }
  return LEVEL.unclassified;
}

// pip-licenses prints trove classifier names ("MIT License", "GNU General Public License v3
// (GPLv3)") when a package has no SPDX License-Expression, and joins several with "; ". Each
// part that looks like a classifier (has spaces, no SPDX operator) is classified as one id after
// its parenthetical suffix is dropped; anything else is parsed as an SPDX expression. Parts are
// combined with AND (conservative: every listed license must be acceptable).
function evaluateLicense(raw) {
  const parts = (raw ?? '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length === 0) return LEVEL.deny; // no license declared = UNKNOWN
  return Math.max(...parts.map(evaluatePart));
}
function evaluatePart(part) {
  const isClassifier = /\s/.test(part) && !/\b(AND|OR|WITH)\b/.test(part);
  if (isClassifier) return classifyId(part.replace(/\s*\([^)]*\)\s*$/, ''));
  return evaluateExpression(part);
}

// SPDX expression evaluation: OR -> most permissive alternative, AND -> least permissive part,
// WITH <exception> -> ignored.
function evaluateExpression(text) {
  const tokens = text.match(/\(|\)|[^\s()]+/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isKeyword = (t, kw) => typeof t === 'string' && t.toUpperCase() === kw;

  function primary() {
    if (peek() === '(') {
      next();
      const v = orExpr();
      if (peek() === ')') next();
      return v;
    }
    const words = [];
    while (
      pos < tokens.length &&
      !['(', ')'].includes(peek()) &&
      !isKeyword(peek(), 'AND') &&
      !isKeyword(peek(), 'OR')
    ) {
      words.push(next());
    }
    const withIdx = words.findIndex((w) => isKeyword(w, 'WITH'));
    const id = (withIdx >= 0 ? words.slice(0, withIdx) : words).join(' ');
    return classifyId(id);
  }
  function andExpr() {
    let v = primary();
    while (isKeyword(peek(), 'AND')) {
      next();
      v = Math.max(v, primary());
    }
    return v;
  }
  function orExpr() {
    let v = andExpr();
    while (isKeyword(peek(), 'OR')) {
      next();
      v = Math.min(v, andExpr());
    }
    return v;
  }
  return orExpr();
}

// --- inputs -> rows {ecosystem, name, version, license, prod} -------------------------

const firstParty = (policy.firstParty ?? []).map(globToRegExp);
const isFirstParty = (name) => firstParty.some((re) => re.test(name));
const rows = [];

function loadPnpm(allFile, prodFile) {
  if (!allFile) return;
  const prodNames = new Set();
  if (prodFile) {
    for (const entries of Object.values(JSON.parse(readFileSync(prodFile, 'utf8')))) {
      for (const e of entries) for (const v of e.versions) prodNames.add(`${e.name}@${v}`);
    }
  }
  for (const [license, entries] of Object.entries(JSON.parse(readFileSync(allFile, 'utf8')))) {
    for (const e of entries) {
      for (const version of e.versions) {
        rows.push({
          ecosystem: 'npm',
          name: e.name,
          version,
          license: e.license ?? license,
          prod: prodFile ? prodNames.has(`${e.name}@${version}`) : true,
        });
      }
    }
  }
}

const pep503 = (name) => name.toLowerCase().replace(/[-_.]+/g, '-');
function requirementNames(file) {
  const names = new Set();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*==/);
    if (m) names.add(pep503(m[1]));
  }
  return names;
}
function loadPip(allFile, lockedFile, prodFile) {
  if (!allFile) return;
  const locked = lockedFile ? requirementNames(lockedFile) : null;
  const prod = prodFile ? requirementNames(prodFile) : null;
  for (const e of JSON.parse(readFileSync(allFile, 'utf8'))) {
    const name = pep503(e.Name);
    if (locked && !locked.has(name)) continue; // tool overlay (pip-licenses itself), not a dependency
    rows.push({
      ecosystem: 'pypi',
      name: e.Name,
      version: e.Version,
      license: e.License ?? '',
      prod: prod ? prod.has(name) : true,
    });
  }
}

function loadNodeModulesDir(dir) {
  if (!dir) return;
  const manifestPath = join(dir, 'package.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const devOnly = new Set(Object.keys(manifest.devDependencies ?? {}));
  const nm = join(dir, 'node_modules');
  for (const entry of readdirSync(nm, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(nm, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const license =
      typeof pkg.license === 'string'
        ? pkg.license
        : (pkg.license?.type ?? pkg.licenses?.map((l) => l.type).join(' OR ') ?? '');
    rows.push({
      ecosystem: 'npm',
      name: pkg.name ?? entry.name,
      version: pkg.version ?? '?',
      license,
      prod: !devOnly.has(pkg.name ?? entry.name),
    });
  }
}

loadPnpm(args['pnpm-all'], args['pnpm-prod']);
loadPip(args['pip-all'], args['pip-locked'], args['pip-prod']);
loadNodeModulesDir(args['node-modules-dir']);

// --- evaluation ------------------------------------------------------------------------

function findException(row) {
  return exceptions.find(
    (ex) =>
      (ex.ecosystem === undefined || ex.ecosystem === row.ecosystem) &&
      globToRegExp(ex.package).test(row.name) &&
      ex.license.toLowerCase() === row.license.toLowerCase(),
  );
}

const counts = { npm: { all: 0, prod: 0 }, pypi: { all: 0, prod: 0 } };
const findings = [];
for (const row of rows) {
  if (isFirstParty(row.name)) continue;
  counts[row.ecosystem].all += 1;
  if (row.prod) counts[row.ecosystem].prod += 1;
  const level = evaluateLicense(row.license);
  if (level === LEVEL.allow) continue;
  const scope = row.prod ? 'production' : 'dev-only';
  const why = `${scope} dependency, ${LEVEL_NAME[level]} license`;
  if (level === LEVEL.warn || !row.prod) {
    findings.push({ severity: 'WARN', row, why });
    continue;
  }
  const ex = findException(row);
  if (ex && ex.expiry >= today) {
    findings.push({
      severity: 'WARN',
      row,
      why: `${why}; exception until ${ex.expiry}: ${ex.reason}`,
    });
  } else if (ex) {
    findings.push({
      severity: 'FAIL',
      row,
      why: `${why}; exception EXPIRED ${ex.expiry} (${ex.reason})`,
    });
  } else {
    findings.push({ severity: 'FAIL', row, why });
  }
}

findings.sort((a, b) =>
  a.severity === b.severity ? a.row.name.localeCompare(b.row.name) : a.severity === 'FAIL' ? -1 : 1,
);
for (const f of findings) {
  console.log(
    `${f.severity}  ${f.row.ecosystem.padEnd(4)} ${f.row.name}@${f.row.version}  "${f.row.license}"  ${f.why}`,
  );
}
const fails = findings.filter((f) => f.severity === 'FAIL').length;
const warns = findings.length - fails;
const scanned = Object.entries(counts)
  .filter(([, c]) => c.all > 0)
  .map(([eco, c]) => `${eco}: ${c.all} packages (${c.prod} production)`)
  .join(', ');
console.log(`license check: ${scanned || 'no packages'}; ${fails} failure(s), ${warns} warning(s)`);
if (fails > 0) {
  console.log(
    'fix: swap the dependency, or add a time-boxed exception (docs/security/licenses.md)',
  );
  process.exit(1);
}

// --- helpers ----------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) die(`unexpected argument ${a}`);
    out[a.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}
function die(msg) {
  console.error(`license-policy: ${msg}`);
  process.exit(2);
}
