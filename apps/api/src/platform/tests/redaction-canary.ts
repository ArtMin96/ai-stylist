// The redaction canary's planted values (doc 11 §8, doc 13 §8.1), shared by the in-process canary
// (logger.redaction.test.ts) and the telemetry child process (telemetry-fixture-process.ts), so
// both plant the same markers under every forbidden key. The keys come from the shared-kernel
// registry: each word, and each word-split example every matcher must catch, so a key added there
// is planted here without an edit.
import { FORBIDDEN_LOG_KEYS, FORBIDDEN_LOG_KEY_EXAMPLES } from '@ai-stylist/shared-kernel';

/** Must never reach a log sink, a span or an OTLP export. */
export const CANARY = 'CANARY_SENSITIVE_9f3a';

/**
 * An `OTEL_RESOURCE_ATTRIBUTES` value planting the marker in the process resource, which spans,
 * metrics and log records all carry: under a forbidden word, in a URL's query and fragment, and
 * under a dropped attribute (`=` inside a value is percent-encoded, as the variable requires).
 * `service.namespace` is the legitimate attribute that must survive.
 */
export const PLANTED_RESOURCE_ATTRIBUTES = [
  'service.namespace=ai-stylist',
  `deploy.api_token=${CANARY}`,
  `url.full=https://deploy.example/hook?sig%3D${CANARY}%23${CANARY}`,
  `user_agent.original=${CANARY}`,
].join(',');

/** A marker under every forbidden key: top level, nested, inside arrays, and in request shapes. */
export function plant(): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const key of FORBIDDEN_LOG_KEYS) flat[key] = CANARY;
  for (const key of FORBIDDEN_LOG_KEY_EXAMPLES.forbidden) flat[key] = CANARY;
  return {
    ...flat,
    // Two variants the registry examples do not carry.
    'x-api-token': CANARY,
    imageBase64: CANARY,
    faceGeometry: { landmarks: [CANARY] },
    user: { email: CANARY, profile: { measurements: { height: CANARY }, id: 'usr_ok' } },
    items: [{ photo: CANARY }, [{ selfie: CANARY }]],
    req: {
      headers: { authorization: CANARY },
      body: { password: CANARY },
      url: `/x?token=${CANARY}`,
    },
    safe: 'visible-value',
  };
}
