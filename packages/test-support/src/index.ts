// Shared test builders/fakes (root CLAUDE.md "Testing rules": reuse, never duplicate).
export { POSTGRES_TEST_IMAGE, type StartedPostgres, startPostgres } from './postgres.js';
export { type MemoryLogStream, memoryLogStream } from './log-stream.js';
export { type FakeClock, fakeClock } from './clock.js';
