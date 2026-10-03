// FIXTURE: violates domain-no-provider-sdk. The OpenTelemetry SDK, its exporters and
// instrumentations, and @fastify/otel are platform wiring (doc 14 §3); a domain module may use
// @opentelemetry/api only.
import otel from '@fastify/otel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { NodeSDK } from '@opentelemetry/sdk-node';

export const startTracing = (): unknown[] => [otel, OTLPTraceExporter, PgInstrumentation, NodeSDK];
