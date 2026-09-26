-- Down for 0003_pgboss_schema (undoes exactly that expand step). LOSSY: drops every pg-boss
-- object and row (jobs, queues, dead-letter copies, schedules, queue stats). Stop every
-- PgBossQueue/worker first; the next `just db-migrate` reinstalls an empty schema.
DROP SCHEMA IF EXISTS "pgboss" CASCADE;
