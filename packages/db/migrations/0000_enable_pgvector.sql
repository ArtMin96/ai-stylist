-- Custom migration (drizzle-kit generate --custom): enable pgvector so later module schemas can
-- declare vector columns. Idempotent; the pgvector image ships the extension.
CREATE EXTENSION IF NOT EXISTS "vector";
