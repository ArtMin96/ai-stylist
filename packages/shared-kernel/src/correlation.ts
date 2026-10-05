// Correlation id propagation (planning/14 §2): one id per logical operation, carried client → API →
// outbox envelope (`correlationId`) → pg-boss job → worker. These are the names every hop uses for
// it; which ids are valid is the event envelope's `correlationId` rule
// (packages/contracts/events/envelope.json), which this package does not restate.
//
// Data lives in packages/shared-kernel/registry/correlation.json (schema beside it). TS code imports
// these constants; the Python workers read the generated ai_stylist_generated.kernel (`just
// generate`, tools/codegen/gen-kernel.mjs python), which also carries the envelope rule. Never copy
// a name into a consumer.
//
// The `vectors` in the same file are the labelled ids every check of the envelope rule (the
// envelope schema, the API header, the worker header) is tested against. TS tests import
// CORRELATION_ID_EXAMPLES; Python tests use the generated vectors.
import registry from '../registry/correlation.json' with { type: 'json' };

/** Request and response header carrying the id (lowercase, as Node exposes incoming headers). */
export const CORRELATION_ID_HEADER: string = registry.header;

/** Log key and span attribute name the id is written under. */
export const CORRELATION_ID_KEY: string = registry.logKey;

export type CorrelationIdExamples = {
  /** Ids every check of the envelope's `correlationId` rule MUST accept. */
  readonly accepted: readonly string[];
  /** Ids every check MUST reject (bounds, separators, newlines, non-ASCII letters and digits). */
  readonly rejected: readonly string[];
};

/** Test vectors for every correlation id check; data only, no matching rule lives here. */
export const CORRELATION_ID_EXAMPLES: CorrelationIdExamples = Object.freeze({
  accepted: Object.freeze([...registry.vectors.accepted]),
  rejected: Object.freeze([...registry.vectors.rejected]),
});
