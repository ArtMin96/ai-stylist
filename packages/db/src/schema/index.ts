// Composed Drizzle schema entry (brief §8 #2). Domain tables live in
// apps/api/src/modules/<name>/internal/schema.ts and are re-exported here once they exist so
// drizzle-kit sees one schema and one migration stream (planning/06 §7).
export * from './platform.js';
