// In-process tests for the DESIGN.md parser and validator (parse.mjs, validate.mjs, twin-rule.mjs):
// the repository DESIGN.md (the token master) and the synthetic fixture pass, every fixtures/TK-NN
// case fails on its own rule only, and each sub-rule fails (or, for an accepted shape, passes) on
// a one-line edit of the valid fixture. Run by scripts/test/design-tokens.test.sh
// (`just test tooling`).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { resolveColors, resolveComponents } from '../normalise.mjs';
import { parseDesignMd } from '../parse.mjs';
import { formatFinding, loadTokens } from '../pipeline.mjs';
import { CONTEXTS } from '../syntax.mjs';
import { validate } from '../validate.mjs';
import { REPO_DESIGN_MD } from './models.mjs';

const FIXTURES = path.resolve(import.meta.dirname, '..', 'fixtures');
const fixtureText = (name) => readFileSync(path.join(FIXTURES, name, 'DESIGN.md'), 'utf8');
const VALID = fixtureText('_valid');
/** `TK-NN/` or `TK-NN-<case>/` (a second case of the same rule): fails on rule TK-NN only. */
const isRuleCase = (name) => /^TK-\d\d(-[a-z0-9-]+)?$/.test(name);
const ruleOf = (name) => name.slice(0, 'TK-NN'.length);
const RULE_CASES = readdirSync(FIXTURES).filter(isRuleCase).sort();

const rulesOf = (findings) => [...new Set(findings.map((f) => f.rule))].sort();
const describeFindings = (findings) => findings.map(formatFinding).join('\n') || '(no findings)';

/** Validates the valid fixture after `edit(frontmatter)`; `body` replaces its prose when given. */
function validateEdited(edit, body) {
  const parsed = parseDesignMd(VALID);
  edit(parsed.frontmatter);
  return validate({ frontmatter: parsed.frontmatter, body: body ?? parsed.body });
}

/** Validates the valid frontmatter with `line` as the only prose under `## Colors`. */
const validateWithLine = (line) => validateEdited(() => {}, `## Colors\n\n${line}\n`);

/** The findings name `rule` and nothing else, and one of them matches `pattern`. */
function assertOnly(findings, rule, pattern) {
  assert.deepEqual(rulesOf(findings), [rule], describeFindings(findings));
  const matched = findings.some((f) => pattern.test(`${f.at}: ${f.message}`));
  assert.ok(matched, `no ${rule} finding matches ${pattern}:\n${describeFindings(findings)}`);
}

test('the valid fixture passes the parser, every rule and the normaliser', () => {
  const { findings, model } = loadTokens(VALID);
  assert.deepEqual(findings, [], describeFindings(findings));
  assert.ok(model);
});

test('the repository DESIGN.md, the token master, passes every rule and normalises', () => {
  const { findings, model } = loadTokens(REPO_DESIGN_MD);
  assert.deepEqual(findings, [], describeFindings(findings));
  const components = Object.keys(model.sets.components);
  for (const context of CONTEXTS) {
    assert.equal(Object.keys(resolveColors(model, context)).length, model.roles.length, context);
    assert.deepEqual(Object.keys(resolveComponents(model, context)), components, context);
  }
});

test('the fixtures hold one failing case per rule, TK-01 to TK-11', () => {
  const expected = Array.from({ length: 11 }, (_, i) => `TK-${String(i + 1).padStart(2, '0')}`);
  assert.deepEqual([...new Set(RULE_CASES.map(ruleOf))], expected);
  assert.ok(RULE_CASES.includes('TK-06-padding'), 'an unresolved padding reference');
  assert.ok(RULE_CASES.includes('TK-06-trailing-icon'), 'a trailing slot naming no icon size');
  assert.ok(RULE_CASES.includes('TK-08-text-transform'), 'a text transform outside the list');
});

for (const name of RULE_CASES) {
  test(`fixtures/${name} fails on ${ruleOf(name)} and on nothing else`, () => {
    const { findings, model } = loadTokens(fixtureText(name));
    assert.equal(model, undefined);
    assert.deepEqual(rulesOf(findings), [ruleOf(name)], describeFindings(findings));
  });
}

