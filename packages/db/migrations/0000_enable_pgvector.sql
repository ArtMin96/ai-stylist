-- Custom migration (drizzle-kit generate --custom): enable pgvector so later module schemas can
-- declare vector columns. Idempotent; Neon ships the extension preinstalled.
CREATE EXTENSION IF NOT EXISTS "vector";
