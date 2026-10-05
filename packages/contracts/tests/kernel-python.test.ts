// Pins the Python kernel that tools/codegen/gen-kernel.mjs (`python`, run by gen-python.sh) writes
// into workers/ml/generated/ai_stylist_generated/kernel to the shared-kernel JSON registries it is
// generated from (DEC-55), and its correlation id rule to the event envelope schema. A hand edit of the generated module or a skipped `just generate` fails
// here as well as in `just generate --check`. The module is imported by a real Python interpreter
// (`$PYTHON`, default `python3`; stdlib only), so the compiled `re.ASCII` patterns are checked
// against every labelled vector with Python's own `fullmatch`, not just compared as text.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type Vectors = Record<string, Record<string, string[]>>;
type LogRedaction = {
  errorNameShape: string;
  codeShape: string;
  maxCauseDepth: number;
  nestContextShape: string;
  vectors: Vectors;
};
type Correlation = {
  header: string;
  logKey: string;
  vectors: { accepted: string[]; rejected: string[] };
};
type CorrelationIdRule = { pattern: string; minLength: number; maxLength: number };

async function readRegistry<T>(file: string): Promise<T> {
  const url = new URL(`../../shared-kernel/registry/${file}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8')) as T;
}

const forbiddenKeys = await readRegistry<{ keys: string[] }>('forbidden-log-keys.json');
const examples = await readRegistry<{ forbidden: string[]; allowed: string[] }>(
  'forbidden-log-keys.examples.json',
);
const redaction = await readRegistry<LogRedaction>('log-redaction.json');
const correlation = await readRegistry<Correlation>('correlation.json');
const envelope = JSON.parse(
  await readFile(new URL('../events/envelope.json', import.meta.url), 'utf8'),
) as { properties: { correlationId: CorrelationIdRule } };
const idRule = envelope.properties.correlationId;

const GENERATED = fileURLToPath(new URL('../../../workers/ml/generated', import.meta.url));

// Dumps the generated module as JSON, plus Python's own verdict for every vector.
const DUMP = `
import json, re
import ai_stylist_generated.kernel as k

def kept(value, *shapes):
    return any(s.fullmatch(value) is not None for s in shapes)

shapes = {n: getattr(k, n) for n in ("ERROR_NAME_SHAPE", "CODE_SHAPE", "NEST_CONTEXT_SHAPE")}

def valid_id(value):
    return (
        k.CORRELATION_ID_MIN_LENGTH <= len(value) <= k.CORRELATION_ID_MAX_LENGTH
        and k.CORRELATION_ID_PATTERN.fullmatch(value) is not None
    )
print(json.dumps({
    "all": sorted(k.__all__),
    "forbiddenKeys": sorted(k.FORBIDDEN_LOG_KEYS),
    "forbiddenKeysType": type(k.FORBIDDEN_LOG_KEYS).__name__,
    "examplesForbidden": list(k.FORBIDDEN_LOG_KEY_EXAMPLES_FORBIDDEN),
    "examplesAllowed": list(k.FORBIDDEN_LOG_KEY_EXAMPLES_ALLOWED),
    "shapes": {n: s.pattern for n, s in shapes.items()},
    "ascii": {n: bool(s.flags & re.ASCII) for n, s in shapes.items()},
    "maxCauseDepth": k.MAX_CAUSE_DEPTH,
    "vectors": {
        "exceptionType": {"kept": list(k.EXCEPTION_TYPE_KEPT), "replaced": list(k.EXCEPTION_TYPE_REPLACED)},
        "nestContext": {"kept": list(k.NEST_CONTEXT_KEPT), "redacted": list(k.NEST_CONTEXT_REDACTED)},
    },
    "verdicts": {
        "exceptionType": {
            "kept": [kept(v, k.ERROR_NAME_SHAPE, k.CODE_SHAPE) for v in k.EXCEPTION_TYPE_KEPT],
            "replaced": [kept(v, k.ERROR_NAME_SHAPE, k.CODE_SHAPE) for v in k.EXCEPTION_TYPE_REPLACED],
        },
        "nestContext": {
            "kept": [kept(v, k.NEST_CONTEXT_SHAPE) for v in k.NEST_CONTEXT_KEPT],
            "redacted": [kept(v, k.NEST_CONTEXT_SHAPE) for v in k.NEST_CONTEXT_REDACTED],
        },
    },
    "correlation": {
        "header": k.CORRELATION_ID_HEADER,
        "logKey": k.CORRELATION_ID_KEY,
        "pattern": k.CORRELATION_ID_PATTERN.pattern,
        "ascii": bool(k.CORRELATION_ID_PATTERN.flags & re.ASCII),
        "minLength": k.CORRELATION_ID_MIN_LENGTH,
        "maxLength": k.CORRELATION_ID_MAX_LENGTH,
        "vectors": {
            "accepted": list(k.CORRELATION_ID_ACCEPTED),
            "rejected": list(k.CORRELATION_ID_REJECTED),
        },
        "verdicts": {
            "accepted": [valid_id(v) for v in k.CORRELATION_ID_ACCEPTED],
            "rejected": [valid_id(v) for v in k.CORRELATION_ID_REJECTED],
        },
    },
}))
`;

type Dump = {
  all: string[];
  forbiddenKeys: string[];
  forbiddenKeysType: string;
  examplesForbidden: string[];
  examplesAllowed: string[];
  shapes: Record<string, string>;
  ascii: Record<string, boolean>;
  maxCauseDepth: number;
  vectors: Vectors;
  verdicts: Record<string, Record<string, boolean[]>>;
  correlation: {
    header: string;
    logKey: string;
    pattern: string;
    ascii: boolean;
    minLength: number;
    maxLength: number;
    vectors: Correlation['vectors'];
    verdicts: { accepted: boolean[]; rejected: boolean[] };
  };
};

function dumpGeneratedKernel(): Dump {
  const python = process.env.PYTHON ?? 'python3';
  const res = spawnSync(python, ['-B', '-W', 'error', '-c', DUMP], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: GENERATED, PYTHONDONTWRITEBYTECODE: '1' },
  });
  if (res.error) throw new Error(`${python}: ${res.error.message} (set PYTHON to a Python 3)`);
  if (res.status !== 0) throw new Error(`${python} exited ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout) as Dump;
}

