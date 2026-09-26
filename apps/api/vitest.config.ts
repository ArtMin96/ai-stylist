import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Nest needs TS legacy decorators; Vite's esbuild transform does not emit them, so unplugin-swc
// compiles TS (reading experimentalDecorators/emitDecoratorMetadata from tsconfig.json).
const swcPlugin = swc.vite({ module: { type: 'es6' } });

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    projects: [
      {
        test: {
          name: 'api',
          include: ['src/**/tests/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: ['tests/migrations/**', 'src/platform/tests/**/*.docker.test.ts'],
        },
      },
      {
        // Platform adapters against a real Postgres (Testcontainers: pg-boss queue, outbox relay).
        // Same rule as `migrations`: it FAILS without Docker, never skips.
        test: {
          name: 'platform-docker',
          include: ['src/platform/tests/**/*.docker.test.ts'],
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
      {
        // Testcontainers (Docker) suite. It FAILS without Docker — never skips (brief T07).
        test: {
          name: 'migrations',
          include: ['tests/migrations/**/*.test.ts'],
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