test('TK-01: no frontmatter, invalid YAML, a duplicate key, or a non-mapping root', () => {
  for (const text of ['# Title\n', '---\ncolors: [\n---\n', '---\nname: a\nname: b\n---\n']) {
    assertOnly(parseDesignMd(text).findings, 'TK-01', /frontmatter|YAML/);
  }
  assertOnly(parseDesignMd('---\n- colors\n---\n').findings, 'TK-01', /not a YAML mapping/);
  assertOnly(parseDesignMd('---\r\nname: a\r\nname: b\r\n---\r\n').findings, 'TK-01', /YAML/);
});

test('TK-01: an unknown top-level key or a missing group', () => {
  const unknown = validateEdited((fm) => (fm.shadows = {}));
  assertOnly(unknown, 'TK-01', /shadows: unknown top-level key/);
  const missing = validateEdited((fm) => delete fm.elevation);
  assertOnly(missing, 'TK-01', /elevation: required token group/);
});

test('TK-02: the `Unpaired by design:` line is missing, malformed, doubled or stale', () => {
  const noLine = validateEdited(() => {}, '# No line\n');
  assertOnly(noLine, 'TK-02', /colors\.ring-light: has no `-dark` twin/);
  assertOnly(noLine, 'TK-02', /components\.chip-outline-light: has no `-dark` twin/);
  const bold = validateWithLine('**Unpaired by design:** `ring-light`, `chip-outline-light`.');
  assertOnly(bold, 'TK-02', /must read exactly/);
  const twice = validateWithLine(
    'Unpaired by design: `ring-light`.\nUnpaired by design: `chip-outline-light`.',
  );
  assertOnly(twice, 'TK-02', /more than one/);
  const paired = validateWithLine(
    'Unpaired by design: `ring-light`, `chip-outline-light`, `text-light`.',
  );
  assertOnly(paired, 'TK-02', /text-light: .*has a light\/dark twin/);
  const unknown = validateWithLine('Unpaired by design: ring-light, chip-outline-light, ghost');
  assertOnly(unknown, 'TK-02', /`ghost` .*not a colour, elevation or component token/);
  const independent = validateWithLine(
    'Unpaired by design: `scrim`, `ring-light`, `chip-outline-light`.',
  );
  assertOnly(independent, 'TK-02', /colors\.scrim: .*no scheme suffix/);
});

test('TK-02: a high-contrast colour without a light/dark base', () => {
  const findings = validateEdited((fm) => (fm.colors['accent-hc-light'] = '#000000'));
  assertOnly(findings, 'TK-02', /accent-hc-light: has no `-light` \+ `-dark` base/);
});

test('TK-02: the Twin Rule covers elevation and component keys, not suffix-free ones', () => {
  const independent = validateEdited((fm) => (fm.colors['camera-ink'] = '#1B1B19'));
  assert.deepEqual(independent, [], describeFindings(independent));
  const shadow = validateEdited((fm) => (fm.elevation['raised-light'] = '2px'));
  assertOnly(shadow, 'TK-02', /elevation\.raised-light: has no `-dark` twin/);
  const tag = validateEdited((fm) => {
    fm.components['tag-dark'] = { backgroundColor: '{colors.primary-dark}' };
  });
  assertOnly(tag, 'TK-02', /components\.tag-dark: has no `-light` twin/);
  const listed = validateEdited(
    (fm) => (fm.elevation['raised-light'] = '2px'),
    '## Colors\n\nUnpaired by design: ring-light, chip-outline-light, raised-light\n',
  );
  assert.deepEqual(listed, [], describeFindings(listed));
});

test('TK-03: a scheme-independent component references a scheme colour', () => {
  const findings = validateEdited((fm) => {
    fm.components.overlay.backgroundColor = '{colors.primary-light}';
  });
  assertOnly(findings, 'TK-03', /scheme-independent entry references the light colour/);
});

