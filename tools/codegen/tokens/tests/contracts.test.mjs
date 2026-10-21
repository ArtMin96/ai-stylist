// Tests for the component-contract checker (contracts.mjs) and the merged API model
// (contract-model.mjs). The repository contracts and fixtures/contracts/_valid pass; every
// fixtures/contracts/CC-NN case fails on its own rule and nothing else; the merge follows the
// owner's decisions of 2026-10-20 (base, then state, then size; `<component>-<state>` references;
// focused is the focus ring over the enabled look). Run by scripts/test/design-tokens.test.sh.
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { parse as parseYaml } from 'yaml';

import { comboKey, resolveReference } from '../contract-model.mjs';
import { checkContract, iconSetOf, loadContracts } from '../contracts.mjs';
import { formatFinding, loadTokens } from '../pipeline.mjs';
import {
  CONTRACT_FIXTURES,
  CONTRACT_TOKENS,
  REPO_CONTRACTS,
  REPO_DESIGN_MD,
  VALID_CONTRACTS,
  apisOf,
  modelOf,
  once,
} from './models.mjs';

const fixtureModel = modelOf(CONTRACT_TOKENS);
const repoModel = modelOf(REPO_DESIGN_MD);
const VALID_TEXT = readFileSync(path.join(VALID_CONTRACTS, 'button.yaml'), 'utf8');
/** `CC-NN/` or `CC-NN-<case>/`: a fixture that fails on rule CC-NN only. */
const isRuleCase = (name) => /^CC-\d\d(-[a-z0-9-]+)?$/.test(name);
const ruleOf = (name) => name.slice(0, 'CC-NN'.length);
const RULE_CASES = readdirSync(CONTRACT_FIXTURES).filter(isRuleCase).sort();
const SCRATCH = mkdtempSync(path.join(tmpdir(), 'contracts-test-'));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

const VALID_ICON_TEXT = readFileSync(path.join(VALID_CONTRACTS, 'icon.yaml'), 'utf8');
const listed = (findings) => findings.map(formatFinding).join('\n');
const [fixture, iconFixture] = apisOf(fixtureModel, VALID_CONTRACTS);
const repoButton = once(() => apisOf(repoModel, REPO_CONTRACTS)[0]);

/** The fixture contract after `edit(text)`, checked against `model`. */
const checkEdited = (edit, model = fixtureModel) =>
  checkContract(edit(VALID_TEXT), 'button.yaml', model);
/** The fixture icon set after `edit(text)`, checked against `model`. */
const checkIconEdited = (edit, model = fixtureModel) =>
  checkContract(edit(VALID_ICON_TEXT), 'icon.yaml', model);
const rulesOf = ({ findings }) => [...new Set(findings.map(({ rule }) => rule))];
const messagesOf = ({ findings }) => findings.map(formatFinding);
const ICON_XS = '  icon-xs: { size: 12px, strokeWidth: 2.2 }\n';
const ICON_SM = '  icon-sm: { size: 16px, strokeWidth: 1.9 }\n';
/** The fixture tokens with the `line` (icon-sm by default) replaced by `replacement`. */
const tokensWith = (replacement, line = ICON_SM) =>
  modelOf(CONTRACT_TOKENS.replace(line, replacement));
/** The fixture tokens with `line` added to both scheme variants of `entry` (`button-secondary`). */
const withProperty = (entry, line, text = CONTRACT_TOKENS) =>
  text.replace(new RegExp(`( {2}${entry}-(light|dark):\\n)`, 'g'), `$1    ${line}\n`);
/** The fixture contract's `icons` block and the shared small slot of its tokens. */
const ICONS = /^icons:\n(?: {2}.*\n)+/m;
const SMALL_SLOT = "    iconSize: '{components.icon-sm}'\n    iconGap: 4px\n";
const ACTION_PROP = '  - name: action\n    type: action\n    required: true\n';

/** One merged look's values: `{ field: { type, value } }`. */
function look(api, context, variant, size, state) {
  const found = api.looks[context].find(
    (l) => l.variant === variant && l.size === size && l.state === state,
  );
  assert.ok(found, `${variant}/${size}/${state} in ${context}`);
  return found.values;
}

test('the repository contracts pass, and the button and icon contracts are approved', () => {
  const { findings, apis, pending } = loadContracts(REPO_CONTRACTS, repoModel);
  assert.deepEqual(findings, [], listed(findings));
  assert.deepEqual(pending, []);
  assert.deepEqual(
    apis.map(({ id }) => id),
    ['button', 'icon'],
  );
});

test('the fixtures hold the valid contracts and one failing case per rule, CC-01 to CC-13', () => {
  const expected = Array.from({ length: 13 }, (_, i) => `CC-${String(i + 1).padStart(2, '0')}`);
  assert.deepEqual([...new Set(RULE_CASES.map(ruleOf))], expected);
  const cases = [
    'CC-01-gallery-title',
    'CC-01-icon-kind',
    'CC-01-icon-paint',
    'CC-08-trailing',
    'CC-11-viewbox',
  ];
  for (const name of cases) {
    assert.ok(RULE_CASES.includes(name), name);
  }
  assert.equal(fixture.id, 'button');
  assert.equal(iconFixture.id, 'icon');
});

