// FORBIDDEN_LOG_KEYS comes from registry/forbidden-log-keys.json, the one list every logger and the
// forbidden-field lint read (planning/11 §8); FORBIDDEN_LOG_KEY_EXAMPLES from
// registry/forbidden-log-keys.examples.json, the word-split examples their tests check. Schema
// validation of both: packages/contracts/tests/kernel-registries.test.ts.
import { describe, expect, it } from 'vitest';

import examples from '../registry/forbidden-log-keys.examples.json' with { type: 'json' };
import registry from '../registry/forbidden-log-keys.json' with { type: 'json' };
import { FORBIDDEN_LOG_KEYS, FORBIDDEN_LOG_KEY_EXAMPLES } from '../src/index.js';

// The matching rule, restated from `WORD_SPLIT` / `isForbiddenLogKey` in
// apps/api/src/platform/logger.ts (shared-kernel cannot import the API; the worker's redaction.py
// and the forbidden-field lint use the same split): a key is forbidden when the whole key, or any
// of its camelCase / snake_case / kebab-case words, lowercased, is a registry word.
const WORD_SPLIT = /[^a-zA-Z0-9]+|(?<=[a-z0-9])(?=[A-Z])/;
const FORBIDDEN = new Set(FORBIDDEN_LOG_KEYS);

function forbiddenWordIn(key: string): string | undefined {
  const words = [key, ...key.split(WORD_SPLIT)].map((word) => word.toLowerCase());
  return words.find((word) => word.length > 0 && FORBIDDEN.has(word));
}

describe('forbidden log keys come from registry/forbidden-log-keys.json', () => {
  it('exports the registry words, in order', () => {
    expect([...FORBIDDEN_LOG_KEYS]).toEqual(registry.keys);
  });

  it('holds single lowercase words, each once', () => {
    for (const key of FORBIDDEN_LOG_KEYS) expect(key).toMatch(/^[a-z][a-z0-9]*$/);
    expect(new Set(FORBIDDEN_LOG_KEYS).size).toBe(FORBIDDEN_LOG_KEYS.length);
  });

  it('covers every doc 11 §8 data class', () => {
    for (const word of [
      'measurements',
      'selfie',
      'face',
      'photo',
      'image',
      'location',
      'coordinates',
      'token',
      'authorization',
      'password',
      'secret',
      'email',
      'prompt',
      'calendar',
    ]) {
      expect(FORBIDDEN_LOG_KEYS).toContain(word);
    }
  });

  it('cannot be mutated at runtime', () => {
    expect(Object.isFrozen(FORBIDDEN_LOG_KEYS)).toBe(true);
  });
});

describe('forbidden log key examples come from registry/forbidden-log-keys.examples.json', () => {
  const { forbidden, allowed } = FORBIDDEN_LOG_KEY_EXAMPLES;

  it('exports the registry examples, in order, frozen', () => {
    expect([...forbidden]).toEqual(examples.forbidden);
    expect([...allowed]).toEqual(examples.allowed);
    expect(Object.isFrozen(FORBIDDEN_LOG_KEY_EXAMPLES)).toBe(true);
    expect(Object.isFrozen(forbidden)).toBe(true);
    expect(Object.isFrozen(allowed)).toBe(true);
  });

  it.each(forbidden)('%s contains a forbidden word', (key) => {
    expect(forbiddenWordIn(key)).toBeDefined();
  });

  it.each(allowed)('%s contains no forbidden word', (key) => {
    expect(forbiddenWordIn(key)).toBeUndefined();
  });

  it('never lists a key as both forbidden and allowed', () => {
    expect(forbidden.filter((key) => allowed.includes(key))).toEqual([]);
  });

  it('covers camelCase, snake_case, kebab-case and UPPER_SNAKE forbidden keys', () => {
    const styles = {
      camel: /^[a-z]+(?:[A-Z][a-z0-9]*)+$/,
      snake: /^[a-z0-9]+(?:_[a-z0-9]+)+$/,
      kebab: /^[a-z0-9]+(?:-[a-z0-9]+)+$/,
      upper: /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/,
    };
    for (const [style, shape] of Object.entries(styles)) {
      expect(
        forbidden.some((key) => shape.test(key)),
        style,
      ).toBe(true);
    }
  });

  it('includes near-misses: a forbidden word inside a longer allowed word does not match', () => {
    const containsWord = (key: string): boolean =>
      FORBIDDEN_LOG_KEYS.some((word) => key.toLowerCase().includes(word));
    expect(allowed.some(containsWord)).toBe(true);
  });
});