test('TK-04: a colour property with a non-colour reference', () => {
  const ref = validateEdited((fm) => (fm.components.overlay.backgroundColor = '{spacing.8}'));
  assertOnly(ref, 'TK-04', /overlay\.backgroundColor: a component colour/);
  const focus = validateEdited((fm) => (fm.components.overlay.color = '{spacing.8}'));
  assertOnly(focus, 'TK-04', /overlay\.color: a component colour/);
});

test('TK-04: a shadow colour may be a literal; any other colour outside `colors` may not', () => {
  const shadow = validateEdited((fm) => {
    fm.elevation.sheet.color = 'rgba(0,0,0,0.2)';
    fm.elevation.sheet.edgeColor = '#2C4740';
  });
  assert.deepEqual(shadow, [], describeFindings(shadow));
  const blur = validateEdited((fm) => (fm.elevation.sheet.blur = '#000000'));
  assertOnly(blur, 'TK-04', /elevation\.sheet\.blur: a colour outside/);
  const entry = validateEdited((fm) => (fm.elevation.raised = '#000000'));
  assertOnly(entry, 'TK-04', /elevation\.raised: a colour outside/);
  const spacing = validateEdited((fm) => (fm.elevation.sheet.color = '{spacing.4}'));
  assertOnly(spacing, 'TK-04', /elevation\.sheet\.color: a shadow colour is a literal/);
  const motion = validateEdited((fm) => (fm.motion.press = '#000000'));
  assertOnly(motion, 'TK-04', /motion\.press: a colour outside/);
});

test('TK-05: a twin may name another colour role; a high-contrast variant another width', () => {
  const role = validateEdited((fm) => {
    fm.components['button-primary-pressed-dark'].backgroundColor = '{colors.primary-dark}';
  });
  assert.deepEqual(role, [], describeFindings(role));
  const highContrast = validateEdited((fm) => {
    fm.components['button-primary-hc-light'] = {
      ...fm.components['button-primary-light'],
      backgroundColor: '{colors.background-hc-light}',
      textColor: '{colors.text-hc-light}',
      height: '56px',
    };
  });
  assert.deepEqual(highContrast, [], describeFindings(highContrast));
});

test('TK-05: variants drop a property, or light, dark and brand disagree on a value', () => {
  const dropped = validateEdited((fm) => delete fm.components['button-primary-dark'].padding);
  assertOnly(dropped, 'TK-05', /button-primary-dark: differs .* `padding`/);
  const hcDropped = validateEdited((fm) => {
    fm.components['button-primary-pressed-hc-dark'] = { height: '48px' };
  });
  assertOnly(hcDropped, 'TK-05', /button-primary-pressed-hc-dark: differs .* `backgroundColor`/);
  const brand = validateEdited((fm) => {
    fm.components['button-primary-brand'] = {
      ...fm.components['button-primary-dark'],
      backgroundColor: '{colors.background-brand}',
      textColor: '{colors.text-brand}',
      height: '56px',
    };
  });
  assertOnly(brand, 'TK-05', /button-primary-brand: differs .* `height`: light, dark and brand/);
  const mixed = validateEdited((fm) => (fm.components['button-primary'] = { height: '48px' }));
  assertOnly(mixed, 'TK-05', /components\.button-primary: a scheme-independent entry/);
});

test('TK-06: a reference motion may not make, and a reference to a group', () => {
  const motion = validateEdited((fm) => (fm.motion.press = '{spacing.4}'));
  assertOnly(motion, 'TK-06', /cannot be referenced here \(allowed: motion\)/);
  const group = validateEdited((fm) => (fm.components.overlay.gap = '{elevation.sheet}'));
  assertOnly(group, 'TK-06', /names a group of values/);
});

