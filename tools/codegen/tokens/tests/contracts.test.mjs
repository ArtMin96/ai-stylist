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

import { comboKey, resolveReference } from '../contract-model.mjs';
import { checkContract, loadContracts } from '../contracts.mjs';
import { formatFinding } from '../pipeline.mjs';
import {
  CONTRACT_FIXTURES,
  CONTRACT_TOKENS,
  REPO_CONTRACTS,
  REPO_DESIGN_MD,
  VALID_CONTRACTS,
  apisOf,
  modelOf,
} from './models.mjs';

const fixtureModel = modelOf(CONTRACT_TOKENS);
const repoModel = modelOf(REPO_DESIGN_MD);
const VALID_TEXT = readFileSync(path.join(VALID_CONTRACTS, 'button.yaml'), 'utf8');
const isRuleCase = (name) => /^CC-\d\d$/.test(name);
const RULE_CASES = readdirSync(CONTRACT_FIXTURES).filter(isRuleCase).sort();
const SCRATCH = mkdtempSync(path.join(tmpdir(), 'contracts-test-'));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

const listed = (findings) => findings.map(formatFinding).join('\n');
const [fixture] = apisOf(fixtureModel, VALID_CONTRACTS);
const [button] = apisOf(repoModel, REPO_CONTRACTS);

/** The fixture contract after `edit(text)`, checked against `model`. */
const checkEdited = (edit, model = fixtureModel) =>
  checkContract(edit(VALID_TEXT), 'button.yaml', model);
const rulesOf = ({ findings }) => [...new Set(findings.map(({ rule }) => rule))];

/** One merged look's values: `{ field: { type, value } }`. */
function look(api, context, variant, size, state) {
  const found = api.looks[context].find(
    (l) => l.variant === variant && l.size === size && l.state === state,
  );
  assert.ok(found, `${variant}/${size}/${state} in ${context}`);
  return found.values;
}

test('the repository contracts pass, and the button contract is approved', () => {
  const { findings, apis, pending } = loadContracts(REPO_CONTRACTS, repoModel);
  assert.deepEqual(findings, [], listed(findings));
  assert.deepEqual(pending, []);
  assert.deepEqual(
    apis.map(({ id }) => id),
    ['button'],
  );
});

test('the fixtures hold the valid contract and one failing case per rule, CC-01 to CC-07', () => {
  const expected = ['CC-01', 'CC-02', 'CC-03', 'CC-04', 'CC-05', 'CC-06', 'CC-07'];
  assert.deepEqual(RULE_CASES, expected);
  assert.equal(fixture.id, 'button');
});

for (const name of RULE_CASES) {
  test(`fixtures/contracts/${name} fails on ${name} and on nothing else`, () => {
    const result = loadContracts(path.join(CONTRACT_FIXTURES, name), fixtureModel);
    assert.ok(result.findings.length > 0, `${name} raised no finding`);
    assert.deepEqual(rulesOf(result), [name], listed(result.findings));
    assert.deepEqual(result.apis, []);
  });
}

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
    ['focusRing', 'FocusRingTokens', true],
  ]);
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
  assert.equal(button.combinations.length, 100);
  const ids = new Set(button.combinations.map(({ variant, size }) => `${variant}/${size}`));
  assert.ok(ids.has('text/compact') && !ids.has('text/small'), 'text small became compact');
  assert.ok(ids.has('primary-outline/compact') && ids.has('destructive-tonal/large'));
  assert.ok(!ids.has('destructive-filled/compact'));
  assert.deepEqual(button.contexts, ['light', 'dark', 'brand', 'hc-light', 'hc-dark']);
});

test('the repository button: merged looks the owner checked on the screens', () => {
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
