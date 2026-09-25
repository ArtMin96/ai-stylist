# apps/api/src/jobs — pg-boss job definitions (T08)

Placeholder: no `pg-boss` dependency yet (P02-T08 `NOT_STARTED`). T08 adds `index.ts`
(composition root for job handlers, doc 04 §5) registering the demo handler that the
[outbox relay](../platform/outbox/README.md) dispatches `demo.outbox-flow.requested.v1` to (the
event `POST /v1/dev/demo-events` and `just db-seed` produce today). Handlers run in the API
process (or a dedicated `jobs` process), are idempotent, and follow the retry/DLQ defaults in
doc 04 §9.2. Handlers import public module APIs only; provider clients are bound here, never in
`modules/**`. Until then `just dev-workers` starts only the segmentation worker.
