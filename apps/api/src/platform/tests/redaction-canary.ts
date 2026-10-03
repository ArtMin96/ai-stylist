// The redaction canary's planted values (doc 11 §8, doc 13 §8.1), shared by the in-process canary
// (logger.redaction.test.ts) and the telemetry child process (telemetry-fixture-process.ts), so
// both plant the same markers under every forbidden key.
import { FORBIDDEN_LOG_KEYS } from '../logger.js';

/** Must never reach a log sink, a span or an OTLP export. */
export const CANARY = 'CANARY_SENSITIVE_9f3a';

/** A marker under every forbidden key: top level, nested, inside arrays, and in request shapes. */
export function plant(): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const key of FORBIDDEN_LOG_KEYS) flat[key] = CANARY;
  return {
    ...flat,
    accessToken: CANARY,
    refresh_token: CANARY,
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
