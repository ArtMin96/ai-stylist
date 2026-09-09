# apps/api/src/trigger — Trigger.dev task definitions (T08)

Placeholder: no `@trigger.dev/sdk` dependency yet. T08 adds `index.ts` (composition root for
tasks, doc 04 §5) with the `demo-outbox-flow` task that the outbox relay dispatches
`demo.outbox-flow.requested.v1` to. Tasks import public module APIs only; provider clients are
bound here, never in `modules/**`.
