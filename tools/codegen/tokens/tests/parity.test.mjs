// The DEC-87 stage-4 golden test: the Swift and Kotlin emitters produce the same name -> value
// table. Both tables are read back from the emitted text (parity-table.mjs), for the synthetic
// fixture and the repository DESIGN.md, so a dialect that drops, renames, reorders or respells a
// token fails here. Run by scripts/test/design-tokens.test.sh.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contextsOf, declarations } from '../declarations.mjs';
import { emitKotlin } from '../emit-kotlin.mjs';
import { emitSwift } from '../emit-swift.mjs';
import { contextId, ktEnumEntry, memberId, tokensTypeName } from '../naming.mjs';
import { CONTEXTS } from '../syntax.mjs';
import { kotlinTable, swiftTable } from './parity-table.mjs';
import { REPO_DESIGN_MD, VALID, modelOf } from './models.mjs';

const filesOf = (model) => {
  const tiers = declarations(model);
  return { swift: emitSwift(tiers, 'DESIGN.md'), kotlin: emitKotlin(tiers, 'DESIGN.md') };
};
const fixture = filesOf(modelOf(VALID));
const repoModel = modelOf(REPO_DESIGN_MD);
const repo = filesOf(repoModel);

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