test('TK-06: motion may reference a motion value, never a chain of references', () => {
  const curve = validateEdited((fm) => {
    fm.motion.sheet = { duration: '250ms', easing: '{motion.easing-enter}' };
  });
  assert.deepEqual(curve, [], describeFindings(curve));
  const chain = validateEdited((fm) => {
    fm.motion.exit = '{motion.easing-enter}';
    fm.motion.sheet = { duration: '250ms', easing: '{motion.exit}' };
  });
  assertOnly(chain, 'TK-06', /motion\.sheet\.easing: `\{motion\.exit\}` is itself a reference/);
  const loop = validateEdited((fm) => (fm.motion.loop = '{motion.loop}'));
  assertOnly(loop, 'TK-06', /motion\.loop: .* is itself a reference/);
});

test('TK-07: a list, a mapping nested two levels, a shadow shorthand', () => {
  const list = validateEdited((fm) => (fm.motion.press = ['150ms']));
  assertOnly(list, 'TK-07', /a list is not a single value/);
  const nested = validateEdited((fm) => (fm.elevation.sheet.blur = { radius: '16px' }));
  assertOnly(nested, 'TK-07', /nested deeper than one level/);
  const shadow = validateEdited((fm) => (fm.elevation.raised = '0 2px 4px rgba(0,0,0,0.2)'));
  assertOnly(shadow, 'TK-07', /CSS shorthand/);
});

test('TK-08: an unknown property, a bad Dynamic Type style, `0` spacing, bad M3 roles', () => {
  const extra = validateEdited((fm) => (fm.typography.body.fontFeature = 'smcp'));
  assertOnly(extra, 'TK-08', /unknown property `fontFeature`/);
  const style = validateEdited((fm) => (fm.typography.body.dynamicType = 'display'));
  assertOnly(style, 'TK-08', /`dynamicType` must be one of/);
  const zero = validateEdited((fm) => (fm.typography.body.letterSpacing = '0'));
  assertOnly(zero, 'TK-08', /`0em`, not `0`/);
  const scalar = validateEdited((fm) => (fm.typography.badge.m3Roles = 'labelSmall'));
  assertOnly(scalar, 'TK-08', /`m3Roles` must be a list/);
  const unknown = validateEdited((fm) => (fm.typography.badge.m3Roles = ['headline']));
  assertOnly(unknown, 'TK-08', /unknown M3 role "headline"/);
  const transform = validateEdited((fm) => (fm.typography.body.textTransform = 'capitalize'));
  assertOnly(transform, 'TK-08', /`textTransform` must be one of none, uppercase/);
});

test('TK-08: `textTransform` is optional, `none` or `uppercase`', () => {
  for (const value of ['none', 'uppercase', undefined]) {
    const findings = validateEdited((fm) => (fm.typography.badge.textTransform = value));
    assert.deepEqual(findings, [], describeFindings(findings));
  }
});

test('TK-09: an M3 role no style claims', () => {
  const findings = validateEdited((fm) => fm.typography.label.m3Roles.pop());
  assertOnly(findings, 'TK-09', /`labelSmall` appears 0 times/);
});

test('TK-10: identifier collisions, a non-camelCase property, a key starting with a digit', () => {
  const roles = validateEdited((fm) => {
    fm.colors['surface2-light'] = '#111111';
    fm.colors['surface2-dark'] = '#222222';
  });
  assertOnly(roles, 'TK-10', /generate the same identifier `surface2`/);
  const padding = validateEdited((fm) => {
    fm.components.overlay.padding = '8px';
    fm.components.overlay.paddingTop = '4px';
  });
  assertOnly(padding, 'TK-10', /same identifier `paddingTop`/);
  const kebab = validateEdited((fm) => (fm.components.overlay['corner-radius'] = '4px'));
  assertOnly(kebab, 'TK-10', /property names are lowerCamelCase/);
  const digit = validateEdited((fm) => {
    fm.colors['2tone-light'] = '#111111';
    fm.colors['2tone-dark'] = '#222222';
  });
  assertOnly(digit, 'TK-10', /must start with a letter/);
});

