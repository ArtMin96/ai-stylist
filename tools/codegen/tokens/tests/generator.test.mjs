// In-process tests for the DESIGN.md parser and validator (parse.mjs, validate.mjs): the synthetic
// fixture passes, every fixtures/TK-NN case fails on its own rule only, and each sub-rule fails on
// a one-line edit of the valid fixture. Run by scripts/test/design-tokens.test.sh
// (`just test tooling`).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { parseDesignMd } from '../parse.mjs';
import { formatFinding, loadTokens } from '../pipeline.mjs';
import { validate } from '../validate.mjs';

const FIXTURES = path.resolve(import.meta.dirname, '..', 'fixtures');
const fixtureText = (name) => readFileSync(path.join(FIXTURES, name, 'DESIGN.md'), 'utf8');
const VALID = fixtureText('_valid');
const isRuleCase = (name) => /^TK-\d\d$/.test(name);
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

test('the fixtures hold one failing case per rule, TK-01 to TK-11', () => {
  const expected = Array.from({ length: 11 }, (_, i) => `TK-${String(i + 1).padStart(2, '0')}`);
  assert.deepEqual(RULE_CASES, expected);
});

for (const name of RULE_CASES) {
  test(`fixtures/${name} fails on ${name} and on nothing else`, () => {
    const { findings, model } = loadTokens(fixtureText(name));
    assert.equal(model, undefined);
    assert.deepEqual(rulesOf(findings), [name], describeFindings(findings));
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
  assertOnly(noLine, 'TK-02', /colors\.scrim: has no scheme suffix/);
  assertOnly(noLine, 'TK-02', /colors\.ring-light: has no `-dark` twin/);
  const bold = validateWithLine('**Unpaired by design:** `scrim`, `ring-light`.');
  assertOnly(bold, 'TK-02', /must read exactly/);
  const twice = validateWithLine('Unpaired by design: `scrim`.\nUnpaired by design: `ring-light`.');
  assertOnly(twice, 'TK-02', /more than one/);
  const paired = validateWithLine('Unpaired by design: `scrim`, `ring-light`, `text-light`.');
  assertOnly(paired, 'TK-02', /text-light: .*has a light\/dark twin/);
  const unknown = validateWithLine('Unpaired by design: scrim, ring-light, ghost');
  assertOnly(unknown, 'TK-02', /`ghost` .*not a colour token/);
});

test('TK-02: a high-contrast colour without a light/dark base', () => {
  const findings = validateEdited((fm) => (fm.colors['accent-hc-light'] = '#000000'));
  assertOnly(findings, 'TK-02', /accent-hc-light: has no `-light` \+ `-dark` base/);
});

test('TK-03: a scheme-independent component references a scheme colour', () => {
  const findings = validateEdited((fm) => {
    fm.components.overlay.backgroundColor = '{colors.primary-light}';
  });
  assertOnly(findings, 'TK-03', /scheme-independent entry references the light colour/);
});

test('TK-04: a colour property with a non-colour reference, a literal colour in elevation', () => {
  const ref = validateEdited((fm) => (fm.components.overlay.backgroundColor = '{spacing.8}'));
  assertOnly(ref, 'TK-04', /overlay\.backgroundColor: a component colour/);
  const literal = validateEdited((fm) => (fm.elevation.sheet.color = 'rgba(0,0,0,0.2)'));
  assertOnly(literal, 'TK-04', /elevation\.sheet\.color: a colour outside/);
});

test('TK-05: scheme variants map a state to different roles, or drop a property', () => {
  const pressed = validateEdited((fm) => {
    fm.components['button-primary-pressed-dark'].backgroundColor = '{colors.primary-dark}';
  });
  assertOnly(pressed, 'TK-05', /button-primary-pressed-dark: differs .* `backgroundColor`/);
  const dropped = validateEdited((fm) => delete fm.components['button-primary-dark'].padding);
  assertOnly(dropped, 'TK-05', /button-primary-dark: differs .* `padding`/);
});

test('TK-06: a reference motion may not make, and a reference to a group', () => {
  const motion = validateEdited((fm) => (fm.motion.press = '{spacing.4}'));
  assertOnly(motion, 'TK-06', /cannot be referenced here \(allowed: none\)/);
  const group = validateEdited((fm) => (fm.components.overlay.gap = '{elevation.sheet}'));
  assertOnly(group, 'TK-06', /names a group of values/);
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

test('TK-11: bad padding, a rem dimension, a component that is not a mapping', () => {
  const padding = validateEdited((fm) => (fm.components.overlay.padding = '1px 2px 3px 4px 5px'));
  assertOnly(padding, 'TK-11', /padding takes 1–4 parts/);
  const rem = validateEdited((fm) => (fm.spacing['16'] = '1rem'));
  assertOnly(rem, 'TK-11', /spacing\.16: "1rem" is not a px dimension/);
  const scalar = validateEdited((fm) => (fm.components.overlay = '4px'));
  assertOnly(scalar, 'TK-11', /must be a non-empty mapping/);
});
