-- Down for 0000_enable_pgvector. Fails if any remaining column still uses the vector type.
DROP EXTENSION IF EXISTS "vector";
