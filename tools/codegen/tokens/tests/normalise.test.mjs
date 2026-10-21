// In-process tests for the in-memory DTCG 2025.10 model and resolver (normalise.mjs) built from
// the synthetic fixture: colour roles and the five contexts, the DTCG value formats, type styles,
// scales, elevation, motion, and component tokens with role keys, states and scheme-dependent
// values. These are the facts the Swift and Kotlin emitters rely on. Run by
// scripts/test/design-tokens.test.sh.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONTEXT_SOURCES, normalise, resolveColors, resolveComponents } from '../normalise.mjs';
import { parseDesignMd } from '../parse.mjs';
import { loadTokens } from '../pipeline.mjs';
import { CONTEXTS } from '../syntax.mjs';
import { VALID, modelOfEdited } from './models.mjs';

const { model } = loadTokens(VALID);
const { primitives, components } = model.sets;
const hexIn = (context) => {
  const resolved = resolveColors(model, context);
  return Object.fromEntries(Object.entries(resolved).map(([role, value]) => [role, value.hex]));
};
const px = (value) => ({ value, unit: 'px' });
const alias = (type, ref) => ({ $type: type, $value: ref });

test('colour roles keep first-appearance order; unpaired colours are fixed roles', () => {
  assert.deepEqual(model.roles, [
    { key: 'background', fixed: false },
    { key: 'text', fixed: false },
    { key: 'primary', fixed: false },
    { key: 'primary-pressed', fixed: false },
    { key: 'on-primary', fixed: false },
    { key: 'surface-2', fixed: false },
    { key: 'scrim', fixed: true },
    { key: 'ring-light', fixed: true },
  ]);
});

test('every context resolves every role, in role order', () => {
  const roleKeys = model.roles.map((r) => r.key);
  for (const context of CONTEXTS) {
    assert.deepEqual(Object.keys(resolveColors(model, context)), roleKeys, context);
  }
});

test('light and dark resolve their own scheme', () => {
  assert.equal(hexIn('light').background, '#fafafa');
  assert.equal(hexIn('light').primary, '#336699');
  assert.equal(hexIn('dark').background, '#0a0a0a');
  assert.equal(hexIn('dark').primary, '#99ccff');
});

test('high contrast overrides what it declares and keeps S1/S2 for the rest', () => {
  assert.equal(hexIn('hc-light').background, '#ffffff');
  assert.equal(hexIn('hc-light').text, '#000000');
  assert.equal(hexIn('hc-light').primary, '#336699');
  assert.equal(hexIn('hc-dark').text, '#ffffff');
  assert.equal(hexIn('hc-dark').primary, '#99ccff');
});

test('brand overrides what it declares over the dark scheme', () => {
  assert.equal(hexIn('brand').background, '#225533');
  assert.equal(hexIn('brand').text, '#f5f5f5');
  assert.equal(hexIn('brand').primary, '#99ccff');
});

test('fixed colours are the same in every context, alpha included', () => {
  for (const context of CONTEXTS) {
    assert.deepEqual(resolveColors(model, context).scrim, {
      colorSpace: 'srgb',
      components: [0, 0, 0],
      alpha: 0.5,
      hex: '#000000',
    });
    assert.equal(resolveColors(model, context)['ring-light'].hex, '#cccccc');
  }
});

test('colours use the DTCG 2025.10 colour value', () => {
  assert.deepEqual(model.modifiers.theme.contexts.light.colors.primary, {
    $type: 'color',
    $value: {
      colorSpace: 'srgb',
      components: [0x33 / 255, 0x66 / 255, 0x99 / 255],
      alpha: 1,
      hex: '#336699',
    },
  });
});

test('each theme context holds only the roles its scheme declares', () => {
  const declared = (context) => Object.keys(model.modifiers.theme.contexts[context].colors);
  assert.deepEqual(declared('brand'), ['background', 'text']);
  assert.deepEqual(declared('hc-light'), ['background', 'text']);
  assert.equal(declared('light').length, 6);
  assert.deepEqual(Object.keys(primitives.colors), ['scrim', 'ring-light']);
});

