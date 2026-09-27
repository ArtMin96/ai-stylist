// FORBIDDEN_LOG_KEYS comes from registry/forbidden-log-keys.json, the one list every logger and the
// forbidden-field lint read (planning/11 §8). Schema validation: packages/contracts/tests.
import { describe, expect, it } from 'vitest';

import registry from '../registry/forbidden-log-keys.json' with { type: 'json' };
import { FORBIDDEN_LOG_KEYS } from '../src/index.js';

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
