// The DEC-87 stage-4 golden test: the Swift and Kotlin emitters produce the same name -> value
// table. Both tables are read back from the emitted text (parity-table.mjs), for the synthetic
// fixture and the repository DESIGN.md, so a dialect that drops, renames, reorders or respells a
// token fails here. Run by scripts/test/design-tokens.test.sh.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { testIdOf } from '../contract-model.mjs';
import { contextsOf, declarations } from '../declarations.mjs';
import { emitApiKotlin } from '../emit-api-kotlin.mjs';
import { emitApiSwift } from '../emit-api-swift.mjs';
import { emitKotlin } from '../emit-kotlin.mjs';
import { emitSwift } from '../emit-swift.mjs';
import { contextId, ktEnumEntry, memberId, testIdName, tokensTypeName } from '../naming.mjs';
import { CONTEXTS } from '../syntax.mjs';
import { kotlinTable, swiftTable } from './parity-table.mjs';
import {
  CONTRACT_TOKENS,
  REPO_CONTRACTS,
  REPO_DESIGN_MD,
  VALID,
  VALID_CONTRACTS,
  apisOf,
  emittedApi,
  modelOf,
} from './models.mjs';

const filesOf = (model) => {
  const tiers = declarations(model);
  return { swift: emitSwift(tiers, 'DESIGN.md'), kotlin: emitKotlin(tiers, 'DESIGN.md') };
};
/** The token tiers plus the component API file of each language, as gen-tokens writes them. */
const withApiOf = (model, dir) => {
  const { swift, kotlin } = filesOf(model);
  return {
    swift: { ...swift, ...emittedApi(emitApiSwift, model, dir) },
    kotlin: { ...kotlin, ...emittedApi(emitApiKotlin, model, dir) },
  };
};
const fixture = filesOf(modelOf(VALID));
const repoModel = modelOf(REPO_DESIGN_MD);
const repo = filesOf(repoModel);
const contractFixture = withApiOf(modelOf(CONTRACT_TOKENS), VALID_CONTRACTS);
const repoWithApi = withApiOf(repoModel, REPO_CONTRACTS);

test('the fixture: Swift and Kotlin spell the same name -> value table', () => {
  assert.deepEqual(swiftTable(fixture.swift), kotlinTable(fixture.kotlin));
});

test('the repository DESIGN.md: Swift and Kotlin spell the same name -> value table', () => {
  assert.deepEqual(swiftTable(repo.swift), kotlinTable(repo.kotlin));
});

