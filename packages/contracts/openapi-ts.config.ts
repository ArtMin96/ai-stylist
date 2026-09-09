// @hey-api/openapi-ts configuration: typed fetch client + types from the bundled spec.
// Invoked by tools/codegen/gen-ts.sh (never run the CLI by hand; use `just generate`).
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './gen/openapi.bundle.json',
  output: {
    path: './gen/ts-client',
    clean: true,
    header: [
      '// GENERATED — do not edit. Run `just generate`.',
      '// Source: packages/contracts/openapi/**',
    ],
    module: { extension: '.js' },
  },
  logs: { level: 'warn' },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
    { name: '@hey-api/client-fetch', bundle: true, baseUrl: false },
  ],
});
