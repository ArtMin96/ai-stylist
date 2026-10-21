// The DEC-87 stage-4 golden test: the Swift and Kotlin emitters produce the same name -> value
// table. Both tables are read back from the emitted text (parity-table.mjs), for the synthetic
// fixtures and the repository DESIGN.md and contracts, so a dialect that drops, renames, reorders
// or respells a token, a merged look or an icon glyph's segment fails here. Run by
// scripts/test/design-tokens.test.sh.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { testIdOf } from '../contract-model.mjs';
import { contextsOf, declarations } from '../declarations.mjs';
import { emitApiKotlin } from '../emit-api-kotlin.mjs';
import { emitApiSwift } from '../emit-api-swift.mjs';
import { emitKotlin } from '../emit-kotlin.mjs';
import { emitSwift } from '../emit-swift.mjs';
import {
  contextId,
  ktEnumEntry,
  memberId,
  nestedTypeName,
  testIdName,
  tokensTypeName,
} from '../naming.mjs';
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
  emittedIconSet,
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
const contractModel = modelOf(CONTRACT_TOKENS);
const contractFixture = withApiOf(contractModel, VALID_CONTRACTS);
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

test('the repository C03 entries: trailing slots, rings, parts and type styles in both tables', () => {
  const tables = { Swift: swiftTable(repo.swift), Kotlin: kotlinTable(repo.kotlin) };
  const expected = {
    'ChipCompactTokens.light.trailingIconSize': 'num:12',
    'ChipCompactTokens.light.trailingIconGap': 'num:6',
    'ChipMediumTokens.hcDark.trailingIconSize': 'num:16',
    'ChipMediumTokens.hcDark.trailingIconGap': 'num:4',
    'ChipOverrideTokens.dark.borderWidth': 'num:1.5',
    'TagProvisionalTokens.light.borderDash': 'num:3',
    'ChipFilterTokens.light.detailTypography': 'ref:AppTypography.labelMdMedium',
    'ChipFilterTokens.light.detailColor': 'role:TEXT_SECONDARY',
    'ChipSwatchTokens.dark.swatchEdgeMinContrast': 'num:3',
    'BadgeDotTokens.light.outerRingWidth': 'num:2',
    'AppTypography.labelMdNormal.fontWeight': 'num:400',
    'AppTypography.labelMdMedium.fontWeight': 'num:500',
    'AppTypography.labelSmMedium.fontSize': 'num:13',
  };
  for (const [language, table] of Object.entries(tables)) {
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(table[name], value, `${language} ${name}`);
    }
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
    'ButtonAppearance.iconSize:type': 'AppIconSize',
    'ButtonAppearance.iconGap:type': 'Double',
    'ButtonSpec.light.looks': 'list:100',
    'ComponentGallery.buttonLabel': 'str:"Continue"',
    'ComponentGallery.button': 'list:100',
    'GalleryComponent.cases': 'BUTTON,ICON',
    'GalleryComponent[BUTTON].id': 'str:"button"',
    'GalleryComponent[BUTTON].title': 'str:"C01 Buttons"',
    'GalleryComponent[BUTTON].slug': 'str:"c01-buttons"',
    'GalleryComponent[ICON].title': 'str:"C02 Icons"',
    'GalleryComponent[ICON].slug': 'str:"c02-icons"',
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
      const iconSize = `role:${ktEnumEntry(values.iconSize.value.id)}`;
      assert.equal(table[`${at}.appearance.iconSize`], iconSize, at);
      assert.equal(table[`${at}.appearance.iconGap`], `num:${values.iconGap.value.n}`, at);
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

// Icon sets (`kind: icon-set`, C02, Linear AI-201): the enums, the sizes and the glyph table.

test('the glyph table: every segment of every fixture glyph, the same in both languages', () => {
  const table = kotlinTable(contractFixture.kotlin);
  const iconSet = apisOf(contractModel, VALID_CONTRACTS).find(({ id }) => id === 'icon');
  const numbers = (points) => `list:[${points.map((n) => `num:${n}`).join(',')}]`;
  for (const { id, set, shapes } of iconSet.glyphs) {
    const entry = `AppIconName[${ktEnumEntry(memberId(id))}]`;
    const glyph = `AppIconGlyphs.${nestedTypeName(id)}.glyph`;
    assert.equal(table[`${entry}.id`], `str:"${id}"`);
    assert.equal(table[`${entry}.set`], `role:${ktEnumEntry(memberId(set))}`);
    assert.equal(table[`${entry}.testId`], `str:"ds-icon-${id}"`);
    assert.equal(table[`${entry}.glyph`], `ref:${glyph}`);
    assert.equal(table[`${glyph}:init`], 'AppIconGlyph');
    assert.equal(table[`${glyph}.shapes`], `list:${shapes.length}`);
    shapes.forEach(({ paint, segments }, s) => {
      const shape = `${glyph}.shapes[${s}]`;
      assert.equal(table[`${shape}.paint`], `role:${paint.toUpperCase()}`, shape);
      assert.equal(table[`${shape}.segments`], `list:${segments.length}`, shape);
      segments.forEach(({ command, points }, i) => {
        const at = `${shape}.segments[${i}]`;
        assert.equal(table[`${at}.command`], `role:${command.toUpperCase()}`, at);
        assert.equal(table[`${at}.points`], numbers(points), at);
      });
    });
  }
  const expected = {
    'AppIconName.cases': 'BACK,INFO,HEART,HEART_FILLED,WAVE,PLUS',
    'AppIconName.set:type': 'AppIconSet',
    'AppIconName.testId:type': 'String',
    'AppIconName.glyph:type': 'AppIconGlyph',
    'AppIconSet.cases': 'NAVIGATION,STATUS,CLOSET,WEATHER,ACTIONS',
    'AppIconSize.cases': 'XS,SM,MD,LG',
    'AppIconSize[SM].id': 'str:"icon-sm"',
    'AppIconSize[SM].size': 'num:16',
    'AppIconSize[SM].strokeWidth': 'num:1.9',
    'ButtonAppearance.iconSize:type': 'AppIconSize',
    'ButtonSpec.light.looks[0].appearance.iconSize': 'role:MD',
    'AppIconSize.strokeWidth:type': 'Double',
    'AppIconMetrics.viewBox': 'num:24',
    'AppIconMetrics.defaultSize': 'role:LG',
    'AppIconSegment.points:type': 'list<Double>',
    'AppIconShape.segments:type': 'list<AppIconSegment>',
    'AppIconPaint.cases': 'STROKE,FILL,BOTH',
    'AppIconCommand.cases': 'MOVE,LINE,CUBIC,CLOSE',
    'AppIconGlyphs.Info.glyph.shapes[0].segments[5].points': 'list:[]',
    'GalleryComponent.cases': 'BUTTON,ICON',
    'GalleryComponent[ICON].title': 'str:"C02 Fixture icons"',
    'GalleryComponent[ICON].slug': 'str:"c02-fixture-icons"',
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(table[name], value, name);
});

test('a glyph point, a paint, a stroke width or an icon test ID spelled differently fails', () => {
  const differs = (file, from, to) => {
    const text = contractFixture.kotlin[file].replace(from, to);
    const [swift, kt] = [
      swiftTable(contractFixture.swift),
      kotlinTable({ ...contractFixture.kotlin, [file]: text }),
    ];
    return Object.keys({ ...swift, ...kt }).filter((name) => swift[name] !== kt[name]);
  };
  const glyphs = 'AppIconGlyphs.kt';
  assert.deepEqual(differs(glyphs, 'listOf(14.5, 5.5)', 'listOf(14.5, 5.6)'), [
    'AppIconGlyphs.Back.glyph.shapes[0].segments[0].points',
  ]);
  assert.deepEqual(differs(glyphs, 'paint = AppIconPaint.FILL', 'paint = AppIconPaint.BOTH'), [
    'AppIconGlyphs.Info.glyph.shapes[2].paint',
  ]);
  const api = 'ComponentApi.kt';
  assert.deepEqual(differs(api, '"icon-sm", 16.0, 1.9', '"icon-sm", 16.0, 1.7'), [
    'AppIconSize[SM].strokeWidth',
  ]);
  assert.deepEqual(differs(api, '"ds-icon-back"', '"ds-icon-back-1"'), [
    'AppIconName[BACK].testId',
  ]);
});

test('a Kotlin enum entry wrapped one argument per line reads as its Swift case', () => {
  const rename = (text) => text.replace('- id: plus\n', '- id: thumbs-up-filled-with-long-name\n');
  const kotlin = emittedIconSet(emitApiKotlin, contractModel, rename);
  assert.ok(kotlin['ComponentApi.kt'].includes('\n    THUMBS_UP_FILLED_WITH_LONG_NAME(\n'));
  const table = kotlinTable(kotlin);
  assert.deepEqual(swiftTable(emittedIconSet(emitApiSwift, contractModel, rename)), table);
  assert.equal(table['AppIconName[THUMBS_UP_FILLED_WITH_LONG_NAME].set'], 'role:ACTIONS');
});