test('the resolver names the five contexts, their source order and the default', () => {
  const theme = model.resolver.modifiers.theme;
  assert.equal(model.resolver.version, '2025.10');
  assert.deepEqual(Object.keys(theme.contexts), CONTEXTS);
  assert.deepEqual(theme.contexts, CONTEXT_SOURCES);
  assert.equal(theme.default, 'light');
  assert.deepEqual(model.resolver.resolutionOrder, ['primitives', 'theme', 'components']);
});

test('type styles are DTCG composites with dynamicType and m3Roles extensions', () => {
  const { heading, label, badge } = primitives.typography;
  assert.deepEqual(heading.$value, {
    fontFamily: ['Fixture Serif', 'serif'],
    fontSize: px(28),
    fontWeight: 400,
    lineHeight: 34 / 28,
    letterSpacing: px(0),
  });
  assert.deepEqual(heading.$extensions['app.m3Roles'], [
    'displayLarge',
    'displayMedium',
    'displaySmall',
    'headlineLarge',
    'headlineMedium',
  ]);
  assert.equal(label.$extensions['app.dynamicType'], 'caption');
  assert.ok(Math.abs(label.$value.letterSpacing.value - 0.6) < 1e-9, 'em times font size');
  assert.equal(badge.$value.lineHeight, 1.25);
  assert.deepEqual(badge.$value.letterSpacing, px(0.5));
  assert.deepEqual(badge.$extensions['app.m3Roles'], []);
});

test('spacing and radii are px dimensions', () => {
  assert.deepEqual(primitives.spacing['8'], { $type: 'dimension', $value: px(8) });
  assert.deepEqual(primitives.rounded.full, { $type: 'dimension', $value: px(999) });
});

test('elevation and motion hold single values and one-level groups', () => {
  assert.deepEqual(primitives.elevation.raised, { $type: 'dimension', $value: px(2) });
  assert.deepEqual(primitives.elevation.sheet, {
    offsetY: { $type: 'dimension', $value: px(-4) },
    blur: { $type: 'dimension', $value: px(16) },
    color: alias('color', '{colors.scrim}'),
  });
  const ms = (value) => ({ $type: 'duration', $value: { value, unit: 'ms' } });
  assert.deepEqual(primitives.motion.press, ms(150));
  assert.deepEqual(primitives.motion.screen, ms(300));
  assert.deepEqual(primitives.motion['easing-enter'], {
    $type: 'cubicBezier',
    $value: [0.2, 0, 0, 1],
  });
});

test('`linear`, a motion alias and a literal shadow colour normalise', () => {
  const edited = modelOfEdited((fm) => {
    fm.motion.tap = { duration: '150ms', easing: 'linear' };
    fm.motion.sheet = { duration: '250ms', easing: '{motion.easing-enter}' };
    fm.elevation.sheet.color = 'rgba(27,27,25,0.14)';
  });
  const { motion, elevation } = edited.sets.primitives;
  assert.deepEqual(motion.tap.easing, { $type: 'cubicBezier', $value: [0, 0, 1, 1] });
  assert.deepEqual(motion.sheet.easing, alias('cubicBezier', '{motion.easing-enter}'));
  assert.deepEqual(elevation.sheet.color, {
    $type: 'color',
    $value: {
      colorSpace: 'srgb',
      components: [27 / 255, 27 / 255, 25 / 255],
      alpha: 0.14,
      hex: '#1b1b19',
    },
  });
});