for (const name of RULE_CASES) {
  test(`fixtures/contracts/${name} fails on ${ruleOf(name)} and on nothing else`, () => {
    const result = loadContracts(path.join(CONTRACT_FIXTURES, name), fixtureModel);
    assert.ok(result.findings.length > 0, `${name} raised no finding`);
    assert.deepEqual(rulesOf(result), [ruleOf(name)], listed(result.findings));
    // Only a contract with no finding gets an API (CC-12/icon.yaml passes beside its button).
    const failing = new Set(result.findings.map(({ at }) => at.split(' ')[0]));
    assert.deepEqual(
      result.apis.filter(({ file }) => failing.has(file)),
      [],
    );
  });
}

test('CC-01: the gallery needs a title of words and single spaces, which its slug is made of', () => {
  const dir = path.join(CONTRACT_FIXTURES, 'CC-01-gallery-title');
  const missing = loadContracts(dir, fixtureModel).findings.map(formatFinding);
  assert.deepEqual(missing, [
    'CC-01 button.yaml gallery: must have required property \'title\' {"missingProperty":"title"}',
  ]);
  for (const title of ['', 'Chips & tags', 'Two  spaces', ' Leading']) {
    const edited = checkEdited((t) => t.replace('title: Fixture buttons', `title: '${title}'`));
    assert.deepEqual(rulesOf(edited), ['CC-01'], JSON.stringify(title));
    assert.match(listed(edited.findings), /gallery\.title: must match pattern/);
  }
});

test('the gallery: the title is "<board> <gallery.title>", the slug its kebab case', () => {
  assert.equal(fixture.gallery.title, 'C01 Fixture buttons');
  assert.equal(fixture.gallery.slug, 'c01-fixture-buttons');
  const board = checkEdited((t) => t.replace('board: C01', 'board: C10')).api.gallery;
  assert.deepEqual([board.title, board.slug], ['C10 Fixture buttons', 'c10-fixture-buttons']);
});

test('CC-01: a duplicate key, an unknown field and a product name fail the schema', () => {
  const duplicate = checkEdited((t) => t.replace('board: C01', 'board: C01\nboard: C02'));
  assert.deepEqual(rulesOf(duplicate), ['CC-01']);
  assert.match(listed(duplicate.findings), /YAML: /);
  const unknown = checkEdited((t) => `${t}owner: ui-designer\n`);
  assert.deepEqual(rulesOf(unknown), ['CC-01']);
  const named = checkEdited((t) => t.replace('name: AppButton', 'name: AppGarderiButton'));
  assert.deepEqual(rulesOf(named), ['CC-01']);
});

test('CC-03: an id that is a Swift or Kotlin keyword fails', () => {
  const withDefault = (t) =>
    t.replace('sizes: [large, small]\n', 'sizes: [large, small, default]\n');
  const result = checkEdited(withDefault);
  assert.deepEqual(rulesOf(result), ['CC-03']);
  assert.match(listed(result.findings), /id "default" is a Swift or Kotlin keyword/);
});

