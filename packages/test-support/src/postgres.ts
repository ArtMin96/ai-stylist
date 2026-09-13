import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/** Same image as docker-compose.yml and CI (production PostgreSQL major + pgvector). */
export const POSTGRES_TEST_IMAGE = 'pgvector/pgvector:pg17';

export type StartedPostgres = {
  /** Connection string for the throwaway database. */
  readonly url: string;
  stop(): Promise<void>;
};

/**
 * Start a throwaway Postgres (pgvector) via Testcontainers. Requires a reachable Docker daemon:
 * when there is none this THROWS with an explicit message — callers must fail, never skip
 * (brief §7 T07: integration suites run wherever Docker is, and are red elsewhere).
 */
export async function startPostgres(): Promise<StartedPostgres> {
  let container: StartedPostgreSqlContainer;
  try {
    container = await new PostgreSqlContainer(POSTGRES_TEST_IMAGE)
      .withDatabase('ai_stylist_test')
      .withUsername('ai_stylist')
      .withPassword('ai_stylist')
      .start();
  } catch (cause) {
    throw new Error(
      'startPostgres: could not start a Testcontainers Postgres. Docker must be running and ' +
        `reachable (DOCKER_HOST / /var/run/docker.sock) with image ${POSTGRES_TEST_IMAGE}. ` +
        `Cause: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
  return {
    url: container.getConnectionUri(),
    stop: async () => {
      await container.stop();
    },
  };
}
