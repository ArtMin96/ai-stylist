// `--import` entry of the API process (default `service.name` `api`): http, @fastify/otel,
// undici, pg and pino instrumentation. Started before `main.ts`:
//   tsx --import ./src/platform/telemetry/instrument-api.ts src/main.ts
//   node --import ./dist/apps/api/src/platform/telemetry/instrument-api.js dist/apps/api/src/main.js
// No OTLP endpoint in the environment: it does nothing (./register.ts).
import { registerTelemetry } from './register.js';

await registerTelemetry('api', process.env);