test('CC-06: a state of another component and a ring without its width fail', () => {
  const pressed = '{components.button-secondary-pressed}';
  const borrowed = checkEdited((t) => t.replace(pressed, '{components.button-primary-pressed}'));
  assert.deepEqual(rulesOf(borrowed), ['CC-06']);
  assert.match(listed(borrowed.findings), /is not the pressed state of \{components\.button-sec/);
  const noRing = modelOf(CONTRACT_TOKENS.replace('  button-outline-ring: { width: 1.5px }\n', ''));
  const ring = checkContract(VALID_TEXT, 'button.yaml', noRing);
  assert.deepEqual(rulesOf(ring), ['CC-06']);
  assert.match(listed(ring.findings), /draws a ring, but \{components\.button-outline-ring\}/);
});

test('CC-08: a used size without its shared size entry, or with half a slot, fails', () => {
  const noEntry = modelOf(CONTRACT_TOKENS.replace(/ {2}button-large:\n( {4}[^\n]*\n)+/, ''));
  const missing = checkContract(VALID_TEXT, 'button.yaml', noEntry);
  assert.deepEqual(rulesOf(missing), ['CC-08']);
  assert.match(listed(missing.findings), /sizes\.large: no \{components\.button-large\} holds/);
  const half = modelOf(CONTRACT_TOKENS.replace('    iconGap: 4px\n', ''));
  const gap = checkContract(VALID_TEXT, 'button.yaml', half);
  assert.deepEqual(rulesOf(gap), ['CC-08']);
  assert.match(listed(gap.findings), /sizes\.small: \{components\.button-small\} has no iconGap/);
});

test('CC-08 (G3): a size where a look draws a trailing icon holds the trailing slot', () => {
  const trailing = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-08-trailing'), fixtureModel);
  const entry = '{components.button-small}';
  assert.deepEqual(messagesOf(trailing), [
    `CC-08 button.yaml sizes.small: ${entry} has no trailingIconSize or trailingIconGap dimension`,
  ]);
});

test('CC-08 (G11): a size needs its slot entry only where a look draws an icon there', () => {
  const noSmallSlot = modelOf(CONTRACT_TOKENS.replace(SMALL_SLOT, ''));
  const leading = "primary: { leading: '{props.leadingIcon}' }";
  const quiet = (t) => t.replace(leading, 'primary: { leading: null }');
  const result = checkContract(quiet(VALID_TEXT), 'button.yaml', noSmallSlot);
  assert.deepEqual(result.findings, [], listed(result.findings));
  assert.equal(look(result.api, 'light', 'primary', 'small', 'enabled').iconSize, undefined);
  assert.equal(result.api.fields.find(({ name }) => name === 'iconSize').optional, true);
  // A state's icon draws the slot too; without `icons` every look draws the leading one.
  const pressed = (t) => t.replace(leading, 'primary: { states: { pressed: { leading: plus } } }');
  const message = 'CC-08 button.yaml sizes.small: {components.button-small} has no iconSize or';
  for (const edit of [pressed, (t) => t.replace(ICONS, '')]) {
    const missing = checkContract(edit(VALID_TEXT), 'button.yaml', noSmallSlot);
    assert.deepEqual(messagesOf(missing), [`${message} iconGap dimension`]);
  }
});

test('the trailing slot (G3): the shared entry holds it at large only, beside the leading one', () => {
  const slot = (values) => [values.trailingIconSize?.value.id, values.trailingIconGap?.value.n];
  for (const context of fixture.contexts) {
    for (const { variant, size, state, values } of fixture.looks[context]) {
      const expected = size === 'large' ? ['sm', 6] : [undefined, undefined];
      assert.deepEqual(slot(values), expected, `${variant}/${size}/${state} in ${context}`);
    }
  }
});

test('the merge (G6): a slot value the base or state entry names wins over the shared one', () => {
  const gaps = withProperty('button-secondary', 'iconGap: 2px');
  const own = withProperty('button-primary-pressed', 'trailingIconGap: 9px', gaps);
  const { findings, api } = checkContract(VALID_TEXT, 'button.yaml', modelOf(own));
  assert.deepEqual(findings, [], listed(findings));
  const value = (variant, size, state, field) => look(api, 'dark', variant, size, state)[field];
  assert.equal(value('secondary', 'large', 'pressed', 'iconGap').value.n, 2, 'the base wins');
  assert.equal(value('primary', 'large', 'enabled', 'iconGap').value.n, 8, 'button-large');
  assert.equal(value('primary', 'large', 'pressed', 'trailingIconGap').value.n, 9, 'the state');
  assert.equal(value('primary', 'large', 'enabled', 'trailingIconGap').value.n, 6);
  assert.equal(value('primary', 'small', 'pressed', 'trailingIconGap').value.n, 9);
  assert.equal(value('primary', 'small', 'enabled', 'trailingIconGap'), undefined);
});

test("the merge (G5): an entry's own borderWidth wins; <id>-outline-ring is the default", () => {
  const pressed = withProperty('button-secondary-pressed', 'borderWidth: 2px');
  const { api } = checkContract(VALID_TEXT, 'button.yaml', modelOf(pressed));
  const width = (state) => look(api, 'dark', 'secondary', 'large', state).borderWidth.value.n;
  assert.deepEqual([width('pressed'), width('enabled')], [2, 1.5]);
  const ring = '  button-outline-ring: { width: 1.5px }\n';
  const own = withProperty('button-secondary', 'borderWidth: 1px').replace(ring, '');
  const alone = checkContract(VALID_TEXT, 'button.yaml', modelOf(own));
  assert.deepEqual(alone.findings, [], 'every ringed look names its width: no ring entry needed');
  assert.equal(look(alone.api, 'light', 'secondary', 'large', 'loading').borderWidth.value.n, 1);
});

test('a dashed ring (G13): borderDash is a dimension the look carries like any property', () => {
  const dashed = modelOf(withProperty('button-secondary', 'borderDash: 3px'));
  const { findings, api } = checkContract(VALID_TEXT, 'button.yaml', dashed);
  assert.deepEqual(findings, [], listed(findings));
  const { borderDash } = look(api, 'hc-light', 'secondary', 'large', 'pressed');
  assert.deepEqual(borderDash, { type: 'double', value: { t: 'number', n: 3 } });
  assert.equal(api.fields.find(({ name }) => name === 'borderDash').optional, true);
});

test('CC-07 (G1): accessibility.busy is optional; when given, it is a state', () => {
  const noBusy = checkEdited((t) => t.replace('  busy: loading\n', ''));
  assert.deepEqual(noBusy.findings, [], listed(noBusy.findings));
  const unknown = checkEdited((t) => t.replace('busy: loading', 'busy: spinning'));
  assert.deepEqual(messagesOf(unknown), [
    'CC-07 button.yaml accessibility.busy: "spinning" is not in `states`',
  ]);
});

test('CC-13 (G9): an interactive role needs a touch target and an action; a passive one neither', () => {
  const missing = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-13'), fixtureModel);
  assert.deepEqual(messagesOf(missing), [
    'CC-13 button.yaml accessibility: role button is interactive: it needs minTouchTarget',
  ]);
  const noAction = checkEdited((t) => t.replace(ACTION_PROP, ''));
  assert.deepEqual(messagesOf(noAction), [
    'CC-13 button.yaml props: role button is interactive: it needs an action prop',
  ]);
  const target = '  minTouchTarget: { ios: 44, android: 48 }\n';
  for (const role of ['text', 'region', 'decorative']) {
    const passive = (t) =>
      t.replace('role: button', `role: ${role}`).replace(ACTION_PROP, '').replace(target, '');
    assert.deepEqual(checkEdited(passive).findings, [], role);
  }
  const acting = checkEdited((t) => t.replace('role: button', 'role: text'));
  assert.deepEqual(messagesOf(acting), [
    'CC-13 button.yaml props: role text is never activated, so no prop is an action',
  ]);
});

test('a pending contract is checked but gets no API', () => {
  const pending = (t) => t.replace('approved: 2026-10-20', 'approved: pending');
  assert.equal(checkEdited(pending).pending, true);
  writeFileSync(path.join(SCRATCH, 'button.yaml'), pending(VALID_TEXT));
  const result = loadContracts(SCRATCH, fixtureModel);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.apis, []);
  assert.deepEqual(result.pending, ['button.yaml']);
});