describe('workers/ml/generated kernel matches packages/shared-kernel/registry', () => {
  const dump = dumpGeneratedKernel();

  it('FORBIDDEN_LOG_KEYS is a frozenset of exactly the registry words', () => {
    expect(dump.forbiddenKeysType).toBe('frozenset');
    expect(dump.forbiddenKeys).toEqual([...forbiddenKeys.keys].sort());
  });

  it('the word-split examples, in order', () => {
    expect(dump.examplesForbidden).toEqual(examples.forbidden);
    expect(dump.examplesAllowed).toEqual(examples.allowed);
  });

  it('the shapes are the registry sources verbatim, compiled with re.ASCII, and the depth', () => {
    expect(dump.shapes).toEqual({
      ERROR_NAME_SHAPE: redaction.errorNameShape,
      CODE_SHAPE: redaction.codeShape,
      NEST_CONTEXT_SHAPE: redaction.nestContextShape,
    });
    expect(dump.ascii).toEqual({
      ERROR_NAME_SHAPE: true,
      CODE_SHAPE: true,
      NEST_CONTEXT_SHAPE: true,
    });
    expect(dump.maxCauseDepth).toBe(redaction.maxCauseDepth);
  });

  it('the vectors, in order, and Python classifies each one as labelled', () => {
    expect(dump.vectors).toEqual(redaction.vectors);
    const { exceptionType, nestContext } = dump.verdicts;
    expect(exceptionType!.kept!.every(Boolean)).toBe(true);
    expect(exceptionType!.replaced!.some(Boolean)).toBe(false);
    expect(nestContext!.kept!.every(Boolean)).toBe(true);
    expect(nestContext!.redacted!.some(Boolean)).toBe(false);
  });

  it('the correlation header and log key are the registry names', () => {
    expect(dump.correlation.header).toBe(correlation.header);
    expect(dump.correlation.logKey).toBe(correlation.logKey);
  });

  it("the correlation id rule is the envelope schema's, the pattern compiled with re.ASCII", () => {
    expect(dump.correlation.pattern).toBe(idRule.pattern);
    expect(dump.correlation.ascii).toBe(true);
    expect(dump.correlation.minLength).toBe(idRule.minLength);
    expect(dump.correlation.maxLength).toBe(idRule.maxLength);
  });

  it('the correlation vectors, in order, and Python classifies each one as labelled', () => {
    expect(dump.correlation.vectors).toEqual(correlation.vectors);
    expect(dump.correlation.verdicts.accepted.every(Boolean)).toBe(true);
    expect(dump.correlation.verdicts.rejected.some(Boolean)).toBe(false);
  });

  it('exports every constant from the package', () => {
    expect(dump.all).toEqual(
      [
        'CODE_SHAPE',
        'CORRELATION_ID_ACCEPTED',
        'CORRELATION_ID_HEADER',
        'CORRELATION_ID_KEY',
        'CORRELATION_ID_MAX_LENGTH',
        'CORRELATION_ID_MIN_LENGTH',
        'CORRELATION_ID_PATTERN',
        'CORRELATION_ID_REJECTED',
        'ERROR_NAME_SHAPE',
        'EXCEPTION_TYPE_KEPT',
        'EXCEPTION_TYPE_REPLACED',
        'FORBIDDEN_LOG_KEYS',
        'FORBIDDEN_LOG_KEY_EXAMPLES_ALLOWED',
        'FORBIDDEN_LOG_KEY_EXAMPLES_FORBIDDEN',
        'MAX_CAUSE_DEPTH',
        'NEST_CONTEXT_KEPT',
        'NEST_CONTEXT_REDACTED',
        'NEST_CONTEXT_SHAPE',
      ].sort(),
    );
  });
});
