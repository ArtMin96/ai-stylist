// Does the object a vendor API returns already match the definition file? The sync sends nothing
// for an object that matches, so a second run changes nothing. Grafana (Go) and PostHog (Python)
// echo defaults for fields a file leaves out, so a key missing on one side equals a zero value
// ("", 0, false, null, [], {}) on the other.

const ZERO_PRIMITIVES = [undefined, null, '', 0, false];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isZero(value) {
  if (ZERO_PRIMITIVES.includes(value)) return true;
  if (Array.isArray(value)) return value.length === 0;
  return isPlainObject(value) && Object.keys(value).length === 0;
}

/** Deep JSON equality in which a missing key and a zero value are equal. */
export function sameJson(a, b) {
  if (a === b || (isZero(a) && isZero(b))) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => sameJson(a[key], b[key]));
}

/**
 * Every top-level key of `desired` equals the same key of `actual`. Top-level keys that only the
 * server sets (`id`, `orgID`, `updated`, `provenance`, `version`) are ignored; below the top level
 * the comparison is `sameJson`, so a removed label, route or query is still a change.
 */
export function matchesTopLevel(desired, actual) {
  if (!isPlainObject(actual)) return false;
  return Object.keys(desired).every((key) => sameJson(desired[key], actual[key]));
}

/** `value` without the given top-level keys. */
export function omitKeys(value, keys) {
  const entries = Object.entries(value).filter(([key]) => !keys.includes(key));
  return Object.fromEntries(entries);
}
