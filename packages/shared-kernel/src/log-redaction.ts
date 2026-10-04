// Error-shape rules for logs and spans (planning/11 §8, planning/14 §2-3): which error class names,
// codes and Nest logger contexts may reach a log line or an exported span, and how many cause links
// of a logged error are followed. A value that fails its shape is replaced (`Error`, or the
// redaction marker for a Nest context), never written.
//
// Data lives in packages/shared-kernel/registry/log-redaction.json (schema beside it). Non-TS
// readers (the Python workers' redaction and tracing modules and their tests) read that JSON
// directly and compile each shape with re.ASCII and a full match; TS code imports these constants.
// Never copy a shape or the depth into a consumer.
//
// The `vectors` in the same file are the labelled values every implementation's tests check:
// `exceptionType.kept` match errorNameShape or codeShape, `exceptionType.replaced` match neither;
// `nestContext.kept` match nestContextShape, `nestContext.redacted` do not. TS tests import
// LOG_REDACTION_EXAMPLES; non-TS tests read the JSON.
import registry from '../registry/log-redaction.json' with { type: 'json' };

export type LogRedactionRules = {
  /** An error class name kept in `err.type` / `exception.type` (identifier, dots, at most 64). */
  readonly errorNameShape: RegExp;
  /** An error code kept in `err.code` / `exception.type` (SQLSTATE or system code, at most 32). */
  readonly codeShape: RegExp;
  /** Cause links of a logged error that are followed; the bound also ends a circular chain. */
  readonly maxCauseDepth: number;
  /** A Nest logger `context` kept as written: a PascalCase class name such as `RoutesResolver`. */
  readonly nestContextShape: RegExp;
};

/** Compiled without flags: each source is anchored and ASCII-only, so `test` is a full match. */
function shape(source: string): RegExp {
  return Object.freeze(new RegExp(source));
}

/** The registry rules, compiled; `.source` of each shape is the registry string. */
export const LOG_REDACTION_RULES: LogRedactionRules = Object.freeze({
  errorNameShape: shape(registry.errorNameShape),
  codeShape: shape(registry.codeShape),
  maxCauseDepth: registry.maxCauseDepth,
  nestContextShape: shape(registry.nestContextShape),
});

export type LogRedactionExamples = {
  readonly exceptionType: {
    /** Values a span sanitizer MUST keep: name-shaped or code-shaped. */
    readonly kept: readonly string[];
    /** Values a span sanitizer MUST replace with `Error`: neither name- nor code-shaped. */
    readonly replaced: readonly string[];
  };
  readonly nestContext: {
    /** Nest logger contexts a logger MUST keep. */
    readonly kept: readonly string[];
    /** Nest logger contexts a logger MUST redact (secrets, stack traces, emails, near-misses). */
    readonly redacted: readonly string[];
  };
};

/** Test vectors for every implementation of the rules; data only, no matching rule lives here. */
export const LOG_REDACTION_EXAMPLES: LogRedactionExamples = Object.freeze({
  exceptionType: Object.freeze({
    kept: Object.freeze([...registry.vectors.exceptionType.kept]),
    replaced: Object.freeze([...registry.vectors.exceptionType.replaced]),
  }),
  nestContext: Object.freeze({
    kept: Object.freeze([...registry.vectors.nestContext.kept]),
    redacted: Object.freeze([...registry.vectors.nestContext.redacted]),
  }),
});
