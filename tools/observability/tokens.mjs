// Upper-case `${…}` tokens in the Grafana definitions (see "Tokens" in
// docs/observability/grafana/README.md). Lower-case `${datasource}`, `$env` and Grafana's `${__…}`
// built-ins are not tokens: they pass through untouched. People come from
// packages/shared-kernel/registry/owners.json; the alert addresses, the on-call time zone and the
// datasource uid are resolved at sync time only.

/** `${NAME}` or `${NAME:arg}`, NAME upper-case. */
const TOKEN = /\$\{([A-Z][A-Z0-9_]*)(?::([^}]*))?\}/g;
const WHOLE_OWNER_TAGS = /^\$\{OWNER_TAGS:([^}]+)\}$/;

/** Tokens that name a role in owners.json. */
const ROLE_TOKENS = ['OWNERS', 'OWNER_TAGS'];
/** Tokens replaced by a value the sync resolves from the environment or the Grafana API. */
export const VALUE_TOKENS = ['PROM_DATASOURCE_UID', 'GRAFANA_ALERT_EMAILS', 'ONCALL_TIMEZONE'];

/** Calls `visit(text, path, inTags)` for every string; `inTags`: it is a `tags` array element. */
function eachString(value, visit, path = '', inTags = false) {
  if (typeof value === 'string') {
    visit(value, path, inTags);
  } else if (Array.isArray(value)) {
    const tags = path === 'tags' || path.endsWith('.tags');
    value.forEach((item, i) => eachString(item, visit, `${path}[${i}]`, tags));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      eachString(item, visit, path === '' ? key : `${path}.${key}`);
    }
  }
}

/** Every token in a JSON value: `{ raw, name, arg, path, whole, inTags }`. */
export function findTokens(value) {
  const found = [];
  eachString(value, (text, path, inTags) => {
    for (const [raw, name, arg] of text.matchAll(TOKEN)) {
      found.push({ raw, name, arg, path, whole: raw === text, inTags });
    }
  });
  return found;
}

export function usesToken(value, name) {
  return findTokens(value).some((token) => token.name === name);
}

/** Paths of strings with an `@` outside a token: an email address committed by accident. */
export function findAtSigns(value) {
  const paths = [];
  eachString(value, (text, path) => {
    if (text.replace(TOKEN, '').includes('@')) paths.push(path || '(root)');
  });
  return paths;
}

/** The people holding `role` (`{ people }`), or `{ error }` naming what is wrong. */
export function roleMembers(owners, role) {
  const roles = owners?.roles ?? {};
  const members = Object.hasOwn(roles, role) ? roles[role] : undefined;
  if (!Array.isArray(members) || members.length === 0) {
    return { error: `role '${role}' is not a role with members in owners.json` };
  }
  const people = new Map((owners.people ?? []).map((person) => [person.id, person]));
  const missing = members.filter((id) => !people.has(id));
  if (missing.length > 0) {
    return { error: `role '${role}' lists ${missing.join(', ')}, not in owners.json people` };
  }
  return { people: members.map((id) => people.get(id)) };
}

/**
 * Token problems in one file, `{ id, message }` each. `allowed`: the token names this file may use
 * (the "Allowed in" column of the contract), so an address or a datasource uid cannot end up in a
 * dashboard or anywhere else it would be published.
 */
export function tokenProblems(value, owners, allowed) {
  const problems = [];
  const add = (id, message) => problems.push({ id, message });
  for (const token of findTokens(value)) {
    const where = `${token.raw} at ${token.path}`;
    const isRole = ROLE_TOKENS.includes(token.name);
    if (!isRole && !VALUE_TOKENS.includes(token.name)) {
      add('token', `unknown token ${where}`);
    } else if (!allowed.includes(token.name)) {
      add('token', `${where}: ${token.name} is not allowed in this file`);
    } else if (isRole && !token.arg) {
      add('token', `${where}: needs a role, \${${token.name}:<role>}`);
    } else if (!isRole && token.arg !== undefined) {
      add('token', `${where}: ${token.name} takes no argument`);
    } else if (token.name === 'OWNER_TAGS' && !(token.whole && token.inTags)) {
      add('token', `${where}: must be a whole element of a tags array`);
    } else if (isRole) {
      const { error } = roleMembers(owners, token.arg);
      if (error) add('role', `${where}: ${error}`);
    }
  }
  return problems;
}

function peopleOf(owners, role) {
  const { people, error } = roleMembers(owners, role);
  if (error) throw new Error(error);
  return people;
}

function replaceTokens(text, context) {
  return text.replace(TOKEN, (raw, name, arg) => {
    if (name === 'OWNERS') {
      const names = peopleOf(context.owners, arg).map((person) => person.name);
      return names.join(', ');
    }
    const resolved = context.values[name];
    if (VALUE_TOKENS.includes(name) && typeof resolved === 'string' && resolved !== '') {
      return resolved;
    }
    throw new Error(`cannot substitute ${raw}`);
  });
}

/**
 * A copy of `value` with every token replaced. `context.owners`: owners.json; `context.values`:
 * VALUE_TOKENS name → string. A whole `${OWNER_TAGS:<role>}` array element becomes one
 * `owner:<person-id>` element per member.
 */
export function substitute(value, context) {
  if (typeof value === 'string') return replaceTokens(value, context);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const match = typeof item === 'string' ? WHOLE_OWNER_TAGS.exec(item) : null;
      if (match === null) return [substitute(item, context)];
      return peopleOf(context.owners, match[1]).map((person) => `owner:${person.id}`);
    });
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => [key, substitute(item, context)]);
    return Object.fromEntries(entries);
  }
  return value;
}
