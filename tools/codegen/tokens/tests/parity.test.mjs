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
  once,
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
const repoWithApi = once(() => withApiOf(repoModel, REPO_CONTRACTS));

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
    'AppColorRole[BACKGROUND].id': 'str:"background"',
    'AppColorRole[SURFACE2].id': 'str:"surface-2"',
    'AppColorRole[RING_LIGHT].id': 'str:"ring-light"',
    'AppTextStyle.name:type': 'String',
    'AppTypography.label.name': 'str:"label"',
    'AppTypography.all': [
      'list:[ref:AppTypography.heading,ref:AppTypography.body',
      'ref:AppTypography.label,ref:AppTypography.badge]',
    ].join(','),
    'AppTypography.all:type': 'list<AppTextStyle>',
    'AppScaleStep.name:type': 'String',
    'AppScaleStep.value:type': 'Double',
    'AppSpacing.all': 'list:3',
    'AppSpacing.all:type': 'list<AppScaleStep>',
    'AppSpacing.all[0]:init': 'AppScaleStep',
    'AppSpacing.all[0].name': 'str:"spacing-4"',
    'AppSpacing.all[0].value': 'ref:AppSpacing.space4',
    'AppSpacing.all[2].name': 'str:"spacing-16"',
    'AppRadius.all[1].name': 'str:"rounded-full"',
    'AppRadius.all[1].value': 'ref:AppRadius.full',
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
  repoModel.roles.forEach(({ key }) => {
    assert.equal(table[`AppColorRole[${ktEnumEntry(memberId(key))}].id`], `str:"${key}"`, key);
  });
});

test('the repository scales and type styles: every step and style named by its DESIGN.md key', () => {
  const table = swiftTable(repo.swift);
  const names = (list) => {
    const out = [];
    for (let i = 0; table[`${list}[${i}].name`] !== undefined; i += 1) {
      out.push(JSON.parse(table[`${list}[${i}].name`].slice('str:'.length)));
    }
    return out;
  };
  const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64].map((n) => `spacing-${n}`);
  assert.deepEqual(names('AppSpacing.all'), spacing);
  const radii = [2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24].map((n) => `rounded-${n}`);
  assert.deepEqual(names('AppRadius.all'), [...radii, 'rounded-full']);
  const styles = Object.keys(repoModel.sets.primitives.typography);
  assert.deepEqual(styles.slice(0, 2), ['display', 'title-1']);
  assert.equal(styles.at(-1), 'button-disabled');
  const all = styles.map((key) => `ref:AppTypography.${memberId(key)}`);
  assert.equal(table['AppTypography.all'], `list:[${all.join(',')}]`);
  for (const key of styles) {
    assert.equal(table[`AppTypography.${memberId(key)}.name`], `str:"${key}"`, key);
  }
});

test('the contract fixture: both component API files spell the same table', () => {
  assert.deepEqual(swiftTable(contractFixture.swift), kotlinTable(contractFixture.kotlin));
});

test('the repository contracts: both component API files spell the same table', () => {
  const { swift, kotlin } = repoWithApi();
  assert.deepEqual(swiftTable(swift), kotlinTable(kotlin));
});

test('the API table holds the ids, the test IDs, the lookup and every merged look', () => {
  const table = kotlinTable(repoWithApi().kotlin);
  const [button] = apisOf(repoModel, REPO_CONTRACTS);
  const expected = {
    'ButtonVariant[PRIMARY_OUTLINE].id': 'str:"primary-outline"',
    'ButtonSize.cases': 'LARGE,CARD,MEDIUM,COMPACT,SMALL',
    'ButtonState[ENABLED].id': 'str:"enabled"',
    'ButtonTestId.textCompactEnabled': 'str:"ds-button-text-compact-enabled"',
    'ButtonSpec.appearance()':
      'fn:(variant: ButtonVariant, size: ButtonSize, state: ButtonState) -> ButtonAppearance?',
    'ButtonAppearance.backgroundColor:type': 'AppColorRole?',
    'ButtonAppearance.iconSize:type': 'Double',
    'ButtonAppearance.iconGap:type': 'Double',
    'ButtonSpec.light.looks': 'list:100',
    'ComponentGallery.buttonLabel': 'str:"Continue"',
    'ComponentGallery.button': 'list:100',
    'GalleryComponent.cases': 'BUTTON',
    'GalleryComponent[BUTTON].id': 'str:"button"',
    'GalleryComponent[BUTTON].title': 'str:"C01 Buttons"',
    'GalleryComponent[BUTTON].slug': 'str:"c01-buttons"',
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
      for (const name of ['iconSize', 'iconGap']) {
        assert.equal(table[`${at}.appearance.${name}`], `num:${values[name].value.n}`, at);
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
  assert.deepEqual(differs('"C01 Fixture buttons"', '"C01 Fixture button"'), [
    'GalleryComponent[BUTTON].title',
  ]);
  assert.deepEqual(differs('"c01-fixture-buttons"', '"c01-buttons"'), [
    'GalleryComponent[BUTTON].slug',
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
  const roleId = differs('SURFACE2("surface-2"', 'SURFACE2("surface2"');
  assert.deepEqual(roleId, ['AppColorRole[SURFACE2].id']);
  const step = differs('name = "spacing-8"', 'name = "space-8"');
  assert.deepEqual(step, ['AppSpacing.all[1].name']);
  const style = differs('name = "label"', 'name = "label-1"');
  assert.deepEqual(style, ['AppTypography.label.name']);
});
