-- Down for 0002_platform_idempotency_keys (undoes exactly that expand step).
DROP INDEX IF EXISTS "platform_idempotency_keys_expires_idx";
DROP TABLE IF EXISTS "platform_idempotency_keys";