test('references: a whole component first, then <component>-<state> (owner, 2026-10-20)', () => {
  const ref = (key) => resolveReference(`{components.${key}}`, repoModel);
  assert.deepEqual(ref('button-primary-pressed'), {
    component: 'button-primary',
    state: 'pressed',
  });
  assert.deepEqual(ref('button-secondary-loading'), {
    component: 'button-secondary',
    state: 'loading',
  });
  assert.deepEqual(ref('button-action-selected'), {
    component: 'button-action-selected',
    state: null,
  });
  assert.deepEqual(ref('focus-ring'), { component: 'focus-ring', state: null });
  assert.equal(ref('button-primary-hover'), null);
});

test('the fixture API: only allowed combinations, in contract order, in every context', () => {
  const keys = fixture.combinations.map(comboKey);
  assert.equal(keys.length, 14);
  assert.ok(keys.includes('primary/small/disabled'));
  assert.ok(!keys.some((key) => key.startsWith('secondary/small/')), 'secondary has no small');
  assert.ok(!keys.includes('secondary/large/disabled'), 'secondary has no disabled');
  assert.deepEqual(fixture.contexts, ['light', 'dark', 'brand', 'hc-light', 'hc-dark']);
  assert.deepEqual(fixture.gallery.items, fixture.combinations);
});

test('the fixture API: merged fields, colours first, optional where a look lacks one', () => {
  const fields = fixture.fields.map(({ name, type, optional }) => [name, type, optional]);
  const padding = ['paddingTop', 'paddingEnd', 'paddingBottom', 'paddingStart'];
  assert.deepEqual(fields, [
    ['backgroundColor', 'role', true],
    ['textColor', 'role', false],
    ['borderColor', 'role', true],
    ['spinnerColor', 'role', true],
    ['borderWidth', 'double', true],
    ['typography', 'textStyle', false],
    ['rounded', 'double', false],
    ['height', 'double', false],
    ...padding.map((side) => [side, 'double', false]),
    ['iconSize', 'AppIconSize', false],
    ['iconGap', 'double', false],
    ['trailingIconSize', 'AppIconSize', true],
    ['trailingIconGap', 'double', true],
    ['focusRing', 'FocusRingTokens', true],
  ]);
});

test('the icon slot: from the shared size entry in every look, whatever holds the size', () => {
  // button-large: icon-md and {spacing.8}; button-small: icon-sm and 4px (fixture DESIGN.md).
  const slot = (values) => [values.iconSize.value.id, values.iconGap.value.n];
  for (const context of fixture.contexts) {
    for (const { variant, size, values } of fixture.looks[context]) {
      const expected = size === 'small' ? ['sm', 4] : ['md', 8];
      assert.deepEqual(slot(values), expected, `${variant}/${size} in ${context}`);
    }
  }
  const large = look(fixture, 'light', 'primary', 'large', 'enabled');
  assert.equal(large.height.value.n, 48, 'the base holds the large height');
});

