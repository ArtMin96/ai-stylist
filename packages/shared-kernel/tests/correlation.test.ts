// CORRELATION_ID_HEADER, CORRELATION_ID_KEY and CORRELATION_ID_EXAMPLES come from
// registry/correlation.json, the one source of the names every hop carries the correlation id under
// (planning/14 §2). Schema validation: packages/contracts/tests/kernel-registries.test.ts. The
// vectors are checked against the envelope rule itself in packages/contracts/tests/events.test.ts
// and against each implementation in its own tests.
import { describe, expect, it } from 'vitest';

import registry from '../registry/correlation.json' with { type: 'json' };
import {
  CORRELATION_ID_EXAMPLES,
  CORRELATION_ID_HEADER,
  CORRELATION_ID_KEY,
  FORBIDDEN_LOG_KEY_EXAMPLES,
} from '../src/index.js';

describe('correlation names come from registry/correlation.json', () => {
  it('exports the header and the log key', () => {
    expect(CORRELATION_ID_HEADER).toBe(registry.header);
    expect(CORRELATION_ID_KEY).toBe(registry.logKey);
  });

  it('exports the registry vectors, in order, with no id labelled both ways', () => {
    expect(CORRELATION_ID_EXAMPLES).toEqual(registry.vectors);
    const rejected = new Set(CORRELATION_ID_EXAMPLES.rejected);
    expect(CORRELATION_ID_EXAMPLES.accepted.filter((id) => rejected.has(id))).toEqual([]);
  });

  it('every redaction matcher is tested to keep the header and the log key', () => {
    expect(FORBIDDEN_LOG_KEY_EXAMPLES.allowed).toContain(CORRELATION_ID_HEADER);
    expect(FORBIDDEN_LOG_KEY_EXAMPLES.allowed).toContain(CORRELATION_ID_KEY);
  });
});
