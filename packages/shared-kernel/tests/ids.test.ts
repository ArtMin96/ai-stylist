import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { ID_PREFIXES, type IdKind, formatId, isId, newId, parseId } from '../src/index.js';

const kinds = Object.keys(ID_PREFIXES) as IdKind[];
const kindArb = fc.constantFrom(...kinds);

describe('ID_PREFIXES', () => {
  it('assigns a unique 3-letter lowercase prefix per kind', () => {
    const prefixes = Object.values(ID_PREFIXES);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    for (const prefix of prefixes) expect(prefix).toMatch(/^[a-z]{3}$/);
  });

  it('covers the entities named in doc 06 §2', () => {
    expect(ID_PREFIXES).toMatchObject({
      closetItem: 'itm',
      mediaAsset: 'ast',
      recommendation: 'rec',
      outfit: 'out',
      entitlement: 'ent',
      event: 'evt',
    });
  });
});

describe('newId / parseId', () => {
  it('round-trips for every kind', () => {
    fc.assert(
      fc.property(kindArb, (kind) => {
        const id = newId(kind);
        const parsed = parseId(id);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.id.kind).toBe(kind);
        expect(formatId(kind, parsed.id.ulid)).toBe(id);
        expect(isId(id, kind)).toBe(true);
      }),
    );
  });

  it('is monotone in time across kinds (ULID timestamp prefix)', () => {
    fc.assert(
      fc.property(
        kindArb,
        fc.integer({ min: 1_600_000_000_000, max: 4_000_000_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (kind, t, delta) => {
          const earlier = parseId(newId(kind, t));
          const later = parseId(newId(kind, t + delta));
          if (!earlier.ok || !later.ok) throw new Error('unreachable');
          expect(earlier.id.ulid.slice(0, 10) < later.id.ulid.slice(0, 10)).toBe(true);
        },
      ),
    );
  });

  it('rejects the wrong expected kind with a typed error', () => {
    const id = newId('closetItem');
    expect(parseId(id, 'user')).toEqual({
      ok: false,
      error: { reason: 'kind_mismatch', value: id, expected: 'user', actual: 'closetItem' },
    });
    expect(isId(id, 'user')).toBe(false);
  });

  it('rejects unknown prefixes, malformed values and non-ULID bodies', () => {
    const ulid = parseId(newId('user'));
    if (!ulid.ok) throw new Error('unreachable');
    expect(parseId(`zzz_${ulid.id.ulid}`)).toMatchObject({
      ok: false,
      error: { reason: 'unknown_prefix', prefix: 'zzz' },
    });
    expect(parseId('usr-not-an-id')).toMatchObject({ ok: false, error: { reason: 'malformed' } });
    expect(parseId(`usr_${'8'.repeat(26)}`)).toMatchObject({
      ok: false,
      error: { reason: 'invalid_ulid' },
    });
  });

  it('never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const result = parseId(value);
        expect(typeof result.ok).toBe('boolean');
      }),
    );
  });
});