test('the merge: base, then state, then size; the base as its own size adds nothing', () => {
  const value = (values, field) => values[field]?.value;
  const disabledLarge = look(fixture, 'light', 'primary', 'large', 'disabled');
  assert.deepEqual(value(disabledLarge, 'typography'), {
    t: 'ref',
    namespace: 'AppTypography',
    member: 'labelMuted',
  });
  assert.deepEqual(value(disabledLarge, 'backgroundColor'), { t: 'role', id: 'surface2' });
  const disabledSmall = look(fixture, 'light', 'primary', 'small', 'disabled');
  assert.equal(value(disabledSmall, 'typography').member, 'body', 'the size entry is last');
  assert.deepEqual(value(disabledSmall, 'height'), { t: 'number', n: 36 });
  assert.deepEqual(value(disabledSmall, 'paddingEnd'), { t: 'number', n: 12 });
  assert.deepEqual(value(disabledSmall, 'textColor'), { t: 'role', id: 'textSecondary' });
});

test('the merge: a scheme-dependent state differs per context', () => {
  const pressed = (context) => look(fixture, context, 'primary', 'large', 'pressed');
  assert.equal(pressed('light').backgroundColor.value.id, 'primaryPressed');
  assert.equal(pressed('dark').backgroundColor.value.id, 'surface2');
  assert.equal(pressed('brand').backgroundColor.value.id, 'surface2');
});

test('the merge: focused is the enabled look plus the focus ring of the same context', () => {
  for (const context of fixture.contexts) {
    const enabled = look(fixture, context, 'secondary', 'large', 'enabled');
    const { focusRing, ...colours } = look(fixture, context, 'secondary', 'large', 'focused');
    assert.deepEqual(colours, enabled);
    assert.equal(focusRing.value.namespace, 'FocusRingTokens');
    assert.equal(enabled.focusRing, undefined);
  }
  const ring = look(fixture, 'hc-dark', 'primary', 'small', 'focused').focusRing.value;
  assert.deepEqual(ring, { t: 'ref', namespace: 'FocusRingTokens', member: 'hcDark' });
});

test('the merge: loading keeps the enabled look unless the variant names its own', () => {
  const enabled = look(fixture, 'dark', 'primary', 'large', 'enabled');
  assert.deepEqual(look(fixture, 'dark', 'primary', 'large', 'loading'), enabled);
  const loading = look(fixture, 'dark', 'secondary', 'large', 'loading');
  assert.equal(loading.spinnerColor.value.id, 'primary');
  assert.equal(loading.borderColor.value.id, 'outline');
  assert.deepEqual(loading.borderWidth.value, { t: 'number', n: 1.5 }, 'button-outline-ring');
  assert.equal(enabled.borderWidth, undefined, 'no ring, no width');
});

test('the repository button: the approved sizes, variants and combinations', () => {
  const button = repoButton();
  assert.equal(button.combinations.length, 100);
  const ids = new Set(button.combinations.map(({ variant, size }) => `${variant}/${size}`));
  assert.ok(ids.has('text/compact') && !ids.has('text/small'), 'text small became compact');
  assert.ok(ids.has('primary-outline/compact') && ids.has('destructive-tonal/large'));
  assert.ok(!ids.has('destructive-filled/compact'));
  assert.deepEqual(button.contexts, ['light', 'dark', 'brand', 'hc-light', 'hc-dark']);
});

test('the repository button: merged looks the owner checked on the screens', () => {
  const button = repoButton();
  const ref = (values, field) => values[field].value;
  const filledDisabled = look(button, 'light', 'destructive-filled', 'large', 'disabled');
  assert.equal(ref(filledDisabled, 'typography').member, 'buttonDisabled', 'label weight 500');
  const compact = look(button, 'light', 'primary', 'compact', 'enabled');
  assert.equal(ref(compact, 'typography').member, 'subhead');
  assert.deepEqual([ref(compact, 'height').n, ref(compact, 'paddingEnd').n], [44, 20]);
  const secondaryLoading = look(button, 'dark', 'secondary', 'large', 'loading');
  assert.equal(ref(secondaryLoading, 'spinnerColor').id, 'primaryText');
  assert.equal(ref(secondaryLoading, 'borderWidth').n, 1.5);
  const destructivePressed = (context) =>
    ref(look(button, context, 'destructive', 'medium', 'pressed'), 'backgroundColor').id;
  assert.deepEqual(['light', 'dark'].map(destructivePressed), ['errorBg', 'surface2']);
  const focused = look(button, 'hc-dark', 'tonal', 'card', 'focused');
  assert.equal(ref(focused, 'focusRing').member, 'hcDark');
});