test('TK-06: a padding part references only spacing, and only a step that exists', () => {
  const mixed = validateEdited((fm) => (fm.components.overlay.padding = '0 {spacing.16} 4px'));
  assert.deepEqual(mixed, [], describeFindings(mixed));
  const missing = loadTokens(fixtureText('TK-06-padding')).findings.map(formatFinding);
  assert.deepEqual(missing, [
    'TK-06 components.chip-outline-light.padding: `{spacing.24}` does not resolve',
  ]);
  const rounded = validateEdited((fm) => (fm.components.overlay.padding = '{rounded.4} 8px'));
  assertOnly(rounded, 'TK-06', /`\{rounded\.4\}` cannot be referenced here \(allowed: spacing\)/);
  const malformed = validateEdited((fm) => (fm.components.overlay.padding = '{spacing} 8px'));
  assertOnly(malformed, 'TK-11', /padding takes 1–4 parts, each 0, Npx or a \{spacing/);
});

test('TK-06: only an icon-slot size names a component, and only an icon size (icon-<step>)', () => {
  const withSize = (fm) => (fm.components['icon-md'] = { size: '20px', strokeWidth: 1.7 });
  for (const prop of ['iconSize', 'trailingIconSize']) {
    for (const value of ['icon-md', '{components.icon-md}', '16px']) {
      const named = validateEdited((fm) => {
        withSize(fm);
        fm.components.overlay[prop] = value;
      });
      assert.deepEqual(named, [], `${prop}: ${value}: ${describeFindings(named)}`);
    }
  }
  const cases = [
    ['height', '{components.icon-md}', /only iconSize or a …IconSize property names a component/],
    ['iconSize', '{components.icon-xl}', /`\{components\.icon-xl\}` does not resolve/],
    ['iconSize', 'icon-xl', /`\{components\.icon-xl\}` does not resolve/],
    ['iconSize', '{components.overlay}', /`\{components\.overlay\}` is not an icon size/],
    ['iconSize', 'icon', /"icon" is not a px dimension, number or \{reference\}/],
    ['trailingIconSize', 'icon-xl', /`\{components\.icon-xl\}` does not resolve/],
    ['trailingIconSize', 'icon', /"icon" is not a px dimension, number or \{reference\}/],
    ['trailingIconGap', 'icon-md', /"icon-md" is not a px dimension, number or \{reference\}/],
  ];
  for (const [prop, value, pattern] of cases) {
    const findings = validateEdited((fm) => {
      withSize(fm);
      fm.components.overlay[prop] = value;
    });
    assertOnly(findings, pattern.source.includes('is not a px') ? 'TK-11' : 'TK-06', pattern);
  }
  const trailing = loadTokens(fixtureText('TK-06-trailing-icon')).findings.map(formatFinding);
  assert.deepEqual(trailing, [
    'TK-06 components.overlay.trailingIconSize: `{components.icon-md}` does not resolve',
  ]);
  const extra = validateEdited((fm) => {
    fm.components['icon-md'] = { size: '20px', strokeWidth: 1.7, color: '{colors.scrim}' };
    fm.components.overlay.iconSize = '{components.icon-md}';
  });
  assertOnly(extra, 'TK-06', /`\{components\.icon-md\}` is not an icon size/);
});

test('TK-11: bad padding, a rem dimension, a component that is not a mapping', () => {
  const padding = validateEdited((fm) => (fm.components.overlay.padding = '1px 2px 3px 4px 5px'));
  assertOnly(padding, 'TK-11', /padding takes 1–4 parts/);
  const rem = validateEdited((fm) => (fm.spacing['16'] = '1rem'));
  assertOnly(rem, 'TK-11', /spacing\.16: "1rem" is not a px dimension/);
  const scalar = validateEdited((fm) => (fm.components.overlay = '4px'));
  assertOnly(scalar, 'TK-11', /must be a non-empty mapping/);
});

test('TK-11: the curve `linear` parses; other CSS easing keywords do not', () => {
  const withEasing = (easing) =>
    validateEdited((fm) => (fm.motion.tap = { duration: '150ms', easing }));
  const linear = withEasing('linear');
  assert.deepEqual(linear, [], describeFindings(linear));
  const easeIn = withEasing('ease-in');
  assertOnly(easeIn, 'TK-11', /"ease-in" is not a duration, cubic-bezier\(\) or linear/);
});
