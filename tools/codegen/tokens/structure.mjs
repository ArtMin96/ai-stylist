// Derives the token structure from the raw frontmatter, without judging it: colour keys grouped
// into roles, keys without their light/dark twin, component keys grouped into components, states
// and scheme variants, and the `Unpaired by design:` prose line. The validator (validate.mjs,
// twin-rule.mjs) judges; the normaliser (normalise.mjs) builds the DTCG model from the same
// structure.
import { splitScheme, splitState } from './syntax.mjs';

export const UNPAIRED_PREFIX = 'Unpaired by design: ';

/**
 * Colour roles in first-appearance order. A base with both a `-light` and a `-dark` key is a
 * scheme role (`{ key: base, fixed: false, schemes: Map(scheme -> colour key) }`); every other
 * colour key (suffix-free, or unpaired by design) becomes a fixed role named by its full key, the
 * same in every context.
 */
export function colorRoles(colors) {
  const bases = new Map();
  for (const key of Object.keys(colors)) {
    const { base, scheme } = splitScheme(key);
    if (!bases.has(base)) bases.set(base, []);
    bases.get(base).push({ key, scheme });
  }
  const roles = [];
  const roleOfKey = new Map();
  for (const [base, keys] of bases) {
    const schemes = new Map(keys.filter((k) => k.scheme).map((k) => [k.scheme, k.key]));
    const paired = schemes.has('light') && schemes.has('dark');
    for (const { key, scheme } of keys) {
      if (paired && scheme) {
        roleOfKey.set(key, base);
        continue;
      }
      roleOfKey.set(key, key);
      roles.push({ key, fixed: true, schemes: new Map([['fixed', key]]) });
    }
    if (paired) roles.push({ key: base, fixed: false, schemes });
  }
  return { roles, roleOfKey };
}

/**
 * The keys of one group that break the Twin Rule (DESIGN.md "Named Rules"): a scheme-suffixed key
 * whose base lacks the `-light` or the `-dark` key. Suffix-free keys are the same in every scheme,
 * so they are never unpaired.
 */
export function unpairedKeys(group) {
  const schemesOfBase = new Map();
  const suffixed = [];
  for (const key of Object.keys(group)) {
    const { base, scheme } = splitScheme(key);
    if (!scheme) continue;
    if (!schemesOfBase.has(base)) schemesOfBase.set(base, new Set());
    schemesOfBase.get(base).add(scheme);
    suffixed.push({ key, base });
  }
  const paired = (base) => ['light', 'dark'].every((s) => schemesOfBase.get(base).has(s));
  return suffixed.filter(({ base }) => !paired(base)).map(({ key }) => key);
}

/**
 * Components in first-appearance order: `{ component, slots: Map(state | '' -> variants) }`, where
 * each variant is `{ key, scheme, props }` and the slot `''` holds the default state.
 */
export function componentGroups(components) {
  const groups = new Map();
  for (const [key, props] of Object.entries(components)) {
    const { base, scheme } = splitScheme(key);
    const { component, state } = splitState(base);
    if (!groups.has(component)) groups.set(component, { component, slots: new Map() });
    const { slots } = groups.get(component);
    const slot = state ?? '';
    if (!slots.has(slot)) slots.set(slot, []);
    slots.get(slot).push({ key, scheme, props });
  }
  return [...groups.values()];
}

/**
 * The body's `Unpaired by design: <token>, …` lines (tokens may be backticked; a trailing full stop
 * is allowed) and every other line that mentions the phrase in a different form.
 */
export function unpairedLines(body) {
  const lines = [];
  const malformed = [];
  for (const line of body.split('\n')) {
    if (line.startsWith(UNPAIRED_PREFIX)) {
      const list = line.slice(UNPAIRED_PREFIX.length).trim().replace(/\.$/, '');
      lines.push(list.split(',').map((t) => t.trim().replace(/^`(.*)`$/, '$1')));
    } else if (/unpaired by design/i.test(line)) {
      malformed.push(line.trim());
    }
  }
  return { lines, malformed };
}
