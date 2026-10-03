// `--import` entry of the jobs process (default `service.name` `jobs`): undici, pg and pino
// instrumentation. Started before `jobs/main.ts`:
//   tsx --import ./src/platform/telemetry/instrument-jobs.ts src/jobs/main.ts
//   node --import ./dist/apps/api/src/platform/telemetry/instrument-jobs.js dist/apps/api/src/jobs/main.js
// No OTLP endpoint in the environment: it does nothing (./register.ts).
import { registerTelemetry } from './register.js';

await registerTelemetry('jobs', process.env);