test('the icon slot: dimensions on a component entry, like height; anything else is TK-11', () => {
  const dimension = (n) => ({ $type: 'dimension', $value: { value: n, unit: 'px' } });
  const compact = repoModel.sets.components['button-compact'];
  assert.deepEqual(compact.iconGap, dimension(6), 'gap 6 is on no scale and stays literal');
  assert.deepEqual(compact.iconSize, {
    ...dimension(20),
    $extensions: { 'app.iconSize': 'icon-md' },
  });
  const { findings } = loadTokens(CONTRACT_TOKENS.replace('iconGap: 4px', 'iconGap: wide'));
  const expected = 'TK-11 components.button-small.iconGap: "wide" is not a px dimension';
  assert.deepEqual(findings.map(formatFinding), [`${expected}, number or {reference}`]);
});

test('the repository button: the icon slot is icon-md everywhere, gap 6 at compact, 8 else', () => {
  const button = repoButton();
  for (const context of button.contexts) {
    for (const { variant, size, state, values } of button.looks[context]) {
      const at = `${variant}/${size}/${state} in ${context}`;
      assert.equal(values.iconSize.type, 'AppIconSize', at);
      assert.equal(values.iconSize.value.id, 'md', at);
      assert.equal(values.iconGap.value.n, size === 'compact' ? 6 : 8, at);
    }
  }
  // compact height and padding come from the variant's entry, the slot from button-compact.
  const filled = look(button, 'dark', 'primary', 'compact', 'loading');
  assert.equal(filled.paddingEnd.value.n, 20, 'button-compact-filled');
  const text = look(button, 'light', 'text', 'compact', 'enabled');
  assert.equal(text.paddingEnd.value.n, 12, 'button-text-compact');
  const ownBase = look(button, 'light', 'destructive-text', 'compact', 'enabled');
  assert.equal(ownBase.paddingEnd.value.n, 10, 'the variant base holds its compact size');
  assert.equal(ownBase.iconGap.value.n, 6, 'the slot still comes from button-compact');
});

// Icon sets (`kind: icon-set`, C02, Linear AI-201).

test('kind: none is a control contract, icon-set is the only kind, each closed', () => {
  const kinds = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-01-icon-kind'), fixtureModel);
  assert.deepEqual(messagesOf(kinds), [
    'CC-01 icon.yaml kind: must be equal to constant {"allowedValue":"icon-set"}',
  ]);
  const withKind = (t) => t.replace('name: AppButton', 'name: AppButton\nkind: icon-set');
  assert.deepEqual(rulesOf(checkEdited(withKind)), ['CC-01'], 'a button is no icon set');
  const testId = checkIconEdited((t) => `${t}testId: ds-icon\n`);
  assert.deepEqual(messagesOf(testId), [
    'CC-01 icon.yaml: must NOT have additional properties {"additionalProperty":"testId"}',
  ]);
  const paint = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-01-icon-paint'), fixtureModel);
  assert.match(listed(paint.findings), /^CC-01 icon\.yaml glyphs\.1\.shapes\.2\.paint: must be /);
  const plusShapes = "shapes:\n      - d: 'm12 5 0 14M5 12h14'\n        paint: stroke\n";
  const noShapes = checkIconEdited((t) => t.replace(plusShapes, 'shapes: []\n'));
  assert.match(listed(noShapes.findings), /glyphs\.5\.shapes: must NOT have fewer than 1 items/);
});

test('CC-09: a glyph id repeated, a keyword, two ids one identifier, or a member, fails', () => {
  const repeated = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-09'), fixtureModel);
  assert.deepEqual(messagesOf(repeated), ['CC-09 icon.yaml glyphs.3.id: "heart" is not unique']);
  const renamed = (from, to) =>
    checkIconEdited((t) => t.replace(`- id: ${from}\n`, `- id: ${to}\n`));
  const cases = [
    ['repeat', 'glyph id "repeat" is a Swift or Kotlin keyword'],
    ['type', 'glyph id "type" becomes the Swift type Type'],
    ['glyph', 'glyph id "glyph" becomes glyph, which the enum has'],
    ['test-id', 'glyph id "test-id" becomes testId, which the enum has'],
  ];
  for (const [to, message] of cases) {
    assert.deepEqual(messagesOf(renamed('plus', to)), [`CC-09 icon.yaml glyphs: ${message}`], to);
  }
  const lines = (t) => t.replace('- id: wave\n', '- id: line-2\n').replace('plus\n', 'line2\n');
  assert.deepEqual(messagesOf(checkIconEdited(lines)), [
    'CC-09 icon.yaml glyphs: glyph ids "line-2" and "line2" both become line2',
    'CC-09 icon.yaml glyphs: glyph ids "line-2" and "line2" both become LINE2',
  ]);
});

