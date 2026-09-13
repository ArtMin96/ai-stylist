# apps/api/src/jobs — pg-boss job definitions (T08)

Placeholder: no `pg-boss` dependency yet. T08 adds `index.ts` (composition root for job
handlers, doc 04 §5) registering the `demo-outbox-flow` handler that the outbox relay dispatches
`demo.outbox-flow.requested.v1` to. Handlers import public module APIs only; provider clients are
bound here, never in `modules/**`.