test('a component group: role and scale aliases, padding sides, state subgroups', () => {
  assert.deepEqual(Object.keys(components), ['button-primary', 'chip-outline-light', 'overlay']);
  assert.deepEqual(components['button-primary'], {
    backgroundColor: alias('color', '{colors.primary}'),
    textColor: alias('color', '{colors.on-primary}'),
    typography: alias('typography', '{typography.label}'),
    rounded: alias('dimension', '{rounded.full}'),
    height: { $type: 'dimension', $value: px(48) },
    paddingTop: { $type: 'dimension', $value: px(0) },
    paddingEnd: { $type: 'dimension', $value: px(16) },
    paddingBottom: { $type: 'dimension', $value: px(0) },
    paddingStart: { $type: 'dimension', $value: px(16) },
    pressed: { backgroundColor: alias('color', '{colors.primary-pressed}') },
  });
});

test('an unpaired component keeps its full key; a scheme-independent one its own', () => {
  const chip = components['chip-outline-light'];
  assert.deepEqual(chip.borderColor, alias('color', '{colors.ring-light}'));
  assert.deepEqual(components.overlay, {
    backgroundColor: alias('color', '{colors.scrim}'),
    gap: { $type: 'dimension', $value: px(8) },
    duration: alias('duration', '{motion.press}'),
  });
});

test('a spacing reference resolves to its px value, whole or as one part of a padding', () => {
  // The fixture chip writes `padding: '{spacing.4} 8px'`, the overlay `gap: '{spacing.8}'`.
  const chip = components['chip-outline-light'];
  const sides = ['paddingTop', 'paddingEnd', 'paddingBottom', 'paddingStart'];
  assert.deepEqual(
    sides.map((side) => chip[side]),
    [4, 8, 4, 8].map((n) => ({ $type: 'dimension', $value: px(n) })),
  );
  assert.deepEqual(components.overlay.gap, { $type: 'dimension', $value: px(8) });
});

test('an iconSize naming an icon size is its px value, and keeps the size it names', () => {
  const model = modelOfEdited((fm) => {
    fm.components['icon-md'] = { size: '20px', strokeWidth: 1.7 };
    fm.components.overlay.iconSize = '{components.icon-md}';
  });
  assert.deepEqual(model.sets.components.overlay.iconSize, {
    $type: 'dimension',
    $value: px(20),
    $extensions: { 'app.iconSize': 'icon-md' },
  });
});

test('a trailing slot (G3): its size names an icon size like iconSize, its gap is a dimension', () => {
  const model = modelOfEdited((fm) => {
    fm.components['icon-xs'] = { size: '12px', strokeWidth: 2.2 };
    fm.components.overlay.trailingIconSize = 'icon-xs';
    fm.components.overlay.trailingIconGap = '{spacing.4}';
  });
  const { overlay } = model.sets.components;
  assert.deepEqual(overlay.trailingIconSize, {
    $type: 'dimension',
    $value: px(12),
    $extensions: { 'app.iconSize': 'icon-xs' },
  });
  assert.deepEqual(overlay.trailingIconGap, { $type: 'dimension', $value: px(4) });
});

test('an unpaired key beside a scheme-independent one is its own component in every context', () => {
  const unpaired = modelOfEdited((fm, parsed) => {
    fm.components['overlay-dark'] = { backgroundColor: '{colors.surface-2-dark}' };
    const listed = '`chip-outline-light`';
    parsed.body = parsed.body.replace(`${listed}.`, `${listed}, \`overlay-dark\`.`);
  });
  assert.deepEqual(Object.keys(unpaired.sets.components), [
    'button-primary',
    'chip-outline-light',
    'overlay',
    'overlay-dark',
  ]);
  for (const context of CONTEXTS) {
    const resolved = resolveComponents(unpaired, context)['overlay-dark'];
    assert.deepEqual(resolved, { backgroundColor: alias('color', '{colors.surface-2}') }, context);
  }
});