test('CC-10: every step names an icon-<step> token with one size and stroke width', () => {
  const missing = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-10'), fixtureModel);
  assert.deepEqual(messagesOf(missing), [
    'CC-10 icon.yaml sizes.4: {components.icon-xl} is not a DESIGN.md component',
  ]);
  const defaultSize = (t) => t.replace('defaultSize: icon-lg', 'defaultSize: icon-xl');
  const unlisted = checkIconEdited(defaultSize);
  assert.deepEqual(messagesOf(unlisted), [
    'CC-10 icon.yaml defaultSize: "icon-xl" is not in `sizes`',
  ]);
  // icon-xs, which no button slot names: a slot naming a broken size is TK-06 first.
  const cases = [
    ['  icon-xs: { size: 12px }\n', 'has no strokeWidth number'],
    ['  icon-xs: { size: 12px, strokeWidth: 2.2, height: 12px }\n', 'has height, not only size'],
    [
      [
        '  icon-xs-light: { size: 12px, strokeWidth: 2.2 }',
        '  icon-xs-dark: { size: 12px, strokeWidth: 2.2 }',
        '  icon-xs-hc-light: { size: 12px, strokeWidth: 2.6 }',
        '',
      ].join('\n'),
      'strokeWidth differs between contexts',
    ],
  ];
  for (const [replacement, message] of cases) {
    const result = checkContract(VALID_ICON_TEXT, 'icon.yaml', tokensWith(replacement, ICON_XS));
    assert.deepEqual(rulesOf(result), ['CC-10'], message);
    const expected = new RegExp(`sizes\\.0: \\{components\\.icon-xs\\} ${message}`);
    assert.match(listed(result.findings), expected);
  }
});

test('CC-10: the scale grows step by step, and each step is a case of its own', () => {
  const shrinking = tokensWith('  icon-sm: { size: 24px, strokeWidth: 1.9 }\n');
  assert.deepEqual(messagesOf(checkContract(VALID_ICON_TEXT, 'icon.yaml', shrinking)), [
    'CC-10 icon.yaml sizes.2: icon-md (20) is not larger than icon-sm (24)',
  ]);
  const steps = (list) => (t) => t.replace('[icon-xs, icon-sm, icon-md, icon-lg]', list);
  const keyword = tokensWith(`${ICON_SM}  icon-in: { size: 64px, strokeWidth: 1.7 }\n`);
  const withIn = steps('[icon-xs, icon-sm, icon-lg, icon-in]')(VALID_ICON_TEXT);
  assert.deepEqual(messagesOf(checkContract(withIn, 'icon.yaml', keyword)), [
    'CC-10 icon.yaml sizes: size step "in" is a Swift or Kotlin keyword',
  ]);
  const numbered = checkIconEdited(steps('[icon-xs, icon-16]'));
  assert.match(listed(numbered.findings), /^CC-01 icon\.yaml sizes\.1: must match pattern/);
});

test('CC-11: a compiled point outside the 24 x 24 viewBox fails; the edges are inside', () => {
  const outside = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-11-viewbox'), fixtureModel);
  assert.deepEqual(messagesOf(outside), [
    'CC-11 icon.yaml glyphs.0.shapes.0.d: back: the point (14.5, 24.5) lies outside the 24 x 24 viewBox',
  ]);
  const toControl = (t) => t.replace("d: 'M12 11v5'", "d: 'M12 11C-1 11 12 16 12 16'");
  assert.deepEqual(messagesOf(checkIconEdited(toControl)), [
    'CC-11 icon.yaml glyphs.1.shapes.1.d: info: the point (-1, 11) lies outside the 24 x 24 viewBox',
  ]);
  const edges = checkIconEdited((t) => t.replace("d: 'M12 11v5'", "d: 'M0 0L24 24'"));
  assert.deepEqual(edges.findings, []);
});

test('CC-11: path data that does not compile, or draws nothing, fails', () => {
  const broken = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-11'), fixtureModel);
  assert.deepEqual(messagesOf(broken), [
    'CC-11 icon.yaml glyphs.1.shapes.0.d: info: cannot compile the path: expected an arc flag (0 or 1) at 12',
  ]);
  const empty = checkIconEdited((t) => t.replace("d: 'M12 11v5'", "d: 'M12 11'"));
  assert.deepEqual(messagesOf(empty), [
    'CC-11 icon.yaml glyphs.1.shapes.1.d: info: the path data draws nothing',
  ]);
});

test('a pending icon set is checked but gets no API', () => {
  const pending = checkIconEdited((t) => t.replace('approved: 2026-10-20', 'approved: pending'));
  assert.deepEqual(pending.findings, []);
  assert.equal(pending.pending, true);
});