test('the table holds values of every tier, in one spelling', () => {
  const table = swiftTable(fixture.swift);
  const expected = {
    'AppSpacing.space4': 'num:4',
    'AppSpacing.space4:type': 'Double',
    'AppTypography.label:init': 'AppTextStyle',
    'AppTypography.label.letterSpacing': 'num:0.6',
    'AppTypography.badge.m3Roles': 'list:[]',
    'AppTextStyle.m3Roles:type': 'list<String>',
    'AppElevation.Sheet.color': 'role:SCRIM',
    'AppMotion.easingEnter': 'list:[num:0.2,num:0,num:0,num:1]',
    'AppColorRole.cases': [
      'BACKGROUND,TEXT,PRIMARY,PRIMARY_PRESSED,ON_PRIMARY,SURFACE2',
      'SCRIM,RING_LIGHT',
    ].join(','),
    'AppColors[ON_PRIMARY]': 'onPrimary',
    'AppColors.scrim:type': 'argb',
    'AppColors.brand.background': 'argb:FF225533',
    'ButtonPrimaryTokens.dark.typography': 'ref:AppTypography.label',
    'ButtonPrimaryTokens.hcLight.pressed:init': 'Pressed',
    'ButtonPrimaryTokens.hcLight.pressed.backgroundColor': 'role:PRIMARY_PRESSED',
    'ButtonPrimaryTokens.Pressed.backgroundColor:type': 'AppColorRole',
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(table[name], value, name);
});

test('the repository table has every role in every context and every component per context', () => {
  const table = kotlinTable(repo.kotlin);
  const roles = repoModel.roles.map(({ key }) => memberId(key));
  assert.equal(table['AppColorRole.cases'], roles.map(ktEnumEntry).join(','));
  for (const context of CONTEXTS.map(contextId)) {
    for (const role of roles) assert.match(table[`AppColors.${context}.${role}`], /^argb:/);
  }
  for (const component of Object.keys(repoModel.sets.components)) {
    const type = tokensTypeName(component);
    const contexts = contextsOf(component).map(contextId);
    for (const context of CONTEXTS.map(contextId)) {
      const expected = contexts.includes(context) ? type : undefined;
      assert.equal(table[`${type}.${context}:init`], expected, `${type}.${context}`);
    }
  }
  assert.equal(table['BannerDarkTokens.light:init'], undefined);
});

test('the contract fixture: both component API files spell the same table', () => {
  assert.deepEqual(swiftTable(contractFixture.swift), kotlinTable(contractFixture.kotlin));
});

test('the repository contracts: both component API files spell the same table', () => {
  assert.deepEqual(swiftTable(repoWithApi.swift), kotlinTable(repoWithApi.kotlin));
});

test('the API table holds the ids, the test IDs, the lookup and every merged look', () => {
  const table = kotlinTable(repoWithApi.kotlin);
  const [button] = apisOf(repoModel, REPO_CONTRACTS);
  const expected = {
    'ButtonVariant[PRIMARY_OUTLINE].id': 'str:"primary-outline"',
    'ButtonSize.cases': 'LARGE,CARD,MEDIUM,COMPACT,SMALL',
    'ButtonState[ENABLED].id': 'str:"enabled"',
    'ButtonTestId.textCompactEnabled': 'str:"ds-button-text-compact-enabled"',
    'ButtonSpec.appearance()':
      'fn:(variant: ButtonVariant, size: ButtonSize, state: ButtonState) -> ButtonAppearance?',
    'ButtonAppearance.backgroundColor:type': 'AppColorRole?',
    'ButtonSpec.light.looks': 'list:100',
    'ComponentGallery.buttonLabel': 'str:"Continue"',
    'ComponentGallery.button': 'list:100',
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(table[name], value, name);
  assert.equal(table['ButtonTestId.textSmallEnabled'], undefined, 'text small is gone');
  for (const context of button.contexts) {
    button.looks[context].forEach(({ variant, size, state, values }, i) => {
      const at = `ButtonSpec.${contextId(context)}.looks[${i}]`;
      assert.equal(table[`${at}.variant`], `role:${ktEnumEntry(memberId(variant))}`, at);
      assert.equal(table[`${at}.state`], `role:${ktEnumEntry(memberId(state))}`, at);
      assert.equal(table[`${at}.size`], `role:${ktEnumEntry(memberId(size))}`, at);
      for (const { name } of button.fields) {
        const present = Object.hasOwn(values, name);
        assert.equal(table[`${at}.appearance.${name}`] === 'none', !present, `${at}.${name}`);
      }
    });
  }
  button.gallery.items.forEach((combo, i) => {
    const constant = `ButtonTestId.${testIdName(combo)}`;
    assert.equal(table[`ComponentGallery.button[${i}].testId`], `ref:${constant}`);
    assert.equal(table[constant], `str:"${testIdOf('button', combo)}"`);
  });
});

test('a merged look, an id or a test ID spelled differently in one API file fails', () => {
  const differs = (from, to) => {
    const kotlin = Object.fromEntries(
      Object.entries(contractFixture.kotlin).map(([file, text]) => [file, text.replace(from, to)]),
    );
    const [swift, kt] = [swiftTable(contractFixture.swift), kotlinTable(kotlin)];
    return Object.keys({ ...swift, ...kt }).filter((name) => swift[name] !== kt[name]);
  };
  assert.deepEqual(differs('SECONDARY("secondary")', 'SECONDARY("secondary-1")'), [
    'ButtonVariant[SECONDARY].id',
  ]);
  assert.deepEqual(differs('borderColor = null,', 'borderColor = AppColorRole.OUTLINE,'), [
    'ButtonSpec.light.looks[0].appearance.borderColor',
  ]);
  assert.deepEqual(differs('"ds-button-primary-large-enabled"', '"ds-button-primary-large"'), [
    'ButtonTestId.primaryLargeEnabled',
  ]);
});

test('a value, a role or a name spelled differently in one language fails the comparison', () => {
  /** The names whose values differ once `from` becomes `to` in the Kotlin text. */
  const differs = (from, to) => {
    const kotlin = Object.fromEntries(
      Object.entries(fixture.kotlin).map(([file, text]) => [file, text.replace(from, to)]),
    );
    const [swift, kt] = [swiftTable(fixture.swift), kotlinTable(kotlin)];
    return Object.keys({ ...swift, ...kt }).filter((name) => swift[name] !== kt[name]);
  };
  const value = differs('background = 0xFFFA_FAFA', 'background = 0xFFFA_FAFB');
  assert.deepEqual(value, ['AppColors.light.background']);
  const role = differs('textColor = AppColorRole.ON_PRIMARY', 'textColor = AppColorRole.TEXT');
  assert.deepEqual(role, ['ButtonPrimaryTokens.light.textColor']);
  const name = differs('val space8: Double', 'val spacing8: Double');
  assert.deepEqual(name, [
    'AppSpacing.space8',
    'AppSpacing.space8:type',
    'AppSpacing.spacing8',
    'AppSpacing.spacing8:type',
  ]);
});
