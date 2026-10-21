// Naming + literal helpers shared by the shared-kernel registry emitters (tools/codegen/gen-kernel.mjs).

export const src = (name) => `packages/shared-kernel/registry/${name}.json`;

const words = (s) => s.split(/[^A-Za-z0-9]+/).filter(Boolean);

/** `closet.max_items` -> `closetMaxItems`, `EXCL-COLD-SAFETY` -> `exclColdSafety`. */
export const camel = (s) =>
  words(s)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('');

/** `temperature` -> `Temperature`. */
export const pascal = (s) =>
  words(s)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');

/** `cmPerInch` -> `CM_PER_INCH`, `closet.max_items` -> `CLOSET_MAX_ITEMS`. */
export const upperSnake = (s) =>
  words(s.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))
    .map((w) => w.toUpperCase())
    .join('_');

/** Reason codes and namespaces drop the shared `RC-` prefix in Swift/Kotlin identifiers. */
export const stripRc = (s) => s.replace(/^RC-/, '');

const SWIFT_KEYWORDS = new Set(
  (
    'associatedtype class deinit enum extension fileprivate func import init inout internal let ' +
    'open operator private precedencegroup protocol public rethrows static struct subscript ' +
    'typealias var break case catch continue default defer do else fallthrough for guard if in ' +
    'repeat return throw switch where while as Any false is nil self Self super throws true try ' +
    'Type await async'
  ).split(' '),
);
/** Backtick-escape Swift reserved words (e.g. `RC-REPEAT` -> `` `repeat` ``). */
export const swiftIdent = (s) => (SWIFT_KEYWORDS.has(s) ? `\`${s}\`` : s);

function assertPrintable(s) {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(s)) {
    throw new Error(`control character in registry string ${JSON.stringify(s)}`);
  }
  return s;
}

export const swiftStr = (s) =>
  `"${assertPrintable(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
export const ktStr = (s) =>
  `"${assertPrintable(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
export const tsStr = (s) => `'${assertPrintable(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
/** Text safe inside a `/** … *\/` or `///` comment. */
export const docText = (s) => assertPrintable(s).replace(/\*\//g, '* /');

/** Always a Double literal in Swift/Kotlin (`2` -> `2.0`). */
export const num = (n) => {
  const s = String(n);
  return /[.eE]/.test(s) ? s : `${s}.0`;
};

/** An Int literal in Swift/Kotlin (an HTTP status); `num` would write `400.0`. */
export const int = (n) => {
  if (!Number.isSafeInteger(n)) {
    throw new Error(`not an integer in registry: ${JSON.stringify(n)}`);
  }
  return String(n);
};

/**
 * Two registry values that map to one Swift or Kotlin identifier (`recs.context.full` and
 * `recs.context_full`) would not compile, and no gate compiles the kernel, so the run fails here.
 */
export function assertUniqueIds(typeName, cases) {
  const seen = new Set();
  for (const { id, raw } of cases) {
    if (seen.has(id)) {
      throw new Error(`${typeName}: '${raw}' maps to the identifier '${id}' of another value`);
    }
    seen.add(id);
  }
}