test('a state suffix without a default-state key is part of the component name', () => {
  const edited = modelOfEdited((fm) => {
    fm.components['mode-selected-light'] = { backgroundColor: '{colors.primary-light}' };
    fm.components['mode-selected-dark'] = { backgroundColor: '{colors.primary-dark}' };
    fm.components['mode-switch'] = { backgroundColor: '{colors.scrim}' };
  });
  const names = Object.keys(edited.sets.components);
  assert.deepEqual(names.slice(-2), ['mode-selected', 'mode-switch']);
  assert.ok(!names.includes('mode'));
  const light = resolveComponents(edited, 'light')['mode-selected'];
  assert.deepEqual(light, { backgroundColor: alias('color', '{colors.primary}') });
  assert.deepEqual(Object.keys(edited.sets.components['button-primary']).at(-1), 'pressed');
});

/** Every colour token in a component group, states included. */
function colourTokens(group) {
  return Object.values(group).flatMap((node) => {
    if (!Object.hasOwn(node, '$value')) return colourTokens(node);
    return node.$type === 'color' ? [node] : [];
  });
}

test('without scheme-dependent values, every context resolves to the components set', () => {
  for (const context of CONTEXTS) {
    assert.deepEqual(model.modifiers.theme.contexts[context].components, {}, context);
    assert.deepEqual(resolveComponents(model, context), components, context);
  }
});

test('a value that differs by scheme moves to each scheme context; the rest stays shared', () => {
  const edited = modelOfEdited((fm) => {
    fm.components['button-primary-pressed-dark'].backgroundColor = '{colors.primary-dark}';
    fm.components['button-primary-hc-light'] = {
      ...fm.components['button-primary-light'],
      backgroundColor: '{colors.background-hc-light}',
      textColor: '{colors.text-hc-light}',
      height: '56px',
    };
  });
  const shared = edited.sets.components['button-primary'];
  const sides = ['paddingTop', 'paddingEnd', 'paddingBottom', 'paddingStart'];
  assert.deepEqual(Object.keys(shared), ['typography', 'rounded', ...sides, 'pressed']);
  assert.deepEqual(shared.pressed, {});
  const declared = (context) => edited.modifiers.theme.contexts[context].components;
  const height = (value) => ({ $type: 'dimension', $value: px(value) });
  assert.deepEqual(declared('light')['button-primary'], {
    backgroundColor: alias('color', '{colors.primary}'),
    textColor: alias('color', '{colors.on-primary}'),
    height: height(48),
    pressed: { backgroundColor: alias('color', '{colors.primary-pressed}') },
  });
  assert.deepEqual(declared('hc-light')['button-primary'], {
    backgroundColor: alias('color', '{colors.background}'),
    textColor: alias('color', '{colors.text}'),
    height: height(56),
  });
  assert.deepEqual(declared('brand'), {});
  const resolved = (context) => resolveComponents(edited, context)['button-primary'];
  assert.deepEqual(resolved('brand').pressed, {
    backgroundColor: alias('color', '{colors.primary}'),
  });
  assert.deepEqual(resolved('brand').height, height(48));
  assert.deepEqual(resolved('hc-light').height, height(56));
  assert.deepEqual(resolved('hc-light').pressed, {
    backgroundColor: alias('color', '{colors.primary-pressed}'),
  });
  assert.deepEqual(resolved('hc-dark').backgroundColor, alias('color', '{colors.primary}'));
  assert.deepEqual(resolved('light').typography, shared.typography);
});

test('no component colour is a resolved value: each is an alias to a known role', () => {
  const roleKeys = new Set(model.roles.map((r) => r.key));
  const tokens = Object.values(components).flatMap(colourTokens);
  assert.equal(tokens.length, 6);
  for (const { $value } of tokens) {
    const role = /^\{colors\.([a-z0-9-]+)\}$/.exec($value)?.[1];
    assert.ok(role && roleKeys.has(role), `not a role alias: ${JSON.stringify($value)}`);
  }
});

test('the model is plain data, and normalise is deterministic', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);
  const { frontmatter } = parseDesignMd(VALID);
  assert.deepEqual(normalise(frontmatter), model);
});
