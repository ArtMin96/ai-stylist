// DESIGN.md "The Twin Rule" as two validator rules (catalog: tools/codegen/tokens/README.md):
// TK-02, every scheme-suffixed colour, elevation and component key has its light/dark twin or is
// named on the `Unpaired by design:` line; TK-05, the scheme variants of one component state agree.
import { unpairedKeys, unpairedLines } from './structure.mjs';
import { isColourProperty, isHighContrast, isPlainObject, splitScheme } from './syntax.mjs';

/** Groups under the Twin Rule: a `-light` key needs its `-dark` twin and the reverse. */
const PAIRED_GROUPS = ['colors', 'elevation', 'components'];

/**
 * TK-02: every scheme-suffixed key has its `-light` + `-dark` base, or is named on the one
 * `Unpaired by design:` line. Suffix-free keys (`scrim`, `camera-ink`) are the same in every
 * scheme, so they are neither paired nor listed.
 */
export function checkPairing({ fm, add }, body) {
  const unpaired = PAIRED_GROUPS.flatMap((group) =>
    unpairedKeys(fm[group]).map((key) => ({ group, key })),
  );
  const { lines, malformed } = unpairedLines(body);
  for (const text of malformed) {
    add('TK-02', 'body', `"${text}" must read exactly \`Unpaired by design: <token>, …\``);
  }
  if (lines.length > 1) add('TK-02', 'body', 'more than one `Unpaired by design:` line');
  const listed = new Set();
  for (const token of lines.flat()) {
    if (listed.has(token)) add('TK-02', 'body', `\`${token}\` is listed twice`);
    listed.add(token);
    const group = PAIRED_GROUPS.find((g) => Object.hasOwn(fm[g], token));
    if (!group) {
      add('TK-02', 'body', `\`${token}\` is not a colour, elevation or component token`);
    } else if (!unpaired.some((u) => u.key === token)) {
      add('TK-02', `${group}.${token}`, `is listed as unpaired by design but ${listedGap(token)}`);
    }
  }
  for (const { group, key } of unpaired) {
    if (!listed.has(key)) {
      const gap = pairingGap(key);
      add('TK-02', `${group}.${key}`, `${gap} and is not on the \`Unpaired by design:\` line`);
    }
  }
}

function pairingGap(key) {
  const { scheme } = splitScheme(key);
  if (scheme === 'light') return 'has no `-dark` twin';
  if (scheme === 'dark') return 'has no `-light` twin';
  return 'has no `-light` + `-dark` base';
}

const listedGap = (key) =>
  splitScheme(key).scheme
    ? 'has a light/dark twin'
    : 'has no scheme suffix: it is the same in every scheme';

/**
 * TK-05: the scheme variants of one component state declare the same properties. A colour
 * property may name a different role in each scheme: a twin keeps the role, not always the tonal
 * step (`chip-never-suggest` is error-bg in light, surface-2 in dark). The light, dark and brand
 * variants share every other value; a high-contrast variant may change it (S7 draws the focus ring
 * 3 px). A state is scheme-independent or has scheme variants, never both.
 */
export function checkVariantsAgree({ add }, variants) {
  const independent = variants.find((v) => v.scheme === null);
  if (independent && variants.length > 1) {
    const text = 'a scheme-independent entry cannot sit beside scheme variants of the same state';
    add('TK-05', `components.${independent.key}`, text);
    return;
  }
  const report = (variant, against, props, why) => {
    const names = props.map((p) => `\`${p}\``).join(', ');
    const message = `differs from \`${against.key}\` on ${names}: ${why}`;
    add('TK-05', `components.${variant.key}`, message);
  };
  const [first, ...rest] = variants;
  for (const variant of rest) {
    const props = differingNames(first.props, variant.props);
    const why = 'scheme variants declare the same properties';
    if (props.length > 0) report(variant, first, props, why);
  }
  const [base, ...twins] = variants.filter((v) => !isHighContrast(v.scheme));
  for (const twin of twins) {
    const props = differingValues(base.props, twin.props);
    const why = 'light, dark and brand variants share every non-colour value';
    if (props.length > 0) report(twin, base, props, why);
  }
}

const propsOf = (props) => (isPlainObject(props) ? props : {});

/** Property names that only one of the two variants declares. */
function differingNames(a, b) {
  const names = new Set([...Object.keys(propsOf(a)), ...Object.keys(propsOf(b))]);
  return [...names].filter((p) => !(Object.hasOwn(propsOf(a), p) && Object.hasOwn(propsOf(b), p)));
}

/** Non-colour properties both variants declare, with different values. */
function differingValues(a, b) {
  const shared = Object.keys(propsOf(a)).filter((p) => Object.hasOwn(propsOf(b), p));
  const same = (p) => JSON.stringify(a[p]) === JSON.stringify(b[p]);
  return shared.filter((p) => !isColourProperty(p) && !same(p));
}