test('CC-12: beside an icon set, every icon slot names one of its sizes', () => {
  const unlisted = loadContracts(path.join(CONTRACT_FIXTURES, 'CC-12'), fixtureModel);
  assert.deepEqual(messagesOf(unlisted), [
    'CC-12 button.yaml sizes.large: {components.button-large} iconSize names icon-md, which icon.yaml does not list',
  ]);
  const iconSet = [iconSetOf(parseYaml(VALID_ICON_TEXT), 'icon.yaml')];
  const smallSlot = "iconSize: '{components.icon-sm}'";
  const literal = modelOf(CONTRACT_TOKENS.replace(smallSlot, 'iconSize: 16px'));
  assert.deepEqual(messagesOf(checkContract(VALID_TEXT, 'button.yaml', literal, iconSet)), [
    'CC-12 button.yaml sizes.small: {components.button-small} iconSize is a number, not a size of icon.yaml',
  ]);
  const twice = [...iconSet, { ...iconSet[0], file: 'brand-icon.yaml' }];
  assert.deepEqual(messagesOf(checkContract(VALID_TEXT, 'button.yaml', fixtureModel, twice)), [
    'CC-12 button.yaml: icon.yaml and brand-icon.yaml are both icon sets; the icon slot names one scale',
  ]);
  // With no icon set the slot is the size's number; nothing requires a reference.
  const alone = checkContract(VALID_TEXT, 'button.yaml', literal);
  assert.deepEqual(alone.findings, []);
  assert.equal(alone.api.fields.find(({ name }) => name === 'iconSize').type, 'double');
});

test("CC-12 (G3, G6): the trailing slot and a variant's own slot size name the set's sizes", () => {
  const iconSet = [iconSetOf(parseYaml(VALID_ICON_TEXT), 'icon.yaml')];
  const check = (text) =>
    messagesOf(checkContract(VALID_TEXT, 'button.yaml', modelOf(text), iconSet));
  const large = '{components.button-large} trailingIconSize';
  const trailing = CONTRACT_TOKENS.replace('trailingIconSize: icon-sm', 'trailingIconSize: 14px');
  assert.deepEqual(check(trailing), [
    `CC-12 button.yaml sizes.large: ${large} is a number, not a size of icon.yaml`,
  ]);
  const own = '{components.button-secondary} iconSize';
  assert.deepEqual(check(withProperty('button-secondary', 'iconSize: 18px')), [
    `CC-12 button.yaml tokens.secondary: ${own} is a number, not a size of icon.yaml`,
  ]);
  const xs = withProperty('button-secondary', 'iconSize: icon-xs');
  const { findings, api } = checkContract(VALID_TEXT, 'button.yaml', modelOf(xs), iconSet);
  assert.deepEqual(findings, [], listed(findings));
  assert.equal(look(api, 'light', 'secondary', 'large', 'enabled').iconSize.value.id, 'xs');
  assert.equal(look(api, 'light', 'primary', 'large', 'enabled').iconSize.value.id, 'md');
});

test('the icon slot is the size enum of the icon set only once that set is approved', () => {
  const iconSet = iconSetOf(parseYaml(VALID_ICON_TEXT), 'icon.yaml');
  const typeOf = (sets) => {
    const { api } = checkContract(VALID_TEXT, 'button.yaml', fixtureModel, sets);
    return api.fields.find(({ name }) => name === 'iconSize').type;
  };
  assert.equal(typeOf([iconSet]), 'AppIconSize');
  assert.equal(typeOf([{ ...iconSet, approved: false }]), 'double');
  assert.equal(typeOf([]), 'double');
  const { api } = checkContract(VALID_TEXT, 'button.yaml', fixtureModel);
  const large = api.looks.light.find(({ size }) => size === 'large').values.iconSize;
  assert.deepEqual(large.value, { t: 'number', n: 20 }, 'icon-md is 20 px');
});

test('the icon fixture API: token sizes, the default, sets by first use, compiled glyphs', () => {
  assert.deepEqual(iconFixture.sizes, [
    { id: 'icon-xs', size: 12, strokeWidth: 2.2 },
    { id: 'icon-sm', size: 16, strokeWidth: 1.9 },
    { id: 'icon-md', size: 20, strokeWidth: 1.7 },
    { id: 'icon-lg', size: 24, strokeWidth: 1.7 },
  ]);
  assert.equal(iconFixture.defaultSize, 'icon-lg');
  assert.deepEqual(iconFixture.sets, ['navigation', 'status', 'closet', 'weather', 'actions']);
  assert.deepEqual(iconFixture.paints, ['stroke', 'fill', 'both']);
  assert.deepEqual(iconFixture.gallery, { title: 'C02 Fixture icons', slug: 'c02-fixture-icons' });
  const ids = ['back', 'info', 'heart', 'heart-filled', 'wave', 'plus'];
  assert.deepEqual(
    iconFixture.glyphs.map(({ id }) => id),
    ids,
  );
  const [back] = iconFixture.glyphs;
  assert.deepEqual(back.shapes, [
    {
      paint: 'stroke',
      segments: [
        { command: 'move', points: [14.5, 5.5] },
        { command: 'line', points: [8, 12] },
        { command: 'line', points: [14.5, 18.5] },
      ],
    },
  ]);
  const info = iconFixture.glyphs[1];
  assert.deepEqual(
    info.shapes.map(({ paint }) => paint),
    ['stroke', 'stroke', 'fill'],
  );
  const heart = (id) => iconFixture.glyphs.find((glyph) => glyph.id === id).shapes[0];
  assert.deepEqual(heart('heart-filled').segments, heart('heart').segments, 'the twin');
  assert.equal(heart('heart-filled').paint, 'both');
});
