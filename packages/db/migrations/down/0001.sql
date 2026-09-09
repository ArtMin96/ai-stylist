-- Down for 0001_platform_outbox (undoes exactly that expand step).
DROP INDEX IF EXISTS "platform_outbox_pending_idx";
DROP INDEX IF EXISTS "platform_outbox_aggregate_sequence_uq";
DROP TABLE IF EXISTS "platform_outbox";
